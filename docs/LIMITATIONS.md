# ⚠️ Known Limitations & What Still Needs Doing

**Version:** 1.0.0-beta.1  
**Last updated:** 2026-04-09

This document is the honest status sheet. It lists every known gap, bug, and future requirement so any developer — human or AI — can pick up exactly where we left off.

---

## 🔴 Critical (must fix before v1.0 stable)

### 1. Assets not bundled in repo
- **Issue:** Real GLB models and PBR textures are NOT committed to the repo (they are too large and have separate licenses). The game runs in fully-procedural mode until `npm run assets` is executed.
- **Impact:** First-time players see only procedural geometry (still playable, but lower visual quality).
- **Fix needed:** Either bundle a minimal set of placeholder assets (<5 MB total), or add a first-launch download prompt inside the game UI itself (currently the download only runs from CLI).
- **File:** `src/game.js` → add in-game asset download flow; `src/ui.js` → add download progress modal.

### 2. No save/load persistence
- **Issue:** `player.serializeState()` and `player.loadState()` exist but `game.js` never calls them. Closing the tab loses all progress.
- **Fix needed:** Call `localStorage.setItem('aetheria_save', JSON.stringify(state))` on pause/exit; call `localStorage.getItem` on load. Also serialize inventory, current system ID, ship position.
- **File:** `src/game.js` → `_saveGame()` / `_loadGame()` methods.

### 3. `README.md` references port 3000, server runs on 8080
- **Issue:** The Quick Start section says `http://localhost:3000` but `server.js` defaults to 8080.
- **Fix needed:** Update `README.md` Quick Start to say 8080, or change server default to 3000 (pick one and be consistent).
- **File:** `README.md` lines 10–16.

### 4. No collision detection between player and solid objects
- **Issue:** Player walks through rocks, trees, and ship hull. Only terrain height collision is implemented.
- **Fix needed:** Add AABB or sphere-capsule collision for flora/creature/ship meshes in `src/player.js`.

---

## 🟡 Important (should fix before beta promotion)

### 5. Ship exit places player mid-air on steep terrain
- **Issue:** `ship.exitShip()` places the player at `ship.position + (3, 0.5, 0)` without checking terrain height at that offset position.
- **Fix:** Call `terrain.getHeightAt(exitX, exitZ)` and use that Y.
- **File:** `src/ship.js` → `exitShip()`.

### 6. Creature spawning ignores water level
- **Issue:** `CreatureManager.spawnForChunk()` checks `wy < waterLevel + 1` but `waterLevel` may be `undefined` on some planet types, causing `NaN` comparisons.
- **Fix:** Default `planet.waterLevel ?? -999` in the check.
- **File:** `src/creatures.js` → `spawnForChunk()` line ~140.

### 7. Galaxy map shows all systems unscouted
- **Issue:** All 100 systems are rendered with full labels. There is no fog-of-war or discovery mechanic.
- **Fix:** Track `discoveredSystems: Set<id>` in save data; only label discovered systems.
- **File:** `src/ui.js` → `_renderGalaxyCanvas()`.

### 8. Mining beam has no visual end-cap on the resource node
- **Issue:** The `Line` geometry connecting player to node works but has no impact particle effect.
- **Fix:** Add a `PointLight` at the target node position when mining, and spawn 2-3 emissive sprite particles.
- **File:** `src/player.js` → `update()` mining section.

### 9. Audio initialisation requires user gesture but game.js calls `audio.playAmbient()` before one
- **Issue:** `_setState(GS.PLANET_SURFACE)` in `selectClass()` calls `audio.playAmbient()` correctly after a button click. But if the game auto-loads a save it may call audio before any gesture.
- **Fix:** Guard `audio.init()` + all play calls with `if (this._audio.initialized)` (already partially done but needs to be consistent).
- **File:** `src/game.js` → `_tickSurface()` calls to audio.

### 10. Touch controls: ship mode shows foot-mode buttons
- **Issue:** When inside ship, the touch buttons (mine, scan) are still visible. Ship needs throttle/yaw sliders instead.
- **Fix:** In `game.js` `_setState()`, toggle a CSS class on `#touch-controls` between `mode-surface` and `mode-ship`.
- **File:** `src/game.js` → `_setState()`; `css/style.css` → add `.mode-ship` rule hiding foot buttons.

---

## 🟢 Nice to Have (v1.1+)

### 11. No multiplayer / co-op
- The architecture is single-player only. WebSocket multiplayer would require a stateful server (not just `server.js` which is static file serving).

### 12. No quest / mission system
- There is a crafting + tech-tree progression loop but no structured quests or objectives. Planned for v1.1.

### 13. Planet-to-planet warp transition has no animation
- `_tickSpace()` teleports to a new system instantly when near a planet. A proper warp tunnel animation is needed.
- **File:** `src/game.js` → `_tickSpace()`; `src/shaders.js` → add WarpTunnelShader.

### 14. No enemy combat — creatures are passive or fleeing
- Hostile creatures have `aggression: 'hostile'` state but `takeDamage()` on the player is never called from creatures.
- **Fix:** In `creatures.js` update loop, if state === ATTACKING and distance < 1.5, call `player.applyDamage(genome.attackDmg)` with a cooldown timer.
- **File:** `src/creatures.js` → `update()` ATTACKING branch.

### 15. No loading indicator for individual terrain chunks
- Chunk generation is synchronous and can cause frame-rate hitches on slow devices.
- **Fix:** Move chunk mesh generation to a Web Worker or spread it across multiple frames using a queue.

### 16. iOS App Store distribution blocked without Apple Developer account ($99/year)
- The Capacitor build produces a valid `.ipa` but it cannot be distributed outside TestFlight without a paid Apple Developer account.
- **Alternative:** Android APK sideloading works for free. Web version works on iOS Safari.

### 17. Android APK is debug-signed by default
- The `build-mobile.sh` script does NOT configure a release keystore. The resulting APK cannot be published to Google Play without:
  1. Generating a release keystore: `keytool -genkey -v -keystore release.keystore …`
  2. Configuring `android/app/build.gradle` with the signing config.
- See `docs/MOBILE_RELEASE.md` for the full signing guide.

### 18. No analytics / crash reporting
- No Sentry, Firebase Crashlytics, or equivalent. Crashes are silent.

### 19. `GalaxyMap` class exported from `galaxy.js` but never imported in `game.js`
- The class exists and is correct, but `game.js` uses `this._hud.showGalaxyMap(this._galaxy, ...)` and renders the map in `ui.js` instead.
- **Options:** Either remove `GalaxyMap` from `galaxy.js` (cleanup) or refactor `ui.js` to use it.

### 20. No difficulty settings
- Planet hazard levels are fixed by seed. A global difficulty multiplier in `config.js` would let players adjust hazard drain rates, creature aggression, etc.

---

## 📋 Immediate Next Steps (recommended order)

1. **Fix README port** (3000 → 8080) — 2 min
2. **Save/load** (`localStorage`) — 2 hrs
3. **Creature attack player** — 30 min
4. **Ship exit height fix** — 15 min
5. **In-game asset download prompt** — 3 hrs
6. **Warp transition animation** — 4 hrs
7. **Quest system v1** (3 starter quests) — 1 day
8. **Chunk generation off main thread** (Web Worker) — 1 day
9. **Android release keystore + Play Store listing** — 2 hrs
10. **Galaxy fog-of-war** — 1 hr

---

## 🔧 Technical Debt

| Area | Issue | Priority |
|---|---|---|
| `src/ui.js` | 32K lines — split into `ui-hud.js`, `ui-menus.js`, `ui-screens.js` | Low |
| `src/game.js` | Single 700-line file — extract `GameInput`, `GameSystems`, `GameRenderer` classes | Medium |
| Three.js r162 | CDN-loaded; should be bundled with Vite/Rollup for mobile Capacitor build | Medium |
| No TypeScript | Adding JSDoc types or migrating to TS would help catch API mismatches | Low |
| No automated tests | No unit or integration tests exist | Medium |
| `tmp/` directory | Download script writes zips to `tmp/` (gitignored) but never cleans up | Low |

---

## 🌐 Platform Status

| Platform | Status | Notes |
|---|---|---|
| Chrome / Edge (desktop) | ✅ Fully working | Recommended browser |
| Firefox (desktop) | ✅ Working | Minor shader difference in atmosphere |
| Safari (desktop) | ⚠️ Partial | WebGL2 works; Web Audio may need gesture |
| Chrome (Android) | ✅ Working | Touch controls active automatically |
| Safari (iOS) | ⚠️ Partial | WebGL2 works; pointer lock not supported |
| Termux → Chrome (Android) | ✅ Working | Local server serves to Android Chrome |
| Android APK (Capacitor) | 🟡 Build works | Needs release signing for Play Store |
| iOS IPA (Capacitor) | 🟡 Build works | Needs Apple Developer account for distribution |
| Electron (desktop app) | ❌ Not implemented | Possible future addition |
