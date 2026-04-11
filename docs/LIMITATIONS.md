# Aetheria: Endless Frontiers — Known Limitations & Issues

> Last updated: Build v4.1 (character slots + physics overhaul)

---

## Fixed in Current Build
| # | Issue | Fix |
|---|---|---|
| 1 | `terrain.js` water lighting never updated | `_waterMeshes` → `waterChunks` iterator |
| 2 | `creatures.js` `isBoss` undefined in `generateGenome()` | Added `isBoss: false` to base genome |
| 3 | `game.js` camera `add({x,y,z})` plain-object bug | Replaced with `new THREE.Vector3()` |
| 4 | `building.js` `dispose()` only freed root mesh | Changed to `traverse()` deep dispose |
| 5 | `creatures.js` only 8 BIOME_TINTS (missing 6 types) | Extended to all 14 planet types |
| 6 | Planet generation only 6 LUSH palettes; all other types had 1 | Added 6–9 palettes for all 14 types |
| 7 | All planets in a galaxy looked identical in hue | Added galaxy chromatic tint (ΔH/S/L) |
| 8 | Jetpack fired on ground then was cancelled by ground-check | `grounded` only set when `vel.y ≤ 0` |
| 9 | Planet sphere radius ~53 units (smaller than ship) | `Math.max(200, radius/4)` → ≥200 units |
| 10 | Atmosphere entry triggered at 8 000 units (wrong planet) | `ATMOSPHERE_ENTRY_RADIUS = 600` constant |
| 11 | `setSpaceDistances()` called with object arg (silently ignored) | Changed to 3 positional args |
| 12 | `_buildings.tick()` — method never existed | Renamed to `update(dt, inventory, primaryRes)` |
| 13 | Build mode existed but had no placement logic | Full placement wired in `_tickSurface` |
| 14 | Building cost keys (`iron`/`gold`) didn't match inventory (`Ferrite Dust`/`Chromatic Metal`) | `BUILD_RESOURCE_MAP` constant added |
| 15 | Mobile touch controls were stub functions (no-ops) | All 12 buttons fully wired |
| 16 | Single save slot — couldn't have multiple characters | 3 independent named save slots |
| 17 | Creature hits could one-shot the player on large creatures | Damage capped at 35 per hit |
| 18 | Settlement `place()` calls threw when terrain wasn't ready | Proxy unlimited inventory for gen |

---

## Open Issues

| Severity | Area | Description | Workaround |
|---|---|---|---|
| Medium | Galaxy progression | `warpGalaxy()` doesn't check player level yet | Player can freely jump galaxies |
| Medium | Planet ownership | `ownedBy` field generated but not shown in UI | None |
| Low | Flora RNG | `buildRockFormation()` still uses `Math.random()` for local offsets | Minor non-determinism in rock scatter |
| Low | NPC dialogue | All NPCs use global dialogue pool regardless of role | Cosmetic only |
| Low | Creature separation | At high creature density (>15), overlap resolution oscillates | Reduce `faunaDensity` on affected planet |
| Low | Binary star companion | Rendered in space scene but not in terrain sky | Cosmetic only |
| Low | Save version | Current code writes `version:4`; will bump to `5` after galaxy progression lands | No data loss risk |
| Low | `Math.SQRT3` | `noise.js` references non-standard property (works at runtime) | No action needed |
| Info | Mobile performance | Bloom post-processing may drop below 30 fps on low-end Android | Set `ENABLE_BLOOM:false` in `config.js` |
| Info | WebGL2 required | No WebGL 1.0 fallback; Safari < 15 not supported | Use Chrome / Firefox / Edge |

---

## Architectural Notes

- **No WebGL fallback**: The game requires WebGL2. Safari < 15 is not supported.
- **localStorage limit**: Save data is capped at ~5 MB per slot. Visited system lists are trimmed to 500 entries per slot.
- **No audio files**: All sound is Web Audio API synthesised — no external dependencies.
- **Asset loading**: If CC0 models fail to download, all geometry falls back to procedural generation.
- **Server requirement**: Some browser security policies block ES module imports from `file://`. Use the Node.js server for full functionality.
- **Physics is client-side**: Multiplayer physics are not synchronised — each client simulates independently. Position sync only.
