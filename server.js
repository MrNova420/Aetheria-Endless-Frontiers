#!/usr/bin/env node
/**
 * Aetheria: Endless Frontiers — Game Server
 *
 * WebSocket + HTTP multiplayer server with admin REST API, mesh networking,
 * persistent state, and rate limiting.
 *
 * Compatible with: standard Node.js >=18, Android/Termux, Raspberry Pi, VPS
 *
 * Usage:
 *   node server.js                    # default port 8080
 *   PORT=3000 node server.js          # custom port
 *   ADMIN_TOKEN=secret node server.js # set admin password
 *   MESH_PEERS=ws://other:8080 node server.js
 */

'use strict';

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const crypto  = require('crypto');

// ── Optional deps (ws, express) ───────────────────────────────────────────────
let WebSocket, WebSocketServer, express;
try { ({ WebSocket, Server: WebSocketServer } = require('ws')); } catch (_) {}
try { express = require('express'); } catch (_) {}

// ── Config ────────────────────────────────────────────────────────────────────
const PORT         = parseInt(process.env.PORT || '8080', 10);
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN  || 'aetheria_admin';
const MAX_PLAYERS  = parseInt(process.env.MAX_PLAYERS || '50', 10);
const MESH_PEERS   = (process.env.MESH_PEERS || '').split(',').filter(Boolean);
const ROOT         = __dirname;

// ── External storage detection (USB/SSD on Android/Termux/Linux) ─────────────
//
// Priority order:
//   1. DATA_DIR env var   — explicit override (e.g. DATA_DIR=/mnt/usb/aetheria)
//   2. Auto-detected USB  — first writable path from ANDROID_USB_PATHS
//   3. Internal fallback  — <game dir>/data
//
// When an external drive is unplugged the server transparently continues with
// the internal fallback.  On re-plug it detects and migrates back within 30s.
//
const ANDROID_USB_PATHS = [
  // Termux — common Android USB OTG / SD-card mount points
  '/storage/emulated/0/AetheriaData',          // Android internal shared (always available)
  '/storage/self/primary/AetheriaData',
  '/mnt/media_rw/usbotg/AetheriaData',         // USB OTG (most ROMs)
  '/mnt/media_rw/usb/AetheriaData',
  '/mnt/usb_storage/AetheriaData',
  '/mnt/usbdisk/AetheriaData',
  '/mnt/usb/AetheriaData',
  '/storage/usbotg/AetheriaData',
  '/storage/usb/AetheriaData',
  // Linux desktop — common USB mount points
  '/media/' + (os.userInfo?.()?.username || 'user') + '/AetheriaData',
  '/run/media/' + (os.userInfo?.()?.username || 'user') + '/AetheriaData',
];

function detectExternalStorage() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  for (const p of ANDROID_USB_PATHS) {
    try {
      // Ensure the directory exists (create it) and is writable
      fs.mkdirSync(p, { recursive: true });
      fs.accessSync(p, fs.constants.W_OK);
      return p;
    } catch (_) {}
  }
  return null;
}

let DATA_DIR        = detectExternalStorage() || path.join(ROOT, 'data');
let _usingExternal  = DATA_DIR !== path.join(ROOT, 'data');
let _lastStorageCheck = 0;

function ensureDataDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); return true; }
  catch (_) { return false; }
}
ensureDataDir(DATA_DIR);

// ── Hot-plug watcher — re-scan storage every 30s ──────────────────────────────
function checkStorageHotPlug() {
  const now = Date.now();
  if (now - _lastStorageCheck < 30000) return;
  _lastStorageCheck = now;

  const preferred = detectExternalStorage();
  const internal  = path.join(ROOT, 'data');

  if (preferred && preferred !== DATA_DIR) {
    // External storage appeared — migrate to it
    log(`⚡ External storage detected: ${preferred} — migrating data…`);
    try {
      // Copy any existing data files across
      if (fs.existsSync(DATA_DIR)) {
        for (const f of fs.readdirSync(DATA_DIR)) {
          const src = path.join(DATA_DIR, f);
          const dst = path.join(preferred, f);
          if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
        }
      }
      DATA_DIR = preferred;
      ensureDataDir(DATA_DIR);
      _usingExternal = true;
      log(`✅ Now using external storage: ${DATA_DIR}`);
    } catch (err) {
      log(`⚠ Migration failed (${err.message}) — staying on ${DATA_DIR}`);
    }
  } else if (!preferred && _usingExternal) {
    // External storage unplugged — fall back to internal
    log('⚠ External storage unavailable — falling back to internal storage.');
    DATA_DIR = internal;
    ensureDataDir(DATA_DIR);
    _usingExternal = false;
  }
}

// ── Ensure data dir ───────────────────────────────────────────────────────────
ensureDataDir(path.join(ROOT, 'data')); // always keep internal dir as fallback

// ── State ─────────────────────────────────────────────────────────────────────
/** @type {Map<string, {ws,id,name,pos,hp,state,ip,joinedAt,lastSeen,godMode}>} */
const players     = new Map();
const bannedIPs   = new Set();
const chatHistory = [];         // last 100 messages
let   buildings   = loadJSON('buildings.json', []);
let   universe    = loadJSON('universe.json', { systems: [], visitedCount: 0 });
const serverStart = Date.now();
const logs        = [];         // last 100 log lines
const rateCounts  = new Map();  // clientId → {count, reset}
const meshPeers   = new Map();  // url → WebSocket

let broadcastInterval = null;

// ── Live banner player count ──────────────────────────────────────────────────
// Tracks how many terminal rows the cursor is below the Players banner line.
// Incremented on every log() call; set to null once the banner has scrolled
// off-screen so we stop issuing cursor-movement escapes.
let _rowsBelowPlayerLine = null;

/** Width of the banner box interior (number of ═ in the top border). */
const BANNER_CONTENT_WIDTH = 58;
/** Fallback terminal height when process.stdout.rows is unavailable. */
const DEFAULT_TERMINAL_ROWS = 24;

/** Build the canonical Players line string, padded to fit the banner box. */
function _playerCountLine() {
  const content = `  Players → ${players.size} / ${MAX_PLAYERS}`;
  return `║${content.padEnd(BANNER_CONTENT_WIDTH)}║`;
}

/**
 * Rewrite the Players line in the banner in-place using ANSI cursor movement.
 * Only active on TTY stdout while the banner is still visible on-screen.
 */
function refreshPlayerCount() {
  if (!process.stdout.isTTY || _rowsBelowPlayerLine === null) return;
  // Disable once the banner has scrolled past the top of the visible terminal.
  const termRows = process.stdout.rows || DEFAULT_TERMINAL_ROWS;
  if (_rowsBelowPlayerLine >= termRows) { _rowsBelowPlayerLine = null; return; }
  const N = _rowsBelowPlayerLine;
  process.stdout.write(
    `\x1b[${N}A` +   // cursor up N rows → Players line
    `\r\x1b[2K` +    // carriage-return + clear entire line
    _playerCountLine() +
    `\x1b[${N}B` +   // cursor down N rows → back to current position
    `\r`             // carriage-return to column 0
  );
}

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  if (_rowsBelowPlayerLine !== null) _rowsBelowPlayerLine++;
  logs.push(line);
  if (logs.length > 100) logs.shift();
}

// ── Persistence ───────────────────────────────────────────────────────────────
function loadJSON(name, def) {
  checkStorageHotPlug(); // opportunistically check hot-plug on every read
  const fp = path.join(DATA_DIR, name);
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { return def; }
}

function saveJSON(name, data) {
  checkStorageHotPlug();
  const fp = path.join(DATA_DIR, name);
  try { fs.writeFileSync(fp, JSON.stringify(data, null, 2)); } catch (e) { log('Save error: ' + e.message); }
}

function saveState() {
  saveJSON('buildings.json', buildings);
  saveJSON('universe.json', universe);
  log(`State saved → ${DATA_DIR}${_usingExternal ? ' (external)' : ' (internal)'}`);
}

// ── Per-player profile persistence ───────────────────────────────────────────
function savePlayerProfile(session) {
  if (!session?.id) return;
  const safe = session.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const data = {
    id:       session.id,
    name:     session.name,
    lastSeen: session.lastSeen,
    joinedAt: session.joinedAt,
    pos:      session.pos,
    hp:       session.hp,
    state:    session.state,
    // game data stored in browser localStorage, but server keeps position/stats
  };
  const dir = path.join(DATA_DIR, 'players');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${safe}.json`), JSON.stringify(data, null, 2));
  } catch (e) {
    log(`Profile save error (${session.id}): ${e.message}`);
  }
}

function loadPlayerProfile(id) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fp = path.join(DATA_DIR, 'players', `${safe}.json`);
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { return null; }
}

function listPlayerProfiles() {
  const dir = path.join(DATA_DIR, 'players');
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch(_){return null;} })
      .filter(Boolean);
  } catch (_) { return []; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLocalIP() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    }
  }
  return ips.length ? ips : ['127.0.0.1'];
}

function makeId() {
  return crypto.randomBytes(6).toString('hex');
}

function broadcast(msg, excludeId = null) {
  const raw = JSON.stringify(msg);
  for (const [id, session] of players) {
    if (id === excludeId) continue;
    if (session.ws.readyState === 1) {
      try { session.ws.send(raw); } catch (_) {}
    }
  }
}

function broadcastToMesh(msg) {
  const raw = JSON.stringify(msg);
  for (const ws of meshPeers.values()) {
    if (ws.readyState === 1) {
      try { ws.send(raw); } catch (_) {}
    }
  }
}

function checkRateLimit(id) {
  const now = Date.now();
  let r = rateCounts.get(id);
  if (!r || now > r.reset) { r = { count: 0, reset: now + 1000 }; rateCounts.set(id, r); }
  r.count++;
  return r.count <= 100;
}

function addChat(id, name, text) {
  const msg = { playerId: id, name, text, timestamp: Date.now() };
  chatHistory.push(msg);
  if (chatHistory.length > 100) chatHistory.shift();
  return msg;
}

// ── HTTP / Express server ─────────────────────────────────────────────────────
let app, httpServer;
const MIME = {
  '.html':'text/html;charset=utf-8', '.js':'application/javascript;charset=utf-8',
  '.mjs':'application/javascript;charset=utf-8', '.css':'text/css;charset=utf-8',
  '.json':'application/json;charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.mp3':'audio/mpeg',
};

if (express) {
  app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ── Admin REST endpoints ───────────────────────────────────────────────────
  function requireToken(req, res) {
    const t = req.query.token || req.body?.token;
    if (t !== ADMIN_TOKEN) { res.status(403).json({ error: 'Invalid token' }); return false; }
    return true;
  }

  app.get('/admin/status', (req, res) => {
    if (!requireToken(req, res)) return;
    res.json({
      uptime:      Math.floor((Date.now() - serverStart) / 1000),
      playerCount: players.size,
      buildingCount: buildings.length,
      meshPeers:   MESH_PEERS.length,
      connectedPeers: meshPeers.size,
      version:     '1.0.0',
    });
  });

  app.get('/admin/players', (req, res) => {
    if (!requireToken(req, res)) return;
    res.json(Array.from(players.values()).map(s => ({
      id: s.id, name: s.name, pos: s.pos, hp: s.hp, state: s.state,
      ip: s.ip, joinedAt: s.joinedAt, lastSeen: s.lastSeen, godMode: s.godMode,
    })));
  });

  app.get('/admin/buildings', (req, res) => {
    if (!requireToken(req, res)) return;
    res.json(buildings);
  });

  app.get('/admin/chat', (req, res) => {
    if (!requireToken(req, res)) return;
    res.json(chatHistory.slice(-50));
  });

  app.get('/admin/logs', (req, res) => {
    if (!requireToken(req, res)) return;
    res.json(logs.slice(-20));
  });

  app.post('/admin/kick', (req, res) => {
    if (!requireToken(req, res)) return;
    const { playerId, reason } = req.body;
    const session = players.get(playerId);
    if (!session) return res.status(404).json({ error: 'Player not found' });
    session.ws.send(JSON.stringify({ type: 'kick', reason: reason || 'Kicked by admin' }));
    session.ws.terminate();
    players.delete(playerId);
    refreshPlayerCount();
    log(`Admin kicked player ${playerId}`);
    res.json({ ok: true });
  });

  app.post('/admin/ban', (req, res) => {
    if (!requireToken(req, res)) return;
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'Missing ip' });
    bannedIPs.add(ip);
    // Kick any matching sessions
    for (const [id, s] of players) {
      if (s.ip === ip) { try { s.ws.terminate(); } catch (_) {} players.delete(id); }
    }
    refreshPlayerCount();
    log(`Admin banned IP ${ip}`);
    res.json({ ok: true });
  });

  app.post('/admin/announce', (req, res) => {
    if (!requireToken(req, res)) return;
    const { text, severity } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });
    broadcast({ type: 'announce', text, severity: severity || 'info' });
    log(`Admin announced: ${text}`);
    res.json({ ok: true });
  });

  app.post('/admin/remove-building', (req, res) => {
    if (!requireToken(req, res)) return;
    const { buildingId } = req.body;
    const before = buildings.length;
    buildings = buildings.filter(b => b.id !== buildingId);
    if (buildings.length < before) {
      broadcast({ type: 'build', action: 'remove', building: { id: buildingId } });
      saveJSON('buildings.json', buildings);
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: 'Building not found' });
    }
  });

  // Serve admin panel
  app.get('/admin', (req, res) => {
    const fp = path.join(ROOT, 'admin.html');
    if (fs.existsSync(fp)) res.sendFile(fp);
    else res.status(404).send('admin.html not found');
  });

  // Serve static game files
  app.use((req, res) => {
    let rawPath;
    try { rawPath = decodeURIComponent(req.path); } catch (_) { return res.status(400).send('Bad Request'); }
    if (/[^a-zA-Z0-9/_\-.]/.test(rawPath) || rawPath.split('/').some(s => s === '..'))
      return res.status(403).send('Forbidden');
    const safePath = rawPath.replace(/^\//, '') || 'index.html';
    const filePath = path.resolve(ROOT, safePath);
    if (!filePath.startsWith(ROOT)) return res.status(403).send('Forbidden');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not Found');
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(filePath);
  });

  httpServer = http.createServer(app);
} else {
  // Fallback: plain http server without express
  httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const safePath = (req.url.split('?')[0].replace(/^\//, '') || 'index.html').replace(/\.\./g, '');
    const filePath = path.resolve(ROOT, safePath);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not Found'); }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
}

// ── WebSocket server ──────────────────────────────────────────────────────────
if (!WebSocketServer) {
  log('WARNING: "ws" package not found. Run: npm install ws express uuid');
  log('Starting HTTP-only mode (no multiplayer).');
  httpServer.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    printBanner(ip);
  });
  return;
}

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
           || req.socket.remoteAddress || 'unknown';

  if (bannedIPs.has(ip)) { ws.close(1008, 'Banned'); return; }
  if (players.size >= MAX_PLAYERS) { ws.close(1013, 'Server full'); return; }

  const tempId = makeId();
  ws.playerId = tempId;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    if (!checkRateLimit(ws.playerId)) {
      ws.send(JSON.stringify({ type: 'announce', text: 'Rate limit exceeded.', severity: 'warn' }));
      return;
    }

    switch (msg.type) {
      case 'join': {
        const id   = msg.id || makeId();
        const name = (msg.name || 'Traveller').slice(0, 32);
        ws.playerId = id;

        const session = {
          ws, id, name, ip,
          pos:       { x: 0, y: 0, z: 0 },
          rot:       { y: 0 },
          hp:        100,
          state:     'idle',
          joinedAt:  Date.now(),
          lastSeen:  Date.now(),
          godMode:   false,
        };
        players.set(id, session);

        // Live-update the Players line in the banner
        refreshPlayerCount();

        // Welcome the new player
        ws.send(JSON.stringify({
          type: 'welcome', playerId: id, playerCount: players.size,
          buildings, universe,
        }));

        // Send recent chat
        if (chatHistory.length) {
          ws.send(JSON.stringify({ type: 'chat_history', messages: chatHistory.slice(-20) }));
        }

        // Notify others
        broadcast({ type: 'player_join', id, name, playerCount: players.size }, id);

        const chatMsg = addChat('server', 'Server', `${name} joined the universe.`);
        broadcast({ type: 'chat', ...chatMsg });
        log(`Player joined: ${name} (${id}) from ${ip}`);
        break;
      }

      case 'state': {
        const session = players.get(ws.playerId);
        if (!session) return;
        session.pos      = msg.pos      || session.pos;
        session.rot      = msg.rot      || session.rot;
        session.hp       = msg.hp       ?? session.hp;
        session.state    = msg.state    || session.state;
        session.lastSeen = Date.now();
        break;
      }

      case 'build': {
        const session = players.get(ws.playerId);
        if (!session) return;
        if (msg.action === 'place' && msg.building) {
          buildings.push({ ...msg.building, placedBy: ws.playerId });
          broadcast({ type: 'build', action: 'place', building: msg.building }, ws.playerId);
          broadcastToMesh({ type: 'build', action: 'place', building: msg.building });
        } else if (msg.action === 'remove' && msg.building?.id) {
          buildings = buildings.filter(b => b.id !== msg.building.id);
          broadcast({ type: 'build', action: 'remove', building: msg.building }, ws.playerId);
        }
        break;
      }

      case 'chat': {
        const session = players.get(ws.playerId);
        if (!session) return;
        const text = (msg.text || '').slice(0, 256);
        const chatMsg = addChat(session.id, session.name, text);
        broadcast({ type: 'chat', id: chatMsg.playerId, name: chatMsg.name, text, timestamp: chatMsg.timestamp });
        broadcastToMesh({ type: 'chat', id: chatMsg.playerId, name: chatMsg.name, text, timestamp: chatMsg.timestamp });
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
        break;
      }

      case 'warp': {
        const session = players.get(ws.playerId);
        if (!session) return;
        universe.visitedCount = (universe.visitedCount || 0) + 1;
        broadcast({ type: 'warp', id: ws.playerId, name: session.name, systemId: msg.systemId }, ws.playerId);
        break;
      }

      case 'admin': {
        if (msg.token !== ADMIN_TOKEN) return;
        handleAdminCommand(ws.playerId, msg.cmd, msg.args);
        break;
      }
    }
  });

  ws.on('close', () => {
    const session = players.get(ws.playerId);
    if (session) {
      broadcast({ type: 'player_leave', id: session.id, name: session.name });
      const chatMsg = addChat('server', 'Server', `${session.name} left.`);
      broadcast({ type: 'chat', ...chatMsg });
      log(`Player left: ${session.name} (${session.id})`);
      players.delete(ws.playerId);
      // Live-update the Players line in the banner
      refreshPlayerCount();
    }
  });

  ws.on('error', err => log(`WS error for ${ws.playerId}: ${err.message}`));
});

function handleAdminCommand(fromId, cmd, args) {
  switch (cmd) {
    case 'kick': {
      const target = players.get(args?.targetId);
      if (target) {
        target.ws.send(JSON.stringify({ type: 'kick', reason: args?.reason || 'Kicked' }));
        target.ws.terminate();
        players.delete(args.targetId);
        refreshPlayerCount();
        log(`Admin (${fromId}) kicked ${args.targetId}`);
      }
      break;
    }
    case 'announce': {
      broadcast({ type: 'announce', text: args?.text || '', severity: args?.severity || 'info' });
      log(`Admin (${fromId}) announced: ${args?.text}`);
      break;
    }
    case 'god_mode': {
      const target = players.get(args?.targetId);
      if (target) { target.godMode = !target.godMode; log(`God mode ${target.godMode} for ${args.targetId}`); }
      break;
    }
    case 'get_stats': {
      const sender = players.get(fromId);
      if (sender) {
        sender.ws.send(JSON.stringify({
          type: 'admin_stats',
          players: players.size,
          buildings: buildings.length,
          uptime: Math.floor((Date.now() - serverStart) / 1000),
        }));
      }
      break;
    }
  }
}

// ── Broadcast player states at 20 Hz ─────────────────────────────────────────
broadcastInterval = setInterval(() => {
  if (!players.size) return;
  const list = Array.from(players.values()).map(s => ({
    id: s.id, name: s.name, pos: s.pos, rot: s.rot, hp: s.hp, state: s.state,
  }));
  broadcast({ type: 'players', players: list });
}, 50);

// ── Heartbeat / inactivity check ──────────────────────────────────────────────
setInterval(() => {
  const now     = Date.now();
  const timeout = 30000;
  for (const [id, s] of players) {
    if (now - s.lastSeen > timeout) {
      log(`Timeout: ${s.name} (${id})`);
      try { s.ws.terminate(); } catch (_) {}
      players.delete(id);
      broadcast({ type: 'player_leave', id, name: s.name });
      refreshPlayerCount();
    }
  }
}, 5000);

// ── Periodic state save ───────────────────────────────────────────────────────
setInterval(saveState, 60000);

// ── Mesh networking ───────────────────────────────────────────────────────────
function connectMeshPeer(url) {
  if (!WebSocket) return;
  log(`Connecting to mesh peer: ${url}`);
  const ws = new WebSocket(url);
  ws.on('open', () => {
    meshPeers.set(url, ws);
    log(`Mesh peer connected: ${url}`);
    ws.send(JSON.stringify({ type: 'mesh_hello', peerId: getLocalIP()[0] + ':' + PORT }));
  });
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch (_) { return; }
    // Relay messages from mesh peers to local players
    if (msg.type === 'players') broadcast(msg);
    if (msg.type === 'chat')    broadcast(msg);
    if (msg.type === 'build')   { broadcast(msg); if (msg.action === 'place') buildings.push(msg.building); }
  });
  ws.on('close', () => {
    meshPeers.delete(url);
    log(`Mesh peer disconnected: ${url}. Reconnecting in 10s...`);
    setTimeout(() => connectMeshPeer(url), 10000);
  });
  ws.on('error', () => {});
}

for (const peer of MESH_PEERS) connectMeshPeer(peer);

// ── Start HTTP server ─────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  printBanner(ip);
});

function printBanner(ips) {
  const ipList = Array.isArray(ips) ? ips : [ips];
  const pad = s => s.padEnd(42);
  const networkLines = ipList.map(ip =>
    `║  Network → ${pad(`http://${ip}:${PORT}  (LAN players)`)}`
  ).join('\n');
  const adminLines = ipList.map(ip =>
    `║  Admin   → ${pad(`http://${ip}:${PORT}/admin.html`)}`
  ).join('\n');
  console.log(`
╔══════════════════════════════════════════════════════════╗
║      AETHERIA : ENDLESS FRONTIERS — GAME SERVER          ║
╠══════════════════════════════════════════════════════════╣
║  Local   → http://localhost:${PORT}                        ║
${networkLines}
${adminLines}
╠══════════════════════════════════════════════════════════╣
║  ⚠  If LAN access fails, allow port ${PORT} in firewall   ║
${_playerCountLine()}
╚══════════════════════════════════════════════════════════╝
Press Ctrl+C to stop.`);
  // After the template literal above, the cursor sits one line below
  // "Press Ctrl+C to stop." — which is 3 lines below the Players line
  // (Players → ╚═══╝ → Press Ctrl+C → cursor).
  if (process.stdout.isTTY) _rowsBelowPlayerLine = 3;
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
  log('Shutting down...');
  clearInterval(broadcastInterval);
  saveState();
  broadcast({ type: 'announce', text: 'Server shutting down...', severity: 'error' });
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
