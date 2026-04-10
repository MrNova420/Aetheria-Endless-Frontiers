# 🗺️ Roadmap – Aetheria: Endless Frontiers

**Current version:** `1.0.0-beta.2`

---

## ✅ Beta 1 – Complete

**Goal:** Fully playable from browser and Termux on any device.

- [x] Full 3D WebGL2 rendering pipeline (Three.js r162)
- [x] 8 procedural planet biomes
- [x] Chunked LOD terrain with PBR shaders
- [x] Atmospheric scattering shader
- [x] 6 alien plant types (instanced)
- [x] Procedural creature genome + AI FSM
- [x] 16 resource types + mining beam
- [x] 48-slot inventory system
- [x] 25 crafting recipes + tech tree
- [x] Ship flight (LANDED / ATMOSPHERIC / SPACE)
- [x] 100-system galaxy map
- [x] Space scene (station, asteroids, planets)
- [x] Full Web Audio API procedural sound
- [x] NMS-style HUD (vitals, compass, minimap, notifications)
- [x] Touch controls for mobile browsers
- [x] Capacitor 5 Android/iOS wrapper
- [x] Termux setup script
- [x] Auto-setup scripts for Windows / Linux / macOS

---

## ✅ Beta 2 – Complete (current)

**Goal:** Combat, persistence, visual quality, and gameplay depth.

- [x] **Save/load v2** – persists player, inventory, level/XP, tech tree, day-time
- [x] **XP / Leveling** – mine XP, kill XP, level-up fanfare + heal
- [x] **Player right-click attack** – blaster shot, range-based, cooldown, SFX
- [x] **Creature loot drops** – resources spawn at creature death site
- [x] **Creature corpse fade** – frame-based die timer (no `setTimeout`)
- [x] **Weather gameplay effects** – blizzard/sandstorm slows player; toxic fog + blizzard drain life support
- [x] **Planet sun/ambient color** – per-biome coloring propagated to scene lighting
- [x] **Galaxy map warp** – click star → warp button → costs 1 Warp Cell → +50 XP
- [x] **Danger vignette** – red border pulses when HP < 30 %
- [x] **Damage flash** – screen flash on player hit
- [x] **Level-up glow flash** – cyan bloom burst on level-up
- [x] **Mining arc ring** – shows actual mining progress in real time
- [x] **Minimap water cells** – water-tinted terrain; creature dots; ship marker
- [x] **Biome label** – live biome type shown in HUD location block
- [x] **Quickslot 1–0 hotkeys** – keyboard number keys select quickslot
- [x] **Seeded node RNG** – copper/gold resource nodes use deterministic RNG
- [x] **Flora wind shader** – wind direction/strength uniforms driven per-frame
- [x] **Sun direction → terrain shader** – lighting synced to day/night cycle
- [x] **Notification CSS fix** – `.notif.notif-*` classes correctly applied
- [x] **Tech tree UI** – upgrade SFX and notifications wired
- [x] **Respawn improvements** – drops half inventory at death site, spawns at ship
- [x] **Creature biome tinting** – body colors lerped toward planet palette
- [x] **Boss creature variant** – 3–4.5× alpha beast, 500–1000 HP, dynamic boss bar (color shifts with HP)
- [x] **Creature damage flash** – red flash on hit, reset after 180ms
- [x] **Status effects system** – burning, frozen, poisoned, energised, shielded; DoT ticks, speed mults, HUD chip icons
- [x] **Auto-Extractor** – Satisfactory-inspired factory element; craft, press B to deploy; animated piston+tether beam; save/load
- [x] **Quest system v1** – 3-quest chain (First Steps → Survival Basics → Explorer's Path); HUD tracker with progress bar; item+XP rewards
- [x] **New crafting recipes** – Auto-Extractor, Medkit ×2, Shield Battery ×2
- [x] **Save format v3** – persists quests, status effects, extractor positions
- [x] **`Inventory.getAllItems()`** – missing method added; respawn loot-drop works correctly
- [x] **`_dropCreatureLoot` fix** – use `.clone().add()` to avoid position mutation

---

## 🔄 Beta 3 – Planned

**Goal:** Space station NPC, enemy ships, base building, warp animation, polish.

- [ ] **Space station NPC** – trading, lore dialogue, blueprint shop
- [ ] **Enemy ship combat** – ships patrol space, shoot player
- [ ] **Base building** – shelter, landing pad, power conduit modules
- [ ] **Warp tunnel shader** – procedural hyperspace effect
- [ ] **PBR terrain textures** – AmbientCG textures in TerrainShader splatmap
- [ ] **Real CC0 models** – wire `AssetManager.cloneModel()` for ship/creatures
- [ ] **Settings menu** – graphics quality, audio volume, controls remap
- [ ] **Galaxy fog-of-war** – only show visited systems
- [ ] **Achievement system** – unlock-based notification + HUD badge
- [ ] **Google Play / itch.io release**

**Target:** 2026-Q3

---

## 🌌 v1.0 Stable – Future

- Day/night full sky cycle with star visibility
- Multiplayer alpha (WebSocket co-op)
- Achievement system
- Steam Deck / desktop release
- [ ] Voice proximity chat (WebRTC)
- [ ] Dedicated server Docker image

**Target:** 2026-10

---

## 🏗️ v2.0 – Civilization Update

**Goal:** Large-scale structures, factions, and narrative.

- [ ] Faction system (3 alien civilizations)
- [ ] Procedural alien language (glyph system)
- [ ] Multi-room base building with power grid
- [ ] Freighter capital ships
- [ ] Galactic market with price fluctuation
- [ ] Main story: 10-chapter narrative
- [ ] Procedural dungeon interiors (abandoned facilities)
- [ ] Electron desktop app wrapper

**Target:** 2027

---

## 💡 Backlog (no ETA)

- VR mode (WebXR)
- Procedural music composer per planet
- Steam distribution via Electron + Greenworks
- Mod API / plugin system
- Speedrun timer mode
- Accessibility: colorblind mode, large UI scale
- Offline PWA (Service Worker + cache)
- AI companion creature (follows player, helps mine)
