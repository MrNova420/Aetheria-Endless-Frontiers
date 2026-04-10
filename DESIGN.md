# AETHERIA: Endless Frontiers — Design & Architecture Document

> **Version:** 4.0 | **Status:** Active Development | **Engine:** Three.js r162 / Node.js WebSocket

---

## 1. Vision

**GTA × No Man's Sky × Satisfactory — in your browser.**

Aetheria: Endless Frontiers is a real-time, open-world multiplayer game playable on any device with a modern browser — including Android phones. It fuses three pillars:

| Pillar | Inspiration | What it means in Aetheria |
|---|---|---|
| **Open-world freedom** | GTA V | Do anything — trade, fight, build, explore, grief, cooperate |
| **Infinite universe** | No Man's Sky | 255 galaxies, procedural planets, unique addresses per system |
| **Factory/empire building** | Satisfactory | Conveyor belts, extractors, power grids, automated production |

**Core promises:**
- Runs on a Raspberry Pi, VPS, or an Android phone running Termux
- No install required for players — just a URL
- Real-time multiplayer from day one, up to 50 players per instance
- Every building, territory, and discovery is persistent across sessions
- A universe so large that even with 10,000 concurrent players, most of it remains unexplored

---

## 2. Universe Architecture

### Scale

```
255 galaxies
  × 32,768 regions per galaxy
    × 1,000 systems per region
      = ~8.4 billion systems per galaxy
```

Each system is procedurally generated but **deterministic** — identical across all clients and server instances for a given seed.

### Coordinate System

Every system has a unique **persistent address** in the format `g:r:s`:

```
g  = galaxy index  (0–254)
r  = region index  (0–32767)
s  = system index  (0–999)

Example: 0:1024:42  →  Galaxy 0, Region 1024, System 42
```

### Deterministic Generation

```js
hashCoord(g, r, s) → uint32 seed
```

All downstream values (star type, planet count, biomes, resources, faction control, NPC layout, building slots) are derived deterministically from this single seed. No server lookup is required to know a system's characteristics.

### Region Loading

Only the **current region** (1,000 systems) is loaded into server memory at any time. Warping to a new region triggers:
1. Save current region state (buildings, territories) to `data/` JSON
2. Unload region from memory
3. Generate new region from seed
4. Replay any persistent changes stored for that region

### Planet Biomes (14 types)

| Biome | Key Resource | Hazard | Visual |
|---|---|---|---|
| LUSH | Carbon, Flora | None | Green forests, rivers |
| BARREN | Ferrite, Silicate | Radiation | Rocky brown wastelands |
| TOXIC | Fungal Mould | Toxin damage | Purple fog, acid pools |
| FROZEN | Dioxite, Ammonia | Blizzards, cold | White ice, snow storms |
| BURNING | Pyrite, Sulphur | Heat, fire | Lava flows, ash sky |
| EXOTIC | Rare tech, Anomalies | Weird physics | Surreal geometry, glass |
| DEAD | Oxygen, Magnetite | Atmosphere-less | Crater fields, grey dust |
| OCEAN | Kelp Sac, Cyto-phosphate | Deep pressure | Endless ocean world |
| TROPICAL | Mordite, Star Bulb | Storms | Jungle canopy, beaches |
| ARCTIC | Dioxite, Sodium | Frost, low vis | Tundra, ice caves |
| VOLCANIC | Pyrite, Magnesium | Eruptions | Active calderas |
| SWAMP | Fungal Mould, Nitrogen | Toxic fog | Murky bayou, bioluminescence |
| DESERT | Silicate, Cactus Flesh | Sandstorms | Dune seas, mesas |
| CRYSTAL | Crystals, Frost Crystal | Resonance | Crystal forest, refraction |

### Star Classes

| Class | Colour | Frequency | Bonus |
|---|---|---|---|
| O | Blue-violet | 0.003% | Exotic planets |
| B | Blue-white | 0.13% | Rare resources |
| A | White | 0.6% | Rich asteroid belts |
| F | Yellow-white | 3% | Lush planets |
| G | Yellow (Sol-like) | 7.6% | High habitability |
| K | Orange | 12.1% | Good for settlements |
| M | Red dwarf | 76.45% | Common, small planets |

Special system configurations: binary star systems, trinary systems, ring planets, and moon systems are generated with weighted probability from the system seed.

---

## 3. Rendering Pipeline

### Stack

- **Three.js r162** — scene graph, geometries, materials
- **WebGL2** — shader features, instanced rendering
- **UnrealBloom** (post-processing) — HDR glow on stars, ships, energy weapons
- **SMAA** (post-processing) — anti-aliasing without TAA ghosting

### Custom GLSL Shaders (`src/shaders.js`)

| Shader | Purpose |
|---|---|
| `terrainPBR` | Physically-based terrain with albedo/normal/roughness maps blended per biome |
| `gerstnerWater` | Multi-octave Gerstner wave ocean with foam, subsurface scattering |
| `spaceNebula` | Fullscreen raymarched nebula cloud background |
| `atmosphere` | Rayleigh + Mie scattering atmosphere on planet surface |
| `starfield` | Instanced star points with spectral colour |
| `buildingEmissive` | Emissive pulse for powered buildings |

### Terrain LOD System (`src/terrain.js`)

Four detail levels based on camera distance:

| LOD | Vertices | Distance |
|---|---|---|
| 0 (highest) | 128 × 128 | 0–200 units |
| 1 | 64 × 64 | 200–600 units |
| 2 | 32 × 32 | 600–1500 units |
| 3 (lowest) | 16 × 16 | 1500+ units |

Terrain chunks are streamed asynchronously — no frame stalls. The chunk pool recycles geometry objects to avoid GC pressure.

### Atmosphere & Weather

- **Day/night cycle**: Sun position drives directional light colour (5500K noon → 2000K sunset → ambient moonlight night)
- **Weather system** (`src/weather.js`): Rain, fog, sandstorm, blizzard, aurora — probabilities driven by biome type
- **Particles**: Weather uses instanced billboard quads for 10,000+ particles at 60fps

---

## 4. Player Systems

### Classes

| Class | Playstyle | Signature Ability |
|---|---|---|
| **Runekeeper** | Mystic / Healer | Rune shields, area heals, ancient tech |
| **Technomancer** | Engineer / Builder | Faster building, drone companions, EMP |
| **Voidhunter** | Combat / Explorer | Combat roll, stealth cloak, enhanced sensors |

### Stats

| Stat | Base Value | Notes |
|---|---|---|
| HP | 100 | Restored by medkits, camp fires, life support |
| Shield | 50 | Recharges automatically after 3s out of combat |
| Stamina | 100 | Drains on sprint; recovers at rest |
| Jetpack Fuel | 100 | Drains on boost; refills on ground |
| Life Support | 100 | Drains on hazardous planets; refill at base |

### Currencies

- **Units (u)** — General currency. Earned by trading, quests, looting, mining
- **Nanites** — Tech upgrade currency. Earned by analysing specimens, completing research missions, salvaging

### Progression

```
XP (kills, discoveries, builds, quests)
→ Levels (1–100)
→ Class abilities unlock at levels 5, 10, 20, 35, 50, 75, 100
→ Tech Tree branches (Exosuit / Multi-tool / Ship)
```

### Status Effects

| Effect | Duration | Source | Counter |
|---|---|---|---|
| Burning | 5s | Fire biome, incendiary weapons | Hazard suit upgrade |
| Frozen | 3s | Blizzard, cryo weapons | Thermal layer |
| Poisoned | 8s | Toxic biome, creature venom | Antidote |
| Energised | 10s | Power cells, faction stations | — (beneficial) |
| Shielded | Until broken | Shield modules, Runekeeper aura | — (beneficial) |

### Tech Tree

Three branches, each with 10 upgrade nodes:

- **Exosuit** — Life support efficiency, hazard resistance, jetpack capacity, carry weight, shield strength
- **Multi-tool** — Mining speed, weapon damage, scan radius, analysis speed, craft speed
- **Ship** — Pulse engine speed, warp range, cargo capacity, weapon hardpoints, shield rating

---

## 5. Building & Empire System

*Satisfactory-style automation in a procedural universe.*

### Building Types (10)

| Building | Cost | Power | Function |
|---|---|---|---|
| **Extractor** | 50 Ferrite, 20 Carbon | −10 MW | Auto-collects resources from terrain at 1u/sec |
| **Conveyor** | 10 Ferrite | −2 MW | Transports items between buildings (up to 5u/sec) |
| **Storage** | 30 Ferrite, 10 Carbon | 0 MW | Holds 500 items; input/output from conveyors |
| **Power Generator** | 80 Ferrite, 40 Pyrite | +50 MW | Burns Pyrite/Carbon to generate power |
| **Research Station** | 100 Ferrite, 50 Nanite Cluster | −20 MW | Generates Nanites over time; unlocks tech |
| **Turret** | 60 Ferrite, 30 Carbon | −15 MW | Attacks hostile NPCs and enemy players (if consented) |
| **Town Hub** | 200 Ferrite, 100 Carbon, 50 Gold | −5 MW | Claims 300u territory, enables NPC settlement |
| **Wall** | 20 Ferrite | 0 MW | Defensive barrier, 500 HP |
| **Door** | 15 Ferrite | −1 MW | Powered door, keyable to faction |
| **Farm** | 40 Ferrite, 20 Carbon | −8 MW | Grows food/plant resources automatically |

### Power Grid

- Every building in a **connected cluster** shares a power pool
- `Total generation - Total consumption = net MW`
- If net < 0: buildings shut down in priority order (cosmetic → functional → defensive)
- Power lines are implicit within a 50-unit radius; Conveyor bridges larger gaps

### Resource Automation Flow

```
Terrain deposit
  → Extractor (collects)
    → Conveyor (transports)
      → Storage (buffers)
        → Conveyor (distributes)
          → Research Station / Farm / other building
```

### Town Hub & Settlement

- Placing a Town Hub claims a **300-unit radius** territory for the player's faction
- Claimed territory: other factions cannot place buildings without triggering a conflict
- Enables spawning of up to 8 friendly NPCs (Merchant, Guard, Wanderer types)
- Town Hubs can be linked to form **empires** — connected territories with shared power and trade

### Empire Expansion

1. Claim systems with Town Hubs
2. Build trade routes (Conveyor chains or Trade Drone assignments)
3. Establish inter-system cargo runs via Ship
4. Factions respond dynamically — allied factions trade, enemies attack

### Building Placement UX

1. Press `B` to enter Build Mode
2. Select building type from radial menu
3. Preview ghost mesh follows terrain cursor (green = valid, red = invalid/overlapping)
4. Resource cost shown in HUD — placement blocked if insufficient materials
5. Press `E` to confirm, `Escape` to cancel

---

## 6. Faction System

*No Man's Sky reputation meets GTA wanted levels.*

### Factions (6)

| Faction | Focus | Territory | Default Stance |
|---|---|---|---|
| **Gek** | Trade & Commerce | Core worlds, trade hubs | Friendly to traders |
| **Vy'keen** | Combat & Honour | Border systems, fortresses | Neutral, respect strength |
| **Korvax** | Science & Knowledge | Research stations, anomalies | Friendly to scientists |
| **Atlas** | Mystery & Transcendence | Atlas interfaces, pilgrim routes | Mysterious, unknowable |
| **Outlaws** | Piracy & Freedom | Uncharted systems, black markets | Hostile to law-abiding |
| **Sentinel Order** | Law & Order | Wealthy systems, patrol routes | Hostile to criminals |

### Reputation System

```
Range: -100 (Hostile) to +100 (Honoured)
Rank tiers: Hostile | Unfriendly | Neutral | Friendly | Trusted | Honoured
```

Reputation changes from:
- Completing faction missions (+5 to +20)
- Trading at faction stations (+1 per trade)
- Killing faction members (−10 per kill)
- Helping faction in combat (+5 to +15)
- Wanted level on faction territory (−5 per level)

### Faction Effects Per Rank

| Rank | Shop Discount | Missions | NPC Dialogue | Combat Aggression |
|---|---|---|---|---|
| Hostile | +25% markup | None | Threats | Attack on sight |
| Unfriendly | +10% markup | None | Cold | Aggressive |
| Neutral | Standard | Basic | Standard | Passive |
| Friendly | −5% | Mid-tier | Warm | Passive |
| Trusted | −10% | High-tier | Detailed | Protective |
| Honoured | −15% | Elite | Full lore | Ally in combat |

### Dynamic Faction Wars & Alliances

- Factions declare war / alliances based on game state (not scripted)
- Territory contested in real time — systems can change faction control
- Player actions influence faction political landscape
- War zones: active combat between faction NPC fleets in contested systems
- Peace treaties: rare, expire after 30 real-time minutes

---

## 7. NPC & Settlement System

### NPC Types (7)

| Type | Behaviour | Spawns In |
|---|---|---|
| **Merchant** | Stationary; buy/sell at faction prices | Settlements, stations |
| **Guard** | Patrols settlement perimeter; attacks hostiles | Settlements, fortresses |
| **Wanderer** | Random walking in settlement radius | Settlements |
| **Quest Giver** | Interactable; offers quests matching player level | Towns, cities |
| **Faction Agent** | Offers faction missions, rep missions | Faction buildings |
| **Bounty Hunter** | Pursues wanted players; escalates with want level | Spawns near player |
| **Settler** | Moves to unclaimed land; may start a new settlement | Wilderness |

### Settlement Sizes

| Size | Min NPCs | Structures | Unlocked By |
|---|---|---|---|
| Camp | 3 | Fire, 2 tents | 1 Town Hub nearby |
| Village | 8 | Hub, market, homes | 2+ Town Hubs |
| Town | 15 | Hub, market, inn, barracks | 4+ linked Hubs |
| City | 30 | All types + trade port | 8+ linked Hubs |

### Dialogue System

Context-aware lines selected at runtime from faction-labelled dialogue pool in `src/npcs.js`:

```
Variables resolved: {playerName}, {faction}, {systemName}, {wantedLevel}
Conditions checked: factionRep, playerLevel, wantedStars, nearbyBuildings
```

### Wanted System & Bounty Hunters

- **0 stars**: Normal
- **1–2 stars**: Nearby guards investigate
- **3 stars**: Bounty Hunter NPC spawns within 200u, pursues
- **4 stars**: Two Bounty Hunters + Sentinel drone patrol
- **5 stars**: Elite Bounty Hunter + faction soldiers + air support

Wanted level decays after 60 seconds outside faction territory, or can be cleared by paying fine at Sentinel station.

---

## 8. Combat: PvE & PvP

### PvE Enemies

| Enemy | HP | Damage | Drop |
|---|---|---|---|
| Creature (small) | 30 | 5 | Meat, hide |
| Creature (large) | 200 | 20 | Rare hide, bone |
| Sentinel Drone | 80 | 15 | Drone tech, Nanites |
| Sentinel Walker | 500 | 40 | Heavy tech, Units |
| NPC Guard | 100 | 18 | Faction token, ammo |
| Faction Soldier | 150 | 25 | Faction token, weapon |
| Bounty Hunter | 250 | 30 | Bounty tech, Units |

### Bosses

| Boss | Location | HP | Reward |
|---|---|---|---|
| Faction Commander | Faction fortress | 2000 | Faction weapon, rep boost |
| Exotic Mega-fauna | Exotic planets | 3000 | Exotic tech, rare resource |
| Ancient Machine | Derelict ruins | 5000 | Ancient tech, galaxy lore |

### PvP

- Players are **non-hostile by default** (consent flag off)
- Players can toggle PvP consent in options; both must have flag on to deal damage
- **Faction war zones**: systems in active faction war create automatic open-PvP areas
- Killing a consenting player: loot their dropped Units (up to 20% of carried amount)
- Griefing (destroying another player's buildings): requires faction war context or full PvP consent

### Loot System

- All drops go to nearby **loot container** visible to all players for 60 seconds
- Resources auto-pickup on walk-over; tech/weapons require manual pickup
- Rare drops: 5% chance per elite kill, displayed with golden particle effect

---

## 9. Economy & Trading

### Commodity Items (30)

Grouped by category:

| Category | Items |
|---|---|
| **Raw Resources** | Ferrite Dust, Pure Ferrite, Carbon, Condensed Carbon, Oxygen, Sodium, Sulphurine, Radon |
| **Biological** | Mordite, Star Bulb, Gamma Root, Cactus Flesh, Fungal Mould, Frost Crystal |
| **Tech Materials** | Nanite Cluster, Chromatic Metal, Ionised Cobalt, Magnetite, Platinum |
| **Refined** | Di-hydrogen, Pyrite, Dioxite, Ammonia, Phosphorus |
| **Rare** | Activated Copper, Activated Cadmium, Activated Emeril, Activated Indium, Larval Core |

### Dynamic Pricing

- Base price per item defined per system (derived from system seed)
- Price fluctuates ±20% based on recent trade volume (supply/demand)
- **Price history**: last 10 trades per item per system stored for trend display
- **Faction modifier**: Honoured standing = 15% better prices at that faction's stations

### Space Station Economy

- Each station has **3 ships for sale**, randomly selected from class pool
- Ship inventory refreshes on each new player warp into the system
- Station has its own **6-slot buy list** and **6-slot sell list**, refreshed every 5 real-minutes

### Trade Drones

- Automated hauler NPCs assigned by players between two systems
- 60-second round trip, carry up to 100u of a single resource
- Cost: 50 Ferrite + 20 Carbon to deploy; persists until destroyed or recalled
- Revenue: buy low at origin, sell high at destination (profit kept by owner)

---

## 10. Multiplayer Architecture

### WebSocket Server (`server.js`)

```
Node.js + ws library
Port: 8080 (configurable via PORT env var)
Runs on: Linux VPS, Raspberry Pi, Android/Termux, Windows, macOS
```

### Message Protocol

All messages are JSON over WebSocket:

```json
{ "type": "PLAYER_UPDATE", "id": "...", "position": {...}, "hp": 100, ... }
{ "type": "BUILDING_PLACE", "building": {...} }
{ "type": "CHAT", "name": "...", "text": "..." }
{ "type": "WARP", "to": "0:1024:42" }
```

### State Sync Rates

| Data Type | Sync Rate | Method |
|---|---|---|
| Player positions | 20 Hz | Broadcast to all in region |
| Building changes | Immediate | Targeted broadcast |
| Chat messages | Immediate | Broadcast to all |
| Economy updates | On trade | Broadcast to region |
| Status effects | On change | Targeted |

### Mesh Networking

Multiple server instances sync peer-to-peer via WebSocket:

```bash
MESH_PEERS=ws://192.168.1.10:8080,ws://vps.example.com:8080 node server.js
```

- Player positions from peer instances broadcast as ghost entities
- Building state and territory synced every 30 seconds between peers
- Chat messages bridged across all mesh nodes

### Persistence

All persistent data stored in `data/` as JSON files:

```
data/universe.json     — visited system addresses, galaxy state
data/buildings.json    — all placed building objects
data/factions.json     — faction territories, wars, alliances
data/economy.json      — price history, trade drone assignments
data/chat.json         — last 1000 chat messages
data/bans.json         — banned IPs and player IDs
```

### Admin System

Token-authenticated REST API (see `admin.html`):

```
GET  /admin/status    — server stats, version, player count
GET  /admin/players   — connected player list
GET  /admin/buildings — all placed buildings
GET  /admin/chat      — last 50 messages
GET  /admin/logs      — last 20 server log lines
GET  /admin/economy   — top traded items
POST /admin/kick      — kick player by ID
POST /admin/ban       — ban player by IP
POST /admin/announce  — broadcast announcement
POST /admin/remove-building — remove building by ID
POST /admin/save      — force save universe state
```

### Capacity

- **50 players** per server instance (configurable via `MAX_PLAYERS` env var)
- Recommended specs per 50 players: 1 CPU core, 512 MB RAM, 1 Mbps upload
- Android/Termux: up to ~15 players on a mid-range phone

---

## 11. Android / Termux Server Setup

Run a full Aetheria server from your Android phone.

### Prerequisites

- Android 7.0+
- [Termux from F-Droid](https://f-droid.org/packages/com.termux/) (do **not** use Google Play version)
- ~200 MB free storage

### Step-by-Step

```bash
# 1. Install Termux from F-Droid

# 2. Update packages and install Node.js + Git
pkg update && pkg upgrade -y
pkg install nodejs git -y

# 3. Clone the repository
git clone https://github.com/MrNova420/Aetheria-Endless-Frontiers.git

# 4. Enter directory and run setup script
cd Aetheria-Endless-Frontiers
bash setup-termux.sh

# 5. Start the server
node server.js
```

### Accessing the Game

- **Local device**: Open browser → `http://localhost:8080`
- **LAN (other devices on same Wi-Fi)**: Server prints your LAN IP on startup
  - Example: `http://192.168.1.42:8080`
- **Admin dashboard**: `http://localhost:8080/admin.html`

### Keeping the Server Running

```bash
# Run in background, persist after closing Termux
nohup node server.js > server.log 2>&1 &
echo $! > server.pid

# Stop it later
kill $(cat server.pid)
```

### Mesh Setup (Multiple Devices)

```bash
# On Device A (main)
node server.js

# On Device B (peer) — point to Device A's LAN IP
MESH_PEERS=ws://192.168.1.42:8080 node server.js
```

Both servers now share player presence and building state across devices.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `ADMIN_TOKEN` | `aetheria_admin` | Admin API token |
| `MAX_PLAYERS` | `50` | Max concurrent players |
| `MESH_PEERS` | `""` | Comma-separated peer WS URLs |
| `SAVE_INTERVAL` | `30000` | Auto-save interval (ms) |

---

## 12. Save Format (v4)

Saved to `localStorage` key `aetheria_save` as JSON.

### Schema

```json
{
  "version": 4,
  "systemId": "0:1024:42",
  "player": {
    "name": "string",
    "class": "Voidhunter | Runekeeper | Technomancer",
    "hp": 100,
    "hpMax": 100,
    "shield": 50,
    "stamina": 100,
    "jetpack": 100,
    "lifeSupport": 100
  },
  "inventory": [
    { "id": "ferrite_dust", "qty": 250 }
  ],
  "level": 1,
  "xp": 0,
  "techTree": {
    "exosuit": [false, false, false, false, false, false, false, false, false, false],
    "multitool": [false, false, false, false, false, false, false, false, false, false],
    "ship": [false, false, false, false, false, false, false, false, false, false]
  },
  "quests": [
    { "id": "string", "status": "active | completed | failed", "progress": 0 }
  ],
  "status": {
    "burning": false,
    "frozen": false,
    "poisoned": false,
    "energised": false,
    "shielded": false
  },
  "extractors": [
    { "id": "string", "systemId": "string", "position": { "x": 0, "y": 0, "z": 0 }, "resource": "string" }
  ],
  "universe": {
    "visited": ["0:0:0", "0:1024:42"],
    "discoveredPlanets": { "0:1024:42": ["planet_0", "planet_1"] }
  },
  "units": 500,
  "nanites": 0,
  "buildings": [
    {
      "id": "string",
      "type": "Extractor | Conveyor | Storage | ...",
      "systemId": "string",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": 0,
      "hp": 100,
      "hpMax": 100,
      "powered": true
    }
  ],
  "factions": {
    "gek":      { "rep": 0 },
    "vykeen":   { "rep": 0 },
    "korvax":   { "rep": 0 },
    "atlas":    { "rep": 0 },
    "outlaws":  { "rep": -50 },
    "sentinel": { "rep": 0 }
  },
  "wantedLevel": 0,
  "wantedDecayTimer": 0
}
```

### Migration

On load, if `version < 4`, the save migrator in `src/game.js` patches missing fields with defaults before the game initialises.

---

## 13. Planned Features (Roadmap)

### Phase 1 — Current (Foundation)
- [x] Procedural universe generation (255 galaxies, 14 biomes, 7 star classes)
- [x] Three.js rendering with custom GLSL shaders
- [x] Player movement, jetpack, mining, inventory
- [x] Building system (10 types, power grid, conveyor automation)
- [x] Faction system (6 factions, reputation, territory)
- [x] Basic NPC types (Merchant, Guard, Wanderer)
- [x] WebSocket multiplayer, admin dashboard
- [x] Termux/Android server support

### Phase 2 — NPC & Combat Depth
- [ ] Full NPC dialogue trees with branching and condition checks
- [ ] Faction wars with real-time territory battles
- [ ] Full bounty hunter chase AI
- [ ] 5 distinct ship classes with combat loadouts
- [ ] Creature ecosystem (predator/prey AI)
- [ ] Weather hazard combat effects

### Phase 3 — Content & Quests
- [ ] Procedural mission generator (fetch, escort, assassination, defend)
- [ ] Atlas storyline (main quest arc, 20 milestones)
- [ ] Portal system (cross-galaxy fast travel, resource cost)
- [ ] Galaxy centre event (endgame zone)
- [ ] Salvage missions in derelict freighters
- [ ] Trade route visualisation overlay

### Phase 4 — Polish & Production
- [ ] Voice acting hooks (Web Speech API + external audio)
- [ ] Cinematic cutscene system (scripted camera + dialogue)
- [ ] Mod support (user scripts loaded from `/mods/*.js`)
- [ ] Achievements system, global leaderboard
- [ ] Screenshot mode, coordinate sharing

### Phase 5 — Mobile Native
- [ ] Capacitor wrapper for Android APK
- [ ] Cloud saves (optional, server-backed)
- [ ] Push notifications for base attacks
- [ ] Touch-optimised HUD overhaul
- [ ] Offline single-player mode

---

## 14. Controls Reference

### Keyboard & Mouse

| Action | Key / Button |
|---|---|
| **Move Forward** | `W` |
| **Move Backward** | `S` |
| **Strafe Left** | `A` |
| **Strafe Right** | `D` |
| **Sprint** | `Shift` |
| **Jump** | `Space` |
| **Jetpack Boost** | `Space` (hold while airborne) |
| **Interact / Use** | `E` |
| **Mine / Attack** | Left Mouse Button |
| **Aim** | Right Mouse Button (hold) |
| **Inventory** | `I` or `Tab` |
| **Map** | `M` |
| **Build Mode** | `B` |
| **Tech Tree** | `T` |
| **Quests** | `J` |
| **Chat** | `Enter` |
| **Cancel / Close** | `Escape` |
| **Screenshot Mode** | `F12` |
| **Toggle HUD** | `H` |
| **Warp (in ship)** | `W` + `Shift` (hold 2s) |
| **Scan** | `C` |
| **Torch / Light** | `F` |
| **Crouch** | `Ctrl` |
| **Ping Location** | `G` |
| **Quick Save** | `F5` |
| **Rotate Building** | `R` (in build mode) |
| **Delete Building** | `Delete` (aim at building) |

### Mouse

| Action | Input |
|---|---|
| Look / Camera | Mouse move |
| Interact | Left Click |
| Aim | Right Click |
| Zoom (scoped) | Right Click + Scroll |
| Scroll Hotbar | Scroll Wheel |
| Drag Inventory | Left Click + Drag |

### Mobile / Touch

| Action | Gesture |
|---|---|
| Move | Left joystick (virtual) |
| Look | Swipe right side of screen |
| Jump / Jetpack | `↑` button (right cluster) |
| Interact | `E` button (right cluster) |
| Mine / Attack | `⚒` button (right cluster) |
| Sprint | Double-tap left joystick |
| Inventory | Hamburger icon (top right) |
| Chat | Speech bubble icon |
| Build Mode | Wrench icon |
| Map | Compass icon |
| Pinch zoom | Two-finger pinch (map / scan view) |

---

## 15. File Structure

```
Aetheria-Endless-Frontiers/
├── index.html              # Game entry point; loads all modules
├── server.js               # Node.js WebSocket + REST admin server
├── admin.html              # Admin dashboard (single-file, no dependencies)
├── package.json            # Node.js dependencies (ws, express)
├── capacitor.config.json   # Capacitor config for Android APK build
├── setup.sh                # Linux/macOS server setup script
├── setup.bat               # Windows setup script
├── setup.ps1               # PowerShell setup script
├── setup-termux.sh         # Android/Termux-specific setup script
│
├── src/
│   ├── assets.js           # Asset manifest; texture/model URLs and loaders
│   ├── audio.js            # Web Audio API: ambient, SFX, music layers
│   ├── building.js         # Building placement, power grid, conveyor logic
│   ├── config.js           # Global constants: biomes, factions, item tables
│   ├── crafting.js         # Crafting recipes, workbench UI, cost validation
│   ├── creatures.js        # Procedural creature generation and AI behaviours
│   ├── extractor.js        # Resource extractor tick, conveyor feed, output
│   ├── factions.js         # Faction definitions, rep system, war/ally logic
│   ├── flora.js            # Procedural plant/tree generation and placement
│   ├── galaxy.js           # Galaxy map, region index, warp navigation
│   ├── game.js             # Main game loop, save/load, module initialisation
│   ├── help.js             # In-game help overlay and tutorial hints
│   ├── inventory.js        # Inventory grid, stack management, drag-drop UI
│   ├── lore.js             # Lore text, codex entries, discovered text tablets
│   ├── mining.js           # Mining beam raycast, resource yield, durability
│   ├── network.js          # WebSocket client, message dispatch, player sync
│   ├── noise.js            # Simplex/Perlin noise utilities for generation
│   ├── npcs.js             # NPC spawn, AI state machine, dialogue engine
│   ├── physics.js          # AABB collision, gravity, terrain height sampling
│   ├── planet.js           # Planet surface generation, biome assignment
│   ├── player.js           # Player stats, movement, class abilities, status FX
│   ├── quests.js           # Quest definitions, tracking, reward distribution
│   ├── sentinels.js        # Sentinel drone/walker AI, wanted level management
│   ├── shaders.js          # All custom GLSL vertex/fragment shader strings
│   ├── ship.js             # Ship flight physics, warp sequence, station dock
│   ├── space.js            # Space scene: stars, nebula, asteroid belts, orbits
│   ├── status.js           # Status effect application, timers, visual feedback
│   ├── terrain.js          # Chunk streaming, LOD system, terrain mesh builder
│   ├── trading.js          # Shop UI, price calculation, trade drone management
│   ├── ui.js               # HUD, minimap, notifications, modal dialogs
│   ├── universe.js         # Universe seed, region loading, address resolution
│   └── weather.js          # Weather state machine, particle systems, hazards
│
├── css/
│   └── *.css               # Supplemental styles (UI panels, inventory)
│
├── assets/
│   ├── textures/           # Planet surface, UI, icon textures
│   ├── models/             # 3D models for ships, buildings, creatures
│   └── audio/              # Ambient loops, SFX, music tracks
│
├── data/                   # Server-side persistent state (JSON, git-ignored)
│   ├── universe.json
│   ├── buildings.json
│   ├── factions.json
│   ├── economy.json
│   ├── chat.json
│   └── bans.json
│
├── docs/                   # Extended documentation
├── archive/                # Deprecated/archived code snapshots
└── scripts/                # Build and utility scripts
```

---

*Document maintained alongside source. Update version number and section when architecture changes.*
