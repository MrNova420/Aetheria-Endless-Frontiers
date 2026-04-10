/**
 * src/mesh-worker.js  –  AETHERIA: Endless Frontiers
 *
 * Dedicated Web Worker for idle-time mesh relay contribution.
 *
 * This worker runs entirely OFF the main game thread so it can NEVER
 * block rendering or input.  It receives tasks from the main thread,
 * processes them only during idle periods, and relays peer messages.
 *
 * Hardware budget: configurable 1-5% of a CPU core equivalent,
 * enforced via sleep intervals so the OS scheduler keeps the worker
 * dormant most of the time.
 *
 * Message protocol (main ↔ worker):
 *   Main → Worker:
 *     { cmd:'configure', contributionPct:number, peerId:string }
 *     { cmd:'relay',     to:string, payload:object }
 *     { cmd:'cache',     key:string, value:* }
 *     { cmd:'peers',     list:[{id,url}] }
 *     { cmd:'stop' }
 *
 *   Worker → Main:
 *     { type:'ready' }
 *     { type:'stats', messagesRelayed:number, bytesRelayed:number, cpuBudgetPct:number, uptimeMs:number }
 *     { type:'relay', from:string, payload:object }
 *     { type:'cache_hit', key:string, value:* }
 *     { type:'error', message:string }
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let _contributionPct = 2;          // target % (1–5)
let _peerId          = '';
let _peers           = new Map();  // id → {id, url, ws:null}
let _cache           = new Map();  // universe/building data cache
let _running         = true;
let _messagesRelayed = 0;
let _bytesRelayed    = 0;
let _startTime       = Date.now();

// ── Compute sleep interval from contribution % ────────────────────────────────
// If we want ~2% CPU: sleep 49ms per 1ms of work (1/(0.02) - 1 ≈ 49x rest ratio)
function sleepMs() {
  const pct = Math.max(1, Math.min(5, _contributionPct)) / 100;
  const rest = Math.round((1 / pct) - 1) * 2;   // *2 for conservatism
  return Math.max(20, Math.min(rest, 2000));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Relay queue ───────────────────────────────────────────────────────────────
const _relayQueue = [];    // {to, payload}[]
const MAX_QUEUE   = 64;

// ── WebSocket peer connections (workers can use WebSocket natively) ───────────
function connectPeer(peer) {
  if (peer.ws && peer.ws.readyState <= 1) return; // already open/connecting
  try {
    const ws = new WebSocket(peer.url);
    peer.ws = ws;
    ws.addEventListener('open', () => {
      postMessage({ type: 'stats', message: `Peer connected: ${peer.id}` });
    });
    ws.addEventListener('message', evt => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (_) { return; }
      // Forward to main thread so game can act on universe/building sync
      postMessage({ type: 'relay', from: peer.id, payload: msg });
      _messagesRelayed++;
      _bytesRelayed += evt.data.length;
    });
    ws.addEventListener('close', () => {
      peer.ws = null;
    });
    ws.addEventListener('error', () => {
      peer.ws = null;
    });
  } catch (err) {
    postMessage({ type: 'error', message: `Peer connect failed (${peer.url}): ${err.message}` });
  }
}

// ── Relay a message to a specific peer ───────────────────────────────────────
function doRelay(to, payload) {
  const raw = JSON.stringify(payload);
  if (to === 'all') {
    for (const peer of _peers.values()) {
      if (peer.ws?.readyState === 1) {
        try { peer.ws.send(raw); _messagesRelayed++; _bytesRelayed += raw.length; } catch (_) {}
      }
    }
  } else {
    const peer = _peers.get(to);
    if (peer?.ws?.readyState === 1) {
      try { peer.ws.send(raw); _messagesRelayed++; _bytesRelayed += raw.length; } catch (_) {}
    }
  }
}

// ── Emit stats to main thread ─────────────────────────────────────────────────
function emitStats() {
  postMessage({
    type:            'stats',
    messagesRelayed: _messagesRelayed,
    bytesRelayed:    _bytesRelayed,
    cpuBudgetPct:    _contributionPct,
    uptimeMs:        Date.now() - _startTime,
    peerCount:       _peers.size,
  });
}

// ── Main worker loop — processes relay queue during idle gaps ─────────────────
async function workerLoop() {
  let statsTimer = 0;
  while (_running) {
    const loopStart = Date.now();

    // Process up to 8 relay tasks per wake cycle
    let processed = 0;
    while (_relayQueue.length && processed < 8) {
      const { to, payload } = _relayQueue.shift();
      doRelay(to, payload);
      processed++;
    }

    // Attempt to (re)connect any disconnected peers
    for (const peer of _peers.values()) {
      if (!peer.ws || peer.ws.readyState > 1) {
        connectPeer(peer);
      }
    }

    // Emit stats every ~10s
    statsTimer += Date.now() - loopStart;
    if (statsTimer >= 10000) {
      emitStats();
      statsTimer = 0;
    }

    // Sleep to enforce hardware budget — this is what keeps CPU usage at 1-5%
    await sleep(sleepMs());
  }
}

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', evt => {
  const msg = evt.data;
  if (!msg || !msg.cmd) return;

  switch (msg.cmd) {
    case 'configure':
      _contributionPct = Math.max(1, Math.min(5, msg.contributionPct ?? 2));
      if (msg.peerId) _peerId = msg.peerId;
      postMessage({ type: 'ready', cpuBudgetPct: _contributionPct });
      break;

    case 'peers': {
      const incoming = msg.list ?? [];
      // Add new peers, keep existing connections
      for (const p of incoming) {
        if (!_peers.has(p.id)) {
          _peers.set(p.id, { id: p.id, url: p.url, ws: null });
        }
      }
      // Remove stale peers
      const ids = new Set(incoming.map(p => p.id));
      for (const [id, peer] of _peers) {
        if (!ids.has(id)) {
          peer.ws?.close?.();
          _peers.delete(id);
        }
      }
      break;
    }

    case 'relay':
      if (_relayQueue.length < MAX_QUEUE) {
        _relayQueue.push({ to: msg.to ?? 'all', payload: msg.payload });
      }
      break;

    case 'cache':
      _cache.set(msg.key, msg.value);
      break;

    case 'cache_get': {
      const val = _cache.get(msg.key);
      if (val !== undefined) {
        postMessage({ type: 'cache_hit', key: msg.key, value: val });
      }
      break;
    }

    case 'stats':
      emitStats();
      break;

    case 'stop':
      _running = false;
      for (const peer of _peers.values()) peer.ws?.close?.();
      postMessage({ type: 'stats', message: 'Worker stopped.' });
      break;

    default:
      postMessage({ type: 'error', message: `Unknown command: ${msg.cmd}` });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
workerLoop().catch(err => {
  postMessage({ type: 'error', message: 'Worker loop crashed: ' + err.message });
});
