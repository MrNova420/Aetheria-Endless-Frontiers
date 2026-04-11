# AETHERIA: Endless Frontiers — Design & Architecture Document

> **Version:** 5.0 | **Status:** Active Development | **Engine:** Three.js r162 / Node.js WebSocket

---

## 1. Vision

**GTA × No Man's Sky × Satisfactory — in your browser.**

Three pillars:

| Pillar | Inspiration | Meaning in Aetheria |
|---|---|---|
| **Open-world freedom** | GTA V | Go anywhere, do anything, own planets |
| **Infinite procedural universe** | No Man's Sky | 255 galaxies × 8.4B systems × 14 planet types |
| **Factory / base building** | Satisfactory | Extractors, conveyors, power grids, research |

---

## 2. Universe Generation Pipeline

```
UniverseSystem._genSystem(g, r, s)
  └─ hashCoord(g,r,s) → 32-bit seed
  └─ getGalaxyTier(g) → tier (1-6), dangerMult, wealthMult, starWeights
  └─ pickStarClassTiered(rng, tier) → M/K/G/F/A/B/O
  └─ STAR_PLANET_BIAS[starType] → planet type pool
  └─ ECONOMIES[rng] → economy
  └─ TRAIT_POOL × 0-2 → system traits
  └─ wealth = f(tier, economy, traits)
  └─ danger = f(tier, conflict, traits)
  └─ planets[0..N] → { seed, typeOverride, orbitRadius, moonCount }

PlanetGenerator.generate(seed, typeOverride, { galaxyIdx })
  └─ TYPE_PALETTES[type][palIdx] → base colours (6-9 variants)
  └─ galaxyChromaTint(galaxyIdx) → ΔH/ΔS/ΔL applied to all colours
  └─ PLANET_MODIFIERS[rng] → modifier (paradise/mega/irradiated/…)
  └─ MOON_TYPES[0..3] → moon descriptors
  └─ habitability → settlement count
  └─ settlements[0..3] → { type, x, z, faction, npcCount, seed }
  └─ Planet descriptor (50+ fields)
```

### Galaxy Tier System

| Tier | Galaxies | Label | Unlock Level | Danger Mult | Star Bias |
|---|---|---|---|---|---|
| 1 | 0–7 | Euclid Cluster | 1 | ×1.0 | Mostly M/K/G |
| 2 | 8–31 | Contested Expanse | 10 | ×1.4 | Balanced |
| 3 | 32–63 | Outer Reaches | 20 | ×1.9 | More F/A |
| 4 | 64–127 | Void Fringe | 35 | ×2.5 | More A/B |
| 5 | 128–191 | The Abyss | 55 | ×3.5 | More B/O |
| 6 | 192–254 | Convergence Core | 80 | ×5.0 | Mostly B/O |

### Planet Type Palette Coverage

Each of the 14 planet types now has 6–9 distinct colour palettes plus a galaxy-level chromatic tint (±18° hue, ±20% saturation, ±10% lightness). Combined with 10 modifiers, 10 moon type permutations, and 4+ moons possible, no two planets look identical across 8.4 billion systems.

| Type | Palettes | Notable Variants |
|---|---|---|
| LUSH | 9 | Verdant, Amber, Crimson, Teal, Neon, Bioluminescent, Slate |
| BARREN | 6 | Rust-red, Grey obsidian, Chalk-gold, Purple dust, Tan |
| TOXIC | 6 | Acid-green, Teal, Yellow sulphur, Purple haze, Dark bog |
| FROZEN | 6 | Ice-blue, Deep ice, Pale blue, Midnight tundra |
| BURNING | 5 | Scarlet, Amber fire, Crimson, Ochre flame |
| EXOTIC | 8 | Electric blue, Neon jungle, Rose, Golden anomaly, Blood |
| DEAD | 5 | Rust-dead, Olive, Dark slate, Ochre wasteland |
| OCEAN | 6 | Deep ocean, Tropical, Mystic ocean |
| TROPICAL | 7 | Golden, Violet, Standard |
| ARCTIC | 5 | Dark, Silver |
| VOLCANIC | 6 | Deep lava, Orange, Magma crimson, Ash purple |
| SWAMP | 6 | Dark peat, Lime, Purple mire, Golden bog |
| DESERT | 7 | Terracotta, Dusk, Red desert |
| CRYSTAL | 7 | Amethyst, Emerald, Citrine, Ruby, Sapphire, Topaz |

---

## 3. Terrain & Surface System

```
TerrainManager
  ├─ SimplexNoise × 3 (different seeds) → layered fBm height
  ├─ _buildChunk(cx, cz, lodIdx)
  │   ├─ PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, LOD_VERTS)
  │   ├─ Per-vertex height from noise.fbm2()
  │   └─ TerrainShader clone (uniforms: biome colours, wetness, wind, sun)
  ├─ _buildWaterChunk(cx, cz) → WaterShader mesh at planet.waterLevel
  ├─ update(playerPos, dt) → stream chunks in/out, advance uTime, uWindTime
  ├─ updateLighting(sunDir, sunColor, ambientColor) → updates all chunks + waterChunks
  └─ getBiomeAt(x,z) → { type, height, norm }

FloraManager
  ├─ BIOME_FLORA_WEIGHTS[14 types × 9 builders] → weighted selection
  ├─ Per-instance colour jitter: ΔH±0.08, ΔS±0.15, ΔL±0.12
  └─ Wind animation via uTime/uWindDir/uWindStrength uniforms

WeatherSystem → rain/blizzard/sandstorm/electrical storm
  └─ TerrainManager.setWetness(wet) → shader uniform uWetness
```

---

## 4. Player & Character System

```
Character Creation (index.html + game.js)
  ├─ Up to 3 independent save slots (aetheria_save_0 / _1 / _2)
  ├─ Character name input (free text, shown in HUD and multiplayer)
  ├─ 8 suit colour swatches → sets _suitColor hex on all 11 player mesh zones
  └─ Class selection (Runekeeper / Technomancer / Voidhunter)

Player (src/player.js)
  ├─ 11 material zones (MeshStandardMaterial, PBR)
  │   helmet, visor(emissive), chest-plate, torso, shirt,
  │   shoulder-pads, arms, gloves, hips, legs/boots, belt, jetpack
  ├─ Movement: walk 12 m/s, sprint 26 m/s, jump, jetpack (fuel drain/regen)
  │   Jetpack activates only when AIRBORNE (isGroundedOrCoyote = false)
  │   Jetpack thrust (40) always exceeds max planetary gravity (VOLCANIC ≈19.6)
  ├─ Camera: 3rd-person with head-tracking + pitch limit
  ├─ Life support: drains over time, hazard damage per planet type
  ├─ Health + shield system (shield regenerates after 3s)
  └─ serializeState() / loadState() for save system

Physics constants (src/game.js / src/player.js)
  WORLD.GRAVITY = 14 m/s²   (per-planet multiplier: LUSH×1.0 → VOLCANIC×1.4)
  JETPACK_THRUST = 40 m/s²  (always > gravity × 1.5 for all planet types)
  WALK_SPEED     = 12 m/s
  SPRINT_SPEED   = 26 m/s
  JETPACK_FUEL   = 100       (depletes at 30/s, recharges at 25/s on ground)
  COYOTE_TIME    = 0.14 s    (grace window to jump after walking off edge)
```

---

## 5. NPC & Creature System

### NPCs (src/npcs.js)
```
buildNpcMesh(factionId, seed)
  ├─ SPECIES[4]: humanoid, tall_lanky, squat_broad, four_armed
  ├─ SKIN_TONES[12]: warm to cold, human to alien
  ├─ ROLE_PALETTES[7]: merchant/guard/wanderer/quest_giver/agent/hunter/settler
  ├─ Per-zone colour variation: ΔH±0.10, ΔS±0.12, ΔL±0.10
  ├─ Emissive eyes, faction insignia ring, role accessories
  └─ Body parts: head, torso (top), hips (bottom), legs, boots, belt, arms, hands

NpcManager.spawnSettlement(basePos, faction, size)
  └─ Spawns NPC cluster appropriate to settlement size
```

### Creatures (src/creatures.js)
```
generateGenome(seed) → 17 traits including isBoss:false
generateBossGenome(seed) → extends base with isBoss:true, enhanced stats

Creature AI states: PATROL → ALERT → CHASE → ATTACK → RECOIL → FLEE → DEAD
BIOME_TINTS[14] → hue/saturation shift per planet type
```

---

## 6. Ship System

```
Ship (src/ship.js)
  ├─ CLASS_PALETTES[5]: explorer/fighter/freighter/scout/alien
  │   Each palette: hullH, hullS, hullL, accentH, accentS, accentL,
  │                 trimH, trimS, trimL, thrusterH, cockpitH
  ├─ Materials: hullMat, accentMat, trimMat, thrusterMat, cockpitMat (PBR)
  ├─ Geometry: LatheGeometry hull + nose cap + equator band + nacelles + wings
  ├─ Flight modes: LANDED → ATMOSPHERIC → SPACE
  └─ Physics: thrust, drag, gravity, terrain collision
```

---

## 7. Building System

```
BuildingSystem (src/building.js)
  ├─ 10 types: extractor, conveyor, storage, power_generator,
  │            research_station, turret, town_hub, wall, door, farm
  ├─ Per-type palette: { base, accent, trim, emissive, window }
  ├─ Per-type unique geometry (drill-bit, crop-rows, turret-barrel, etc.)
  ├─ Power grid: generator produces, others consume
  ├─ update(dt, inventory, primaryRes) → automation tick each frame
  │   extractor   : every 10 s → +2-5 primaryResource to inventory
  │   research_stn: every 30 s → +5 Nanites
  │   farm        : every 15 s → +3 Carbon
  ├─ serialize() / load() for save persistence
  └─ dispose() uses traverse() for full Three.js resource cleanup

Build Mode (src/game.js _toggleBuildMode / _tickSurface)
  ├─ B key toggles build mode on/off
  ├─ Digit keys 1–9 select building type (BUILD_RESOURCE_MAP maps costs)
  ├─ Left Click: raycast 6 units forward from player, snap to terrain height
  ├─ Cost check: BUILD_RESOURCE_MAP { iron→'Ferrite Dust', carbon→'Carbon',
  │              gold→'Chromatic Metal', sodium→'Sodium', … }
  ├─ On success: deduct inventory, show ✅ notification, award 20 XP
  └─ Build Panel HUD: shows all 10 types with colour-coded costs
       Green = player can afford  |  Red = insufficient resources
```

---

## 8. Game State Machine

```
GS.LOADING → GS.MAIN_MENU → GS.PLANET_SURFACE
                                    ↕ G key
                             GS.SHIP_ATMOSPHERE
                                    ↕ altitude
                             GS.SPACE_LOCAL
                                    ↕ M key
                             GS.GALAXY_MAP
```

---

## 9. Save / Load System (Version 4 — Per-Slot)

Three independent save slots stored in `localStorage`:
- `localStorage['aetheria_save_0']`  — Character slot 0
- `localStorage['aetheria_save_1']`  — Character slot 1
- `localStorage['aetheria_save_2']`  — Character slot 2

Each slot's JSON shape:
```json
{
  "version": 5,
  "charName": "Nova",
  "systemId": "0_0_0",
  "planetSeed": 10001,
  "planetType": "LUSH",
  "dayTime": 0.0,
  "player": {
    "pos": [0, 5, 0],
    "hp": 100, "shield": 80,
    "classId": "technomancer",
    "suitColor": 16744448,
    "charName": "Nova"
  },
  "inventory": { "slots": [] },
  "level": 1,
  "xp": 0,
  "xpToNext": 100,
  "techTree": {},
  "quests": {},
  "status": {},
  "extractors": [],
  "universe": { "g": 0, "r": 0, "s": 0, "visited": [] },
  "units": 3000,
  "nanites": 100,
  "buildings": [],
  "factions": {},
  "trading": {},
  "timestamp": 1744387200000
}
```

**Slot lifecycle methods on the `Game` class:**
| Method | Description |
|---|---|
| `getSlotSummaries()` | Returns array of 3 slot summaries (null if empty) |
| `startNewCharacter(slot, name, suitColor, classId)` | Creates a fresh character in the given slot |
| `loadSave(slot)` | Loads saved state from the given slot |
| `_getSlotKey(slot)` | Returns `'aetheria_save_${slot}'` |
| `_saveGame(silent?)` | Auto-saves or manual save to active slot |

---

## 10. Multiplayer Architecture

```
server.js (Node.js + ws)
  ├─ broadcastInterval: 20Hz, 800u proximity filter
  ├─ savePlayerProfile() on join + leave → data/players/<id>.json
  ├─ checkStorageHotPlug() every 30s → USB/SSD auto-detect
  └─ spawnHint in welcome message → safe spawn position

Client (src/network.js)
  └─ _updateOtherPlayerMeshes() → ghost meshes for visible players
```

---

## 11. Audio System

All sound is procedurally synthesised via Web Audio API — no audio files required.

| Category | Implementation |
|---|---|
| Footsteps | Filtered noise bursts |
| Jetpack | Oscillator + envelope |
| Mining beam | Sawtooth + LFO |
| Weapon fire | Short noise + pitch drop |
| Ambient | Layered drone pads per planet type |
| Weather | Filtered noise, intensity-scaled |
| Level up | Chord progression |
| UI clicks | Short sine blip |

---

## 12. Performance Notes

- Terrain chunks: `RENDER_DISTANCE` × 2 chunks loaded at any time
- Flora: spawned only in close chunks (< 2 chunk distances)
- Creatures: pooled, max 20 active within 300u
- NPC meshes: new per-NPC (seeded) but geometry is shared via cache
- Post-processing: Bloom (EffectComposer) — strength tuned per planet type
- Shadow casting: creatures + player cast; terrain only receives
