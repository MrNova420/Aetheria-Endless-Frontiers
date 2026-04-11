# Aetheria: Endless Frontiers — Development Guide

> Per-module API reference, conventions, and how to extend the game.

---

## Conventions

| Rule | Detail |
|---|---|
| One file per system | All systems live in `src/`, one `.js` per system |
| ES modules only | `import`/`export`, no bundler, no CommonJS |
| No build step | Verify with brace-balance check (see ARCHITECTURE.md) |
| Seeded RNG everywhere | Use `seededRng(seed)` for all procedural content |
| PBR materials | Use `MeshStandardMaterial` with `roughness`/`metalness` |
| Dispose everything | Call `geometry.dispose()`, `material.dispose()` on remove |
| Constants at top | Game-balance numbers go in named constants at file top |
| `_sv1/_sv2/_sv3` | Scratch Vector3s in game.js — never store references |

---

## Module APIs

### config.js
```js
export const WORLD        // chunk size, LOD, gravity, height scale, day duration
export const PLANET_TYPES // { LUSH, BARREN, TOXIC, … }  (14 types)
export const BIOME_COLORS // { LUSH:{low,mid,high,…}, … }  (single fallback palette)
export const PLANET_GRAVITY   // { LUSH:1.0, BARREN:0.9, … }
export const PLANET_HAZARD_RATES
export const CLASSES      // { EXPLORER, WARRIOR, TRADER }
```

### universe.js
```js
export class UniverseSystem {
  getCurrentSystem()         // → system descriptor
  getLoadedSystems()         // → array of 1000 system descriptors in current region
  getAdjacentSystems(n=8)    // → n nearest systems sorted by distance
  warpTo(systemId)           // → bool; systemId = "g_r_s"
  warpGalaxy()               // → advance to next galaxy (increments galaxyIdx)
  getGalaxyName()            // → string
  getStats()                 // → { galaxyName, galaxyIdx, visitedCount, … }
  serialize() / load(data)
}

export function getGalaxyTier(galaxyIdx)   // → { tier, label, col, unlock, … }
export function getGalaxyLore(galaxyIdx)   // → string
export const GALAXY_TIERS                  // array of 6 tier definitions
```

**System descriptor shape:**
```js
{
  id, galaxyIdx, regionIdx, systemIdx, seed, name,
  position: { x, y },
  starType, starColor, starGlow, starSize, starIntensity,
  economy, economyIcon, economyDescr, conflictLevel,
  hasBinary, binaryCompanion,
  planets: [{ seed, typeOverride, orbitRadius, moonCount }],
  traits,    // string[]  0-2 from TRAIT_POOL
  wealth,    // 0-5
  danger,    // 0-5
  galaxyTier, galaxyTierLabel,
  visited,   // bool
}
```

### planet.js
```js
export class PlanetGenerator {
  static generate(seed, typeOverride?, { isHomeworld?, galaxyIdx? })
    // → planet descriptor (50+ fields, see below)

  static getSystemPlanets(systemSeed, systemData?)
    // → array of planet descriptors
}

export class PlanetAtmosphere {
  constructor(scene, planetConfig)
  update(dt, sunDir, playerPos)
  setSunPosition(dir)
  dispose()
}
```

**Planet descriptor shape (key fields):**
```js
{
  id, name, seed, type,
  // Colours (all THREE.Color)
  atmosphereColor, rayleighColor, fogColor, waterColor,
  vegetationColor, rockColor, sandColor, snowColor, sunColor, ambientColor,
  // Terrain
  waterLevel, hasWater, heightScale, gravity,
  fogDensity, cloudCoverage,
  // Life
  floraDensity, faunaDensity,
  // Hazards
  temperature, toxicity, radiation, stormFrequency,
  hazardType, hazardRates,
  // Visual extras
  hasRings, moons: [{ name, color, size, emissive, orbitSpeed, orbitAngle, orbitTilt }],
  nightGlowColor, emissiveStrength,
  // Resources
  resourceWeights: { [resourceType]: weight },
  // Generation metadata
  modifier: { id, tag, … } | null,
  habitability,   // 0-10
  dominantFaction,
  settlements: [{ id, type, x, z, faction, npcCount, seed }],
  ownedBy: null | playerId,
}
```

### terrain.js
```js
export class TerrainManager {
  constructor(scene, planet, noise)
  setManagers(floraManager, resourceManager)
  update(playerPos, dt)
  updateLighting(sunDir, sunColor, ambientColor)
  getHeightAt(x, z)   // → float
  getBiomeAt(x, z)    // → { type, height, norm }
  setWetness(wet)     // 0-1
  dispose()
}
```

### flora.js
```js
export class FloraManager {
  constructor(scene, planet)
  spawnForChunk(cx, cz, chunkSize, getHeightAt, getBiomeAt, rng)
  removeForChunk(cx, cz)
  update(dt, windTime)
  dispose()
}
```

### creatures.js
```js
export class CreatureManager {
  constructor(scene, planet, physics)
  update(dt, playerPos, inp)
  spawnInChunk(cx, cz, chunkSize, getHeightAt, getBiomeAt)
  despawnForChunk(cx, cz)
  getNearbyCreatures(pos, radius)   // → Creature[]
  getDamageables(pos, radius)       // → Creature[]
  dispose()
}

class Creature {
  getPosition()           // → THREE.Vector3
  takeDamage(amount)      // → bool (true = died)
  isBoss()                // → bool
  isAlive()               // → bool
  drainPendingHits()      // → number (pending damage from player)
  getLoot()               // → { [type]: amount }
  genome: { isBoss, bodySize, aggression, maxHp, … }
}
```

### player.js
```js
export class Player {
  constructor(scene, camera, classId?)
  update(inputs, dt, terrain, physicsWorld)
  getPosition()       // → THREE.Vector3
  applyDamage(amount, source)   // → actual damage after shield
  heal(amount)
  setHazardProtection(mult)
  serializeState()
  loadState(data)
  // Public properties:
  hp, maxHp, shield, maxShield, jetpackFuel, lifeSupportDrainMult
}
```

### ship.js
```js
export class Ship {
  constructor(scene, planet, physics, shipClass?)
  update(dt, inputs, terrain)
  // shipClass: 'explorer'|'fighter'|'freighter'|'scout'|'alien'
  // inputs: { shipThrust, shipYaw, shipPitch }
  getPosition()
  setPosition(pos)
  flightMode   // 'LANDED'|'ATMOSPHERIC'|'SPACE'
}
```

### npcs.js
```js
export class NpcManager {
  constructor(scene, factions)
  spawnNpc(type, pos, factionId?)
  // type: 'merchant'|'guard'|'wanderer'|'quest_giver'|'faction_agent'|'bounty_hunter'|'settler'
  spawnSettlement(basePos, factionId, size)
  // size: 'city'|'town'|'village'|'camp'
  update(dt, playerPos)
  interact(playerPos, radius)   // → NPC | null
  dispose()
}
```

### building.js
```js
export class BuildingSystem {
  constructor(scene)
  place(typeId, pos, quaternion)   // → building id
  remove(id)
  update(dt)
  getPowerStatus()   // → { produced, consumed, surplus }
  serialize() / load(data)
  dispose()
  static buildMesh(typeId)   // preview mesh for build mode
  // typeId: 'extractor'|'conveyor'|'storage'|'power_generator'|
  //         'research_station'|'turret'|'town_hub'|'wall'|'door'|'farm'
}
```

### inventory.js
```js
export class Inventory {
  addItem(type, amount)     // → overflow count
  removeItem(type, amount)  // → bool success
  getAmount(type)           // → number
  getAllItems()              // → [{ type, amount }]
  serialize() / load(data)
}
```

### physics.js
```js
export class PhysicsWorld {
  addBody(body)
  removeBody(body)
  fireProjectile(origin, direction, ownerId, scene, color)
  step(dt)
  dispose(scene)
}
```

---

## Adding a New Planet Type

1. Add entry to `PLANET_TYPES` in `config.js`
2. Add `BIOME_COLORS[NEWTYPE]` in `config.js`
3. Add `PLANET_GRAVITY[NEWTYPE]` in `config.js`
4. Add `PLANET_HAZARD_RATES[NEWTYPE]` in `config.js`
5. Add `TYPE_DEFAULTS[NEWTYPE]` in `planet.js`
6. Add `RESOURCE_WEIGHTS_BY_TYPE[NEWTYPE]` in `planet.js`
7. Add `TYPE_PALETTES[NEWTYPE]` in `planet.js` (array of 4+ palettes)
8. Add `BIOME_TINTS[NEWTYPE]` in `creatures.js`
9. Add `BIOME_FLORA_WEIGHTS[NEWTYPE]` in `flora.js`
10. Add lore entries in `lore.js` `PLANET_DESCRIPTIONS[NEWTYPE]`
11. Add to `habBase`, `SETTLE_POOLS`, `FACTION_BY_TYPE` in `planet.js`
12. Update `STAR_PLANET_BIAS` in `universe.js` to include the new type

---

## Adding a New Building Type

1. Add entry to `BUILDING_TYPES` in `building.js`
2. Add `BUILDING_PALETTES[typeId]` in `building.js`
3. Implement geometry in `_createMesh(typeId, preview)` switch statement
4. Wire into power grid if needed (`powerDraw` / `powerProduce`)

---

## Adding a New Ship Class

1. Add entry to `CLASS_PALETTES` in `ship.js` with HSL values for all 5 zones
2. Add geometry variant in `buildShipMesh(seed, shipClass)` switch/if block
3. Add to ship class selection in `game.js` `_setupShip()`

---

## Adding a Quest

In `src/quests.js`, add to the `QUEST_DEFS` array:
```js
{
  id: 'my_quest',
  title: 'Quest Title',
  steps: [
    { event: 'event_name', target: 3, desc: 'Do X three times' },
    { event: 'other_event', target: 1, desc: 'Do Y once' },
  ],
  reward: { xp: 500, units: 1000, items: [{ type: 'Gold', amount: 5 }] },
}
```

Trigger progress from anywhere with: `this._quests.reportEvent('event_name')`

---

## Brace-Balance Check (Required Before PR)

```bash
node --input-type=module -e '
import fs from "fs";
let ok=true;
for(const f of fs.readdirSync("src").filter(f=>f.endsWith(".js")).map(f=>"src/"+f)){
  const s=fs.readFileSync(f,"utf8");
  const d=(s.match(/\{/g)||[]).length-(s.match(/\}/g)||[]).length;
  if(d){console.log("WARN",f,d);ok=false;}
}
if(ok)console.log("All balanced");
' && node -c server.js
```
