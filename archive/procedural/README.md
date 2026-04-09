# Aetheria – Procedural Code Archive

This folder contains the original **100% procedural** Three.js source code
(no external assets required – every mesh, texture, and sound is generated in JS/GLSL).

It is kept here as a permanent reference and fallback.
The live game in `/src/` uses this code as a **fallback** when GLB/texture assets
have not yet been downloaded.

## When to use this
- If `scripts/download-assets.js` has not been run yet
- For offline/no-network development
- As a reference for the procedural generation algorithms

## Contents
| File | Description |
|---|---|
| src/noise.js | Simplex 2D/3D + domain-warped fBm |
| src/config.js | All game constants, planet types, resources |
| src/shaders.js | Film-grade GLSL: terrain PBR, atmosphere, water, flora, space |
| src/terrain.js | LOD chunk terrain system |
| src/planet.js | Procedural planet generator |
| src/flora.js | 6 alien plant types (InstancedMesh) |
| src/creatures.js | Genome-based fauna + AI |
| src/player.js | Astronaut controller |
| src/ship.js | Procedural ship model |
| src/space.js | Space scene |
| src/galaxy.js | 100-system galaxy |
| src/mining.js | Resource node system |
| src/inventory.js | Item management |
| src/crafting.js | Recipes + tech tree |
| src/audio.js | Web Audio API sound engine |
| src/ui.js | Full NMS-style HUD |
| src/game.js | Main game loop |
