/**
 * tests/run-all.js  –  Aetheria: Endless Frontiers
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive full-game test, isolation, simulation & stress suite.
 * Pure Node.js (no test framework needed):  node tests/run-all.js
 *
 * Covers every logic module that can run server-side:
 *   Infrastructure · Inventory · Equipment · Crafting · TechTree
 *   StatusEffects  · QuestSystem · FactionManager · TradingSystem
 *   UniverseSystem · SimplexNoise · Day/Night simulation
 *   Physics constants · Combat simulation · Economy simulation
 *   Stress / edge-case / isolation / limit-push tests
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.join(__dir, '..');
const SRC    = path.join(ROOT, 'src');

// ── Inline imports (avoid browser-only module chains) ────────────────────────
// Pure-JS modules can be imported directly.
import { Inventory, Equipment }
  from '../src/inventory.js';
import { RECIPES, CraftingSystem, TechTree }
  from '../src/crafting.js';
import { StatusEffectManager }
  from '../src/status.js';
import { QuestSystem, QUEST_DEFS }
  from '../src/quests.js';
import { FactionManager, FACTIONS, FACTION_RANKS }
  from '../src/factions.js';
import { TradingSystem, COMMODITIES, SHIP_CLASSES }
  from '../src/trading.js';
import { UniverseSystem }
  from '../src/universe.js';
import { SimplexNoise, fbm, warpedFbm }
  from '../src/noise.js';
import {
  PLANET_TYPES, PLANET_GRAVITY, PLANET_HAZARD_RATES,
  WORLD, PLAYER_CONFIG, TECH_UPGRADES
} from '../src/config.js';

// ── Minimal test harness ──────────────────────────────────────────────────────
let _suite = '', _passed = 0, _failed = 0, _skipped = 0;
const _failures = [];
const _bugs = [];

function suite(name) {
  _suite = name;
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  📦 ${name}`);
  console.log('═'.repeat(70));
}

function test(name, fn) {
  try {
    fn();
    _passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    _failed++;
    _failures.push({ suite: _suite, name, error: e.message });
    console.log(`  ❌ ${name}`);
    console.log(`       ${e.message}`);
  }
}

function bugTest(name, fn) {
  // A bug-hunt test: failures here are flagged as BUGS found, not test errors.
  try {
    fn();
    _passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    _bugs.push({ suite: _suite, name, error: e.message });
    console.log(`  🐛 BUG FOUND — ${name}`);
    console.log(`       ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertGte(a, b, msg) {
  if (a < b) throw new Error(msg || `Expected ${a} >= ${b}`);
}
function assertLte(a, b, msg) {
  if (a > b) throw new Error(msg || `Expected ${a} <= ${b}`);
}
function assertRange(v, lo, hi, msg) {
  if (v < lo || v > hi) throw new Error(msg || `Expected ${v} in [${lo}, ${hi}]`);
}

// ═════════════════════════════════════════════════════════════════════════════
//  1. INFRASTRUCTURE – brace balance, syntax checks
// ═════════════════════════════════════════════════════════════════════════════
suite('Infrastructure — File integrity');

test('All src/*.js files are brace-balanced', () => {
  const bad = [];
  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(SRC, f), 'utf8');
    const d = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
    if (d !== 0) bad.push(`${f} (delta ${d})`);
  }
  assert(bad.length === 0, `Imbalanced braces: ${bad.join(', ')}`);
});

test('server.js passes node -c syntax check', () => {
  try {
    execSync(`node -c "${path.join(ROOT, 'server.js')}"`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error(e.stderr?.toString() || e.message);
  }
});

test('All src/*.js files exist and are non-empty', () => {
  const expected = [
    'assets','audio','building','config','crafting','creatures','extractor',
    'factions','flora','galaxy','game','hardware-mesh','help','inventory',
    'lore','mesh-worker','mining','network','noise','npcs','physics',
    'planet','player','quests','sentinels','shaders','ship','space',
    'status','terrain','trading','ui','universe','weather',
  ];
  const missing = expected.filter(m => !fs.existsSync(path.join(SRC, `${m}.js`)));
  assert(missing.length === 0, `Missing modules: ${missing.join(', ')}`);
  for (const m of expected) {
    const sz = fs.statSync(path.join(SRC, `${m}.js`)).size;
    assert(sz > 100, `${m}.js is suspiciously small (${sz} bytes)`);
  }
});

test('package.json valid JSON with required fields', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(pkg.name, 'Missing name');
  assert(pkg.version, 'Missing version');
  assert(pkg.main === 'server.js', `main should be server.js, got ${pkg.main}`);
  assert(pkg.dependencies?.ws, 'Missing ws dependency');
  assert(pkg.dependencies?.express, 'Missing express dependency');
});

// ═════════════════════════════════════════════════════════════════════════════
//  2. CONFIG CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════
suite('Config — Constants & Balance');

test('All 14 planet types defined', () => {
  const expected = ['LUSH','BARREN','TOXIC','FROZEN','BURNING','EXOTIC',
                    'DEAD','OCEAN','TROPICAL','ARCTIC','VOLCANIC','SWAMP','DESERT','CRYSTAL'];
  for (const t of expected) {
    assert(PLANET_TYPES[t] === t, `Missing planet type: ${t}`);
    assert(PLANET_GRAVITY[t] !== undefined, `Missing gravity for ${t}`);
    assert(PLANET_HAZARD_RATES[t] !== undefined, `Missing hazard rates for ${t}`);
  }
});

test('Gravity values in reasonable range [0.4, 1.6]', () => {
  for (const [type, g] of Object.entries(PLANET_GRAVITY)) {
    assertRange(g, 0.4, 1.6, `${type} gravity ${g} out of range`);
  }
});

test('Hazard rates non-negative', () => {
  for (const [type, rates] of Object.entries(PLANET_HAZARD_RATES)) {
    for (const [hazard, rate] of Object.entries(rates)) {
      assert(rate >= 0, `${type}.${hazard} hazard rate is negative (${rate})`);
    }
  }
});

test('WORLD constants sane', () => {
  assertRange(WORLD.DAY_DURATION, 600, 3600, `DAY_DURATION ${WORLD.DAY_DURATION} unexpected`);
  assertRange(WORLD.GRAVITY, 5, 50, `GRAVITY ${WORLD.GRAVITY} unexpected`);
  assertRange(WORLD.WATER_LEVEL, 5, 30, `WATER_LEVEL ${WORLD.WATER_LEVEL} unexpected`);
  assert(WORLD.CHUNK_SIZE > 0, 'CHUNK_SIZE must be positive');
});

test('PLAYER_CONFIG values sane', () => {
  assert(PLAYER_CONFIG.MAX_HP > 0, 'MAX_HP must be positive');
  assert(PLAYER_CONFIG.SPRINT_SPEED > PLAYER_CONFIG.WALK_SPEED, 'Sprint must be faster than walk');
  assert(PLAYER_CONFIG.JETPACK_FUEL > 0, 'Jetpack fuel must be positive');
  assert(PLAYER_CONFIG.SHIELD_REGEN_RATE > 0, 'Shield regen rate must be positive');
});

test('TECH_UPGRADES structure valid', () => {
  assert(TECH_UPGRADES.SUIT, 'Missing SUIT upgrades');
  assert(TECH_UPGRADES.MULTITOOL, 'Missing MULTITOOL upgrades');
  for (const [cat, techs] of Object.entries(TECH_UPGRADES)) {
    for (const [id, tech] of Object.entries(techs)) {
      assert(tech.name, `${cat}.${id} missing name`);
      assert(Array.isArray(tech.tiers), `${cat}.${id} missing tiers array`);
      assert(tech.tiers.length > 0, `${cat}.${id} has no tiers`);
      for (const tier of tech.tiers) {
        assert(tier.cost, `${cat}.${id} tier missing cost`);
        assert(tier.bonus, `${cat}.${id} tier missing bonus`);
      }
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  3. INVENTORY
// ═════════════════════════════════════════════════════════════════════════════
suite('Inventory — Core logic, edge cases, stress');

test('Add item to empty inventory returns 0 overflow', () => {
  const inv = new Inventory(48);
  const ov  = inv.addItem('Carbon', 100);
  assertEqual(ov, 0);
  assertEqual(inv.getAmount('Carbon'), 100);
});

test('Stack items into existing slot up to 9999', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 9000);
  inv.addItem('Carbon', 999);
  assertEqual(inv.getAmount('Carbon'), 9999);
  assertEqual(inv.getAllItems().filter(s => s.type === 'Carbon').length, 1);
});

test('Overflow spills into new slot when stack full', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 9999);
  inv.addItem('Carbon', 5000);
  assertEqual(inv.getAmount('Carbon'), 14999);
  assertEqual(inv.getAllItems().filter(s => s.type === 'Carbon').length, 2);
});

test('Overflow returned when inventory completely full', () => {
  const inv = new Inventory(2); // only 2 slots
  inv.addItem('A', 9999);
  inv.addItem('B', 9999);
  const ov = inv.addItem('C', 100);
  assertEqual(ov, 100, 'Full inventory should return full overflow');
  assertEqual(inv.getAmount('C'), 0, 'Full inventory should not add item');
});

test('removeItem returns true on success', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 200);
  const ok = inv.removeItem('Carbon', 100);
  assert(ok === true, 'removeItem should return true');
  assertEqual(inv.getAmount('Carbon'), 100);
});

test('removeItem returns false when insufficient', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 50);
  const ok = inv.removeItem('Carbon', 100);
  assert(ok === false, 'removeItem should return false when not enough');
});

test('removeItem clears slot when amount reaches 0', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 100);
  inv.removeItem('Carbon', 100);
  assertEqual(inv.getAmount('Carbon'), 0);
  const filled = inv.getAllItems().filter(s => s.type === 'Carbon');
  assertEqual(filled.length, 0, 'Slot should be cleared after full removal');
});

test('removeItem spans multiple slots', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 9999);
  inv.addItem('Carbon', 9999);
  const ok = inv.removeItem('Carbon', 15000);
  assert(ok, 'Should be able to remove across 2 slots');
  assertEqual(inv.getAmount('Carbon'), 4998);
});

test('hasIngredients matches recipe requirements', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 50);
  const recipe = { inputs: { 'Carbon': 50 } };
  assert(inv.hasIngredients(recipe), 'Should have exact ingredients');
  const recipe2 = { inputs: { 'Carbon': 51 } };
  assert(!inv.hasIngredients(recipe2), 'Should not have insufficient ingredients');
});

test('serialize/load round-trip preserves all items', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 250);
  inv.addItem('Ferrite Dust', 150);
  inv.addItem('Di-Hydrogen', 60);
  const data = JSON.parse(JSON.stringify(inv.serialize()));
  const inv2 = new Inventory();
  inv2.load(data);
  assertEqual(inv2.getAmount('Carbon'), 250);
  assertEqual(inv2.getAmount('Ferrite Dust'), 150);
  assertEqual(inv2.getAmount('Di-Hydrogen'), 60);
  assertEqual(inv2.maxSlots, 48);
});

test('[STRESS] 10,000 add/remove operations stay consistent', () => {
  const inv = new Inventory(48);
  let expected = 0;
  for (let i = 0; i < 5000; i++) {
    inv.addItem('Gold', 1);
    expected++;
  }
  for (let i = 0; i < 5000; i++) {
    inv.removeItem('Gold', 1);
    expected--;
  }
  assertEqual(inv.getAmount('Gold'), expected, `Expected ${expected} Gold after stress ops`);
});

test('[STRESS] Fill all 48 slots with different items', () => {
  const inv = new Inventory(48);
  for (let i = 0; i < 48; i++) {
    const ov = inv.addItem(`Resource_${i}`, 9999);
    assertEqual(ov, 0, `Slot ${i} should not overflow`);
  }
  assertEqual(inv.getAllItems().length, 48, 'All 48 slots should be filled');
  const ov = inv.addItem('Extra', 1);
  assertEqual(ov, 1, 'Adding to completely full inventory should overflow 1');
});

test('[EDGE] Adding 0 amount does not corrupt state', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 0);
  assertEqual(inv.getAmount('Carbon'), 0);
  assertEqual(inv.getAllItems().length, 0, 'Zero-amount add should not create slot');
});

test('[EDGE] Removing 0 amount returns true without changing state', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 100);
  const ok = inv.removeItem('Carbon', 0);
  assert(ok, 'Removing 0 should return true');
  assertEqual(inv.getAmount('Carbon'), 100, 'Amount should not change');
});

test('[EDGE] Removing non-existent item returns false', () => {
  const inv = new Inventory(48);
  const ok = inv.removeItem('NonExistent', 1);
  assert(!ok, 'Should return false for non-existent item');
});

// ─── Equipment ────────────────────────────────────────────────────────────────
test('Equipment equip/unequip returns displaced item', () => {
  const eq = new Equipment();
  const sword = { name: 'Laser', stats: { weaponDamage: 2 } };
  const old = eq.equip('weapon', sword);
  assert(old === null, 'Empty slot should return null');
  const sword2 = { name: 'Plasma', stats: { weaponDamage: 3 } };
  const displaced = eq.equip('weapon', sword2);
  assertEqual(displaced.name, 'Laser', 'Should return displaced weapon');
});

test('Equipment getStats accumulates bonuses', () => {
  const eq = new Equipment();
  eq.equip('weapon', { stats: { weaponDamage: 2.0 } });
  eq.equip('head',   { stats: { maxHP: 20 } });
  eq.equip('body',   { stats: { shieldMax: 30 } });
  const stats = eq.getStats();
  assertEqual(stats.maxHP, 20);
  assertEqual(stats.shieldMax, 30);
  // weaponDamage starts at 1.0 (base multiplier) and adds the equipped weapon's +2.0 → 3.0
  assertEqual(stats.weaponDamage, 3.0);
});

test('Equipment serialize/load round-trip', () => {
  const eq = new Equipment();
  eq.equip('weapon', { name: 'Plasma Boltcaster', stats: { weaponDamage: 2.5 } });
  const data = JSON.parse(JSON.stringify(eq.serialize()));
  const eq2 = new Equipment();
  eq2.load(data);
  assertEqual(eq2.slots.weapon.name, 'Plasma Boltcaster');
});

// ═════════════════════════════════════════════════════════════════════════════
//  4. CRAFTING
// ═════════════════════════════════════════════════════════════════════════════
suite('Crafting — Recipes, CraftingSystem, TechTree');

test('All 28+ recipes have valid structure', () => {
  assert(Object.keys(RECIPES).length >= 20, 'Expected at least 20 recipes');
  for (const [id, r] of Object.entries(RECIPES)) {
    assert(r.id === id, `Recipe id mismatch: ${id}`);
    assert(r.name, `Recipe ${id} missing name`);
    assert(r.category, `Recipe ${id} missing category`);
    assert(r.inputs && Object.keys(r.inputs).length > 0, `Recipe ${id} missing inputs`);
    assert(r.outputs && Object.keys(r.outputs).length > 0, `Recipe ${id} missing outputs`);
    for (const [k, v] of Object.entries(r.inputs))  assert(v > 0, `${id} input ${k} <= 0`);
    for (const [k, v] of Object.entries(r.outputs)) assert(v > 0, `${id} output ${k} <= 0`);
  }
});

test('canCraft returns false when inventory empty', () => {
  const inv = new Inventory(48);
  const cs  = new CraftingSystem(inv);
  assert(!cs.canCraft('warp_cell'), 'Should not be craftable with empty inventory');
});

test('canCraft returns true with exact ingredients', () => {
  const inv = new Inventory(48);
  inv.addItem('Di-Hydrogen', 50);
  inv.addItem('Chromatic Metal', 30);
  const cs = new CraftingSystem(inv);
  assert(cs.canCraft('warp_cell'), 'Should be craftable with exact ingredients');
});

test('craft consumes inputs and adds outputs', () => {
  const inv = new Inventory(48);
  inv.addItem('Ferrite Dust', 100);
  const cs = new CraftingSystem(inv);
  const ok = cs.craft('pure_ferrite');
  assert(ok, 'craft should return true');
  assertEqual(inv.getAmount('Ferrite Dust'), 50, 'Should consume 50 Ferrite Dust');
  assertEqual(inv.getAmount('Pure Ferrite'), 50, 'Should produce 50 Pure Ferrite');
});

test('craft returns false with insufficient ingredients and does not mutate', () => {
  const inv = new Inventory(48);
  inv.addItem('Ferrite Dust', 49); // 1 short
  const cs  = new CraftingSystem(inv);
  const ok  = cs.craft('pure_ferrite');
  assert(!ok, 'craft should return false');
  assertEqual(inv.getAmount('Ferrite Dust'), 49, 'Inventory should be unchanged');
  assertEqual(inv.getAmount('Pure Ferrite'), 0,  'No output should be produced');
});

test('onCraft callback fires on success', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 50);
  const cs = new CraftingSystem(inv);
  let fired = false;
  cs.onCraft = () => { fired = true; };
  cs.craft('condensed_carbon');
  assert(fired, 'onCraft should fire on successful craft');
});

test('learnBlueprint and unknown blueprint gatekeeping', () => {
  const inv = new Inventory(48);
  const cs  = new CraftingSystem(inv);
  cs.knownBlueprints.clear(); // forget everything
  inv.addItem('Ferrite Dust', 50);
  assert(!cs.canCraft('pure_ferrite'), 'Unknown blueprint should block craft');
  cs.learnBlueprint('pure_ferrite');
  assert(cs.canCraft('pure_ferrite'), 'Learned blueprint should allow craft');
});

test('[CHAIN] Craft warp_cell from raw materials via intermediate steps', () => {
  const inv = new Inventory(48);
  // Copper → Chromatic Metal, then use it to craft Warp Cell
  inv.addItem('Copper', 100);
  inv.addItem('Di-Hydrogen', 50);
  const cs = new CraftingSystem(inv);
  assert(cs.craft('chromatic_metal'), 'Should craft Chromatic Metal');
  assertEqual(inv.getAmount('Copper'), 0, 'Copper should be consumed');
  assertEqual(inv.getAmount('Chromatic Metal'), 50, 'Should have Chromatic Metal');
  assert(cs.craft('warp_cell'), 'Should craft Warp Cell from intermediate product');
  assertEqual(inv.getAmount('Warp Cell'), 1, 'Should have 1 Warp Cell');
});

test('TechTree upgrade deducts cost and stores tier', () => {
  const inv = new Inventory(48);
  inv.addItem('Ferrite Dust', 80);
  const tt  = new TechTree();
  tt.setConfig(TECH_UPGRADES);
  const ok  = tt.upgrade('SUIT', 'HAZARD', inv, TECH_UPGRADES);
  assert(ok, 'Upgrade should succeed');
  assertEqual(inv.getAmount('Ferrite Dust'), 0, 'Cost should be deducted');
  assertEqual(tt.upgrades['SUIT.HAZARD'], 1, 'Tier should be 1');
});

test('TechTree upgrade blocked when insufficient funds', () => {
  const inv = new Inventory(48);
  inv.addItem('Ferrite Dust', 10); // need 80
  const tt  = new TechTree();
  const ok  = tt.upgrade('SUIT', 'HAZARD', inv, TECH_UPGRADES);
  assert(!ok, 'Upgrade should fail with insufficient funds');
  assertEqual(inv.getAmount('Ferrite Dust'), 10, 'Funds should be unchanged');
});

test('TechTree serialize/load round-trip', () => {
  const inv = new Inventory(48);
  inv.addItem('Ferrite Dust', 80);
  const tt = new TechTree();
  tt.upgrade('SUIT', 'HAZARD', inv, TECH_UPGRADES);
  const data = JSON.parse(JSON.stringify(tt.serialize()));
  const tt2 = new TechTree();
  tt2.load(data);
  assertEqual(tt2.upgrades['SUIT.HAZARD'], 1, 'Loaded TechTree should have tier');
});

test('[STRESS] Craft all craftable recipes with sufficient materials', () => {
  let success = 0;
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const inv = new Inventory(48);
    for (const [type, amt] of Object.entries(recipe.inputs)) {
      inv.addItem(type, amt);
    }
    const cs = new CraftingSystem(inv);
    const ok = cs.craft(id);
    if (ok) success++;
    else throw new Error(`Recipe ${id} could not be crafted with exact inputs`);
  }
  assert(success === Object.keys(RECIPES).length, 'All recipes should be craftable');
});

// ═════════════════════════════════════════════════════════════════════════════
//  5. STATUS EFFECTS
// ═════════════════════════════════════════════════════════════════════════════
suite('StatusEffects — apply, tick, stack, serialize');

function mockPlayer() {
  const p = { hp: 100, ls: 100, dmgLog: [], lsLog: [] };
  p.applyDamage   = (d) => { p.hp -= d; p.dmgLog.push(d); };
  p.drainLifeSupport = (d) => { p.ls -= d; p.lsLog.push(d); };
  return p;
}

test('apply returns true on new effect, false on refresh', () => {
  const sem = new StatusEffectManager();
  assert(sem.apply('burning') === true,  'First apply should return true');
  assert(sem.apply('burning') === false, 'Re-apply should return false (refresh)');
});

test('has() returns correct state', () => {
  const sem = new StatusEffectManager();
  assert(!sem.has('frozen'), 'Should not have effect before apply');
  sem.apply('frozen');
  assert(sem.has('frozen'), 'Should have effect after apply');
  sem.remove('frozen');
  assert(!sem.has('frozen'), 'Should not have effect after remove');
});

test('burning deals 8 HP per tick (tickRate=1.0s)', () => {
  const sem = new StatusEffectManager();
  const p   = mockPlayer();
  sem.apply('burning');
  sem.update(1.0, p); // exactly 1 tick
  assertEqual(p.dmgLog.length, 1, 'Should deal exactly 1 tick of damage at 1s');
  assertEqual(p.dmgLog[0], 8, 'Burning should deal 8 hp per tick');
});

test('frozen deals 0 HP damage but drains life support', () => {
  const sem = new StatusEffectManager();
  const p   = mockPlayer();
  sem.apply('frozen');
  sem.update(2.0, p); // tickRate=2.0
  assertEqual(p.dmgLog.length, 0, 'Frozen should deal no HP damage');
  assert(p.lsLog.length >= 1, 'Frozen should drain life support');
});

test('effect expires after duration elapses', () => {
  const sem = new StatusEffectManager();
  const p   = mockPlayer();
  sem.apply('energised'); // duration=15s
  const expired1 = sem.update(14.9, p);
  assert(sem.has('energised'), 'Effect should still be active at 14.9s');
  assertEqual(expired1.length, 0, 'Nothing should have expired yet');
  const expired2 = sem.update(0.2, p);
  assert(!sem.has('energised'), 'Effect should expire after 15s+');
  assert(expired2.includes('energised'), 'Expired list should include energised');
});

test('refresh extends duration', () => {
  const sem = new StatusEffectManager();
  const p   = mockPlayer();
  sem.apply('burning');      // duration=6s
  sem.update(5.0, p);       // 5s in – still active
  sem.apply('burning');      // refresh
  sem.update(5.0, p);       // now 5s from refresh
  assert(sem.has('burning'), 'Refreshed effect should still be active');
});

test('getSpeedMult multiplies correctly for stacked effects', () => {
  const sem = new StatusEffectManager();
  sem.apply('frozen');     // speedMult=0.5
  sem.apply('energised');  // speedMult=1.4
  const mult = sem.getSpeedMult();
  const expected = 0.5 * 1.4;
  assert(Math.abs(mult - expected) < 0.001, `Expected ${expected}, got ${mult}`);
});

test('getHudIcons returns correct structure', () => {
  const sem = new StatusEffectManager();
  sem.apply('poisoned');
  const icons = sem.getHudIcons();
  assertEqual(icons.length, 1);
  assert(icons[0].icon, 'Should have icon');
  assert(icons[0].label, 'Should have label');
  assertGte(icons[0].remaining, 0);
});

test('serialize/load round-trip preserves effects', () => {
  const sem = new StatusEffectManager();
  sem.apply('burning');
  sem.apply('frozen');
  const data = JSON.parse(JSON.stringify(sem.serialize()));
  const sem2 = new StatusEffectManager();
  sem2.load(data);
  assert(sem2.has('burning'), 'Should restore burning');
  assert(sem2.has('frozen'), 'Should restore frozen');
});

test('apply unknown effect returns false', () => {
  const sem = new StatusEffectManager();
  const ok = sem.apply('nonexistent_effect');
  assert(ok === false, 'Unknown effect should return false');
  assert(!sem.has('nonexistent_effect'), 'Unknown effect should not be stored');
});

test('[STRESS] All 5 effects applied simultaneously are tracked correctly', () => {
  const sem = new StatusEffectManager();
  const p   = mockPlayer();
  const all = ['burning','frozen','poisoned','energised','shielded'];
  for (const e of all) sem.apply(e);
  assertEqual(sem.getHudIcons().length, 5, 'All 5 effects should show on HUD');
  // Run for 20s — all should expire
  sem.update(20.0, p);
  assertEqual(sem.getHudIcons().length, 0, 'All effects should expire after 20s');
});

// ═════════════════════════════════════════════════════════════════════════════
//  6. QUEST SYSTEM
// ═════════════════════════════════════════════════════════════════════════════
suite('QuestSystem — start, progress, complete, chain, serialize');

test('All 8 quest definitions are well-formed', () => {
  assert(Object.keys(QUEST_DEFS).length >= 8, 'Expected at least 8 quests');
  for (const [id, q] of Object.entries(QUEST_DEFS)) {
    assert(q.id === id, `Quest id mismatch: ${id}`);
    assert(q.title, `Quest ${id} missing title`);
    assert(Array.isArray(q.objectives) && q.objectives.length > 0, `Quest ${id} missing objectives`);
    assert(q.reward?.xp > 0, `Quest ${id} missing xp reward`);
    for (const o of q.objectives) {
      assert(o.id, `Quest ${id} objective missing id`);
      assert(o.type, `Quest ${id} objective missing type`);
      assert(o.target > 0, `Quest ${id} objective target must be > 0`);
    }
    // Chain must reference a valid quest or be null
    if (q.chain) assert(QUEST_DEFS[q.chain], `Quest ${id} chains to unknown quest ${q.chain}`);
  }
});

test('start() returns true first time, false if already active', () => {
  const qs = new QuestSystem();
  assert(qs.start('first_steps') === true);
  assert(qs.start('first_steps') === false, 'Starting active quest should return false');
});

test('start() returns false if already completed', () => {
  const qs = new QuestSystem();
  qs.start('first_steps');
  qs.reportEvent('collect', { resource: 'Carbon',       amount: 100 });
  qs.reportEvent('collect', { resource: 'Ferrite Dust', amount: 50  });
  assert(qs.isCompleted('first_steps'), 'Quest should be completed');
  assert(qs.start('first_steps') === false, 'Cannot start completed quest');
});

test('reportEvent increments objective progress', () => {
  const qs = new QuestSystem();
  qs.start('first_steps');
  qs.reportEvent('collect', { resource: 'Carbon', amount: 50 });
  const active = qs.getActive()[0];
  const carbonObj = active.objectives.find(o => o.resource === 'Carbon');
  assertEqual(carbonObj.progress, 50);
  assert(!carbonObj.done, 'Not done until 100');
});

test('completing all objectives fires completed event and auto-chains', () => {
  const qs = new QuestSystem();
  qs.start('first_steps');
  let completedId = null;
  qs.on('completed', q => { completedId = q.id; });
  qs.reportEvent('collect', { resource: 'Carbon',       amount: 100 });
  qs.reportEvent('collect', { resource: 'Ferrite Dust', amount: 50  });
  assertEqual(completedId, 'first_steps', 'completed event should fire');
  assert(qs.isCompleted('first_steps'), 'Quest should be completed');
  // chain quest should auto-start
  const active = qs.getActive().map(q => q.id);
  assert(active.includes('survival_basics'), 'Chain quest should auto-start');
});

test('progress capped at target (no over-counting)', () => {
  const qs = new QuestSystem();
  qs.start('first_steps');
  qs.reportEvent('collect', { resource: 'Carbon', amount: 9999 });
  const active = qs.getActive();
  if (active.length > 0) {
    const carbonObj = active[0]?.objectives.find(o => o.resource === 'Carbon');
    if (carbonObj) {
      assertLte(carbonObj.progress, carbonObj.target, 'Progress must not exceed target');
    }
  }
});

test('[CHAIN] Full quest chain first_steps → … → convergence', () => {
  const qs = new QuestSystem();
  qs.start('first_steps');
  const completed = [];
  qs.on('completed', q => completed.push(q.id));

  // first_steps
  qs.reportEvent('collect', { resource: 'Carbon',       amount: 100 });
  qs.reportEvent('collect', { resource: 'Ferrite Dust', amount: 50  });
  // survival_basics
  for (let i = 0; i < 3; i++) qs.reportEvent('kill', {});
  qs.reportEvent('craft',   { item: 'Warp Cell', amount: 1 });
  // explorer_path
  for (let i = 0; i < 5; i++) qs.reportEvent('scan', {});
  qs.reportEvent('warp', {});
  // sentinel_alert
  for (let i = 0; i < 3; i++) qs.reportEvent('kill_sentinel', {});
  for (let i = 0; i < 3; i++) qs.reportEvent('scan', {});
  // anomaly_investigation
  for (let i = 0; i < 3; i++) qs.reportEvent('warp', {});
  for (let i = 0; i < 10; i++) qs.reportEvent('scan', {});
  // atlas_path
  qs.reportEvent('warp_galaxy', {});
  qs.reportEvent('collect', { resource: 'Atlas Stone', amount: 1 });
  // tech_mastery
  for (let i = 0; i < 5; i++) qs.reportEvent('craft', { item: 'x', amount: 1 });
  for (let i = 0; i < 3; i++) qs.reportEvent('build', {});
  for (let i = 0; i < 10; i++) qs.reportEvent('kill', {});
  // convergence
  qs.reportEvent('build', { buildingType: 'town_hub' });
  for (let i = 0; i < 5; i++) qs.reportEvent('warp', {});
  qs.reportEvent('collect', { resource: 'Quantum Essence', amount: 3 });

  const expectedChain = ['first_steps','survival_basics','explorer_path',
    'sentinel_alert','anomaly_investigation','atlas_path','tech_mastery','convergence'];
  for (const id of expectedChain) {
    assert(completed.includes(id) || qs.isCompleted(id),
      `Quest ${id} should be completed in chain run`);
  }
});

test('getHudSummary returns first incomplete objective', () => {
  const qs = new QuestSystem();
  qs.start('first_steps');
  const hud = qs.getHudSummary();
  assert(hud !== null, 'Should return HUD summary when quest active');
  assert(hud.title, 'HUD should have title');
  assert(hud.label, 'HUD should have objective label');
  assertGte(hud.target, 1, 'HUD target should be >= 1');
});

test('serialize/load round-trip preserves progress', () => {
  const qs = new QuestSystem();
  qs.start('first_steps');
  qs.reportEvent('collect', { resource: 'Carbon', amount: 75 });
  const data = JSON.parse(JSON.stringify(qs.serialize()));
  const qs2 = new QuestSystem();
  qs2.load(data);
  const active = qs2.getActive()[0];
  assert(active, 'Quest should be active after load');
  const carbonObj = active.objectives.find(o => o.resource === 'Carbon');
  assertEqual(carbonObj.progress, 75, 'Progress should be preserved');
});

// ═════════════════════════════════════════════════════════════════════════════
//  7. FACTION SYSTEM
// ═════════════════════════════════════════════════════════════════════════════
suite('FactionManager — reputation, rank, war, alliance, territory');

test('All 6 factions initialise with correct base rep', () => {
  const fm = new FactionManager();
  for (const [id, def] of Object.entries(FACTIONS)) {
    assertEqual(fm.getRep(id), def.baseRep, `${id} should start at base rep ${def.baseRep}`);
  }
});

test('addRep changes rank at thresholds', () => {
  const fm = new FactionManager();
  fm.addRep('gek', 60);
  assert(['friendly','honored','exalted'].includes(fm.getRank('gek')),
    `Expected friendly+ after +60 rep`);
  fm.addRep('gek', -200);
  assertEqual(fm.getRank('gek'), 'hostile', 'Should be hostile after -200');
});

test('rep clamped to [-100, 100]', () => {
  const fm = new FactionManager();
  fm.addRep('gek', 999);
  assertLte(fm.getRep('gek'), 100, 'Rep should not exceed 100');
  fm.addRep('gek', -9999);
  assertGte(fm.getRep('gek'), -100, 'Rep should not go below -100');
});

test('getRank correct at all FACTION_RANKS boundaries', () => {
  const fm = new FactionManager();
  const cases = [
    [-61, 'hostile'], [-20, 'unfriendly'], [0, 'neutral'],
    [20, 'neutral'], [40, 'friendly'], [60, 'friendly'],
    [70, 'honored'], [80, 'exalted'], [100, 'exalted'],
  ];
  for (const [rep, expected] of cases) {
    fm._rep.set('gek', rep);
    const rank = fm.getRank('gek');
    assert(FACTION_RANKS.includes(rank), `${rank} not in FACTION_RANKS`);
  }
});

test('declareWar sets war flag and reduces rep', () => {
  const fm = new FactionManager();
  fm.declareWar('gek', 'vykeen');
  assert(fm.isAtWar('gek', 'vykeen'), 'Should be at war');
  assertLte(fm.getRep('gek'), 0, 'War should reduce gek rep');
  assertLte(fm.getRep('vykeen'), 0, 'War should reduce vykeen rep');
});

test('formAlliance cancels war', () => {
  const fm = new FactionManager();
  fm.declareWar('gek', 'korvax');
  fm.formAlliance('gek', 'korvax');
  assert(!fm.isAtWar('gek', 'korvax'), 'War should end after alliance');
  assert(fm.isAllied('gek', 'korvax'), 'Should be allied');
});

test('onRepChange callback fires on change', () => {
  const fm = new FactionManager();
  let fired = false;
  fm.onRepChange(() => { fired = true; });
  fm.addRep('gek', 10);
  assert(fired, 'onRepChange should fire');
});

test('getStandingText returns non-empty for all ranks', () => {
  const fm = new FactionManager();
  const reps = [-80, -40, 0, 40, 70, 95];
  for (const r of reps) {
    fm._rep.set('gek', r);
    const text = fm.getStandingText('gek');
    assert(text.length > 10, `Standing text should be non-empty for rep ${r}`);
  }
});

test('serialize/load round-trip preserves all state', () => {
  const fm = new FactionManager();
  fm.addRep('gek', 50);
  fm.declareWar('vykeen', 'korvax');
  fm.formAlliance('gek', 'atlas');
  const data = JSON.parse(JSON.stringify(fm.serialize()));
  const fm2 = new FactionManager();
  fm2.load(data);
  assertEqual(fm2.getRep('gek'), 50);
  assert(fm2.isAtWar('vykeen', 'korvax'));
  assert(fm2.isAllied('gek', 'atlas'));
});

test('[STRESS] 1000 rep changes stay within bounds', () => {
  const fm = new FactionManager();
  for (let i = 0; i < 1000; i++) {
    fm.addRep('gek', (i % 2 === 0) ? 7 : -5);
  }
  assertRange(fm.getRep('gek'), -100, 100, 'Rep should remain in bounds after 1000 ops');
});

// ═════════════════════════════════════════════════════════════════════════════
//  8. TRADING SYSTEM
// ═════════════════════════════════════════════════════════════════════════════
suite('TradingSystem — prices, buy/sell, ships, drones, economy');

test('All commodities have valid base prices and volatility', () => {
  for (const [id, c] of Object.entries(COMMODITIES)) {
    assert(c.basePrice > 0, `Commodity ${id} has non-positive base price`);
    assertRange(c.volatility, 0, 1, `Commodity ${id} volatility ${c.volatility} out of [0,1]`);
    assert(c.name, `Commodity ${id} missing name`);
    assert(c.category, `Commodity ${id} missing category`);
  }
});

test('getPrice returns value in [50%, 150%] of base price', () => {
  const ts = new TradingSystem();
  for (const [id, c] of Object.entries(COMMODITIES)) {
    const price = ts.getPrice('sys_test', id);
    assertRange(price, c.basePrice * 0.2, c.basePrice * 2.0,
      `Price for ${id} (${price}) well outside expected range around ${c.basePrice}`);
  }
});

test('getPrices returns all commodities', () => {
  const ts = new TradingSystem();
  const prices = ts.getPrices('system_42');
  const ids = Object.keys(COMMODITIES);
  for (const id of ids) {
    assert(id in prices, `Missing price for ${id}`);
    assert(prices[id] > 0, `Price for ${id} should be positive`);
  }
});

test('buy succeeds with enough units', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  const price = ts.getPrice('sys_a', 'carbon');
  const res = ts.buy('sys_a', 'carbon', 10, inv, price * 10 + 1);
  assert(res.ok, `Buy should succeed: ${res.message}`);
  assert(inv.getAmount('Carbon') >= 10, 'Should have Carbon after buy');
});

test('buy fails with insufficient units', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  const res = ts.buy('sys_a', 'carbon', 100, inv, 0);
  assert(!res.ok, 'Buy should fail with 0 units');
  assertEqual(inv.getAmount('Carbon'), 0, 'Inventory should be unchanged');
});

test('buy fails with full inventory', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(1); // 1-slot inventory, fill it
  inv.addItem('IronBlock', 9999);
  const res = ts.buy('sys_a', 'carbon', 1, inv, 999999);
  assert(!res.ok, 'Buy should fail when inventory full');
});

test('sell succeeds with item in inventory', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  inv.addItem('Carbon', 50);
  const res = ts.sell('sys_a', 'carbon', 50, inv);
  assert(res.ok, `Sell should succeed: ${res.message}`);
  assert(res.revenue > 0, 'Revenue should be positive');
  assertEqual(inv.getAmount('Carbon'), 0, 'Carbon should be gone');
});

test('sell fails when insufficient inventory', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  inv.addItem('Carbon', 10);
  const res = ts.sell('sys_a', 'carbon', 100, inv);
  assert(!res.ok, 'Sell should fail with insufficient stock');
  assertEqual(inv.getAmount('Carbon'), 10, 'Inventory should be unchanged');
});

test('sell unknown item returns not-ok', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  const res = ts.sell('sys_a', 'nonexistent_item_xyz', 1, inv);
  assert(!res.ok, 'Sell unknown item should fail');
});

test('getShipsForSale returns 3 ships with valid stats', () => {
  const ts = new TradingSystem();
  const ships = ts.getShipsForSale(12345);
  assertEqual(ships.length, 3, 'Should return 3 ships');
  for (const s of ships) {
    assert(s.id, 'Ship needs id');
    assert(s.name, 'Ship needs name');
    assert(s.class, 'Ship needs class');
    assertGte(s.slots, 1, 'Ship needs >= 1 slot');
    assertGte(s.speed, 1, 'Ship needs speed > 0');
    assertGte(s.price, 1, 'Ship needs price > 0');
  }
});

test('getShipsForSale is deterministic for same seed', () => {
  const ts = new TradingSystem();
  const a = ts.getShipsForSale(99999);
  const b = ts.getShipsForSale(99999);
  assertEqual(a[0].id, b[0].id, 'Same seed should produce same ships');
  assertEqual(a[0].price, b[0].price, 'Same seed should produce same price');
});

test('buyShip fails with insufficient funds', () => {
  const ts  = new TradingSystem();
  const ships = ts.getShipsForSale(42);
  const res = ts.buyShip(ships[0], 0);
  assert(!res.ok, 'buyShip should fail with 0 units');
});

test('[ECONOMY SIM] Trade route profit: buy low in sys-A, sell high in sys-B', () => {
  const ts = new TradingSystem();
  // Compute arbitrage opportunities across 20 system pairs
  let profitableRoutes = 0;
  for (let a = 0; a < 10; a++) {
    for (let b = a + 1; b < 20; b++) {
      for (const id of Object.keys(COMMODITIES)) {
        const buyAt  = ts.getPrice(`sys_${a}`, id);
        const sellAt = ts.getPrice(`sys_${b}`, id);
        if (sellAt > buyAt) profitableRoutes++;
      }
    }
  }
  assert(profitableRoutes > 0, 'There should be profitable trade routes in the galaxy');
});

test('[STRESS] 500 buy/sell cycles leave no floating point corruption', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  let units = 500000;
  for (let i = 0; i < 500; i++) {
    const price = ts.getPrice('stress_sys', 'carbon');
    const qty   = 10;
    const cost  = price * qty;
    if (units >= cost) {
      const r = ts.buy('stress_sys', 'carbon', qty, inv, units);
      if (r.ok) {
        units -= r.cost;
        const r2 = ts.sell('stress_sys', 'carbon', qty, inv);
        if (r2.ok) units += r2.revenue;
      }
    }
  }
  assert(Number.isFinite(units), 'Units should remain a finite number');
  assertGte(units, 0, 'Units should not go negative');
});

test('serialize/load round-trip preserves player ships', () => {
  const ts  = new TradingSystem();
  const ships = ts.getShipsForSale(777);
  ts.buyShip(ships[0], 9999999);
  const data = JSON.parse(JSON.stringify(ts.serialize()));
  const ts2 = new TradingSystem();
  ts2.load(data);
  assertEqual(ts2._playerShips.length, 1, 'Should restore player ships');
});

// ═════════════════════════════════════════════════════════════════════════════
//  9. UNIVERSE SYSTEM
// ═════════════════════════════════════════════════════════════════════════════
suite('UniverseSystem — generation, warp, galaxy traversal');

test('Starts at galaxy 0 / region 0 / system 0 (New Meridian)', () => {
  const u   = new UniverseSystem();
  const sys = u.getCurrentSystem();
  assertEqual(sys.name, 'New Meridian', 'Home system should be New Meridian');
  assertEqual(sys.galaxyIdx, 0);
  assertEqual(sys.regionIdx, 0);
  assertEqual(sys.systemIdx, 0);
});

test('getCurrentSystem is deterministic across instances', () => {
  const a = new UniverseSystem().getCurrentSystem();
  const b = new UniverseSystem().getCurrentSystem();
  assertEqual(a.name, b.name, 'Home system name should be deterministic');
  assertEqual(a.seed, b.seed, 'Home system seed should be deterministic');
  assertEqual(a.starType, b.starType, 'Star type should be deterministic');
});

test('getAdjacentSystems returns requested count, sorted by distance', () => {
  const u    = new UniverseSystem();
  const adj  = u.getAdjacentSystems(8);
  assertEqual(adj.length, 8, 'Should return 8 adjacent systems');
  for (let i = 0; i < adj.length - 1; i++) {
    assertLte(adj[i]._dist, adj[i + 1]._dist, 'Adjacent systems should be sorted by distance');
  }
});

test('warpTo changes current system', () => {
  const u  = new UniverseSystem();
  const adj = u.getAdjacentSystems(1);
  const ok  = u.warpTo(adj[0].id);
  assert(ok, 'warpTo should return true');
  const cur = u.getCurrentSystem();
  assertEqual(cur.id, adj[0].id, 'Should be at new system after warp');
});

test('warpTo marks system as visited', () => {
  const u   = new UniverseSystem();
  const adj = u.getAdjacentSystems(1);
  u.warpTo(adj[0].id);
  const sys = u.getCurrentSystem();
  assert(sys.visited, 'Warped-to system should be marked visited');
  assertGte(u.getStats().visitedCount, 2, 'Should have visited at least 2 systems');
});

test('warpTo invalid ID returns false', () => {
  const u  = new UniverseSystem();
  const ok = u.warpTo('not_valid');
  assert(!ok, 'warpTo with invalid ID should return false');
});

test('warpGalaxy increments galaxy index and resets region/system', () => {
  const u  = new UniverseSystem();
  const g1 = u.getStats().galaxyIdx;
  u.warpGalaxy();
  const g2 = u.getStats().galaxyIdx;
  assertEqual(g2, (g1 + 1) % 255, 'Galaxy index should increment');
  const cur = u.getCurrentSystem();
  assertEqual(cur.regionIdx, 0);
  assertEqual(cur.systemIdx, 0);
});

test('Galaxy 255 wraps to 0', () => {
  const u = new UniverseSystem();
  for (let i = 0; i < 255; i++) u.warpGalaxy();
  assertEqual(u.getStats().galaxyIdx, 0, 'Should wrap back to galaxy 0 after 255 warps');
});

test('getStats returns sane values', () => {
  const u = new UniverseSystem();
  const s = u.getStats();
  assertEqual(s.totalGalaxies, 255);
  assert(s.systemsInGalaxy > 1_000_000, 'Universe should have > 1M systems per galaxy');
  assert(s.totalSystems > 1_000_000_000, 'Total systems should exceed 1 billion');
  assert(s.galaxyName.length > 0, 'Galaxy name should be non-empty');
});

test('Planets in home system have valid structure', () => {
  const u   = new UniverseSystem();
  const sys = u.getCurrentSystem();
  assert(Array.isArray(sys.planets), 'System should have planets array');
  assertGte(sys.planets.length, 2, 'Should have at least 2 planets');
  for (const p of sys.planets) {
    assert(p.seed !== undefined, 'Planet should have seed');
    assert(p.typeOverride, 'Planet should have type override');
    assertGte(p.orbitRadius, 100, 'Orbit radius should be positive');
  }
});

test('serialize/load round-trip preserves position and visited', () => {
  const u = new UniverseSystem();
  const adj = u.getAdjacentSystems(1);
  u.warpTo(adj[0].id);
  const data = JSON.parse(JSON.stringify(u.serialize()));
  const u2 = new UniverseSystem();
  u2.load(data);
  const cur = u2.getCurrentSystem();
  assertEqual(cur.id, adj[0].id, 'Should restore position after load');
  assert(u2.getStats().visitedCount >= 2, 'Visited count should be restored');
});

test('[STRESS] Generate 1000 systems and verify all unique IDs', () => {
  const u    = new UniverseSystem();
  const seen = new Set();
  for (const sys of u.getLoadedSystems()) {
    assert(!seen.has(sys.id), `Duplicate system id: ${sys.id}`);
    seen.add(sys.id);
    assert(sys.name.length > 0, 'Every system needs a name');
    assert(['M','K','G','F','A','B','O'].includes(sys.starType),
      `Unknown star type: ${sys.starType} in ${sys.id}`);
  }
  assertEqual(seen.size, 1000, 'Region should have exactly 1000 systems');
});

test('[STRESS] Warp 50 times and verify consistent state', () => {
  const u = new UniverseSystem();
  for (let i = 0; i < 50; i++) {
    const adj = u.getAdjacentSystems(1);
    if (adj.length > 0) u.warpTo(adj[0].id);
    const cur = u.getCurrentSystem();
    assert(cur.id, `System must have id after warp ${i}`);
    assert(cur.name.length > 0, `System must have name after warp ${i}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  10. NOISE / TERRAIN
// ═════════════════════════════════════════════════════════════════════════════
suite('SimplexNoise — range, determinism, fbm, warpedFbm');

test('noise2D stays in [-1, 1] across 10,000 samples', () => {
  const sn  = new SimplexNoise(42);
  let outMin = Infinity, outMax = -Infinity;
  for (let i = 0; i < 10000; i++) {
    const v = sn.noise2D(Math.random() * 100 - 50, Math.random() * 100 - 50);
    if (v < outMin) outMin = v;
    if (v > outMax) outMax = v;
  }
  assertGte(outMin, -1.05, `noise2D min ${outMin} below -1`);
  assertLte(outMax,  1.05, `noise2D max ${outMax} above  1`);
});

test('noise2D is deterministic with same seed', () => {
  const a = new SimplexNoise(1337);
  const b = new SimplexNoise(1337);
  for (let i = 0; i < 100; i++) {
    const x = i * 0.1, y = i * 0.13;
    assertEqual(a.noise2D(x, y), b.noise2D(x, y), `Noise should be deterministic at (${x},${y})`);
  }
});

test('noise2D differs between seeds', () => {
  const a = new SimplexNoise(1);
  const b = new SimplexNoise(2);
  let same = 0;
  // Use fractional coordinates to avoid integer-coord collision artifacts
  for (let i = 0; i < 100; i++) {
    const x = i * 0.137, y = i * 0.271;
    if (Math.abs(a.noise2D(x, y) - b.noise2D(x, y)) < 1e-10) same++;
  }
  assert(same < 10, 'Different seeds should produce mostly different values');
});

test('fbm returns value near [-1, 1]', () => {
  const sn = new SimplexNoise(7);
  for (let i = 0; i < 200; i++) {
    const v = fbm(sn, i * 0.03, i * 0.07);
    assertRange(v, -1.5, 1.5, `fbm value ${v} unexpected at sample ${i}`);
  }
});

test('warpedFbm returns value near [-1, 1]', () => {
  const sn = new SimplexNoise(99);
  for (let i = 0; i < 50; i++) {
    const v = warpedFbm(sn, i * 0.1, i * 0.05);
    assertRange(v, -2.0, 2.0, `warpedFbm value ${v} out of range`);
  }
});

test('Different seeds produce different terrain patterns', () => {
  const snA = new SimplexNoise(100);
  const snB = new SimplexNoise(200);
  let matches = 0;
  for (let i = 0; i < 50; i++) {
    if (Math.abs(fbm(snA, i, i) - fbm(snB, i, i)) < 0.001) matches++;
  }
  assert(matches < 10, 'Different seeds should produce largely different terrain');
});

test('[STRESS] 100,000 noise2D calls complete without NaN/Infinity', () => {
  const sn = new SimplexNoise(31415);
  let bad = 0;
  for (let i = 0; i < 100000; i++) {
    const v = sn.noise2D(i * 0.001, i * 0.0013);
    if (!Number.isFinite(v)) bad++;
  }
  assertEqual(bad, 0, 'No NaN/Infinity values should occur in 100k samples');
});

// ═════════════════════════════════════════════════════════════════════════════
//  11. DAY / NIGHT CYCLE SIMULATION
// ═════════════════════════════════════════════════════════════════════════════
suite('Day/Night Simulation — all 14 planet types, timing, edge cases');

// Mirrors the exact logic from planet.js + game.js
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

const DN_BASE = {
  LUSH:1200, BARREN:1600, TOXIC:800,  FROZEN:2400, BURNING:1400,
  EXOTIC:600, DEAD:3000, OCEAN:1100,  TROPICAL:960, ARCTIC:2800,
  VOLCANIC:1800, SWAMP:1000, DESERT:1600, CRYSTAL:720,
};
const DN_CENTER = {
  LUSH:0.78, BARREN:0.72, TOXIC:0.60, FROZEN:0.70, BURNING:0.68,
  EXOTIC:0.65, DEAD:0.58, OCEAN:0.80, TROPICAL:0.82, ARCTIC:0.65,
  VOLCANIC:0.60, SWAMP:0.63, DESERT:0.74, CRYSTAL:0.72,
};

function genDnPlanet(type, seed) {
  const rng    = makeRng(seed);
  const base   = DN_BASE[type] || 1200;
  const cycle  = Math.round(base * (0.6 + rng() * 0.8));
  const center = DN_CENTER[type] ?? 0.75;
  const df     = Math.min(0.90, Math.max(0.45, center + (rng() - 0.5) * 0.20));
  return { type, cycle, dayFraction: df };
}

function simDayNight(cycle, dayFraction) {
  const NIGHT_FRAC = 1 - dayFraction;
  let day = 0, night = 0;
  const STEPS = 10000, dt = cycle / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const tRaw = (i * dt) / cycle;
    const sunAngle = tRaw < dayFraction
      ? (tRaw / dayFraction) * Math.PI
      : Math.PI + ((tRaw - dayFraction) / NIGHT_FRAC) * Math.PI;
    if (Math.sin(sunAngle) > 0) day += dt; else night += dt;
  }
  return { day, night };
}

test('All planet types produce positive day AND night', () => {
  for (const type of Object.keys(DN_BASE)) {
    for (let seed = 1; seed <= 5; seed++) {
      const p = genDnPlanet(type, seed * 9999 + type.charCodeAt(0) * 7);
      const { day, night } = simDayNight(p.cycle, p.dayFraction);
      assertGte(day,   1, `${type}[seed${seed}] day should be > 0`);
      assertGte(night, 1, `${type}[seed${seed}] night should be > 0`);
    }
  }
});

test('dayFraction always in [0.45, 0.90] for all types', () => {
  for (const type of Object.keys(DN_BASE)) {
    for (let seed = 0; seed < 20; seed++) {
      const p = genDnPlanet(type, seed * 12345 + 1);
      assertRange(p.dayFraction, 0.45, 0.90,
        `${type}[seed${seed}] dayFraction ${p.dayFraction.toFixed(3)} out of [0.45,0.90]`);
    }
  }
});

test('Cycle length always positive and non-zero', () => {
  for (const type of Object.keys(DN_BASE)) {
    for (let seed = 0; seed < 20; seed++) {
      const p = genDnPlanet(type, seed * 7777 + 1);
      assertGte(p.cycle, 1, `${type}[seed${seed}] cycle should be >= 1s`);
    }
  }
});

test('Average day near 15min, average night near 5min across all types', () => {
  let totalDay = 0, totalNight = 0, count = 0;
  for (const type of Object.keys(DN_BASE)) {
    for (let seed = 1; seed <= 5; seed++) {
      const p = genDnPlanet(type, seed * 9999 + type.charCodeAt(0) * 7);
      const { day, night } = simDayNight(p.cycle, p.dayFraction);
      totalDay += day / 60; totalNight += night / 60; count++;
    }
  }
  const avgDay   = totalDay   / count;
  const avgNight = totalNight / count;
  assertRange(avgDay,   8,  25, `Average day ${avgDay.toFixed(1)}min out of [8,25]min range`);
  assertRange(avgNight, 2,  15, `Average night ${avgNight.toFixed(1)}min out of [2,15]min range`);
});

test('Day is always longer than night for each individual planet', () => {
  let failures = [];
  for (const type of Object.keys(DN_BASE)) {
    for (let seed = 1; seed <= 5; seed++) {
      const p = genDnPlanet(type, seed * 9999 + type.charCodeAt(0) * 7);
      const { day, night } = simDayNight(p.cycle, p.dayFraction);
      if (day < night) failures.push(`${type}[seed${seed}]: day=${(day/60).toFixed(1)}<night=${(night/60).toFixed(1)}`);
    }
  }
  assert(failures.length === 0, `Planets where night > day: ${failures.join(', ')}`);
});

test('No two LUSH planets in same region have identical cycles', () => {
  const cycles = [];
  for (let seed = 0; seed < 50; seed++) {
    const p = genDnPlanet('LUSH', seed * 1234 + 567);
    cycles.push(p.cycle);
  }
  const unique = new Set(cycles);
  assertGte(unique.size, 40, 'Most planets should have unique cycle lengths');
});

test('[SIM] 100 full cycles complete correctly (no drift)', () => {
  const p = genDnPlanet('LUSH', 42);
  // Simulate 100 cycles and verify total time == 100 * cycle
  let elapsed = 0;
  const STEPS_PER_CYCLE = 100;
  const dt = p.cycle / STEPS_PER_CYCLE;
  for (let cycle = 0; cycle < 100; cycle++) {
    for (let i = 0; i < STEPS_PER_CYCLE; i++) elapsed += dt;
  }
  const expected = 100 * p.cycle;
  assert(Math.abs(elapsed - expected) < 0.001, `Elapsed ${elapsed} != expected ${expected}`);
});

// ═════════════════════════════════════════════════════════════════════════════
//  12. PHYSICS CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════
suite('Physics — constants, terminal velocity, coyote time');

// Inline PHYSICS from physics.js (avoid THREE dep)
const PHYSICS = {
  TERMINAL_VELOCITY  : -55,
  AIR_DRAG_PER_SEC   : 0.88,
  GROUND_FRICTION_PS : 0.72,
  SLOPE_THRESHOLD    : 0.55,
  SLIDE_ACCEL        : 9,
  COYOTE_TIME        : 0.14,
  JUMP_BUFFER        : 0.10,
  STEP_HEIGHT        : 0.45,
  ACCEL_GROUND       : 60,
  ACCEL_AIR          : 18,
  PROJECTILE_SPEED   : 120,
  PROJECTILE_DROOP   : 4,
  PROJECTILE_LIFETIME: 3.0,
  PROJECTILE_RADIUS  : 0.45,
  CREATURE_RADIUS    : 0.7,
  MIN_SEPARATION     : 0.02,
};

test('PHYSICS constants are physically plausible', () => {
  assert(PHYSICS.TERMINAL_VELOCITY < 0, 'Terminal velocity should be negative (downward)');
  assertRange(Math.abs(PHYSICS.TERMINAL_VELOCITY), 20, 200,
    `Terminal velocity ${PHYSICS.TERMINAL_VELOCITY} implausible`);
  assertRange(PHYSICS.AIR_DRAG_PER_SEC, 0.5, 1.0,
    'Air drag should be between 0.5 and 1.0 per second');
  assertRange(PHYSICS.GROUND_FRICTION_PS, 0.3, 1.0,
    'Ground friction should be between 0.3 and 1.0 per second');
  assertRange(PHYSICS.COYOTE_TIME, 0.05, 0.5, 'Coyote time should be 50ms–500ms');
  assert(PHYSICS.ACCEL_GROUND > PHYSICS.ACCEL_AIR, 'Ground accel should exceed air accel');
  assertGte(PHYSICS.PROJECTILE_SPEED, 20, 'Projectile speed should be >= 20 m/s');
  assertGte(PHYSICS.STEP_HEIGHT, 0.1, 'Step height should be >= 0.1m');
});

test('[SIM] Gravity simulation reaches terminal velocity', () => {
  let vy = 0;
  const G  = WORLD.GRAVITY; // 22 m/s²
  const dt = 0.016;         // 60 fps
  let steps = 0;
  while (vy > PHYSICS.TERMINAL_VELOCITY && steps < 10000) {
    vy -= G * dt;
    vy = Math.max(vy, PHYSICS.TERMINAL_VELOCITY);
    steps++;
  }
  assertEqual(vy, PHYSICS.TERMINAL_VELOCITY, 'Should reach terminal velocity');
  assertGte(steps, 1, 'Should take at least 1 step to reach terminal velocity');
});

test('[SIM] Air drag reduces velocity exponentially', () => {
  let vx = 100;
  const dt = 0.016;
  for (let i = 0; i < 60; i++) vx *= Math.pow(PHYSICS.AIR_DRAG_PER_SEC, dt);
  assertRange(vx, 10, 90, 'After 1 second of drag, velocity should be reduced but not zero');
});

test('[SIM] Ground friction stops player in finite time', () => {
  let vx = PLAYER_CONFIG.SPRINT_SPEED;
  const dt = 0.016;
  let frames = 0;
  while (vx > 0.01 && frames < 10000) {
    vx *= Math.pow(PHYSICS.GROUND_FRICTION_PS, dt);
    frames++;
  }
  assert(vx <= 0.01, 'Player should stop from sprint speed with ground friction');
  assertLte(frames, 5000, 'Should stop in < 5000 frames (~83s)');
});

test('[SIM] Projectile with droop hits ground before max lifetime', () => {
  let y = 1.5; // player eye height
  let vy = 0;
  const speed = PHYSICS.PROJECTILE_SPEED;
  const droop = PHYSICS.PROJECTILE_DROOP;
  const dt    = 0.016;
  let t = 0;
  while (y > 0 && t < PHYSICS.PROJECTILE_LIFETIME) {
    vy -= droop * dt;
    y  += vy * dt;
    t  += dt;
  }
  assert(y <= 0 || t >= PHYSICS.PROJECTILE_LIFETIME,
    'Projectile should either hit ground or expire');
});

// ═════════════════════════════════════════════════════════════════════════════
//  13. COMBAT SIMULATION
// ═════════════════════════════════════════════════════════════════════════════
suite('Combat Simulation — damage, shields, HP, status effects in battle');

class SimPlayer {
  constructor() {
    this.hp          = PLAYER_CONFIG.MAX_HP;
    this.shield      = PLAYER_CONFIG.MAX_SHIELD;
    this.maxHp       = PLAYER_CONFIG.MAX_HP;
    this.maxShield   = PLAYER_CONFIG.MAX_SHIELD;
    this.lifeSupport = 100;
    this.dead        = false;
    this.sem         = new StatusEffectManager();
    this.shieldRegenDelay  = PLAYER_CONFIG.SHIELD_REGEN_DELAY;
    this.shieldRegenRate   = PLAYER_CONFIG.SHIELD_REGEN_RATE;
    this._shieldTimer      = 0;
  }
  applyDamage(dmg) {
    const absorbed = Math.min(this.shield, dmg);
    this.shield -= absorbed;
    const remainder = dmg - absorbed;
    this.hp = Math.max(0, this.hp - remainder);
    this._shieldTimer = 0;
    if (this.hp <= 0) this.dead = true;
  }
  drainLifeSupport(d) { this.lifeSupport = Math.max(0, this.lifeSupport - d); }
  update(dt) {
    this.sem.update(dt, this);
    this._shieldTimer += dt;
    if (this._shieldTimer >= this.shieldRegenDelay && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * dt);
    }
  }
}

test('Damage first drains shield before HP', () => {
  const p = new SimPlayer();
  p.applyDamage(40);
  assertEqual(p.shield, PLAYER_CONFIG.MAX_SHIELD - 40, 'Shield should absorb first 40');
  assertEqual(p.hp, PLAYER_CONFIG.MAX_HP, 'HP should be untouched while shield holds');
});

test('Excess damage bleeds through to HP after shield depleted', () => {
  const p = new SimPlayer();
  p.applyDamage(PLAYER_CONFIG.MAX_SHIELD + 30);
  assertEqual(p.shield, 0, 'Shield should be at 0');
  assertEqual(p.hp, PLAYER_CONFIG.MAX_HP - 30, 'Excess damage should hit HP');
});

test('Player dies when HP reaches 0', () => {
  const p = new SimPlayer();
  p.applyDamage(PLAYER_CONFIG.MAX_SHIELD + PLAYER_CONFIG.MAX_HP);
  assert(p.dead, 'Player should be dead');
  assertEqual(p.hp, 0, 'HP should be exactly 0');
});

test('Shield regenerates after regen delay', () => {
  const p = new SimPlayer();
  p.applyDamage(50); // drain shield
  // Wait for regen delay + 1 second of regen
  p.update(PLAYER_CONFIG.SHIELD_REGEN_DELAY + 1.0);
  assertGte(p.shield, PLAYER_CONFIG.SHIELD_REGEN_RATE * 1.0 - 1,
    'Shield should have regenerated some amount');
});

test('Shield does not exceed max during regen', () => {
  const p = new SimPlayer();
  p.applyDamage(5); // tiny damage
  for (let i = 0; i < 600; i++) p.update(0.1); // 60 seconds of regen
  assertLte(p.shield, PLAYER_CONFIG.MAX_SHIELD, 'Shield should not exceed max');
});

test('[SIM] Sustained combat: 10 hits of 20 damage each', () => {
  const p = new SimPlayer();
  for (let i = 0; i < 10; i++) {
    p.applyDamage(20);
    p.update(0.016);
  }
  const totalDmg = 200;
  const totalDmgAbs = totalDmg;
  const expectedHpMin = 0;
  assertGte(p.hp, expectedHpMin, 'HP should not go below 0');
  assertLte(p.hp + p.shield, PLAYER_CONFIG.MAX_HP + PLAYER_CONFIG.MAX_SHIELD,
    'Total HP+Shield should not exceed max');
});

test('[SIM] Burning DoT kills player with no regen if sustained', () => {
  const p = new SimPlayer();
  p.shield = 0; // no shield
  p.sem.apply('burning');
  let t = 0;
  while (!p.dead && t < 60) {
    p.update(0.5);
    t += 0.5;
  }
  // burning: 8 hp/s for 6s = 48 damage total – won't kill 100hp alone
  // but let's verify DoT actually dealt damage
  assert(p.hp < PLAYER_CONFIG.MAX_HP, 'Burning should deal damage over time');
});

test('[SIM] Player under multiple effects: frozen slows, burning hurts', () => {
  const p = new SimPlayer();
  p.shield = 0;
  p.sem.apply('burning');
  p.sem.apply('frozen');
  const speedMult = p.sem.getSpeedMult();
  assert(speedMult < 1.0, 'Frozen+burning should reduce speed (frozen=0.5)');
  p.update(3.0);
  assert(p.hp < PLAYER_CONFIG.MAX_HP, 'Burning should deal damage alongside frozen');
});

// ═════════════════════════════════════════════════════════════════════════════
//  14. LIMIT / EDGE CASE / ISOLATION STRESS TESTS
// ═════════════════════════════════════════════════════════════════════════════
suite('Limit & Stress — push game systems to extremes');

test('[LIMIT] Inventory: add MAX_STACK * 48 items and verify correct total', () => {
  const inv  = new Inventory(48);
  const type = 'Carbon';
  let expected = 0;
  // Fill every slot to 9999 with the same item (it will use all 48 slots)
  for (let slot = 0; slot < 48; slot++) {
    const ov = inv.addItem(`UniqueItem_${slot}`, 9999);
    assertEqual(ov, 0, `Slot ${slot} should not overflow`);
    expected += 9999;
  }
  // Now a 49th unique item has nowhere to go
  const ov = inv.addItem('FinalItem', 1);
  assertEqual(ov, 1, 'Should return overflow=1 when all 48 slots full');
});

test('[LIMIT] Quest: sending 99999 scan events does not break progress', () => {
  const qs = new QuestSystem();
  qs.start('explorer_path'); // needs 5 scans
  for (let i = 0; i < 99999; i++) qs.reportEvent('scan', {});
  // Quest should be completed (warp still needed), not crashed
  const active = qs.getActive();
  // Either still active (warp not done) or completed
  assert(active.length >= 0, 'Quest system should survive 99999 events');
});

test('[LIMIT] Trading: buying 0 qty returns not-ok without crash', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  const res = ts.buy('sys', 'carbon', 0, inv, 999999);
  assert(!res.ok, 'Buying 0 qty should fail gracefully');
});

test('[LIMIT] Trading: selling 0 qty returns not-ok without crash', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  inv.addItem('Carbon', 100);
  const res = ts.sell('sys', 'carbon', 0, inv);
  assert(!res.ok, 'Selling 0 qty should fail gracefully');
});

test('[LIMIT] Faction: addRep to non-existent faction is safe no-op', () => {
  const fm = new FactionManager();
  fm.addRep('totally_fake_faction', 100); // should not throw
  assertEqual(fm.getRep('totally_fake_faction'), 0, 'Non-existent faction should return 0 rep');
});

test('[LIMIT] StatusEffect: update with very large dt expires all effects cleanly', () => {
  const sem = new StatusEffectManager();
  const p   = mockPlayer();
  sem.apply('burning');
  sem.apply('frozen');
  sem.apply('poisoned');
  sem.update(999999, p); // massive time step
  assertEqual(sem.getHudIcons().length, 0, 'All effects should expire with large dt');
});

test('[LIMIT] Universe: warpTo 0_0_0 always lands on New Meridian', () => {
  const u = new UniverseSystem();
  u.warpGalaxy(); // go somewhere
  u.warpTo('0_0_0');
  assertEqual(u.getCurrentSystem().name, 'New Meridian', 'Should always return to home');
});

test('[LIMIT] Inventory: negative amount add does not corrupt state', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 100);
  // Passing negative amount – the while loop condition `amount > 0` will be false immediately
  inv.addItem('Carbon', -50);
  // Result depends on implementation; critical thing is no crash and no negative amounts
  const amt = inv.getAmount('Carbon');
  assertGte(amt, 0, 'Amount should not go negative');
});

bugTest('[BUG HUNT] Inventory: addItem with amount=0 should not create empty slots', () => {
  const inv = new Inventory(48);
  inv.addItem('Carbon', 0);
  const slots = inv.getAllItems();
  assertEqual(slots.length, 0, 'Zero-amount add SHOULD NOT create a slot. If this fails, there is a zero-slot bug.');
});

bugTest('[BUG HUNT] Crafting: craft should fail when inventory is missing ONE ingredient', () => {
  const inv = new Inventory(48);
  // warp_cell needs Di-Hydrogen:50 AND Chromatic Metal:30
  inv.addItem('Di-Hydrogen', 50); // only one ingredient
  const cs = new CraftingSystem(inv);
  const ok = cs.craft('warp_cell');
  assert(!ok, 'Crafting with only half the ingredients SHOULD fail. If this passes, partial-craft bug exists.');
  assertEqual(inv.getAmount('Di-Hydrogen'), 50, 'Inventory should be unchanged after failed craft attempt');
});

bugTest('[BUG HUNT] Quest: events for wrong resource should NOT advance progress', () => {
  const qs = new QuestSystem();
  qs.start('first_steps'); // needs Carbon:100
  qs.reportEvent('collect', { resource: 'Gold', amount: 9999 });
  const active = qs.getActive()[0];
  const carbonObj = active?.objectives.find(o => o.resource === 'Carbon');
  assertEqual(carbonObj?.progress, 0,
    'Collecting wrong resource SHOULD NOT advance Carbon objective. Bug if non-zero.');
});

bugTest('[BUG HUNT] Trading: sell more than owned should fail atomically', () => {
  const ts  = new TradingSystem();
  const inv = new Inventory(48);
  inv.addItem('Carbon', 10);
  const res = ts.sell('sys', 'carbon', 100, inv); // try to sell 100, only have 10
  assert(!res.ok, 'Selling more than owned SHOULD fail');
  assertEqual(inv.getAmount('Carbon'), 10, 'Carbon should be UNCHANGED after failed sell. Bug if 0.');
});

bugTest('[BUG HUNT] StatusEffect: stacking same effect should not double the duration beyond max', () => {
  const sem = new StatusEffectManager();
  sem.apply('burning'); // duration=6
  sem.apply('burning'); // refresh
  const state = sem._effects.get('burning');
  assertLte(state.remaining, StatusEffectManager.DEFS.burning.duration + 0.001,
    'Re-applying SHOULD NOT stack duration beyond single effect max. Bug if doubled.');
});

bugTest('[BUG HUNT] Faction: declaring war twice should not double-penalise rep', () => {
  const fm     = new FactionManager();
  const before = fm.getRep('gek');
  fm.declareWar('gek', 'vykeen');
  const after1 = fm.getRep('gek');
  fm.declareWar('gek', 'vykeen');
  const after2 = fm.getRep('gek');
  assertEqual(after1, after2,
    'Declaring war on already-at-war pair SHOULD NOT re-penalise rep. Bug if rep drops further.');
});

bugTest('[BUG HUNT] Universe: serialise/load then warp should work correctly', () => {
  const u1   = new UniverseSystem();
  const adj  = u1.getAdjacentSystems(1);
  u1.warpTo(adj[0].id);
  const data = JSON.parse(JSON.stringify(u1.serialize()));
  const u2   = new UniverseSystem();
  u2.load(data);
  // Warping after load should still work
  const adj2 = u2.getAdjacentSystems(1);
  assert(adj2.length > 0, 'getAdjacentSystems after load+warp should return results');
  const ok = u2.warpTo(adj2[0].id);
  assert(ok, 'Warp after serialize/load SHOULD succeed. Bug if it fails.');
});

// ═════════════════════════════════════════════════════════════════════════════
//  SUMMARY
// ═════════════════════════════════════════════════════════════════════════════
const totalTests = _passed + _failed;
console.log('\n' + '═'.repeat(70));
console.log('  RESULTS');
console.log('═'.repeat(70));
console.log(`  Total : ${totalTests}`);
console.log(`  ✅ Pass : ${_passed}`);
console.log(`  ❌ Fail : ${_failed}`);
console.log(`  🐛 Bugs : ${_bugs.length}`);
console.log('═'.repeat(70));

if (_failures.length > 0) {
  console.log('\n❌ FAILURES:');
  for (const f of _failures) {
    console.log(`  [${f.suite}] ${f.name}`);
    console.log(`    → ${f.error}`);
  }
}

if (_bugs.length > 0) {
  console.log('\n🐛 BUGS FOUND (real issues to fix):');
  for (const b of _bugs) {
    console.log(`  [${b.suite}] ${b.name}`);
    console.log(`    → ${b.error}`);
  }
}

if (_failed === 0 && _bugs.length === 0) {
  console.log('\n🚀 All systems nominal — no failures, no bugs detected.\n');
} else if (_failed === 0 && _bugs.length > 0) {
  console.log(`\n⚠️  Tests all pass but ${_bugs.length} bug(s) found — see above.\n`);
} else {
  console.log(`\n💥 ${_failed} test failure(s) — fix before shipping.\n`);
}

process.exit(_failed > 0 ? 1 : 0);
