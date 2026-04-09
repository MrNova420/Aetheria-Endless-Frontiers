# 🏛️ Architecture & System Design – Aetheria: Endless Frontiers

Quick reference diagram and data-flow notes for developers.

---

## Module Dependency Graph

```
index.html
  └─ <script type="module" src="src/game.js">
        │
        ├─ src/assets.js       (AssetManager singleton)
        │     └─ assets/manifest.json
        │
        ├─ src/config.js       (pure constants – no dependencies)
        ├─ src/noise.js        (pure math – no dependencies)
        │
        ├─ src/planet.js       ← config, noise
        ├─ src/terrain.js      ← config, noise, shaders, flora*, mining*
        ├─ src/flora.js        ← noise, shaders, assets
        ├─ src/creatures.js    ← noise, assets
        ├─ src/mining.js       ← config, noise, assets
        │
        ├─ src/player.js       ← config, THREE
        ├─ src/ship.js         ← config, assets, THREE
        ├─ src/space.js        ← noise, shaders, assets, THREE
        ├─ src/galaxy.js       ← noise, THREE
        │
        ├─ src/inventory.js    (pure data – no THREE dependency)
        ├─ src/crafting.js     ← inventory
        │
        ├─ src/audio.js        (Web Audio API – no THREE)
        ├─ src/ui.js           (DOM – no THREE)
        └─ src/shaders.js      (GLSL strings – no dependencies)

* terrain.js receives floraManager and miningSystem via setManagers() callback
  to avoid circular imports
```

---

## Frame Update Order

Every animation frame, `game._tick(dt)` runs in this order:

```
1. Input poll       (_pollInput)
2. Game state tick
   ├─ LOADING       (asset progress only)
   ├─ MAIN_MENU     (idle)
   ├─ PLANET_SURFACE
   │    ├─ terrain.update(playerPos)      ← chunk streaming
   │    ├─ flora.update(dt, windTime)     ← wind animation
   │    ├─ creatures.update(dt, pos, h)   ← AI step
   │    ├─ mining.update(dt, pos, ...)    ← beam + extraction
   │    ├─ player.update(dt, input, ...)  ← physics + camera
   │    ├─ ship.update(dt, input, ...)    ← idle engine
   │    ├─ atmosphere.update(dt, sun, p)  ← sky shader uniforms
   │    └─ hud.update(dt, ...)            ← DOM updates
   ├─ SHIP_ATM
   │    ├─ terrain.update(playerPos)
   │    ├─ ship.update(dt, input, terrain)
   │    └─ hud.update(dt, ...)
   ├─ SPACE_LOCAL
   │    ├─ spaceScene.update(dt, camera)
   │    └─ hud.update(dt, ...)
   ├─ PAUSED / DEAD / GALAXY_MAP  ← no simulation tick
3. renderer / composer.render()
```

---

## State Machine Transitions

```
[LOADING] ──preloadDone──► [MAIN_MENU]
[MAIN_MENU] ──selectClass──► [PLANET_SURFACE]
[PLANET_SURFACE] ──enterShip──► [SHIP_ATM]
[SHIP_ATM] ──exitShip──► [PLANET_SURFACE]
[SHIP_ATM] ──reachOrbit──► [SPACE_LOCAL]
[SPACE_LOCAL] ──enterAtmo──► [SHIP_ATM]
[SPACE_LOCAL] ──warpTo──► [SPACE_LOCAL] (new system)
any ──KeyM──► [GALAXY_MAP] (overlay)
any ──Escape──► [PAUSED] (overlay)
any ──hp≤0──► [DEAD] (overlay)
```

---

## Data Flow: Mining → Inventory → Crafting

```
Player presses E near resource node
  → mining.update(..., isMining=true, ...)
      → _miningProgress += dt * rate
      → when _miningProgress >= nodeYield:
          inventory.addItem(node.resourceType, amount)
          spawnLootParticles()

Player opens Crafting (C key)
  → ui.showCraftingMenu(crafting, inventory)
      → crafting.getAvailableRecipes()
          → inventory.hasIngredients(recipe) for each
      → render available recipes in DOM

Player clicks recipe
  → crafting.craft(recipeId)
      → inventory.removeItem(each input)
      → inventory.addItem(each output)
      → ui.showNotification("Crafted: " + name)
```

---

## Data Flow: Galaxy Navigation

```
Player presses M
  → game._toggleGalaxyMap()
      → hud.showGalaxyMap(galaxy, currentSystemId)
          → GalaxyMap renders canvas with system nodes
          → Click on system → galaxy.getSystem(id)

Player selects warp target in SPACE_LOCAL
  → _tickSpace() detects player near planet
      → spaceScene.getPlanetAt(pos, radius)
      → if warp key pressed:
          galaxy.warpTo(targetId)
          spaceScene.enterSystem(newSystem)
          game._setState(SPACE_LOCAL)
```

---

## Planet Generation Pipeline

```
Seed (integer)
  ↓
PlanetGenerator.generate(seed)
  ├─ Hashes seed → picks PLANET_TYPE
  ├─ Generates name from seed
  ├─ Assigns fog, atmosphere, sun colors
  ├─ Assigns hazard levels (toxicity, radiation, temperature)
  ├─ Assigns flora/fauna density
  └─ Returns plain object (no Three.js)

TerrainManager.constructor(scene, planet, sunLight)
  ├─ Creates TerrainShader instance
  ├─ Creates water plane
  └─ Begins streaming first chunks

FloraManager.constructor(scene, planet)
  └─ Picks 3-4 plant types for this biome

CreatureManager.constructor(scene, planet)
  └─ Defines genome rules for this biome
```

---

## Asset Loading Fallback Pattern

Every module that uses assets follows this pattern:

```js
import { getAssets } from './assets.js';

function buildMyMesh(key) {
  const model = getAssets().cloneModel(key);
  if (model) {
    // Use real GLB model
    scene.add(model);
    return model;
  }
  // Fallback: build procedural geometry
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}
```

If no `.glb` file exists (e.g. `npm run assets` was not run), every single call returns `null` and the procedural fallback runs. **The game is always fully playable without downloading assets.**

---

## Shader Uniform Update Pattern

Shaders receive per-frame updates via `material.uniforms`:

```js
// In game.js _tickSurface():
if (this._terrain) {
  const mat = this._terrain.getMaterial();
  mat.uniforms.uTime.value      = elapsed;
  mat.uniforms.uSunDir.value    = sunDir;
  mat.uniforms.uCamPos.value    = camPos;
}
```

All shader uniforms are declared in `src/shaders.js` in the `uniforms` object and are strongly typed (`THREE.Uniform`).

---

## Memory Management

Three.js objects must be explicitly disposed to free GPU memory:

| What | How |
|------|-----|
| Terrain chunks (unloaded) | `geometry.dispose(); material.dispose(); scene.remove(mesh)` |
| Flora meshes | `instancedMesh.dispose()` |
| Creature meshes | `geometry.dispose(); material.dispose()` |
| Atmosphere | `atmosphereMesh.geometry.dispose(); ...material.dispose()` |
| Entire scene change (Surface→Space) | All managers call `.dispose()` |

The `dispose()` method on every manager calls `.dispose()` on all its owned Three.js objects.
