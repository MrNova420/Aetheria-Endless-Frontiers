# 🗺️ Roadmap – Aetheria: Endless Frontiers

**Current version:** `1.0.0-beta.1`

---

## ✅ Beta 1 – Complete (current)

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
- [x] CC0 asset pipeline (GLTFLoader + procedural fallback)
- [x] Termux setup script
- [x] Auto-setup scripts for Windows / Linux / macOS

---

## 🔄 Beta 2 – In Progress

**Goal:** Bug fixes, persistence, and visual quality uplift.

- [ ] **Save/load** – `localStorage` persistence for player, inventory, current system
- [ ] **Real CC0 models** – wire `AssetManager.cloneModel()` into ship.js, flora.js, creatures.js
- [ ] **PBR terrain textures** – wire AmbientCG textures into TerrainShader splatmap
- [ ] **Ship exit height fix** – use `terrain.getHeightAt()` for exit position Y
- [ ] **Creature attack player** – hostile creatures deal damage on contact
- [ ] **Touch ship controls** – joystick/throttle in SHIP_ATM mode
- [ ] **Audio SFX** – add `playOneShot('mine')`, `playOneShot('jump')`, `playOneShot('land')`
- [ ] **Galaxy fog-of-war** – only show visited systems in galaxy map
- [ ] **Warp animation** – tunnel shader on hyperspace jump
- [ ] **Performance mode** – URL param `?quality=low` reduces render load on mobile
- [ ] Fix README port references (3000 → 8080) ✅ done

**Target:** 2026-05

---

## 🚀 v1.0 Stable

**Goal:** First public stable release on GitHub, itch.io, and Google Play.

- [ ] 3 starter quests with objective markers
- [ ] Space station trading NPC
- [ ] Combat system (weapon slots, enemy ships)
- [ ] Base building (deployable modules)
- [ ] Day/night cycle with star visibility at night
- [ ] Weather effects per biome (rain, snow, sandstorm particles)
- [ ] Minimap labels (POIs, resource rich areas)
- [ ] Settings menu (graphics quality, audio volume, controls remap)
- [ ] Google Play signed APK release
- [ ] GitHub Releases page with APK download
- [ ] itch.io web embed

**Target:** 2026-07

---

## 🌌 v1.1 – Multiplayer Alpha

**Goal:** Optional co-op (2-4 players) via WebSocket server.

- [ ] WebSocket server (`server-multiplayer.js`)
- [ ] Player position sync (interpolated, 10Hz)
- [ ] Shared resource nodes (server-authoritative)
- [ ] Friends list / invite code
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
