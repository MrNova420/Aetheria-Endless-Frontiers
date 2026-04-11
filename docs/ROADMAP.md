# Aetheria: Endless Frontiers — Roadmap

## ✅ Completed (Current Build)

### Universe & Generation
- [x] 255 galaxies × 8.4B systems — fully seeded, deterministic
- [x] 6 galaxy tiers with progression unlock levels (1/10/20/35/55/80)
- [x] Galaxy chromatic tinting — every galaxy shifts all planet colours uniquely
- [x] 7 star classes (M/K/G/F/A/B/O) with tier-biased distribution
- [x] 14 planet types × 6–9 colour palettes = 100+ distinct visual styles
- [x] 10 planet modifiers (Paradise, Giant, Micro, Irradiated, Storm-Wracked, Tidally Locked, Bioluminescent, Ancient, Sparse, Verdant)
- [x] 10 moon types, up to 4 moons per planet
- [x] Ring systems (type-probability-tuned)
- [x] 12 system traits (nebula, pirate stronghold, ruins, anomaly…)
- [x] System wealth (0–5) and danger (0–5) from tier + economy + traits
- [x] Deterministic settlements (0–3 per planet) with faction, NPC count, type

### Visual / Rendering
- [x] Custom terrain GLSL shader: 4-layer biome blend, wetness, wind, emissive
- [x] Custom water shader: animated waves, caustics, Fresnel, fog
- [x] Atmosphere shader: Rayleigh+Mie scatter, moon discs, aurora
- [x] Bloom post-processing (EffectComposer)
- [x] 4-level LOD terrain streaming with seamless transitions
- [x] Dynamic day/night cycle with real-time sun/terrain/water lighting
- [x] Water lighting bug fixed (`_waterMeshes` → `waterChunks`)
- [x] Player: 11-zone AAA colour palette (PBR materials)
- [x] Ships: 5-class PBR palette, hull panels, nacelles, cockpit glass
- [x] Buildings: 10 per-type 5-layer palettes + unique accent geometry
- [x] NPCs: 4 alien species, 12 skin tones, 7 role outfit palettes, accessories
- [x] Creatures: `isBoss:false` fix; 14 biome colour tints
- [x] Flora: biome-weighted type selection; per-instance HSL colour jitter

### Gameplay
- [x] 3 player classes: Explorer, Warrior, Trader
- [x] Mining, inventory (48 slots), crafting (40+ recipes)
- [x] Tech tree upgrades (shield, jetpack, mining, life support, scan)
- [x] XP / leveling system with level-up rewards
- [x] Quest chain (3-quest survival basics)
- [x] Auto-extractor deployment
- [x] Status effects (burn/freeze/poison/energised/shield)
- [x] Settlement spawning in _setupSurface (NPCs + buildings)
- [x] 6 factions with reputation system
- [x] 30-commodity trading system
- [x] Sentinel drones with wanted level
- [x] WebSocket multiplayer with proximity filtering

---

## 🔄 In Progress

- [ ] Galaxy progression unlock gate (level check in warpGalaxy)
- [ ] Galaxy map tier colour coding
- [ ] Save version bump to 5 with highestGalaxy field
- [ ] Planet ownership tracking (ownedBy field wired to UI)

---

## 📋 Planned — Near Term

- [ ] **Space station interiors** — dock, trade, repair
- [ ] **Freighter capital ships** — player-owned, customisable
- [ ] **Faction war events** — system-level conflict missions
- [ ] **Ancient ruins puzzles** — on EXOTIC/DEAD/CRYSTAL planets
- [ ] **Creature taming** — passive creatures become companions
- [ ] **Planet claiming** — flag + beacon, shown to other players
- [ ] **Galaxy map galaxy-jump UI** — show 255 galaxies, tier colours, lock state
- [ ] **More quest chains** — faction-specific 5-step arcs

## 📋 Planned — Long Term

- [ ] **Multiplayer guilds** — shared bases, joint missions
- [ ] **Procedural dungeons** — underground cave systems with loot
- [ ] **Seasonal events** — galaxy-wide timed challenges
- [ ] **Shader-based planet rings** — visible from surface + space
- [ ] **Procedural music** — full generative soundtrack per biome/tier
- [ ] **iOS / Android store release** — Capacitor-wrapped build
- [ ] **WebXR VR support** — first-person mode for supported headsets
