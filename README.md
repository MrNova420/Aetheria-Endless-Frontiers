# 🌌 Aetheria: Endless Frontiers

> **GTA × No Man's Sky × Satisfactory — in your browser.**

A fully 3D, real-time open-world browser RPG powered by Three.js and WebGL2.
255 procedurally-generated galaxies, each containing ~8.4 billion unique star systems.
No install required — runs in any modern browser.

---

## 🚀 Quick Start

```bash
npm install && npm start
# Open http://localhost:8080
```

Or without Node.js:
```bash
python3 -m http.server 8080
```

---

## 🎮 Controls

### On Foot
| Key / Input | Action |
|---|---|
| `W A S D` | Move |
| `Shift` | Sprint |
| `Space` | Jump (on ground) / Jetpack thrust (in air) |
| `Mouse` | Look / aim |
| `Left Click` (hold) | Mine resource node |
| `Right Click` | Fire weapon / attack |
| `F` | Scanner pulse |
| `E` | Interact with NPC / object |
| `G` | Board ship (near ship) / Exit ship (when landed) |
| `B` | Toggle Build Mode |
| `1–9` | In Build Mode: select building type; otherwise quick-slot select |
| `Left Click` | In Build Mode: place selected building |
| `Tab` | Inventory |
| `N` | Crafting menu |
| `T` | Tech tree |
| `M` | Galaxy map |
| `H` | Help / controls overlay |
| `P` | Manual save |
| `O` | Load save |
| `Esc` | Pause |

### Ship Flight
| Key | Action |
|---|---|
| `W / S` | Throttle forward / brake |
| `A / D` | Yaw left / right |
| `Mouse` | Pitch / roll |
| `Space` | Boost |
| `G` | Land / exit ship |

### Touch (Mobile) — 12-Button Layout
| Button | Action |
|---|---|
| Left virtual joystick | Move (double-tap = sprint toggle) |
| Right drag | Look |
| `⬆ JUMP` | Jump (on ground) / Jetpack (in air) |
| `🚀 JET` | Sustained jetpack burst |
| `🔍 SCAN` | Scanner pulse |
| `⚔ ATK` | Fire weapon |
| `⛏ MINE` | Mine resource node |
| `💊 HEAL` | Use Health Pack from inventory |
| `🚀 BOARD` | Enter nearby ship |
| `🪂 EXIT` | Exit ship when landed |
| `🎒 INV` | Open inventory |
| `🔨 BUILD` | Toggle Build Mode |
| `🗺 MAP` | Galaxy map |
| `⚙ CRAFT` | Crafting menu |

---

## 🪐 Universe Scale

| Dimension | Count |
|---|---|
| Galaxies | **255** |
| Regions per galaxy | 32,768 |
| Systems per region | 1,000 |
| **Total star systems** | **~8.4 billion per galaxy** |
| Total across all galaxies | **~2.1 trillion** |
| Planet types | 14 |
| Visual palette variants per type | 6–9 |
| Planet modifiers | 10 |
| Unique planet looks | **millions** |

### Galaxy Tiers (progression)
| Tier | Galaxies | Name | Unlock Level | Theme |
|---|---|---|---|---|
| 1 | 0–7 | Euclid Cluster | 1 | Lush starter worlds, calm |
| 2 | 8–31 | Contested Expanse | 10 | Mixed biomes, moderate danger |
| 3 | 32–63 | Outer Reaches | 20 | Harsh, high sentinel presence |
| 4 | 64–127 | Void Fringe | 35 | Extreme biomes, elite fauna |
| 5 | 128–191 | The Abyss | 55 | Alien/exotic dominated, ruins |
| 6 | 192–254 | Convergence Core | 80 | Maximum challenge, reality fractures |

---

## ✨ Feature Set

### Character Creation
- **3 independent save slots** — each slot holds a fully separate character and progression
- **Named characters** — choose any name displayed throughout the game
- **Suit colour customisation** — 8 colour options (blue, orange, purple, green, red, cyan, yellow, white) applied to all 11 material zones of the player mesh
- **3 character classes** to choose from after naming and colouring your character

### Procedural Generation
- **14 planet types**: LUSH, BARREN, TOXIC, FROZEN, BURNING, EXOTIC, DEAD, OCEAN, TROPICAL, ARCTIC, VOLCANIC, SWAMP, DESERT, CRYSTAL
- **6–9 unique colour palettes** per planet type = 100+ distinct visual styles
- **10 planet modifiers**: Paradise, Giant, Micro, Irradiated, Storm-Wracked, Tidally Locked, Bioluminescent, Ancient, Sparse, Verdant
- **Galaxy chromatic tinting**: every galaxy applies a subtle HSL shift to all terrain colours
- **10 moon types** with unique colours and orbital properties (up to 4 per planet)
- **Ring systems** with type-tuned probability (Crystal worlds most likely)
- **7 star classes** (M/K/G/F/A/B/O) with tier-biased distribution — higher-tier galaxies have hotter stars
- **12 system traits**: nebula, pirate stronghold, ancient ruins, derelict station, exotic anomaly, rich deposits, conflict zone, trade hub, abandoned, paradise, quarantine, pulsar proximity

### World Surface
- **Chunked terrain streaming** with 4-level LOD and seamless transitions
- **Custom GLSL terrain shader**: 4-layer biome blending, wetness/wind uniforms, emissive lava/crystal zones
- **Custom water shader**: animated waves, caustics, Fresnel reflectance, fog integration
- **Atmosphere shader**: Rayleigh scattering, Mie scattering, dynamic moon discs, aurora effects
- **Biome-weighted flora**: 9 procedural plant types, each with per-instance ±HSL colour jitter
- **Day/night cycle**: dynamic sun direction, real-time terrain/water lighting update, star visibility
- **Weather system**: rain, blizzard, sandstorm, electrical storm — affects terrain wetness shader

### Characters & NPCs
- **Player**: 11 material zones (helmet, visor, chest, torso, shirt, shoulders, arms, gloves, hips, legs/boots, belt, jetpack) driven by class colour palette
- **3 player classes**: Explorer, Warrior, Trader — each with unique stats and starter gear
- **NPCs**: seeded genome — 4 alien species (humanoid, tall/lanky, squat/broad, four-armed), 12 skin/chitin tones, 7 role-based outfit palettes with per-zone colour variation, emissive eyes, faction insignia ring, role accessories
- **NPC roles**: merchant, guard, wanderer, quest giver, faction agent, bounty hunter, settler
- **Settlements**: 0–3 per planet, seeded deterministically — city, trading post, research base, space port, mining camp, outpost, ruins

### Creatures
- **Procedural genome system**: body size, leg count (2/4/6/0), head shape, tail, horns, bioluminescence, wing count, eye count
- **14 biome colour tints** mapped to all planet types
- **AI state machine**: PATROL → ALERT → CHASE → ATTACK → RECOIL → FLEE → DEAD
- **Boss creatures** with enhanced stats, glow effects
- **Loot drops** on death

### Ships
- **5 ship classes**: Explorer, Fighter, Freighter, Scout, Alien
- **PBR materials**: hull, accent, trim, thruster glow, cockpit glass — all class-specific
- **3 flight modes**: LANDED, ATMOSPHERIC, SPACE
- **Seamless transitions**: on-foot → ship → atmosphere → space

### Buildings (Base Building)
- **10 building types**: Extractor, Conveyor, Storage, Power Generator, Research Station, Turret, Town Hub, Wall, Door, Farm
- **5-layer per-type colour palettes**: base, accent, trim, emissive glow, window tint
- **Unique geometry** per type (drill bits, panels, crop rows, turret barrel, etc.)
- **Power grid**: buildings require power, generator supplies it
- **Build Mode** (`B` key): digit keys `1–9` select type, Left Click places at cursor + 6 units forward, real resource cost deducted from inventory, on-screen build panel shows costs colour-coded green (affordable) / red (can't afford)
- **Resource automation**: powered Extractors produce resources every 10 s; Research Stations generate Nanites every 30 s; Farms generate Carbon every 15 s
- **Serialised/saved** per planet across all 3 save slots

### Economy & Progression
- **30 trade commodities** across 6 factions
- **40+ crafting recipes** with multi-step chains
- **Tech tree**: upgrades for shield, jetpack, mining, life support, scan range
- **XP/level system** with level-up rewards
- **Faction reputation** system (6 factions: Gek, Korvax, Vykeen, Atlas, Outlaw, Sentinel Order)
- **Quest system**: 3-quest chain with event tracking
- **Starter kit**: all classes begin with Carbon ×250, Ferrite Dust ×150, Di-Hydrogen ×60, Warp Cell ×2, Health Pack ×3, 3 000 Units, 100 Nanites — enough to immediately build a base and warp to the next system

### Multiplayer
- **WebSocket server** with proximity filtering (800u range, 20Hz broadcast)
- **Ghost mesh rendering** for other online players
- **Player profiles** saved server-side to `data/players/<id>.json`
- **Hardware mesh contribution** system (idle CPU sharing)

---

## 📁 Project Structure

```
Aetheria-Endless-Frontiers/
├── index.html                  Entry point (loads game.js as ES module)
├── server.js                   Node.js WebSocket + static file server
├── package.json
├── capacitor.config.json       Mobile wrapper config
│
├── css/
│   └── style.css               NMS holographic HUD styles
│
├── src/                        All game modules (ES6, no bundler)
│   ├── game.js                 Main loop, state machine, wires all systems
│   ├── config.js               All constants (WORLD, PLANET_TYPES, CLASSES…)
│   ├── noise.js                SimplexNoise + fBm
│   ├── shaders.js              All GLSL: terrain, water, atmosphere, flora, post
│   │
│   ├── universe.js             255-galaxy universe; 6 tiers; system generation
│   ├── planet.js               Planet generator; 14 types × 9 palettes; modifiers
│   ├── terrain.js              Chunked terrain LOD, water planes, shader streaming
│   ├── flora.js                Biome-weighted procedural plants, wind animation
│   ├── creatures.js            Genome-based AI creatures, 14 biome tints
│   ├── weather.js              Weather system (rain/blizzard/storm/sand)
│   ├── space.js                Space scene (stars, asteroid belt, sun mesh)
│   │
│   ├── player.js               11-zone player mesh, movement, jetpack, camera
│   ├── ship.js                 5-class PBR ship, 3 flight modes
│   ├── npcs.js                 4-species seeded NPC genome + dialogue + AI
│   ├── sentinels.js            Sentinel drone AI, wanted level
│   ├── building.js             10-type base building, power grid, serialisation
│   ├── extractor.js            Auto-extractor deployment + resource drip
│   │
│   ├── inventory.js            48-slot grid inventory
│   ├── crafting.js             Recipe system, 40+ recipes
│   ├── mining.js               Resource nodes, scan, mining beam
│   ├── trading.js              30-commodity market per system
│   ├── factions.js             6 factions, reputation, standing
│   ├── quests.js               Quest chain system
│   ├── status.js               Status effects (burn/freeze/poison/energised/shield)
│   │
│   ├── physics.js              Body physics, projectiles, gravity wells
│   ├── lore.js                 Procedural planet/creature/system lore text
│   ├── help.js                 In-game help system
│   ├── audio.js                Web Audio procedural SFX + ambient
│   ├── ui.js                   All HUD, menus, galaxy map, tech tree UI
│   ├── network.js              WebSocket client, proximity broadcast
│   ├── assets.js               GLTFLoader + TextureLoader + manifest
│   ├── galaxy.js               Galaxy map data helper
│   ├── spawn.js                Safe spawn position finder
│   ├── hardware-mesh.js        Hardware mesh CPU contribution system
│   └── mesh-worker.js          Web Worker relay for mesh computation
│
├── assets/
│   └── manifest.json           CC0 asset registry
│
├── data/
│   └── players/                Server-side player profile JSONs
│
├── scripts/
│   ├── download-assets.js      CC0 asset downloader
│   ├── download-assets.sh      Linux/macOS wrapper
│   ├── download-assets.bat     Windows wrapper
│   ├── build-mobile.sh         Capacitor build (Linux/macOS)
│   └── build-mobile.bat        Capacitor build (Windows)
│
├── docs/
│   ├── ARCHITECTURE.md         Module dependency map, data flow
│   ├── DEVELOPMENT.md          Per-module API, conventions, how to extend
│   ├── ROADMAP.md              Feature plan
│   ├── LIMITATIONS.md          Known issues
│   └── MOBILE_RELEASE.md       iOS + Android store release guide
│
├── DESIGN.md                   Vision, systems, generation pipeline
├── LICENSE-ASSETS.md           CC0 asset credits
├── setup.sh / setup.bat / setup.ps1 / setup-termux.sh
└── README.md                   This file
```

---

## 🧪 Testing

```bash
npm test
# Runs tests/run-all.js — 202 tests, 16 suites, pure Node.js ESM
# Covers: physics, building automation, character save slots,
#         planet scale, game balance, crafting, factions, trading,
#         universe generation, full gameplay loop simulation
```

---



| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 14 | Dev server + WebSocket |
| npm | ≥ 6 | Package management |
| Chrome / Firefox / Edge | Latest | WebGL2 + ES modules |
| Android Studio *(optional)* | Latest | Android APK |
| Xcode *(optional, macOS)* | ≥ 14 | iOS IPA |

---

## 🛠️ Setup

### Windows
```bat
setup.bat
```

### Linux / macOS
```bash
chmod +x setup.sh && ./setup.sh
```

### Termux (Android Terminal)
```bash
pkg install git nodejs -y
git clone https://github.com/MrNova420/Aetheria-Endless-Frontiers.git
cd Aetheria-Endless-Frontiers
bash setup-termux.sh
# Open http://localhost:8080 in Chrome
```

---

## 📦 Asset Download

```bash
npm run assets          # full CC0 asset download
npm run assets:quick    # essential assets only
```

---

## 📱 Mobile Build (Android & iOS)

```bash
npm install
npm run mobile:build
npx cap open android   # Android Studio
npx cap open ios       # Xcode (macOS only)
```

See [docs/MOBILE_RELEASE.md](docs/MOBILE_RELEASE.md) for store release steps.

---

## 🛠️ Tech Stack

| Technology | Role |
|---|---|
| Three.js r162 | 3D rendering (WebGL2) |
| Custom GLSL Shaders | Terrain, water, atmosphere, flora, post-processing |
| Web Audio API | Procedural SFX and ambient music |
| WebSocket (ws) | Real-time multiplayer |
| Capacitor 5 | Android / iOS native wrapper |
| Node.js | Dev server + player data persistence |

---

## 📚 Documentation

| File | Contents |
|---|---|
| [DESIGN.md](DESIGN.md) | Vision, pillars, all systems overview |
| [docs/GAMEPLAY.md](docs/GAMEPLAY.md) | **Full player guide** — first steps, building, combat, trading, tips |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map, data flow, memory management |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Per-module API, conventions, extending the game |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Current progress and planned features |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Known issues and gaps |
| [docs/MOBILE_RELEASE.md](docs/MOBILE_RELEASE.md) | Store release guide |
| [LICENSE-ASSETS.md](LICENSE-ASSETS.md) | CC0 asset credits |

---

## 🤝 Contributing

1. Fork → `git checkout -b feat/my-feature`
2. One module per system in `src/`
3. Verify: `node --input-type=module -e 'import fs from "fs"; for(const f of fs.readdirSync("src").filter(f=>f.endsWith(".js")).map(f=>"src/"+f)){const s=fs.readFileSync(f,"utf8");const d=(s.match(/\{/g)||[]).length-(s.match(/\}/g)||[]).length;if(d)console.log("WARN",f,d);}'`
4. `node -c server.js`
5. `npm test` — all 202 tests must pass
6. Open a Pull Request

---

## 📄 License

- **Game code** — MIT © 2026 MrNova420
- **Assets** — CC0 1.0 Universal (see [LICENSE-ASSETS.md](LICENSE-ASSETS.md))

---

*Built with Three.js · Web Audio API · Capacitor · Node.js*
