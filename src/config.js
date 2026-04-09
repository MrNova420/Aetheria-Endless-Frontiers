/**
 * src/config.js
 * Central configuration for all game systems.
 */

// ─── World ────────────────────────────────────────────────────────────────────
export const WORLD = {
  CHUNK_SIZE       : 128,   // world units per chunk side
  CHUNK_VERTS      : 33,    // vertices per side (33 = 32 quads per chunk)
  HEIGHT_SCALE     : 35,    // max terrain height
  RENDER_DISTANCE  : 3,     // chunks loaded each direction from player
  SEED             : 42,
  DAY_DURATION     : 600,   // seconds for a full day/night cycle
  GRAVITY          : 28,
  MAX_CHUNK_OBJECTS: 18,    // decorative objects per chunk
};

// ─── Biomes ───────────────────────────────────────────────────────────────────
export const BIOMES = {
  MAGITECH_RUINS: {
    id      : 'MAGITECH_RUINS',
    name    : 'Magitech Ruins',
    // ground colour gradient: [low, mid, high]
    colors  : ['#5c4a30', '#7a6040', '#a09060'],
    accent  : '#00aaff',
    fog     : '#1a2a4a',
    fogDensity: 0.008,
    enemyTypes: ['VOID_WRAITH', 'MAGITECH_DRONE', 'CRYSTAL_ELEMENTAL'],
    music   : 'ruins',
  },
  CRYSTAL_VAULTS: {
    id      : 'CRYSTAL_VAULTS',
    name    : 'Crystal Vaults',
    colors  : ['#0d1f3c', '#1a3460', '#2a508a'],
    accent  : '#00ffcc',
    fog     : '#0a1535',
    fogDensity: 0.01,
    enemyTypes: ['CRYSTAL_ELEMENTAL', 'VOID_WRAITH', 'RUST_STALKER'],
    music   : 'crystal',
  },
  TECH_WASTELAND: {
    id      : 'TECH_WASTELAND',
    name    : 'Tech Wasteland',
    colors  : ['#3a2510', '#5a3a18', '#8a5e25'],
    accent  : '#ff6600',
    fog     : '#2a1a0a',
    fogDensity: 0.012,
    enemyTypes: ['MAGITECH_DRONE', 'CORRUPTED_GOLEM', 'RUST_STALKER'],
    music   : 'wasteland',
  },
  CORRUPTED_FOREST: {
    id      : 'CORRUPTED_FOREST',
    name    : 'Corrupted Forest',
    colors  : ['#0d1a08', '#152a10', '#203a18'],
    accent  : '#cc00ff',
    fog     : '#0a0f06',
    fogDensity: 0.015,
    enemyTypes: ['CORRUPTED_GOLEM', 'VOID_WRAITH', 'RUST_STALKER'],
    music   : 'forest',
  },
  FLOATING_ISLES: {
    id      : 'FLOATING_ISLES',
    name    : 'Floating Archipelago',
    colors  : ['#c0d8f0', '#a8c8e8', '#90b8e0'],
    accent  : '#ffdd00',
    fog     : '#6080a0',
    fogDensity: 0.005,
    enemyTypes: ['MAGITECH_DRONE', 'CRYSTAL_ELEMENTAL', 'VOID_WRAITH'],
    music   : 'sky',
  },
};

// ─── Player Classes ───────────────────────────────────────────────────────────
export const CLASSES = {
  runekeeper: {
    name        : 'Runekeeper',
    icon        : '⚔',
    description : 'Balanced warrior-mage. Runic blades fused with elemental arcana.',
    baseStats   : { maxHp:120, maxMp:100, str:12, agi:10, int:12, vit:12 },
    abilities   : ['runic_slash','arcane_bolt','mana_shield','ley_surge'],
    bodyColor   : '#4488ff',
    accentColor : '#88ccff',
  },
  technomancer: {
    name        : 'Technomancer',
    icon        : '⚙',
    description : 'Magitech engineer. Commands drones, overcharges systems.',
    baseStats   : { maxHp:100, maxMp:120, str:8, agi:14, int:16, vit:8 },
    abilities   : ['deploy_drone','emp_pulse','overcharge','orbital_strike'],
    bodyColor   : '#ff8800',
    accentColor : '#ffcc44',
  },
  voidhunter: {
    name        : 'Voidhunter',
    icon        : '🌑',
    description : 'Shadow assassin. Teleports through void rifts, harvests entropy.',
    baseStats   : { maxHp:90, maxMp:110, str:14, agi:18, int:10, vit:8 },
    abilities   : ['shadow_step','void_trap','phase_shift','singularity'],
    bodyColor   : '#aa00ff',
    accentColor : '#cc44ff',
  },
};

// ─── Abilities ────────────────────────────────────────────────────────────────
export const ABILITIES = {
  // Runekeeper
  runic_slash    : { name:'Runic Slash',     icon:'⚡', mpCost:15, cooldown:3,  range:4,  damage:1.8, type:'melee',    color:'#4488ff', desc:'AoE melee slash that deals arcane damage.' },
  arcane_bolt    : { name:'Arcane Bolt',     icon:'🔥', mpCost:20, cooldown:4,  range:30, damage:2.2, type:'projectile',color:'#4488ff', desc:'Fire a bolt of arcane energy.' },
  mana_shield    : { name:'Mana Shield',     icon:'🛡', mpCost:30, cooldown:12, range:0,  damage:0,   type:'shield',   color:'#44aaff', desc:'Absorb incoming damage for 4 seconds.' },
  ley_surge      : { name:'Ley Surge',       icon:'🌊', mpCost:50, cooldown:25, range:8,  damage:5.0, type:'aoe',      color:'#0066ff', desc:'Massive arcane explosion around caster.' },
  // Technomancer
  deploy_drone   : { name:'Deploy Drone',    icon:'🤖', mpCost:25, cooldown:8,  range:0,  damage:1.2, type:'summon',   color:'#ff8800', desc:'Summon an AI combat drone.' },
  emp_pulse      : { name:'EMP Pulse',       icon:'⚡', mpCost:30, cooldown:10, range:10, damage:1.5, type:'aoe',      color:'#ffaa00', desc:'Stun all nearby tech-type enemies.' },
  overcharge     : { name:'Overcharge',      icon:'🔋', mpCost:20, cooldown:15, range:0,  damage:0,   type:'buff',     color:'#ffcc00', desc:'Boost speed and damage for 6 seconds.' },
  orbital_strike : { name:'Orbital Strike',  icon:'🛸', mpCost:60, cooldown:30, range:25, damage:7.0, type:'projectile',color:'#ff6600', desc:'Call down a devastating energy beam.' },
  // Voidhunter
  shadow_step    : { name:'Shadow Step',     icon:'👁', mpCost:20, cooldown:5,  range:15, damage:2.5, type:'dash',     color:'#aa00ff', desc:'Teleport behind target and backstab.' },
  void_trap      : { name:'Void Trap',       icon:'💀', mpCost:15, cooldown:6,  range:20, damage:1.8, type:'trap',     color:'#8800dd', desc:'Place an invisible void trap.' },
  phase_shift    : { name:'Phase Shift',     icon:'🌀', mpCost:35, cooldown:18, range:0,  damage:0,   type:'invuln',   color:'#cc44ff', desc:'Enter the void plane briefly (2s invulnerability).' },
  singularity    : { name:'Singularity',     icon:'⚫', mpCost:70, cooldown:35, range:20, damage:8.0, type:'aoe',      color:'#660099', desc:'Create a black hole that pulls and destroys enemies.' },
};

// ─── Enemy Definitions ────────────────────────────────────────────────────────
export const ENEMY_DEFS = {
  VOID_WRAITH: {
    name:'Void Wraith', maxHp:60, speed:9, dmg:12, xp:30,
    scale:1.0, color:'#8800cc', emissive:'#4400aa',
    aggro:18, attack:2.2, lootTable:'low',
    type: 'normal',
  },
  CORRUPTED_GOLEM: {
    name:'Corrupted Golem', maxHp:200, speed:3, dmg:22, xp:80,
    scale:1.8, color:'#556644', emissive:'#228822',
    aggro:12, attack:2.0, lootTable:'medium',
    type: 'normal',
  },
  MAGITECH_DRONE: {
    name:'Magitech Drone', maxHp:80, speed:10, dmg:14, xp:45,
    scale:0.8, color:'#445566', emissive:'#0088ff',
    aggro:22, attack:1.8, lootTable:'medium',
    type: 'flying',
  },
  CRYSTAL_ELEMENTAL: {
    name:'Crystal Elemental', maxHp:120, speed:5, dmg:18, xp:60,
    scale:1.3, color:'#2255aa', emissive:'#00ccff',
    aggro:15, attack:2.5, lootTable:'medium',
    type: 'normal',
  },
  RUST_STALKER: {
    name:'Rust Stalker', maxHp:90, speed:8, dmg:20, xp:55,
    scale:1.1, color:'#664422', emissive:'#ff4400',
    aggro:10, attack:2.0, lootTable:'medium',
    type: 'stealth',
  },
  // Boss enemies
  ABYSSAL_ARCHON: {
    name:'Abyssal Archon', maxHp:1500, speed:5, dmg:35, xp:600,
    scale:2.5, color:'#440066', emissive:'#9900ff',
    aggro:40, attack:1.5, lootTable:'boss',
    type: 'boss', phases: 3,
  },
  NEXUS_CORE: {
    name:'Nexus Core', maxHp:2000, speed:0, dmg:28, xp:800,
    scale:3.0, color:'#334455', emissive:'#00aaff',
    aggro:50, attack:1.2, lootTable:'boss',
    type: 'boss_stationary', phases: 2,
  },
};

// ─── Loot ─────────────────────────────────────────────────────────────────────
export const RARITIES = [
  { id:'common',    name:'Common',    color:'#aaaaaa', weight:50 },
  { id:'uncommon',  name:'Uncommon',  color:'#4caf50', weight:25 },
  { id:'rare',      name:'Rare',      color:'#2196f3', weight:14 },
  { id:'epic',      name:'Epic',      color:'#9c27b0', weight:8  },
  { id:'legendary', name:'Legendary', color:'#ffd700', weight:2.5},
  { id:'mythic',    name:'Mythic',    color:'#ff6600', weight:0.5},
];

export const ITEM_TYPES = {
  WEAPON: {
    slots: ['weapon'],
    subtypes: [
      {name:'Runic Blade', icon:'⚔', stats:['str','int'], dmgMult:1.2 },
      {name:'Arcane Staff', icon:'🪄', stats:['int','mp'], dmgMult:1.0 },
      {name:'Void Dagger', icon:'🗡', stats:['agi','str'], dmgMult:1.1 },
      {name:'Tech Rifle',  icon:'🔫', stats:['agi','int'], dmgMult:1.3 },
      {name:'Crystal Wand',icon:'💎', stats:['int'],       dmgMult:0.9 },
    ],
  },
  HELM: {
    slots: ['head'],
    subtypes: [
      {name:'Rune Helm',     icon:'🪖', stats:['vit','str'] },
      {name:'Data Crown',    icon:'👑', stats:['int','mp']  },
      {name:'Shadow Cowl',   icon:'🎩', stats:['agi','vit'] },
    ],
  },
  CHEST: {
    slots: ['chest'],
    subtypes: [
      {name:'Magitech Plate', icon:'🦺', stats:['vit','str'] },
      {name:'Void Robe',      icon:'👘', stats:['int','mp']  },
      {name:'Circuit Vest',   icon:'🥋', stats:['agi','int'] },
    ],
  },
  BOOTS: {
    slots: ['boots'],
    subtypes: [
      {name:'Ley Striders',    icon:'👢', stats:['agi','vit'] },
      {name:'Void Walkers',    icon:'🥾', stats:['agi','int'] },
    ],
  },
  ACCESSORY: {
    slots: ['ring','amulet'],
    subtypes: [
      {name:'Resonance Crystal', icon:'💠', stats:['int','mp']   },
      {name:'Data Core',         icon:'🔮', stats:['int','str']  },
      {name:'Ley Shard',         icon:'🔷', stats:['mp','vit']   },
      {name:'Entropy Sigil',     icon:'⭕', stats:['str','agi']  },
    ],
  },
};

// Prefixes & suffixes for procedural item names
export const ITEM_AFFIXES = {
  prefix: ['Ancient','Corrupted','Crystalline','Void-touched','Runic','Overcharged',
           'Spectral','Shattered','Radiant','Entropic','Prismatic','Abyssal'],
  suffix: ['of Dominion','of the Archon','of Corruption','of the Void','of Entropy',
           'of Ascension','of the Nexus','of Eternity','of Ruin','of the Magitech'],
};

// Stat ranges per rarity multiplier
export const RARITY_MULT = {
  common   : 1.0,
  uncommon : 1.4,
  rare     : 2.0,
  epic     : 2.8,
  legendary: 4.0,
  mythic   : 6.0,
};

// ─── XP table (XP required to reach next level) ───────────────────────────────
export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.6));
}

// ─── Stat scaling (bonus per stat point) ─────────────────────────────────────
export const STAT_SCALE = {
  str : { physDmg: 2.0  },
  agi : { speed: 0.4, critChance: 0.5 },  // critChance in %
  int : { spellDmg: 2.2, mpRegen: 0.1 },
  vit : { hpBonus: 8.0, hpRegen: 0.05 },
};
