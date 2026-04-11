# Aetheria: Endless Frontiers — Gameplay Guide

> Complete guide to surviving, building, trading, and conquering the universe.

---

## Contents

1. [First Steps](#1-first-steps)
2. [Planet Surface Exploration](#2-planet-surface-exploration)
3. [Mining & Resources](#3-mining--resources)
4. [Crafting](#4-crafting)
5. [Base Building & Empire](#5-base-building--empire)
6. [Ship Flight & Space Travel](#6-ship-flight--space-travel)
7. [Combat](#7-combat)
8. [Factions & Trading](#8-factions--trading)
9. [Progression — XP, Levels & Tech Tree](#9-progression--xp-levels--tech-tree)
10. [Character Classes](#10-character-classes)
11. [Status Effects](#11-status-effects)
12. [Galaxy Map & Warping](#12-galaxy-map--warping)
13. [Multiplayer](#13-multiplayer)
14. [Tips & Tricks](#14-tips--tricks)

---

## 1. First Steps

### Creating Your Character
When you launch the game you see the **Character Slot** screen.

| Action | How |
|---|---|
| New character | Click an empty slot → enter your **name** → pick a **suit colour** → choose a **class** |
| Continue | Click a filled slot → press **Continue** |
| Delete | Click a filled slot → press **Delete** (confirmation required) |

You have **3 independent save slots** — each holds a completely separate character, inventory, tech tree, and universe position. All three can co-exist.

### Starter Kit (all classes)
Every new character receives:

| Item | Amount |
|---|---|
| Carbon | 250 |
| Ferrite Dust | 150 |
| Di-Hydrogen | 60 |
| Warp Cell | 2 |
| Health Pack | 3 |
| Units (currency) | 3 000 |
| Nanites | 100 |

This is enough to immediately build a basic power generator + extractor and warp to the next star system.

### Your First 5 Minutes
1. **Look around** — your ship is a few metres ahead; the terrain stretches in every direction.
2. **Mine Carbon and Ferrite Dust** — approach any glowing resource node and hold `Left Click`.
3. **Open the Crafting menu** (`N`) — craft a **Warp Cell** from Di-Hydrogen + Chromatic Metal.
4. **Press `B`** to enter Build Mode — place a **Power Generator** (digit `4`), then an **Extractor** (digit `1`) nearby.
5. **Press `M`** to open the Galaxy Map — pick any adjacent system and warp (costs 1 Warp Cell).

---

## 2. Planet Surface Exploration

### Movement
| Action | Key | Note |
|---|---|---|
| Walk | `W A S D` | 12 m/s |
| Sprint | `Shift` | 26 m/s — hold while moving |
| Jump | `Space` (on ground) | ~2 m apex |
| Coyote jump | `Space` (just off ledge) | 0.14 s grace window |
| Jetpack | `Space` (while airborne) | Thrust overrides gravity |
| Jetpack fuel | — | 100 units; drains 30/s, recharges 25/s on ground |

> **Tip:** The jetpack activates **only when you are already airborne**. Jump first, then hold `Space` to continue rising.

### Scanner (`F`)
The scanner pulse reveals:
- Nearby **resource nodes** with floating icons
- **Creatures** in a 30-unit radius
- **NPCs and settlements**
- **Points of interest** (ruins, anomalies, derelict stations)

Each scan has a 2.5-second cooldown.

### Interact (`E`)
Press `E` near an NPC to open dialogue. NPCs can:
- Offer quests
- Sell items (merchants)
- Give faction reputation information
- Trade resources

### Day / Night Cycle
Each planet has its own day/night length. The sky transitions in real time — terrain lighting, water reflections, and atmospheric scattering all update dynamically. Night brings stars and up to 4 visible moons.

### Weather
| Type | Effect |
|---|---|
| Rain | Wets terrain shader (slicker-looking ground) |
| Blizzard | Reduces movement speed to 45% |
| Sandstorm | Reduces movement speed to 70% |
| Electrical storm | Periodic lightning; hazard damage on exposed planets |

---

## 3. Mining & Resources

### Mining Resource Nodes
1. Approach a glowing node (they pulse gently).
2. Hold `Left Click` to activate the mining beam.
3. Resources drop into your inventory automatically when the node breaks.
4. Each successful mine awards XP.

### Common Resources
| Resource | Found on | Primary use |
|---|---|---|
| Carbon | All types | Crafting, building fuel |
| Ferrite Dust | Barren, Volcanic | Building (iron substitute) |
| Di-Hydrogen | Ocean, Lush, Tropical | Warp Cells, fuel |
| Chromatic Metal | Exotic, Crystal | Warp Cells, tech |
| Sodium | Toxic, Swamp | Batteries, building |
| Cobalt | Frozen, Arctic | Tech upgrades |
| Platinum | Dead, Barren | High-value trade |
| Uranium | Volcanic, Burning | Power cells, trading |

### Auto-Extractor
Deploying a **powered Extractor** (press `B` → digit `1` → `Left Click` to place) produces resources passively:
- Every **10 seconds** it deposits the planet's primary resource directly into your inventory.
- Requires a **Power Generator** to be active.

---

## 4. Crafting

Open the crafting menu with `N`. Resources are consumed from your inventory to produce items.

### Key Recipes
| Output | Inputs | Use |
|---|---|---|
| Warp Cell | Di-Hydrogen ×50, Chromatic Metal ×30 | Inter-system travel |
| Health Pack | Carbon ×20, Sodium ×10 | Restore 40 HP |
| Shield Battery | Cobalt ×15, Carbon ×10 | Restore 50 Shield |
| Antimatter | Carbon ×50, Chromatic Metal ×20 | Advanced fuel |
| Life Support Gel | Carbon ×30, Sodium ×20 | Restore life support |

Crafting more complex items requires unlocking **blueprints** through the Tech Tree (`T`).

### Crafting Tips
- Stack materials first — buy in bulk from merchants.
- The crafting menu shows greyed-out recipes when you're missing ingredients, so you always know what to gather next.
- Craft items **before warping** — trading posts in new systems may not stock what you need.

---

## 5. Base Building & Empire

Build Mode (`B` key) is the foundation of your empire. Once you have resources and a Power Generator, you can automate resource production and start expanding.

### Build Mode Controls
| Action | Key |
|---|---|
| Toggle Build Mode | `B` |
| Select building 1–9 | Digit keys `1` – `9` |
| Place building | `Left Click` (placed 6 units ahead) |
| Exit Build Mode | `B` again |

The **Build Panel** on the right side of the screen shows all available buildings with their resource costs colour-coded:
- 🟢 **Green** = you can afford it
- 🔴 **Red** = you are missing resources

### Building Types
| # | Type | Power Cost | Power Gen | Primary Function |
|---|---|---|---|---|
| 1 | Extractor | 20 | 0 | Mines planet resource every 10 s |
| 2 | Conveyor | 5 | 0 | Transports items between buildings |
| 3 | Storage | 0 | 0 | Extra inventory capacity |
| 4 | Power Generator | 5 | 100 | Supplies power to all nearby buildings |
| 5 | Research Station | 30 | 0 | Generates 5 Nanites every 30 s |
| 6 | Turret | 10 | 0 | Auto-attacks hostile creatures/sentinels |
| 7 | Town Hub | 0 | 0 | Settlement centre; attracts NPC traders |
| 8 | Wall | 0 | 0 | Defensive perimeter |
| 9 | Door | 0 | 0 | Passable gap in walls |
| — | Farm | 10 | 0 | Grows Carbon every 15 s |

### Building Costs (Resource Name Map)
Building costs use short keys internally. Here is the mapping to inventory names:

| Cost key | Inventory name |
|---|---|
| `iron` | Ferrite Dust |
| `carbon` | Carbon |
| `sodium` | Sodium |
| `gold` | Chromatic Metal |
| `titanium` | Titanium |
| `cobalt` | Cobalt |
| `copper` | Copper |
| `platinum` | Platinum |

### Power Grid
- **Power Generator** produces 100 power units.
- Each building draws power according to its `powerCost`.
- If total draw > total generation, **all powered buildings shut down**.
- Storage and Town Hub have zero power cost — they always run.

### Starter Base Blueprint (Recommended)
```
1. Place Power Generator  (iron×15, carbon×10, sodium×5)
2. Place Extractor nearby  (iron×10, carbon×5)
3. Place Research Station  (iron×20, gold×5, carbon×10)
4. Place Farm             (iron×25, gold×3)
5. Later: add Turrets for defence
6. Later: add Town Hub to attract merchants
```

This setup produces Carbon, Ferrite Dust (via extractor), Nanites, and food-Carbon from the farm — a self-sustaining economy in ~2 minutes.

### Building Automation Rates
| Building | Cycle | Output |
|---|---|---|
| Extractor (powered) | Every 10 s | 3–5 of planet's primary resource |
| Research Station (powered) | Every 30 s | 5 Nanites |
| Farm (powered) | Every 15 s | 3 Carbon |

---

## 6. Ship Flight & Space Travel

### Boarding and Exiting
- Walk close to your ship and press `G` to board.
- Press `G` again (when landed) to exit.
- On mobile, use the `🚀 BOARD` / `🪂 EXIT` buttons.

### Flight Modes
| Mode | When | Controls |
|---|---|---|
| LANDED | On the ground | `G` to take off |
| ATMOSPHERIC | Below space altitude | `W/S` throttle, `A/D` yaw, mouse pitch/roll, `Space` boost |
| SPACE | Above atmosphere | Same controls, no gravity |

### Entering Space
Fly upward (`W` + pitch up). The atmosphere fades, stars appear, and the ship transitions to **SPACE** mode above ~1 800 altitude units.

### Entering a Planet's Atmosphere
In space, fly toward a planet sphere. When within **600 units** of the sphere surface your ship automatically begins atmospheric re-entry — the transition plays an entry animation and deposits you on the surface.

### Warp Travel
Press `M` to open the **Galaxy Map**. Click a nearby star to warp — this consumes 1 **Warp Cell** and teleports you to that system's starting planet.

---

## 7. Combat

### Attacking
- `Right Click` fires your weapon.
- There is a 0.5-second cooldown between shots.
- Attack range: 12 world units.
- Base damage: 25 per shot.

### Taking Damage
Damage is absorbed by **Shield** first, then **HP**:
- Shield regenerates automatically after 3 seconds without taking damage.
- HP is restored with Health Packs (`💊 HEAL` button on mobile, or use from inventory).
- Creatures deal melee damage when they close to attack range. Boss creatures hit harder, but damage is capped at 35 per hit.

### Sentinel Drones
Mining and combat raise your **Wanted Level**. Sentinels deploy at level 1+ and escalate:
| Level | Response |
|---|---|
| 1 | Single scout drone |
| 2 | Two drones |
| 3 | Three drones + increased aggression |
| 4+ | Heavy drones |

Wanted level decays over time when you avoid conflict.

---

## 8. Factions & Trading

### The 6 Factions
| Faction | Playstyle | Specialty |
|---|---|---|
| Gek First Spawn | Merchant | Trading, commodities |
| Korvax Convergence | Science | Research, technology |
| Vykeen Warrior Clans | Combat | Weapons, combat gear |
| Atlas Foundation | Exploration | Navigation, lore |
| Outlaw Syndicate | Smuggling | Black market items |
| Sentinel Order | Enforcement | Security, wanted system |

### Reputation Ranks
`hostile → unfriendly → neutral → friendly → honored → exalted`

Gain reputation by:
- Completing faction quests
- Trading with faction merchants
- Defeating faction enemies (improves standing with rival factions)

### Trading
Open a merchant dialogue (`E`) or visit a **Trading Post** settlement.

| Price | Explanation |
|---|---|
| Base price × 0.5–1.5 | Commodity prices fluctuate per system |
| Buy low in one system | Some economies specialise in cheap commodities |
| Sell high in another | Carry goods to systems that need them |

The **TradingSystem** tracks 30 commodities with per-system price variation. Check commodity prices at each trading post — a profit of 500–2 000 Units per trade route is typical early game.

---

## 9. Progression — XP, Levels & Tech Tree

### Gaining XP
| Action | XP |
|---|---|
| Mine a resource | 3 per unit |
| Complete a mine cycle | ×10 bonus |
| Kill a creature | 35 |
| Kill a boss creature | 100+ |
| Build a structure | 20 |
| Complete a quest | 200–500 |
| Level up | Scales ×1.35 per level |

### Tech Tree (`T`)
Spend Nanites to unlock upgrades:

| Category | Upgrade | Effect |
|---|---|---|
| **Jetpack** | Fuel Capacity | +25% jetpack fuel |
| **Jetpack** | Thrust Boost | +15% thrust |
| **Shield** | Shield Capacity | +25 max shield |
| **Shield** | Regen Speed | −0.5 s regen delay |
| **Mining** | Beam Power | Mine 50% faster |
| **Mining** | Range | +4 unit beam range |
| **Life Support** | Efficiency | −20% hazard drain rate |
| **Life Support** | Capacity | +30 s total life support |
| **Scanner** | Range | +15 unit scan radius |
| **Scanner** | Speed | −0.5 s scan cooldown |

---

## 10. Character Classes

| Class | Strength | Starting Bonus |
|---|---|---|
| **Explorer** | Jetpack fuel, scan range | +50 jetpack fuel, wider scanner |
| **Warrior** | HP, shield, damage | +20 HP, +15 shield, +5 attack damage |
| **Trader** | Units, trade prices | +1 500 starting Units, better buy/sell rates |

All classes receive the **same starter kit** of resources. Class choice affects combat viability and economic efficiency, not access to content — everything is available to every class.

---

## 11. Status Effects

Status effects are applied by environmental hazards, creature attacks, and weather.

| Effect | Source | Duration | Effect |
|---|---|---|---|
| 🔥 Burning | Fire creatures, BURNING/VOLCANIC planets | 6 s | 8 HP damage per second |
| ❄ Frozen | ICE creatures, FROZEN/ARCTIC planets | 5 s | Speed reduced to 40% |
| ☠ Poisoned | Toxic creatures, TOXIC/SWAMP planets | 8 s | 4 HP/s + life support drain |
| ⚡ Energised | Power cells, certain loot | 10 s | Speed ×1.5, damage +10 |
| 🛡 Shielded | Shield Battery item | 12 s | Incoming damage reduced 40% |

Effects can be stacked (e.g., Burning + Frozen) but re-applying the same effect only refreshes duration — it does not double the intensity.

---

## 12. Galaxy Map & Warping

Press `M` to open the Galaxy Map at any time (on foot or in space).

### System Info Panel
Click any system to see:
- Star type and colour
- Danger level (0–5)
- Wealth level (0–5)
- Economy type (Mining / Industrial / High-Tech / etc.)
- Number of planets
- System traits (Nebula, Ancient Ruins, Trade Hub, etc.)
- Galaxy tier and unlock level

### Warping
1. Click a system on the map.
2. Press **WARP** button (or `Enter`).
3. One **Warp Cell** is consumed from your inventory.
4. You arrive on the starting planet of the target system.

### Galaxy Jump
After reaching the required level for your current galaxy tier, you can jump to the next galaxy via the map screen. Each galaxy applies a **chromatic tint** to all terrain colours — galaxies look visually distinct.

### Galaxy Tiers
| Tier | Galaxies | Unlock Level | Challenge |
|---|---|---|---|
| 1 — Euclid Cluster | 0–7 | 1 | Starter — calm, lush worlds |
| 2 — Contested Expanse | 8–31 | 10 | Mixed — moderate danger |
| 3 — Outer Reaches | 32–63 | 20 | Harsh — high sentinel activity |
| 4 — Void Fringe | 64–127 | 35 | Extreme — elite fauna |
| 5 — The Abyss | 128–191 | 55 | Alien — ruins, exotic worlds |
| 6 — Convergence Core | 192–254 | 80 | Maximum — reality fractures |

---

## 13. Multiplayer

Multiplayer requires the **Node.js server** (`npm start`). Browser-only `python3 -m http.server` only supports single player.

### Features
- **Up to 50 concurrent players** per server
- **Proximity filtering**: only players within 800 units receive your position updates (20 Hz broadcast)
- **Ghost meshes**: other players are rendered as translucent blue silhouettes
- **Character names**: your character's name floats above your ghost mesh
- **Chat**: open chat by pressing Enter

### Playing Together
- You and friends **share the same universe** — system IDs are deterministic, so warping to the same system ID puts you in the same environment.
- Bases are **not yet synced in real time** — buildings are saved per-player.
- Combat is **client-side** — players cannot damage each other yet (PvE only).

---

## 14. Tips & Tricks

### Survival
- Keep **3+ Health Packs** in your inventory at all times.
- On **Toxic / Volcanic / Burning** planets your life support drains fast — craft **Life Support Gel** before landing.
- Sentinels disengage if you hide inside your **ship**.

### Economy
- **Platinum** and **Chromatic Metal** are the highest-value commodities. Find systems with `Rich Deposits` trait.
- Check the **Trader class** for a passive buy/sell bonus — useful for bulk commodity runs.
- **Research Stations** generate Nanites passively — place several for tech tree upgrades without grinding.

### Building Efficiency
- Place the **Power Generator first** — nothing else works without it.
- **Farms + Extractors** are self-funding once placed: they pay back their resource cost in the first 5 minutes.
- Build your **Town Hub** last — it attracts merchant NPCs, turning your base into a trading post.

### Exploration
- Scan (`F`) frequently — resource nodes and creature dens only appear in the scanner overlay.
- **Crystal planets** have the highest ring-system probability — rings are visible from orbit.
- **Exotic planets** can have bioluminescent flora that glows brightly at night.
- **DEAD** planets have no fauna but often contain **Ancient Ruins** with tech blueprints.

### Combat
- Target **Boss creatures** first (larger, glowing eyes) — they deal more damage and have better loot.
- Stay **mobile** — creatures have a fixed attack range. Circle-strafe to avoid charge attacks.
- The **Warrior class** starts with higher HP and shield, making early-game combat much easier.

### Mobile
- **Double-tap** the joystick area to toggle sprint lock.
- The `🚀 JET` button fires a sustained jetpack burst without needing to hold jump.
- Use `🔨 BUILD` → tap once to enter build mode; the digit row on screen selects the building type.
