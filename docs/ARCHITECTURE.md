# Aetheria: Endless Frontiers — Architecture

> Module dependency map, data flow, and memory management reference.

---

## Module Dependency Graph

```
index.html
 └─ src/game.js  (main entry, ES module)
      ├─ config.js          constants (WORLD, PLANET_TYPES, BIOME_COLORS, CLASSES…)
      ├─ noise.js            SimplexNoise, fBm
      ├─ shaders.js          GLSL: TerrainShader, WaterShader, AtmosphereShader,
      │                            FloraShader, PostShader
      ├─ assets.js           GLTFLoader, TextureLoader, manifest.json
      ├─ audio.js            Web Audio procedural SFX + ambient
      ├─ physics.js          Bodies, projectiles, gravity wells, separation
      │
      ├─ universe.js         UniverseSystem (255 galaxies, 6 tiers, _genSystem)
      ├─ planet.js           PlanetGenerator, PlanetAtmosphere
      ├─ terrain.js          TerrainManager (LOD chunks, water, lighting)
      ├─ flora.js            FloraManager (biome-weighted, per-instance colour jitter)
      ├─ creatures.js        CreatureManager (genome, AI, BIOME_TINTS)
      ├─ weather.js          WeatherSystem
      ├─ space.js            SpaceScene (stars, asteroid belt, sun mesh)
      │
      ├─ player.js           Player (11-zone mesh, movement, camera, life support)
      ├─ ship.js             Ship (5-class PBR, 3 flight modes)
      ├─ npcs.js             NpcManager (4-species genome, settlements)
      ├─ sentinels.js        SentinelManager (drones, wanted level)
      ├─ building.js         BuildingSystem (10 types, power grid)
      ├─ extractor.js        AutoExtractor (deploy, drip resources)
      │
      ├─ inventory.js        Inventory (48 slots, add/remove/serialize)
      ├─ crafting.js         CraftingSystem (40+ recipes)
      ├─ mining.js           MiningSystem (resource nodes, beam, XP)
      ├─ trading.js          TradingSystem (30 commodities, market prices)
      ├─ factions.js         FactionManager (6 factions, reputation)
      ├─ quests.js           QuestSystem (event tracking, 3-quest chain)
      ├─ status.js           StatusEffectManager (burn/freeze/poison/energised/shield)
      │
      ├─ lore.js             LoreSystem (planet/creature/system descriptions)
      ├─ help.js             HelpSystem (in-game controls overlay)
      ├─ network.js          NetworkManager (WebSocket, proximity, ghost meshes)
      ├─ ui.js               HUD, menus, galaxy map, tech tree, crafting UI
      ├─ galaxy.js           Galaxy map data helper
      ├─ spawn.js            SpawnSystem (safe spawn finder, FNV-1a RNG)
      ├─ hardware-mesh.js    HardwareMeshContribution (idle CPU sharing)
      └─ mesh-worker.js      Web Worker relay
```

---

## Game State Machine

```
GS.LOADING
  └─ _setLoad(pct, msg) → progress bar
  └─ → GS.MAIN_MENU (after assets + terrain ready)

GS.MAIN_MENU
  └─ Slot picker: getSlotSummaries() → show 3 slot cards
  └─ New character flow:
       1. Enter name (char-name-input)
       2. Pick suit colour (suit-swatch, 8 options)
       3. selectClass(classId) → _giveStarterKit() → startNewCharacter()
       → _setupSurface() → _setupPlayer() → _setupShip() → GS.PLANET_SURFACE
  └─ Continue character:
       loadSave(slot) → _loadGame() → restore state → GS.PLANET_SURFACE

GS.PLANET_SURFACE
  └─ _tickSurface(dt) every frame
  └─ B key → _toggleBuildMode()
       └─ 1–9 keys select building type
       └─ LMB → raycast + place building (deduct resources, award XP)
  └─ G key (near ship) → _boardShip() → GS.SHIP_ATMOSPHERE
  └─ M key → _toggleGalaxyMap() → GS.GALAXY_MAP

GS.SHIP_ATMOSPHERE
  └─ _tickShip(dt) every frame
  └─ altitude > SPACE_ALTITUDE_THRESHOLD → GS.SPACE_LOCAL
  └─ G key (landed) → GS.PLANET_SURFACE

GS.SPACE_LOCAL
  └─ _tickSpace(dt) every frame
  └─ getPlanetAt(pos, ATMOSPHERE_ENTRY_RADIUS=600) → enter atmosphere
  └─ M key → GS.GALAXY_MAP

GS.GALAXY_MAP
  └─ Click star → _warpToSystem(sys) → consume Warp Cell
  └─ → GS.PLANET_SURFACE (after warp, always)
```

---

## Per-Frame Tick: _tickSurface(dt)

```
1.  Input polling (_keyPoll)
2.  Player.update(inputs, dt, terrain, physics)
    └─ jump / jetpack (only airborne when !isGroundedOrCoyote)
    └─ vel.y ≤ 0 guard for grounded-check (prevents mid-jump snap)
3.  Camera follow (lerp with Vector3 scratch)
4.  TerrainManager.update(playerPos, dt)       ← streams chunks
5.  FloraManager.update(dt, windTime)           ← wind animation
6.  CreatureManager.update(dt, playerPos)       ← AI tick
7.  NpcManager.update(dt, playerPos)            ← NPC AI tick
8.  SentinelManager.update(dt, playerPos)       ← sentinel drones
9.  WeatherSystem.update(dt)                    ← particles + uniforms
10. MiningSystem.update(dt, playerPos)          ← beam, resource drip
11. PhysicsWorld.step(dt)                       ← bodies + projectiles
12. StatusEffectManager.update(dt, player)      ← burn/freeze/…
13. AutoExtractor.update(dt, inventory)         ← resource drip
14. BuildingSystem.update(dt, inventory, primaryRes) ← building automation
15. Build mode placement check (if _buildMode && LMB)
16. TerrainManager.updateLighting(sunDir, …)    ← sun changes per day cycle
17. Atmosphere.update(dt, sunDir, playerPos)    ← moon orbits, day factor
18. HUD updates (HP, shield, life support, XP, wanted level, build panel)
19. Day/night cycle advance (_dayTime)
20. Hazard damage check (planet hazard type)
21. Autosave every AUTO_SAVE_INTERVAL seconds
```

---

## Data Flow: Planet Generation → Surface Setup

```
_warpToSystem(sys)
  └─ universe.warpTo(sys.id)          → updates _galaxyIdx, _regionIdx, _systemIdx
  └─ PlanetGenerator.generate(
       planetSeed,
       sys.planets[0].typeOverride,
       { galaxyIdx: sys.galaxyIdx }
     )
     ├─ TYPE_PALETTES[type][palIdx]   → base colours
     ├─ galaxyChromaTint(galaxyIdx)   → ΔH/ΔS/ΔL tint applied to all colours
     ├─ PLANET_MODIFIERS[rng]         → modifier (paradise/mega/irradiated/…)
     ├─ MOON_TYPES × moonCount        → moon descriptors
     └─ settlements[] + habitability  → settlement descriptors
  └─ _setupSurface(planet)
       ├─ TerrainManager(scene, planet, noise)
       ├─ FloraManager(scene, planet)
       ├─ CreatureManager(scene, planet)
       ├─ WeatherSystem(scene, planet)
       ├─ PlanetAtmosphere(scene, planet)
       ├─ SpaceScene.enterSystem(sys)
       ├─ scene.fog = FogExp2(planet.fogColor, planet.fogDensity)
       └─ _spawnSettlements(planet)
            └─ for each settlement:
                 NpcManager.spawnSettlement(pos, faction, size)
                 BuildingSystem.place(type, pos, quat) × bTypes
```

---

## Memory Management

### Three.js Resource Lifecycle

| Resource | Created | Disposed |
|---|---|---|
| Terrain chunk geometry | `_buildChunk()` | `_removeChunk()` → `geometry.dispose()` |
| Terrain chunk material | Clone per chunk | `material.dispose()` on remove |
| Water chunk mesh | `_buildWaterChunk()` | `waterChunks.delete(key)` + dispose |
| Flora group | `spawnForChunk()` | `removeForChunk()` → traverse dispose |
| Building mesh | `_createMesh()` | `dispose()` → traverse dispose |
| NPC mesh | `buildNpcMesh()` | `NpcManager.dispose()` |
| Creature mesh | `buildCreatureMesh()` | `CreatureManager.dispose()` |
| Atmosphere mesh | `PlanetAtmosphere._build()` | `atmosphere.dispose()` |

### Chunk Streaming

Chunks are indexed by `(cx, cz)` coordinates. The terrain manager maintains:
- `_chunks` Map: active chunk meshes (4 LOD levels)
- `waterChunks` Map: water plane meshes
- `_chunkFlora` Map (FloraManager): flora groups per chunk

On each `update(playerPos, dt)`:
1. Compute visible chunk range from player position
2. Remove chunks outside `RENDER_DISTANCE`
3. Add chunks inside range at appropriate LOD
4. LOD transition: seamless via vertex count (64→32→16→8 subdivisions)

---

## Shader Uniforms Reference

### TerrainShader
| Uniform | Type | Description |
|---|---|---|
| `uTime` | float | Elapsed seconds |
| `uSunDir` | vec3 | Normalised sun direction |
| `uSunColor` | vec3 | Sun light colour |
| `uAmbientColor` | vec3 | Ambient fill colour |
| `uWetness` | float | 0–1, set by WeatherSystem |
| `uWindTime` | float | Wind animation time |
| `uEmissiveStrength` | float | Lava/crystal glow intensity |
| `uLowColor` | vec3 | Ground / vegetation colour |
| `uMidColor` | vec3 | Rock / soil colour |
| `uHighColor` | vec3 | Peak / snow colour |
| `uWaterLevel` | float | Water plane height |

### AtmosphereShader
| Uniform | Type | Description |
|---|---|---|
| `uRayleighColor` | vec3 | Sky scatter colour |
| `uMieColor` | vec3 | Haze colour |
| `uSunDir` | vec3 | Sun direction |
| `uDayFactor` | float | 0–1 day brightness |
| `uCloudCoverage` | float | Cloud density |
| `uAuroraColor` | vec3 | Night glow / aurora |
| `uMoon0Dir/1Dir/2Dir` | vec3 | Moon direction vectors |
| `uMoon0Color/…` | vec3 | Moon disc colours |
| `uMoon0Size/…` | float | Angular size of moon disc |
| `uMoonCount` | int | Number of active moons |

---

## Server Architecture (server.js)

```
WebSocket server (port 8080 default)
  ├─ Static file handler (index.html, src/*, css/*, assets/*)
  ├─ Connection lifecycle:
  │   join  → assign playerId → spawnHint → savePlayerProfile()
  │   move  → proximity filter (800u) → broadcast to nearby
  │   chat  → broadcast to all
  │   leave → savePlayerProfile() → broadcast playerLeft
  ├─ broadcastInterval: setInterval(20Hz)
  │   └─ per-player spatial filter before send
  ├─ savePlayerProfile(id, data) → data/players/<id>.json
  └─ checkStorageHotPlug() → 30s interval → /storage/ /mnt/media_rw/ /run/media/
```

---

## Verify Build Health

```bash
# Check all JS files are brace-balanced
node --input-type=module -e '
import fs from "fs";
let ok=true;
for(const f of fs.readdirSync("src").filter(f=>f.endsWith(".js")).map(f=>"src/"+f)){
  const s=fs.readFileSync(f,"utf8");
  const d=(s.match(/\{/g)||[]).length-(s.match(/\}/g)||[]).length;
  if(d){console.log("WARN",f,d);ok=false;}
}
if(ok)console.log("All balanced");
'

# Check server syntax
node -c server.js
```
