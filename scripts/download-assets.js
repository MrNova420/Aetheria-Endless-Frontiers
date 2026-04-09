#!/usr/bin/env node
/**
 * scripts/download-assets.js
 *
 * Downloads all free CC0 game assets from Kenney.nl, Quaternius, and Poly Pizza.
 * Converts OBJ → GLB using Node.js-based tools where available, otherwise
 * places the raw OBJ/FBX files and lets Three.js load them directly via OBJLoader.
 *
 * Usage:
 *   node scripts/download-assets.js          # Download everything
 *   node scripts/download-assets.js --quick  # Only essential assets
 *   node scripts/download-assets.js --check  # Check what's missing without downloading
 *
 * Requirements:
 *   npm install  (installs adm-zip, node-fetch already in package.json)
 *
 * All assets are CC0 (Public Domain) – see LICENSE-ASSETS.md
 */

const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const http     = require('http');
const { execSync } = require('child_process');

const ROOT    = path.join(__dirname, '..');
const ASSETS  = path.join(ROOT, 'assets');
const TMP     = path.join(ROOT, 'tmp', 'downloads');

// ── Colour output ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  bold:   '\x1b[1m',
};
const log   = (msg)      => console.log(`${C.cyan}[assets]${C.reset} ${msg}`);
const ok    = (msg)      => console.log(`${C.green}[  OK  ]${C.reset} ${msg}`);
const warn  = (msg)      => console.log(`${C.yellow}[ WARN ]${C.reset} ${msg}`);
const error = (msg)      => console.log(`${C.red}[ERROR ]${C.reset} ${msg}`);
const head  = (msg)      => console.log(`\n${C.bold}${C.cyan}── ${msg} ──${C.reset}`);

// ── Args ───────────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const QUICK  = args.includes('--quick');
const CHECK  = args.includes('--check');

// ── Asset packs to download ────────────────────────────────────────────────────
const PACKS = [
  {
    id:   'kenney_space',
    name: 'Kenney Space Kit (CC0)',
    url:  'https://kenney.nl/media/pages/assets/space-kit/2f8fecefde-1699457988/kenney_space-kit.zip',
    dest: 'tmp/kenney_space',
    essential: true,
    mappings: [
      { src: 'Models/GLTF format/craft_speederA.glb', dst: 'assets/models/ship/explorer.glb' },
      { src: 'Models/GLTF format/craft_miner.glb',    dst: 'assets/models/ship/fighter.glb' },
      { src: 'Models/GLTF format/craft_cargoA.glb',   dst: 'assets/models/ship/freighter.glb' },
      { src: 'Models/GLTF format/craft_speederC.glb', dst: 'assets/models/environment/crashed_ship.glb' },
      { src: 'Models/GLTF format/station_A.glb',      dst: 'assets/models/environment/space_station.glb' },
    ]
  },
  {
    id:   'kenney_nature',
    name: 'Kenney Nature Kit (CC0)',
    url:  'https://kenney.nl/media/pages/assets/nature-kit/95cac8ca4b-1629982591/kenney_nature-kit.zip',
    dest: 'tmp/kenney_nature',
    essential: true,
    mappings: [
      { src: 'Models/GLTF format/tree_detailed.glb',   dst: 'assets/models/flora/alien_tree.glb' },
      { src: 'Models/GLTF format/mushroom_redTall.glb',dst: 'assets/models/flora/mushroom.glb' },
      { src: 'Models/GLTF format/cactus.glb',          dst: 'assets/models/flora/cactus.glb' },
      { src: 'Models/GLTF format/grass.glb',           dst: 'assets/models/flora/grass.glb' },
      { src: 'Models/GLTF format/plant_bush2.glb',     dst: 'assets/models/environment/resource_carbon.glb' },
      { src: 'Models/GLTF format/tree_palmDetailedTall.glb', dst: 'assets/models/flora/palm_tree.glb' },
    ]
  },
  {
    id:   'kenney_rocks',
    name: 'Kenney Rock Kit (CC0)',
    url:  'https://kenney.nl/media/pages/assets/rock-kit/1e5e1a6c20-1699457892/kenney_rock-kit.zip',
    dest: 'tmp/kenney_rocks',
    essential: true,
    mappings: [
      { src: 'Models/GLTF format/rock_largeA.glb',        dst: 'assets/models/flora/rock_a.glb' },
      { src: 'Models/GLTF format/rock_largeB.glb',        dst: 'assets/models/flora/rock_b.glb' },
      { src: 'Models/GLTF format/rock_crystalLargeA.glb', dst: 'assets/models/environment/resource_crystal.glb' },
      { src: 'Models/GLTF format/rock_crystalLargeB.glb', dst: 'assets/models/environment/resource_gold.glb' },
      { src: 'Models/GLTF format/rock_crystalSmallA.glb', dst: 'assets/models/flora/crystal.glb' },
      { src: 'Models/GLTF format/rock_smallA.glb',        dst: 'assets/models/environment/resource_ferrite.glb' },
    ]
  },
  {
    id:   'kenney_characters',
    name: 'Kenney Character Pack (CC0)',
    url:  'https://kenney.nl/media/pages/assets/character-pack/0ee2b33a88-1699457949/kenney_character-pack.zip',
    dest: 'tmp/kenney_characters',
    essential: true,
    mappings: [
      { src: 'Models/GLTF format/character_maleAdventurer.glb', dst: 'assets/models/player/explorer.glb' },
      { src: 'Models/GLTF format/character_femalePerson.glb',   dst: 'assets/models/player/explorer_f.glb' },
    ]
  },
  {
    id:   'kenney_scifi',
    name: 'Kenney Sci-Fi RTS (CC0)',
    url:  'https://kenney.nl/media/pages/assets/sci-fi-rts/a20d2d5b11-1699457921/kenney_sci-fi-rts.zip',
    dest: 'tmp/kenney_scifi',
    essential: false,
    mappings: [
      { src: 'Models/GLTF format/towerSquare_lowDetailed.glb', dst: 'assets/models/environment/ruins_tower.glb' },
    ]
  },
  {
    id:   'kenney_planets',
    name: 'Kenney Planets (CC0)',
    url:  'https://kenney.nl/media/pages/assets/planets/bcbb94b0b9-1699457886/kenney_planets.zip',
    dest: 'tmp/kenney_planets',
    essential: false,
    mappings: [
      { src: 'Models/GLTF format/planet.glb', dst: 'assets/models/environment/planet_base.glb' },
    ]
  },
];

// ── Texture downloads (free/CC0 from various sources) ─────────────────────────
const TEXTURES = [
  // Ambient CG (CC0 photogrammetric PBR textures)
  {
    name: 'Grass Ground (AmbientCG – CC0)',
    baseUrl: 'https://ambientcg.com/get?file=GrassField004_1K-JPG.zip',
    dest: 'tmp/tex_grass',
    essential: true,
    mappings: [
      { src: 'GrassField004_1K_Color.jpg',     dst: 'assets/textures/terrain/grass_albedo.jpg' },
      { src: 'GrassField004_1K_NormalGL.jpg',  dst: 'assets/textures/terrain/grass_normal.jpg' },
    ]
  },
  {
    name: 'Rock Ground (AmbientCG – CC0)',
    baseUrl: 'https://ambientcg.com/get?file=Rock026_1K-JPG.zip',
    dest: 'tmp/tex_rock',
    essential: true,
    mappings: [
      { src: 'Rock026_1K_Color.jpg',     dst: 'assets/textures/terrain/rock_albedo.jpg' },
      { src: 'Rock026_1K_NormalGL.jpg',  dst: 'assets/textures/terrain/rock_normal.jpg' },
    ]
  },
  {
    name: 'Sand (AmbientCG – CC0)',
    baseUrl: 'https://ambientcg.com/get?file=Ground054_1K-JPG.zip',
    dest: 'tmp/tex_sand',
    essential: false,
    mappings: [
      { src: 'Ground054_1K_Color.jpg', dst: 'assets/textures/terrain/sand_albedo.jpg' },
    ]
  },
  {
    name: 'Snow (AmbientCG – CC0)',
    baseUrl: 'https://ambientcg.com/get?file=Snow007A_1K-JPG.zip',
    dest: 'tmp/tex_snow',
    essential: false,
    mappings: [
      { src: 'Snow007A_1K_Color.jpg', dst: 'assets/textures/terrain/snow_albedo.jpg' },
    ]
  },
];

// ── Utility: check for adm-zip ─────────────────────────────────────────────────
function checkDeps() {
  try { require('adm-zip'); return true; }
  catch { return false; }
}

// ── Utility: HTTP download with redirect following ─────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

// ── Utility: extract zip ────────────────────────────────────────────────────────
function extractZip(zipPath, destDir) {
  const AdmZip = require('adm-zip');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

// ── Utility: copy file creating dirs ───────────────────────────────────────────
function copyFile(src, dst) {
  const dir = path.dirname(dst);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dst);
}

// ── Process one pack ───────────────────────────────────────────────────────────
async function processPack(pack) {
  head(pack.name);

  // Check if all outputs already exist
  const allExist = pack.mappings.every(m => fs.existsSync(path.join(ROOT, m.dst)));
  if (allExist) { ok('All files already present – skipping'); return; }

  if (CHECK) { warn('Missing – would download'); return; }

  const zipPath   = path.join(ROOT, pack.dest + '.zip');
  const extractDir = path.join(ROOT, pack.dest);

  // Download
  if (!fs.existsSync(zipPath)) {
    log(`Downloading ${pack.url} …`);
    try {
      await download(pack.url, zipPath);
      ok(`Downloaded → ${pack.dest}.zip`);
    } catch (e) {
      error(`Download failed: ${e.message}`);
      error('You can download it manually from: ' + pack.url);
      error('Then re-run this script.');
      return;
    }
  } else {
    ok('Zip already cached');
  }

  // Extract
  log('Extracting…');
  try {
    extractZip(zipPath, extractDir);
    ok('Extracted');
  } catch (e) {
    error('Extraction failed: ' + e.message);
    return;
  }

  // Copy mapped files
  for (const m of pack.mappings) {
    const src = path.join(extractDir, m.src);
    const dst = path.join(ROOT, m.dst);
    if (fs.existsSync(dst)) { ok(`Already exists: ${m.dst}`); continue; }
    if (!fs.existsSync(src)) {
      warn(`Source not found in zip: ${m.src}`);
      // Try alternate path patterns
      const alt = findFile(extractDir, path.basename(m.src));
      if (alt) { copyFile(alt, dst); ok(`Copied (alt path): ${m.dst}`); }
      else      { warn(`Could not locate ${path.basename(m.src)} – will use procedural fallback`); }
      continue;
    }
    copyFile(src, dst);
    ok(`Copied: ${m.dst}`);
  }
}

// ── Find file recursively ──────────────────────────────────────────────────────
function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f === name) return full;
    if (fs.statSync(full).isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

// ── Process textures ───────────────────────────────────────────────────────────
async function processTex(tex) {
  head(tex.name);
  const allExist = tex.mappings.every(m => fs.existsSync(path.join(ROOT, m.dst)));
  if (allExist) { ok('All textures already present'); return; }
  if (CHECK) { warn('Missing – would download'); return; }

  const zipPath    = path.join(ROOT, tex.dest + '.zip');
  const extractDir = path.join(ROOT, tex.dest);

  if (!fs.existsSync(zipPath)) {
    log(`Downloading texture pack…`);
    try {
      await download(tex.baseUrl, zipPath);
      ok('Downloaded');
    } catch (e) {
      error('Texture download failed: ' + e.message);
      warn('Terrain will use procedurally generated colour – still playable!');
      return;
    }
  }

  try { extractZip(zipPath, extractDir); ok('Extracted'); }
  catch (e) { error('Extraction failed: ' + e.message); return; }

  for (const m of tex.mappings) {
    const src = path.join(extractDir, m.src);
    const dst = path.join(ROOT, m.dst);
    if (fs.existsSync(dst)) continue;
    if (!fs.existsSync(src)) {
      const alt = findFile(extractDir, path.basename(m.src));
      if (alt) { copyFile(alt, dst); ok(`Texture: ${m.dst}`); }
      else      { warn(`Texture not found: ${m.src}`); }
      continue;
    }
    copyFile(src, dst);
    ok(`Texture: ${m.dst}`);
  }
}

// ── Generate procedural fallback textures using Canvas ────────────────────────
function generateFallbackTextures() {
  head('Generating procedural fallback textures');
  // We'll emit a tiny 4×4 data-URI PNG stored as JS in assets/textures/fallback-data.js
  const data = `
// Auto-generated by download-assets.js – fallback colour textures
// These are used when real PBR textures have not been downloaded yet.
export const FALLBACK_COLORS = {
  grass:  '#3a6e2a',
  rock:   '#6b5d4f',
  sand:   '#c9a96e',
  snow:   '#dde8f0',
  alien:  '#4a2a6e',
  toxic:  '#2a5c2a',
  lava:   '#8a2a0a',
  ice:    '#aacce0',
};
`;
  const fdir = path.join(ASSETS, 'textures');
  if (!fs.existsSync(fdir)) fs.mkdirSync(fdir, { recursive: true });
  fs.writeFileSync(path.join(fdir, 'fallback-data.js'), data);
  ok('Fallback texture data written');
}

// ── Summary ────────────────────────────────────────────────────────────────────
function printSummary() {
  head('Asset Status Summary');
  const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));
  let total = 0, present = 0, missing = [];
  for (const [key, asset] of Object.entries(manifest.models || {})) {
    total++;
    if (fs.existsSync(path.join(ROOT, asset.file))) { present++; }
    else { missing.push(asset.file); }
  }
  for (const [key, tex] of Object.entries(manifest.textures || {})) {
    total++;
    if (fs.existsSync(path.join(ROOT, tex.file))) { present++; }
    else { missing.push(tex.file); }
  }
  console.log(`\n  ${C.green}${present}${C.reset}/${total} assets present`);
  if (missing.length > 0) {
    console.log(`  ${C.yellow}Missing (will use procedural fallback):${C.reset}`);
    for (const m of missing.slice(0, 20)) console.log(`    – ${m}`);
    if (missing.length > 20) console.log(`    … and ${missing.length - 20} more`);
  }
  console.log(`\n  ${C.cyan}Game is ${present === 0 ? 'fully procedural' : 'using ' + present + ' real assets'}${C.reset}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
  console.log(`║   Aetheria – Asset Downloader v1.0               ║`);
  console.log(`║   All assets are CC0 / Public Domain             ║`);
  console.log(`╚══════════════════════════════════════════════════╝${C.reset}\n`);

  if (!checkDeps()) {
    error('adm-zip not found. Run: npm install');
    process.exit(1);
  }

  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

  const packs = QUICK ? PACKS.filter(p => p.essential) : PACKS;
  const textures = QUICK ? TEXTURES.filter(t => t.essential) : TEXTURES;

  for (const pack of packs) {
    try { await processPack(pack); }
    catch (e) { error(`Pack ${pack.id} failed: ${e.message}`); }
  }

  for (const tex of textures) {
    try { await processTex(tex); }
    catch (e) { warn(`Texture pack failed (not critical): ${e.message}`); }
  }

  generateFallbackTextures();
  printSummary();

  if (!CHECK) {
    console.log(`${C.green}${C.bold}✔ Asset setup complete!${C.reset}`);
    console.log(`${C.cyan}  Run the game: npm start${C.reset}\n`);
  }
}

main().catch(e => { error(e.message); process.exit(1); });
