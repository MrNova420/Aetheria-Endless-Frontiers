/**
 * scripts/test-startup.mjs
 *
 * Headless startup simulation for Aetheria: Endless Frontiers.
 * Tests all core modules that participate in game.js init() without
 * requiring a browser, THREE renderer, or DOM.
 *
 * Usage:  node scripts/test-startup.mjs
 */
import { readFileSync } from 'fs';

/** Expected number of systems in a freshly loaded region. */
const EXPECTED_SYSTEM_COUNT = 1000;
import { execSync }     from 'child_process';

// ─── Browser global stubs ────────────────────────────────────────────────────
try { Object.defineProperty(global,'navigator',{value:{vibrate:()=>{}},writable:true}); } catch(e) {}
global.document = {
  getElementById:  ()=>null,
  createElement:   ()=>({ style:{}, classList:{add:()=>{},remove:()=>{}}, appendChild:()=>{}, append:()=>{}, querySelectorAll:()=>[] }),
};
global.window      = { addEventListener:()=>{}, location:{ hostname:'localhost' } };
global.localStorage = (()=>{ const m={}; return { getItem:k=>m[k]??null, setItem:(k,v)=>{ m[k]=v; }, removeItem:k=>{ delete m[k]; } }; })();

// ─── THREE stub (geometry/math only) ─────────────────────────────────────────
const THREE = {
  Clock:   class { getDelta(){ return 0.016; } },
  Vector3: class {
    constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; }
    set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; }
    clone(){ return new THREE.Vector3(this.x,this.y,this.z); }
    copy(v){ this.x=v.x; this.y=v.y; this.z=v.z; return this; }
    distanceTo(v){ return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z); }
    add(v){ this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
    sub(v){ this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; }
    multiplyScalar(s){ this.x*=s; this.y*=s; this.z*=s; return this; }
    normalize(){ const l=Math.hypot(this.x,this.y,this.z)||1; this.x/=l; this.y/=l; this.z/=l; return this; }
    length(){ return Math.hypot(this.x,this.y,this.z); }
  },
};
global.THREE = THREE;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const passes=[], fails=[];
function pass(n)     { passes.push(n); console.log('  ✅ '+n); }
function fail(n,e)   { fails.push(n);  console.error('  ❌ '+n+': '+e.message); }
function load(file, ret) {
  const src = readFileSync('src/'+file,'utf8')
    .replace(/^import\s[^\n]*/gm,'')   // strip ES import lines
    .replace(/^export /gm,'');          // strip export keyword
  return new Function('THREE','document', src+'\nreturn {'+ret+'};')(THREE, global.document);
}

// ─── 1. noise.js ─────────────────────────────────────────────────────────────
try {
  const { SimplexNoise, fbm } = load('noise.js','SimplexNoise,fbm');
  const sn = new SimplexNoise(42);
  const v2 = sn.noise2D(0.5, 0.3);
  if (typeof v2 !== 'number') throw new Error('noise2D not number');
  const v3 = sn.noise3D(0.1,0.2,0.3);
  if (typeof v3 !== 'number') throw new Error('noise3D not number');
  const f  = fbm(sn, 0.5, 0.5, 4);
  if (typeof f  !== 'number') throw new Error('fbm not number');
  pass('SimplexNoise: noise2D, noise3D, fbm');
} catch(e) { fail('noise',e); }

// ─── 2. universe.js ──────────────────────────────────────────────────────────
let universe;
try {
  const { UniverseSystem } = load('universe.js','UniverseSystem');
  universe = new UniverseSystem();
  const sys = universe.getCurrentSystem();
  if (!sys?.id) throw new Error('no current system');
  const loaded = universe.getLoadedSystems();
  if (!Array.isArray(loaded) || loaded.length !== EXPECTED_SYSTEM_COUNT) throw new Error('bad loaded count: '+loaded.length);
  const adj = universe.getAdjacentSystems(8);
  if (!Array.isArray(adj) || adj.length !== 8) throw new Error('bad adjacent count');
  const ok = universe.warpTo('0_0_42');
  if (!ok) throw new Error('warpTo returned false');
  const snap = universe.serialize();
  if (snap.g !== 0 || snap.s !== 42) throw new Error('serialize bad: '+JSON.stringify(snap));
  universe.load(snap);
  pass('UniverseSystem: construct(1000 systems), warpTo, serialize/load');
} catch(e) { fail('universe',e); }

// ─── 3. factions.js — the bug fix ────────────────────────────────────────────
try {
  const { FactionManager } = load('factions.js','FactionManager');

  // Control: old broken code must throw
  let threw = false;
  try { const bad = universe?.currentRegion ?? universe ?? []; for (const s of bad) {} }
  catch(e2) { threw = true; }
  if (!threw) throw new Error('control check failed — old code should throw');
  pass('Control: old code (universe?.currentRegion ?? universe) correctly throws');

  // Fixed code: must not throw and must assign all 1000 systems
  const fm = new FactionManager();
  fm.assignTerritories(universe);
  if (fm.getTerritoryCount() !== EXPECTED_SYSTEM_COUNT) throw new Error('territory count wrong: '+fm.getTerritoryCount());
  pass('FactionManager.assignTerritories(universe): '+EXPECTED_SYSTEM_COUNT+' systems, no throw');

  // Faction distribution
  const dist = {};
  for (const v of fm._territories.values()) dist[v]=(dist[v]||0)+1;
  if (Object.keys(dist).length < 6) throw new Error('too few factions: '+JSON.stringify(dist));
  pass('Territory distribution: '+Object.keys(dist).length+' factions present');

  // Null / undefined safety
  const fm2 = new FactionManager();
  fm2.assignTerritories(null);
  if (fm2.getTerritoryCount() !== 0) throw new Error('null should give 0 territories');
  new FactionManager().assignTerritories(undefined);
  pass('FactionManager.assignTerritories(null/undefined): safe, no throw');

  // Rep / rank / war / alliance
  fm.addRep('Korvax', 600);
  const rank = fm.getRank('Korvax');
  if (!rank) throw new Error('no rank');
  fm.declareWar('Korvax','Gek');
  if (!fm.isAtWar('Korvax','Gek')) throw new Error('war not set');
  fm.formAlliance('Vykeen','Atlas');
  if (!fm.isAllied('Vykeen','Atlas')) throw new Error('alliance not set');
  pass('FactionManager: rep/rank, war, alliance');

  // getTerritoryFaction
  const firstId = universe.getLoadedSystems()[0].id;
  if (!fm.getTerritoryFaction(firstId)) throw new Error('no faction for system '+firstId);
  pass('FactionManager.getTerritoryFaction: resolved for loaded system');
} catch(e) { fail('factions',e); }

// ─── 4. inventory.js ─────────────────────────────────────────────────────────
try {
  const { Inventory } = load('inventory.js','Inventory');
  const inv = new Inventory(48);
  inv.addItem('Carbon', 250);
  inv.addItem('Ferrite', 150);
  inv.addItem('Di-Hydrogen', 60);
  if (inv.getAllItems().length !== 3) throw new Error('expected 3 items');
  const over = inv.addItem('Carbon', 99999);
  if (typeof over !== 'number') throw new Error('overflow not a number');
  if (!inv.removeItem('Carbon', 10)) throw new Error('removeItem failed');
  if (inv.getSlots().length !== 48) throw new Error('slots length wrong');
  pass('Inventory: addItem/overflow, getAllItems, removeItem, getSlots(48)');
} catch(e) { fail('inventory',e); }

// ─── 5. status.js ────────────────────────────────────────────────────────────
try {
  const { StatusEffectManager } = load('status.js','StatusEffectManager');
  const sm  = new StatusEffectManager();
  const fp  = { applyDamage:()=>1, drainLifeSupport:()=>{} };
  sm.apply('burning');
  const exp1 = sm.update(7.0, fp);   // burning lasts 6s → expired after 7s
  if (!Array.isArray(exp1)) throw new Error('update must return array');
  if (!exp1.includes('burning')) throw new Error('burning not expired after 7s');
  sm.apply('frozen'); sm.apply('poisoned'); sm.apply('shielded');
  const exp2 = sm.update(0.016, fp);
  if (!Array.isArray(exp2)) throw new Error('second update not array');
  if (typeof sm.getSpeedMult() !== 'number') throw new Error('getSpeedMult not number');
  const snap = sm.serialize();
  const sm2  = new StatusEffectManager();
  sm2.load(snap);
  if (sm2.getHudIcons().length !== sm.getHudIcons().length) throw new Error('serialize/load mismatch');
  pass('StatusEffectManager: apply, update→expired, getSpeedMult, serialize/load');
} catch(e) { fail('status',e); }

// ─── 6. quests.js ────────────────────────────────────────────────────────────
try {
  const { QuestSystem } = load('quests.js','QuestSystem,QUEST_DEFS');
  const qs = new QuestSystem();
  qs.start('first_steps');
  qs.reportEvent('move', {});
  const active = qs.getActive();
  if (!Array.isArray(active) || active.length === 0) throw new Error('no active quests');
  pass('QuestSystem: start, reportEvent, getActive');
} catch(e) { fail('quests',e); }

// ─── 7. config.js ────────────────────────────────────────────────────────────
try {
  const mod = load('config.js','TECH_UPGRADES,PLAYER_CONFIG,BIOME_COLORS');
  if (!mod.TECH_UPGRADES || !mod.PLAYER_CONFIG || !mod.BIOME_COLORS) throw new Error('missing exports');
  pass('config: TECH_UPGRADES, PLAYER_CONFIG, BIOME_COLORS present');
} catch(e) { fail('config',e); }

// ─── 8. crafting.js ──────────────────────────────────────────────────────────
try {
  const invSrc = readFileSync('src/inventory.js','utf8').replace(/^import\s[^\n]*/gm,'').replace(/^export /gm,'');
  const cftSrc = readFileSync('src/crafting.js','utf8').replace(/^import\s[^\n]*/gm,'').replace(/^export /gm,'');
  const mod = new Function('THREE','document', invSrc+'\n'+cftSrc+'\nreturn { CraftingSystem, TechTree, Inventory };')(THREE, global.document);
  const inv = new mod.Inventory(48);
  const cs  = new mod.CraftingSystem(inv);
  const recipes = cs.getAvailableRecipes();
  if (!Array.isArray(recipes)) throw new Error('getAvailableRecipes not array');
  new mod.TechTree();
  pass('CraftingSystem: getAvailableRecipes, TechTree constructed');
} catch(e) { fail('crafting',e); }

// ─── 9. server.js syntax ─────────────────────────────────────────────────────
try {
  execSync('node -c server.js', { cwd: process.cwd() });
  pass('server.js: syntax check passed');
} catch(e) { fail('server.js syntax',e); }

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Results: ${passes.length} passed, ${fails.length} failed`);
if (fails.length === 0) {
  console.log('✅ ALL TESTS PASSED — startup path is healthy.');
  process.exit(0);
} else {
  console.log('❌ FAILURES:', fails);
  process.exit(1);
}
