#!/usr/bin/env node
/**
 * scripts/download-assets.js
 *
 * Downloads CC0 game assets from Kenney.nl and AmbientCG.
 * If downloads fail, generates high-quality procedural PNG textures locally.
 *
 * Usage:
 *   node scripts/download-assets.js           # Download + generate all
 *   node scripts/download-assets.js --quick   # Essential assets only
 *   node scripts/download-assets.js --check   # Status report only
 *   node scripts/download-assets.js --gen     # Generate procedural textures only (no downloads)
 */

'use strict';
const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const zlib    = require('zlib');

const ROOT   = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const TMP    = path.join(ROOT, 'tmp', 'downloads');

// ── Colour output ──────────────────────────────────────────────────────────────
const C = { reset:'\x1b[0m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', red:'\x1b[31m', bold:'\x1b[1m' };
const log  = m => console.log(`${C.cyan}[assets]${C.reset} ${m}`);
const ok   = m => console.log(`${C.green}[  OK  ]${C.reset} ${m}`);
const warn = m => console.log(`${C.yellow}[ WARN ]${C.reset} ${m}`);
const err  = m => console.log(`${C.red}[ERROR ]${C.reset} ${m}`);
const head = m => console.log(`\n${C.bold}${C.cyan}── ${m} ──${C.reset}`);

const args  = process.argv.slice(2);
const QUICK = args.includes('--quick');
const CHECK = args.includes('--check');
const GEN   = args.includes('--gen');

// ── Pure-JS PNG encoder (no external deps) ─────────────────────────────────────
// Writes 24-bit RGB PNG using Node.js built-in zlib
function encodePNG(width, height, pixels) {
  // pixels: Uint8Array of length width*height*3 (RGB)
  const CRC_TABLE = new Uint32Array(256);
  for (let n=0;n<256;n++) {
    let c=n;
    for (let k=0;k<8;k++) c = (c&1) ? (0xEDB88320^(c>>>1)) : (c>>>1);
    CRC_TABLE[n]=c;
  }

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (const b of buf) { crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xFF]; }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.allocUnsafe(4); crcVal.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // 8-bit RGB

  // Raw scanlines with filter byte
  const raw = Buffer.allocUnsafe(height * (1 + width * 3));
  for (let y=0;y<height;y++) {
    raw[y*(1+width*3)] = 0; // None filter
    for (let x=0;x<width;x++) {
      const si = (y*width+x)*3;
      const di = y*(1+width*3)+1+x*3;
      raw[di]=pixels[si]; raw[di+1]=pixels[si+1]; raw[di+2]=pixels[si+2];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Noise primitives ───────────────────────────────────────────────────────────
function hash2(x, y) {
  let h = (Math.imul(x|0, 374761393) + Math.imul(y|0, 1234577)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return h / 4294967296;
}
function smoothNoise(x, y, scale) {
  const xi=Math.floor(x/scale)|0, yi=Math.floor(y/scale)|0;
  const xf=x/scale-xi, yf=y/scale-yi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  return hash2(xi,yi)*(1-u)*(1-v)+hash2(xi+1,yi)*u*(1-v)+hash2(xi,yi+1)*(1-u)*v+hash2(xi+1,yi+1)*u*v;
}
function fbm(x, y, octaves, scale) {
  let v=0, a=0.5, f=1;
  for (let i=0;i<octaves;i++) { v+=smoothNoise(x*f,y*f,scale)*a; a*=0.5; f*=2.1; }
  return v;
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function lerp(a, b, t) { return a + (b-a)*t; }
function lerpRGB(c1, c2, t) {
  return [lerp(c1[0],c2[0],t), lerp(c1[1],c2[1],t), lerp(c1[2],c2[2],t)];
}

// ── Procedural texture generators ─────────────────────────────────────────────
const TEX_SIZE = 256;

function makeGrassTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  const dark=[30,65,15], base=[52,110,28], light=[85,155,45], acc=[40,80,20];
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const n1=fbm(x,y,6,40), n2=fbm(x+200,y+100,4,18), n3=fbm(x+500,y+500,3,9);
    const t=n1*0.5+n2*0.3+n3*0.2;
    const g=(hash2(x,y)-0.5)*0.18;
    let col = lerpRGB(dark, base, clamp01(t+g));
    col = lerpRGB(col, light, clamp01(n2*n3*3));
    col = lerpRGB(col, acc, clamp01((1-t)*0.4));
    const i=(y*TEX_SIZE+x)*3;
    px[i]=col[0]|0; px[i+1]=col[1]|0; px[i+2]=col[2]|0;
  }
  return px;
}

function makeRockTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  const dark=[55,45,38], base=[107,93,79], light=[145,130,110], crack=[40,35,28];
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const n1=fbm(x,y,5,50), n2=fbm(x+100,y+200,4,24), n3=fbm(x*1.5,y*1.5,3,15);
    const cracks = Math.pow(Math.abs(n2-0.5)*2, 1.5);
    const t=n1*0.6+n3*0.4;
    const g=(hash2(x,y)-0.5)*0.15;
    let col = lerpRGB(dark, base, clamp01(t+g));
    col = lerpRGB(col, light, clamp01(t*0.6));
    col = lerpRGB(col, crack, clamp01(cracks*0.6));
    const i=(y*TEX_SIZE+x)*3;
    px[i]=col[0]|0; px[i+1]=col[1]|0; px[i+2]=col[2]|0;
  }
  return px;
}

function makeSandTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  const dark=[180,140,85], base=[200,165,105], light=[225,195,140];
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const n=fbm(x,y,4,60), ripple=fbm(x,y*3,3,30)*0.3;
    const t=n*0.7+ripple;
    const g=(hash2(x,y)-0.5)*0.12;
    const col=lerpRGB(dark,light,clamp01(t+g));
    const i=(y*TEX_SIZE+x)*3;
    px[i]=col[0]|0; px[i+1]=col[1]|0; px[i+2]=col[2]|0;
  }
  return px;
}

function makeSnowTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  const dark=[190,205,218], base=[225,235,245], light=[248,252,255];
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const n=fbm(x,y,4,55), sparkle=(hash2(x*3,y*3)>0.96)?1.0:0.0;
    const t=n*0.8+sparkle*0.2;
    const g=(hash2(x,y)-0.5)*0.08;
    const col=lerpRGB(dark,light,clamp01(t+g));
    const i=(y*TEX_SIZE+x)*3;
    px[i]=col[0]|0; px[i+1]=col[1]|0; px[i+2]=col[2]|0;
  }
  return px;
}

function makeAlienTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  const dark=[30,12,60], base=[80,35,150], light=[140,60,220], glow=[180,80,255];
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const n1=fbm(x,y,5,45), n2=fbm(x+300,y+100,4,22);
    const cell=Math.pow(clamp01((n1-0.4)*3),2);
    const t=n1*0.6+n2*0.4;
    const g=(hash2(x,y)-0.5)*0.2;
    let col=lerpRGB(dark,base,clamp01(t+g));
    col=lerpRGB(col,light,clamp01(n2*1.5));
    col=lerpRGB(col,glow,clamp01(cell*0.8));
    const i=(y*TEX_SIZE+x)*3;
    px[i]=col[0]|0; px[i+1]=col[1]|0; px[i+2]=col[2]|0;
  }
  return px;
}

function makeGrassNormalTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const h0=fbm(x,y,4,32), hx=fbm(x+0.5,y,4,32), hy=fbm(x,y+0.5,4,32);
    const nx=clamp01((h0-hx)*6+0.5), ny=clamp01((h0-hy)*6+0.5);
    const i=(y*TEX_SIZE+x)*3;
    px[i]=(nx*255)|0; px[i+1]=(ny*255)|0; px[i+2]=255;
  }
  return px;
}

function makeRockNormalTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const h0=fbm(x,y,5,40), hx=fbm(x+0.5,y,5,40), hy=fbm(x,y+0.5,5,40);
    const nx=clamp01((h0-hx)*10+0.5), ny=clamp01((h0-hy)*10+0.5);
    const i=(y*TEX_SIZE+x)*3;
    px[i]=(nx*255)|0; px[i+1]=(ny*255)|0; px[i+2]=255;
  }
  return px;
}

function makeStarsTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const i=(y*TEX_SIZE+x)*3;
    const nebula=fbm(x,y,4,80)*15|0;
    const starVal = hash2(x*7,y*7);
    const brightness = starVal>0.975 ? Math.pow((starVal-0.975)/0.025,2)*255 : 0;
    px[i]=nebula+(brightness*0.9)|0; px[i+1]=nebula+(brightness*0.95)|0; px[i+2]=nebula+brightness|0;
  }
  return px;
}

function makeNebulaTexture() {
  const px = new Uint8Array(TEX_SIZE*TEX_SIZE*3);
  for (let y=0;y<TEX_SIZE;y++) for (let x=0;x<TEX_SIZE;x++) {
    const n1=fbm(x,y,5,80), n2=fbm(x+300,y+200,4,55);
    const cols = [
      [n1*60|0, n1*10|0, n1*120|0],
      [n2*120|0, n2*40|0, n2*200|0],
      [n1*n2*4*80|0, 0, n1*n2*4*150|0],
    ];
    const t=clamp01(n1*n2*2);
    let col=lerpRGB(cols[0],cols[1],t); col=lerpRGB(col,cols[2],clamp01(t*t*2));
    const star = hash2(x*11,y*13)>0.985?120:0;
    const i=(y*TEX_SIZE+x)*3;
    px[i]=(col[0]+star)|0; px[i+1]=(col[1]+star/2)|0; px[i+2]=(col[2]+star)|0;
  }
  return px;
}

// ── Generate all procedural textures ──────────────────────────────────────────
const PROCEDURAL_TEXTURES = [
  { dst:'assets/textures/terrain/grass_albedo.png',  gen: makeGrassTexture,       label:'Grass albedo' },
  { dst:'assets/textures/terrain/rock_albedo.png',   gen: makeRockTexture,        label:'Rock albedo' },
  { dst:'assets/textures/terrain/sand_albedo.png',   gen: makeSandTexture,        label:'Sand albedo' },
  { dst:'assets/textures/terrain/snow_albedo.png',   gen: makeSnowTexture,        label:'Snow albedo' },
  { dst:'assets/textures/terrain/alien_albedo.png',  gen: makeAlienTexture,       label:'Alien albedo' },
  { dst:'assets/textures/terrain/grass_normal.png',  gen: makeGrassNormalTexture, label:'Grass normal' },
  { dst:'assets/textures/terrain/rock_normal.png',   gen: makeRockNormalTexture,  label:'Rock normal' },
  { dst:'assets/textures/sky/stars.png',             gen: makeStarsTexture,       label:'Stars' },
  { dst:'assets/textures/sky/nebula.png',            gen: makeNebulaTexture,      label:'Nebula' },
];

function generateProceduralTextures(force = false) {
  head('Generating procedural textures');
  let generated = 0;
  for (const tex of PROCEDURAL_TEXTURES) {
    const dst = path.join(ROOT, tex.dst);
    if (!force && fs.existsSync(dst)) { ok(`Already exists: ${tex.label}`); continue; }
    const dir = path.dirname(dst);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    log(`Generating ${tex.label}…`);
    try {
      const pixels = tex.gen();
      const pngData = encodePNG(TEX_SIZE, TEX_SIZE, pixels);
      fs.writeFileSync(dst, pngData);
      ok(`Generated: ${tex.dst}`);
      generated++;
    } catch (e) {
      err(`Failed to generate ${tex.label}: ${e.message}`);
    }
  }
  if (generated > 0) ok(`${generated} procedural texture(s) generated`);
}

// ── Asset packs to download (with multiple URL fallbacks) ─────────────────────
const PACKS = [
  {
    id: 'kenney_space', name: 'Kenney Space Kit (CC0)', essential: true,
    urls: [
      'https://kenney.nl/media/pages/assets/space-kit/2f8fecefde-1699457988/kenney_space-kit.zip',
      'https://kenney.nl/assets/space-kit',
    ],
    dest: 'tmp/kenney_space',
    mappings: [
      { src: 'Models/GLTF format/craft_speederA.glb', dst: 'assets/models/ship/explorer.glb' },
      { src: 'Models/GLTF format/craft_miner.glb',    dst: 'assets/models/ship/fighter.glb' },
      { src: 'Models/GLTF format/craft_cargoA.glb',   dst: 'assets/models/ship/freighter.glb' },
      { src: 'Models/GLTF format/station_A.glb',      dst: 'assets/models/environment/space_station.glb' },
    ]
  },
  {
    id: 'kenney_nature', name: 'Kenney Nature Kit (CC0)', essential: true,
    urls: [
      'https://kenney.nl/media/pages/assets/nature-kit/95cac8ca4b-1629982591/kenney_nature-kit.zip',
    ],
    dest: 'tmp/kenney_nature',
    mappings: [
      { src: 'Models/GLTF format/tree_detailed.glb',          dst: 'assets/models/flora/alien_tree.glb' },
      { src: 'Models/GLTF format/mushroom_redTall.glb',       dst: 'assets/models/flora/mushroom.glb' },
      { src: 'Models/GLTF format/cactus.glb',                 dst: 'assets/models/flora/cactus.glb' },
      { src: 'Models/GLTF format/grass.glb',                  dst: 'assets/models/flora/grass.glb' },
      { src: 'Models/GLTF format/palm_tree_detailed.glb',     dst: 'assets/models/flora/palm_tree.glb' },
      { src: 'Models/GLTF format/plant_bush2.glb',            dst: 'assets/models/environment/resource_carbon.glb' },
    ]
  },
  {
    id: 'kenney_rocks', name: 'Kenney Rock Kit (CC0)', essential: true,
    urls: [
      'https://kenney.nl/media/pages/assets/rock-kit/1e5e1a6c20-1699457892/kenney_rock-kit.zip',
    ],
    dest: 'tmp/kenney_rocks',
    mappings: [
      { src: 'Models/GLTF format/rock_largeA.glb',         dst: 'assets/models/flora/rock_a.glb' },
      { src: 'Models/GLTF format/rock_largeB.glb',         dst: 'assets/models/flora/rock_b.glb' },
      { src: 'Models/GLTF format/rock_crystalLargeA.glb',  dst: 'assets/models/environment/resource_crystal.glb' },
      { src: 'Models/GLTF format/rock_crystalSmallA.glb',  dst: 'assets/models/flora/crystal.glb' },
      { src: 'Models/GLTF format/rock_smallA.glb',         dst: 'assets/models/environment/resource_ferrite.glb' },
    ]
  },
  {
    id: 'kenney_characters', name: 'Kenney Character Pack (CC0)', essential: true,
    urls: [
      'https://kenney.nl/media/pages/assets/character-pack/0ee2b33a88-1699457949/kenney_character-pack.zip',
    ],
    dest: 'tmp/kenney_characters',
    mappings: [
      { src: 'Models/GLTF format/character_maleAdventurer.glb', dst: 'assets/models/player/explorer.glb' },
      { src: 'Models/GLTF format/character_femalePerson.glb',   dst: 'assets/models/player/explorer_f.glb' },
    ]
  },
];

// ── HTTP download with redirects ───────────────────────────────────────────────
function download(url, dest, timeout=30000) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout }, res => {
      if (res.statusCode===301||res.statusCode===302||res.statusCode===307||res.statusCode===308) {
        file.close(); try { fs.unlinkSync(dest); } catch(_){}
        return download(res.headers.location, dest, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { file.close(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', e => { try { fs.unlinkSync(dest); } catch(_){} reject(e); });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractZip(zipPath, destDir) {
  let AdmZip;
  try { AdmZip = require('adm-zip'); } catch { throw new Error('adm-zip not installed — run npm install'); }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  new AdmZip(zipPath).extractAllTo(destDir, true);
}

function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f === name) return full;
    if (fs.statSync(full).isDirectory()) { const r=findFile(full,name); if(r) return r; }
  }
  return null;
}

function copyFile(src, dst) {
  const dir = path.dirname(dst);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dst);
}

async function processPack(pack) {
  head(pack.name);
  const allExist = pack.mappings.every(m => fs.existsSync(path.join(ROOT, m.dst)));
  if (allExist) { ok('All files already present'); return; }
  if (CHECK) { warn('Missing – would download'); return; }

  const zipPath    = path.join(ROOT, pack.dest + '.zip');
  const extractDir = path.join(ROOT, pack.dest);

  if (!fs.existsSync(zipPath)) {
    let downloaded = false;
    for (const url of pack.urls) {
      log(`Trying: ${url}`);
      try { await download(url, zipPath); ok('Downloaded'); downloaded=true; break; }
      catch (e) { warn(`Failed (${e.message}), trying next URL…`); }
    }
    if (!downloaded) { warn('All download URLs failed — models will use procedural fallback'); return; }
  } else { ok('Zip cached'); }

  try { extractZip(zipPath, extractDir); ok('Extracted'); }
  catch (e) { err('Extraction failed: '+e.message); return; }

  for (const m of pack.mappings) {
    const dst = path.join(ROOT, m.dst);
    if (fs.existsSync(dst)) { ok(`Already: ${m.dst}`); continue; }
    const src = path.join(extractDir, m.src);
    if (fs.existsSync(src)) { copyFile(src, dst); ok(`Copied: ${m.dst}`); }
    else {
      const alt = findFile(extractDir, path.basename(m.src));
      if (alt) { copyFile(alt, dst); ok(`Copied (alt): ${m.dst}`); }
      else warn(`Not found: ${path.basename(m.src)} — procedural fallback`);
    }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
function printSummary() {
  head('Asset Status Summary');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(ASSETS,'manifest.json'),'utf8')); }
  catch { warn('No manifest.json found'); return; }
  let total=0, present=0, missing=[];
  for (const [,a] of Object.entries({...manifest.models||{},...manifest.textures||{}})) {
    total++;
    if (fs.existsSync(path.join(ROOT, a.file))) present++;
    else missing.push(a.file);
  }
  console.log(`\n  ${C.green}${present}${C.reset}/${total} assets present`);
  if (missing.length) {
    console.log(`  ${C.yellow}Missing (procedural fallback):${C.reset}`);
    missing.slice(0,15).forEach(m => console.log(`    – ${m}`));
    if (missing.length>15) console.log(`    … and ${missing.length-15} more`);
  }
  const pct = total>0 ? Math.round(present/total*100) : 0;
  console.log(`\n  ${C.cyan}Asset coverage: ${pct}%${C.reset}`);
  console.log(`  ${C.cyan}Procedural fallbacks cover all missing assets automatically.${C.reset}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════╗`);
  console.log(`║   AETHERIA – Asset Pipeline v2.0                     ║`);
  console.log(`║   Procedural generation + CC0 downloads              ║`);
  console.log(`╚══════════════════════════════════════════════════════╝${C.reset}\n`);

  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

  // Always generate procedural textures first (fast, no network needed)
  generateProceduralTextures();

  if (!GEN && !CHECK) {
    // Try to download real 3D models from Kenney
    const packs = QUICK ? PACKS.filter(p=>p.essential) : PACKS;
    for (const pack of packs) {
      try { await processPack(pack); }
      catch (e) { warn(`Pack ${pack.id}: ${e.message}`); }
    }
  }

  printSummary();
  console.log(`${C.green}${C.bold}✔ Asset pipeline complete!${C.reset}`);
  console.log(`${C.cyan}  Run the game: npm start${C.reset}\n`);
}

main().catch(e => { err(e.message); process.exit(1); });
