# Aetheria: Endless Frontiers — Known Limitations & Issues

> Last updated: Build v5.0

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

---

## Open Issues

| Severity | Area | Description | Workaround |
|---|---|---|---|
| Medium | Galaxy progression | `warpGalaxy()` doesn't check player level yet | Player can freely jump galaxies |
| Medium | Planet ownership | `ownedBy` field generated but not shown in UI | None |
| Medium | Settlement buildings | `BuildingSystem.place()` may throw if terrain not ready | Caught silently in `_spawnSettlements` |
| Low | Flora RNG | `buildRockFormation()` still uses `Math.random()` for local offsets | Minor non-determinism in rock scatter |
| Low | NPC dialogue | All NPCs use global dialogue pool regardless of role | Cosmetic only |
| Low | Creature separation | At high creature density (>15), overlap resolution oscillates | Reduce faunaDensity on affected planet |
| Low | Binary star companion | Rendered in space scene but not in terrain sky | Cosmetic only |
| Low | Save version | Current code writes `version:4`, should be `version:5` after galaxy progression lands | No data loss risk |
| Low | `Math.SQRT3` | `noise.js` references non-standard property (works at runtime) | No action needed |
| Info | Mobile performance | Bloom post-processing may drop below 30fps on low-end Android | Bloom disabled via `ENABLE_BLOOM:false` in config |

---

## Architectural Notes

- **No WebGL fallback**: The game requires WebGL2. Safari < 15 is not supported.
- **localStorage limit**: Save data is capped at ~5MB. Visited system lists are trimmed to 500 entries.
- **No audio files**: All sound is Web Audio API synthesised — no external dependencies.
- **Asset loading**: If CC0 models fail to download, all geometry falls back to procedural generation.
- **Server requirement**: Some browser security policies block ES module imports from `file://`. Use the Node.js server for full functionality.
