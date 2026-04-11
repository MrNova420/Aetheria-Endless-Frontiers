#!/usr/bin/env node
/**
 * scripts/setup-game.js
 *
 * All-in-one setup script for Aetheria: Endless Frontiers.
 * 1. Checks Node.js version
 * 2. Installs npm dependencies
 * 3. Generates procedural game textures
 * 4. Optionally downloads CC0 3D model packs from Kenney.nl
 * 5. Starts the game server
 *
 * Usage:
 *   node scripts/setup-game.js           # Full setup + start
 *   node scripts/setup-game.js --no-start # Setup only, don't start server
 *   node scripts/setup-game.js --quick    # Skip 3D model downloads
 */
'use strict';
const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT = path.join(__dirname, '..');
const C = { reset:'\x1b[0m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', red:'\x1b[31m', bold:'\x1b[1m', blue:'\x1b[34m' };
const log   = m => console.log(`${C.cyan}[setup]${C.reset} ${m}`);
const ok    = m => console.log(`${C.green}[  OK  ]${C.reset} ${m}`);
const warn  = m => console.log(`${C.yellow}[ WARN ]${C.reset} ${m}`);
const fail  = m => { console.log(`${C.red}[FAIL  ]${C.reset} ${m}`); process.exit(1); };
const step  = m => console.log(`\n${C.bold}${C.blue}▶ ${m}${C.reset}`);
const hr    = () => console.log(`${C.cyan}${'─'.repeat(58)}${C.reset}`);

const args     = process.argv.slice(2);
const NO_START = args.includes('--no-start');
const QUICK    = args.includes('--quick');

function run(cmd, opts={}) {
  try { execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts }); return true; }
  catch { return false; }
}

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces) {
      if (i.family==='IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

async function main() {
  console.log(`\n${C.bold}${C.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║      AETHERIA : ENDLESS FRONTIERS – SETUP               ║');
  console.log('║      All-in-one game setup & launcher                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(C.reset);

  // ── Step 1: Node.js version check ─────────────────────────────────────────
  step('Checking Node.js version');
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) fail(`Node.js 18+ required. Found v${process.versions.node}. Download from https://nodejs.org`);
  ok(`Node.js v${process.versions.node} ✓`);

  // ── Step 2: npm install ────────────────────────────────────────────────────
  step('Installing npm dependencies');
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'ws'))) {
    log('Running npm install…');
    if (!run('npm install')) fail('npm install failed. Check your internet connection and try again.');
    ok('Dependencies installed');
  } else {
    ok('Dependencies already installed');
  }

  // ── Step 3: Generate / download assets ────────────────────────────────────
  step('Setting up game assets');
  const assetsScript = path.join(ROOT, 'scripts', 'download-assets.js');
  if (fs.existsSync(assetsScript)) {
    const flags = QUICK ? '--quick' : '';
    log('Running asset pipeline…');
    run(`node "${assetsScript}" ${flags}`);
  } else {
    warn('Asset script not found — game will use fully procedural mode');
  }

  // ── Step 4: Verify server.js exists ──────────────────────────────────────
  step('Verifying server');
  const serverJs = path.join(ROOT, 'server.js');
  if (!fs.existsSync(serverJs)) fail('server.js not found!');
  ok('server.js found');

  // ── Done ───────────────────────────────────────────────────────────────────
  hr();
  const ip   = getLocalIP();
  const port = process.env.PORT || 8080;
  console.log(`\n${C.bold}${C.green}  ✔ Setup complete!${C.reset}\n`);
  console.log(`  ${C.bold}How to play:${C.reset}`);
  console.log(`  • Local:   ${C.cyan}http://localhost:${port}${C.reset}`);
  console.log(`  • Network: ${C.cyan}http://${ip}:${port}${C.reset}  ← share with LAN players`);
  console.log(`  • Admin:   ${C.cyan}http://${ip}:${port}/admin.html${C.reset}\n`);
  console.log(`  ${C.yellow}Tip: Other devices on the same Wi-Fi can join using the Network URL above.${C.reset}`);
  console.log(`  ${C.yellow}     If it doesn't connect, check your firewall allows port ${port}.${C.reset}\n`);

  if (NO_START) {
    console.log(`  Run manually: ${C.bold}node server.js${C.reset}\n`);
    hr();
    return;
  }

  // ── Step 5: Start server ───────────────────────────────────────────────────
  step('Starting game server');
  hr();
  console.log('');
  // Re-exec server.js in this process group so Ctrl+C works naturally
  const server = spawn(process.execPath, [serverJs], {
    cwd:   ROOT,
    stdio: 'inherit',
    env:   { ...process.env },
  });
  server.on('error', e => fail('Failed to start server: ' + e.message));
  server.on('exit',  code => { if (code) fail(`Server exited with code ${code}`); });
  // Forward signals
  process.on('SIGINT',  () => server.kill('SIGINT'));
  process.on('SIGTERM', () => server.kill('SIGTERM'));
}

main().catch(e => { console.error(C.red + e.message + C.reset); process.exit(1); });
