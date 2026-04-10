# 🏗️ Development Guide – Aetheria: Endless Frontiers

This document covers the full architecture, system interactions, module API, and how to work on each part of the codebase.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Game State Machine](#2-game-state-machine)
3. [Module Reference](#3-module-reference)
4. [Asset Pipeline](#4-asset-pipeline)
5. [Shader System](#5-shader-system)
6. [Adding a New Planet Biome](#6-adding-a-new-planet-biome)
7. [Adding a New Crafting Recipe](#7-adding-a-new-crafting-recipe)
8. [Adding a New Creature](#8-adding-a-new-creature)
9. [Running Locally](#9-running-locally)
10. [Termux / Android Terminal](#10-termux--android-terminal)
11. [Performance Tuning](#11-performance-tuning)
12. [Debugging](#12-debugging)

---

## 1. Architecture Overview

```
index.html
  └── src/game.js          ← master orchestrator (RAF loop, state machine)
        ├── src/assets.js  ← loads GLB/textures; procedural fallback
        ├── src/planet.js  ← generates planet data (seed → config object)
        ├── src/terrain.js ← chunks terrain mesh from planet config
        ├── src/flora.js   ← instanced plants spawned on terrain
        ├── src/creatures.js ← AI fauna spawned per chunk
        ├── src/mining.js  ← resource nodes + extraction
        ├── src/player.js  ← input → physics → camera
        ├── src/ship.js    ← 3-mode flight (LANDED/ATM/SPACE)
        ├── src/space.js   ← space scene (stars, planets, station)
        ├── src/galaxy.js  ← 100-system map
        ├── src/inventory.js ← 48-slot item grid
        ├── src/crafting.js  ← recipes + tech tree
        ├── src/audio.js   ← Web Audio API sounds
        ├── src/ui.js      ← HUD, menus, notifications
        ├── src/shaders.js ← custom GLSL (terrain, atm, water, flora, space)
        ├── src/noise.js   ← simplex/perlin noise utils
        └── src/config.js  ← all numeric constants
```

**Key design principles:**
- Every module is self-contained and only talks to others through `game.js`.
- `game.js` passes references down on construction (e.g. `new Player(scene, camera)`).
- All Three.js geometry is built once and reused via instancing wherever possible.
- Assets are loaded through `AssetManager` which returns `null` on failure so every caller must have a procedural fallback.
- No build step required for web — Three.js is loaded from CDN via import-map.

---

## 2. Game State Machine

```
LOADING
  └─► MAIN_MENU
        └─► PLANET_SURFACE  ←→  SHIP_ATM  ←→  SPACE_LOCAL
              │                    │                 │
              └────────────────────┴─────────────────┘
                                   │
                              GALAXY_MAP (overlay)
                              PAUSED     (overlay)
                              DEAD       (overlay)
```

State is held in `game.state` (string enum `GS.*`).  
`game._setState(newState)` handles transitions and updates sub-system visibility.

| State | What's active |
|---|---|
| `LOADING` | Loading screen, asset preload |
| `MAIN_MENU` | Class select, controls panel |
| `PLANET_SURFACE` | Terrain, flora, creatures, mining, player on foot |
| `SHIP_ATM` | Ship atmospheric flight, terrain still active |
| `SPACE_LOCAL` | Space scene, planet meshes, no terrain |
| `GALAXY_MAP` | Overlay canvas, pauses simulation |
| `PAUSED` | Overlay, simulation frozen |
| `DEAD` | Death screen, player frozen |

---

## 3. Module Reference

### `src/config.js`
All game constants. Edit here to tune gameplay without touching logic files.

```js
PLAYER_CONFIG.WALK_SPEED      // m/s on foot
PLAYER_CONFIG.JETPACK_FUEL    // max fuel (drains at 30/s while thrusting)
WORLD.GRAVITY                 // m/s² downward acceleration
PLANET_TYPES[n]               // 8 biome definitions
RESOURCES[name]               // resource definitions with rarity + colours
```

### `src/noise.js`
Exports:
- `simplex2(x, y)` → `[-1, 1]`
- `simplex3(x, y, z)` → `[-1, 1]`
- `warpedFbm(x, y, octaves, lacunarity, gain)` → domain-warped fractal noise

### `src/planet.js`
```js
// Static factory – call with a seed integer
const planet = PlanetGenerator.generate(seed);
// Returns: { type, name, biomeIndex, waterLevel, fogColor, sunColor,
//            atmosphereColor, faunaDensity, floraDensity,
//            toxicity, radiation, temperature, ... }

// Atmosphere rendering
const atm = new PlanetAtmosphere(scene, planet);
atm.update(dt, sunDirection, playerPos);
atm.dispose();
```

### `src/terrain.js`
```js
const terrain = new TerrainManager(scene, planet, sunLight);
terrain.setManagers(floraManager, miningSystem); // call before first update
terrain.update(playerWorldPos);   // call every frame – handles chunk streaming
terrain.getHeightAt(x, z);        // returns world Y at any XZ position
terrain.dispose();
```
Chunk size: 192 world units. LOD: 3 levels (high/med/low detail).

### `src/flora.js`
```js
const flora = new FloraManager(scene, planet);
flora.update(dt, windTime);  // animates wind sway
flora.dispose();
// FloraManager is called by TerrainManager internally via setManagers()
```

### `src/creatures.js`
```js
const mgr = new CreatureManager(scene, planet);
mgr.update(dt, playerPos, getHeightAt);
mgr.getNearbyCreatures(pos, radius);  // returns Creature[]
mgr.dispose();
// Spawning is called by TerrainManager internally
```

### `src/mining.js`
```js
const mining = new MiningSystem(scene, inventory);
mining.update(dt, playerPos, isMining, miningDir, getHeightAt);
mining.getNodesNear(pos, radius);  // returns ResourceNode[]
mining.mine(nodeId, amount);       // extract resources
mining.dispose();
```

### `src/player.js`
```js
const player = new Player(scene, camera);
player.update(dt, input, terrain, mining);
player.getPosition();          // THREE.Vector3 clone
player.setPosition(v3);
player.applyDamage(amount, type);
player.heal(amount);
player.getStats();             // { hp, maxHp, shield, maxShield, jetpack, lifeSup }
player.serializeState();       // save/load object
player.loadState(data);
player.dispose();
```

Input object shape:
```js
{
  forward, back, left, right,   // booleans
  sprint, jump, mine, scan,      // booleans
  interact,
  mouseDX, mouseDY,              // raw mouse delta (reset each frame)
  shipThrust, shipYaw, shipPitch, shipRoll,  // -1..1 floats
}
```

### `src/ship.js`
```js
const ship = new Ship(scene);
ship.update(dt, input, terrain);
ship.isPlayerNear(playerPos);  // true if within 5 units
ship.enterShip(player);        // hides player model, sets _playerInside
ship.exitShip(player);         // shows player model, moves to door
ship.takeOff();
ship.land(targetY);
ship.getPosition();
ship.dispose();
```

### `src/inventory.js`
```js
const inv = new Inventory(48);
inv.addItem(type, amount);           // returns overflow
inv.removeItem(type, amount);        // returns true on success
inv.getAmount(type);                 // total count of type
inv.getSlots();                      // Slot[] array (null = empty)
inv.hasSpace();                      // boolean
```

### `src/crafting.js`
```js
const crafting = new CraftingSystem(inventory);
crafting.getAvailableRecipes();      // Recipe[]
crafting.canCraft(recipeId);         // boolean
crafting.craft(recipeId);            // boolean, adds outputs to inventory

const tech = new TechTree();
tech.isUnlocked(category, id);
tech.canAfford(category, id, inventory);
tech.upgrade(category, id, inventory);  // deducts cost, returns boolean
```

### `src/ui.js`
```js
const hud = new GameHUD();
hud.init();                                 // call once on startup
hud.update(dt, player, planet, ship, terrain, gameState);  // every frame
hud.showNotification(text, type, duration);
hud.showGalaxyMap(galaxy, currentSystemId);
hud.showInventoryScreen(inventory);
hud.showCraftingMenu(crafting, inventory);
hud.setLoadingProgress(pct, message);
hud.hideLoading();
hud.showHUD() / hud.hideHUD();
```

### `src/audio.js`
```js
const audio = new AudioManager();
// Must call init() after a user gesture (browser policy)
audio.init();
audio.playAmbient(planetType);    // 'LUSH' | 'BARREN' | 'TOXIC' | etc.
audio.playSFX(name);              // 'mine' | 'jump' | 'land' | 'warp' | 'craft'
audio.stopAmbient();
```

### `src/assets.js`
```js
const assets = getAssets();          // singleton
await assets.loadManifest();         // loads assets/manifest.json
await assets.preloadAll(onProgress); // loads everything declared in manifest
assets.cloneModel(key);              // THREE.Group clone or null (fallback)
assets.getTexture(key);              // THREE.Texture or procedural fallback
assets.hasRealModel(key);            // false if file was missing
assets.createMixer(key, clone);      // { mixer, clips } for animations
```

---

## 4. Asset Pipeline

### How it works

1. `assets/manifest.json` declares every asset with `file`, `source`, `fallback`.
2. `scripts/download-assets.js` downloads zip packs from Kenney.nl / AmbientCG, extracts them, and copies named files to `assets/models/` and `assets/textures/`.
3. At runtime, `AssetManager.preloadAll()` tries to load each file via `GLTFLoader` / `TextureLoader`. On 404 it silently falls back to procedural geometry.
4. Calling code checks `assets.cloneModel(key)` — if `null` it builds its own Three.js geometry instead.

### Adding a new model

1. Place the `.glb` in `assets/models/<category>/`.
2. Add an entry to `assets/manifest.json`:
```json
"my_model": {
  "file": "assets/models/environment/my_model.glb",
  "fallback": "procedural",
  "scale": [1.0, 1.0, 1.0]
}
```
3. Load it in your module:
```js
import { getAssets } from './assets.js';
const mesh = getAssets().cloneModel('my_model') ?? buildFallback();
```

---

## 5. Shader System

All shaders are in `src/shaders.js` as exported objects `{ uniforms, vertexShader, fragmentShader }`.

| Export | Purpose |
|---|---|
| `TerrainShader` | Triplanar PBR terrain with 4-texture splatting |
| `SpaceShader` | Skybox nebula + procedural starfield |
| `WaterShader` | Fresnel reflective water with wave displacement |
| `FloraShader` | Vertex wind animation for grass/plants |
| `AtmosphereShader` | Rayleigh + Mie scattering for planet sky |

To add a shader: export a new object from `shaders.js` and import it where needed.

---

## 6. Adding a New Planet Biome

1. Open `src/config.js`, find `PLANET_TYPES`.
2. Add a new entry:
```js
{
  name: 'GLITCH',
  fogColor: '#ff00ff',
  fogDensity: 0.015,
  atmosphereColor: '#aa00ff',
  sunColor: '#ffffff',
  terrainScale: 0.003,
  heightAmplitude: 120,
  waterLevel: -5,
  floraDensity: 0,
  faunaDensity: 0.3,
  toxicity: 0,
  radiation: 0.8,
  temperature: 0,
  groundColors: ['#ff00ff', '#aa00aa', '#660066'],
}
```
3. Add any biome-specific flora/creature rules in `flora.js` and `creatures.js` by checking `planet.type === 'GLITCH'`.

---

## 7. Adding a New Crafting Recipe

Open `src/crafting.js`, find the `RECIPES` object:

```js
my_new_item: {
  id: 'my_new_item',
  name: 'Plasma Core',
  category: 'tech',      // 'materials' | 'fuel' | 'tech' | 'food'
  inputs:  { 'Chromatic Metal': 50, 'Di-Hydrogen': 30 },
  outputs: { 'Plasma Core': 1 },
}
```

No further changes needed — `CraftingSystem` reads the `RECIPES` object automatically.

---

## 8. Adding a New Creature

Creature genomes are fully procedural via seed in `src/creatures.js`. To add a new body type:

1. In `generateGenome()`, extend the `legCounts` array or add new genome properties.
2. In `buildCreatureMesh()`, add new geometry cases for those properties.
3. To add a creature with a real GLB model, add it to `assets/manifest.json` as `creature_<name>` and check `assets.cloneModel('creature_<name>')` at the top of `buildCreatureMesh()`.

---

## 9. Running Locally

```bash
# Any platform
npm install
npm start          # → http://localhost:8080

# Custom port
PORT=3000 npm start

# With assets
npm run assets:quick   # download essential CC0 models + textures
npm start
```

No build step. The browser loads ES modules directly via CDN import-map.

---

## 10. Termux / Android Terminal

See `setup-termux.sh` and `docs/MOBILE_RELEASE.md` for full details.

Quick start in Termux:
```bash
pkg install git nodejs -y
git clone https://github.com/MrNova420/Aetheria-Endless-Frontiers.git
cd Aetheria-Endless-Frontiers
bash setup-termux.sh
```
Then open `http://localhost:8080` in Chrome on the same device.

---

## 11. Performance Tuning

These settings in `src/config.js` have the biggest FPS impact:

| Setting | Default | Low-end suggestion |
|---|---|---|
| `WORLD.CHUNK_VIEW_DIST` | 3 | 2 |
| `WORLD.FLORA_DENSITY` | 1.0 | 0.3 |
| `WORLD.CREATURE_DENSITY` | 1.0 | 0.2 |
| Bloom `strength` in `game.js` | 0.9 | 0.4 or disabled |
| Shadow map size | 2048×2048 | 1024×1024 |
| `renderer.setPixelRatio` | `min(dpr, 2)` | `min(dpr, 1)` |

On mobile/Termux-served devices the game auto-detects `navigator.hardwareConcurrency` to adjust density. You can also append `?quality=low` to the URL (implement in `config.js`).

---

## 12. Debugging

Open browser DevTools (F12) and check the Console for:

- `[assets] Model 'x' not found – using procedural fallback` — normal if assets not downloaded.
- `THREE.WebGLRenderer: Context Lost` — GPU memory pressure; reduce quality settings.
- Any `SyntaxError` in `src/*.js` — check the import path is correct in the failing file.

Useful dev commands in browser console:
```js
window.game.state              // current game state string
window.game._player.hp         // player HP
window.game._level             // current player level
window.game._xp                // current XP
window.game._inventory         // inventory object
window.game._currentPlanet     // current planet config
window.game._assets.stats      // { total, loaded, failed, real }
window.game._weather?.getWeatherName()  // active weather
// Give yourself items:
window.game._inventory.addItem('Gold', 50);
// Award XP:
window.game._awardXP(500);
// Warp to a specific system:
window.game._galaxy.getSystems()[3]  // pick a system
```

---

## 13. Combat System

The player fires a blaster shot on **right-click** (or gamepad R2). The weapon:
- Deals `ATTACK_DAMAGE = 25` points per hit
- Has `ATTACK_COOLDOWN = 0.5s` between shots
- Targets the nearest alive creature within `ATTACK_RANGE = 12` units
- Plays `attack_shoot` SFX, then `creature_kill` SFX on death
- Awards `XP_PER_KILL = 35` XP per kill
- Has a 55 % chance to drop a loot resource node at the kill site

Hostile creatures counter-attack automatically every `COMBAT_TICK_INTERVAL` seconds if within melee range.

---

## 14. XP & Leveling

```
XP awarded by:
  Mine cycle completion  → +30 XP per cycle
  Creature kill          → +35 XP
  System warp            → +50 XP
  Scanner discovery      → (future)

Level formula:
  xpToNext(n) = floor(100 × 1.35^(n-1))

Level-up effects:
  • +30 HP heal
  • Fanfare SFX + level-up flash
  • Notification toast
```

To add new XP sources, call `game._awardXP(amount)` from any tick method.

---

## 15. Weather Gameplay Effects

| Weather | Speed Mult | Life Support Drain |
|---------|-----------|-------------------|
| Normal  | 1.0 ×     | —                 |
| Storm   | 0.7 ×     | —                 |
| Sandstorm | 0.45 ×  | —                 |
| Blizzard  | 0.45 ×  | −2/s              |
| Toxic Fog | 1.0 ×   | −4/s              |

Effects are applied each tick in `_tickSurface()` and propagated via `inp._weatherSpeedMult` to the player controller.
