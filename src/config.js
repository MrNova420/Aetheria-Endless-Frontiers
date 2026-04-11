/**
 * src/config.js  –  NMS-inspired game configuration
 */

export const PLANET_TYPES = {
  LUSH:'LUSH', BARREN:'BARREN', TOXIC:'TOXIC', FROZEN:'FROZEN',
  BURNING:'BURNING', EXOTIC:'EXOTIC', DEAD:'DEAD', OCEAN:'OCEAN',
  // New planet subtypes
  TROPICAL:'TROPICAL', ARCTIC:'ARCTIC', VOLCANIC:'VOLCANIC',
  SWAMP:'SWAMP', DESERT:'DESERT', CRYSTAL:'CRYSTAL',
};

export const RESOURCES = {
  CARBON:'Carbon', FERRITE:'Ferrite Dust', COPPER:'Copper',
  GOLD:'Gold', URANIUM:'Uranium', SODIUM:'Sodium', OXYGEN:'Oxygen',
  DIHYDROGEN:'Di-Hydrogen', CHROMATIC_METAL:'Chromatic Metal',
  PURE_FERRITE:'Pure Ferrite', CONDENSED_CARBON:'Condensed Carbon',
  PLATINUM:'Platinum', COBALT:'Cobalt', TITANIUM:'Titanium',
  EMERIL:'Emeril', INDIUM:'Indium'
};

export const WORLD = {
  CHUNK_SIZE:240, CHUNK_VERTS:65, LOD_LEVELS:[65,33,17,9],
  RENDER_DISTANCE:4, HEIGHT_SCALE:80, WATER_LEVEL:13,
  GRAVITY:14, SEED:12345, DAY_DURATION:1200
};

/** Per-planet gravity multiplier (applied to WORLD.GRAVITY). */
export const PLANET_GRAVITY = {
  LUSH:     1.00,
  BARREN:   0.75,
  TOXIC:    0.90,
  FROZEN:   0.85,
  BURNING:  1.30,  // dense heavy-metal core
  EXOTIC:   0.60,  // low-gravity bioluminescent world
  DEAD:     0.80,
  OCEAN:    0.95,
  // New subtypes
  TROPICAL: 1.05,
  ARCTIC:   0.80,
  VOLCANIC: 1.40,  // hyper-dense volcanic core
  SWAMP:    1.10,
  DESERT:   0.70,
  CRYSTAL:  0.55,  // crystalline low-density world
};

/** Per-planet hazard damage rates (HP/s when exposed without protection). */
export const PLANET_HAZARD_RATES = {
  LUSH:     { heat:0,   cold:0,   radiation:0,   toxic:0,   storm:0.5  },
  BARREN:   { heat:3,   cold:0,   radiation:2,   toxic:0,   storm:1.0  },
  TOXIC:    { heat:0,   cold:0,   radiation:1,   toxic:6,   storm:0.5  },
  FROZEN:   { heat:0,   cold:5,   radiation:0,   toxic:0,   storm:2.0  },
  BURNING:  { heat:8,   cold:0,   radiation:3,   toxic:1,   storm:0    },
  EXOTIC:   { heat:0,   cold:0,   radiation:0,   toxic:0.5, storm:0    },
  DEAD:     { heat:0,   cold:1,   radiation:8,   toxic:0,   storm:0    },
  OCEAN:    { heat:0,   cold:0,   radiation:0,   toxic:0,   storm:1.0  },
  TROPICAL: { heat:2,   cold:0,   radiation:0,   toxic:0,   storm:3.0  },
  ARCTIC:   { heat:0,   cold:10,  radiation:0,   toxic:0,   storm:4.0  },
  VOLCANIC: { heat:12,  cold:0,   radiation:4,   toxic:2,   storm:0    },
  SWAMP:    { heat:1,   cold:0,   radiation:0,   toxic:4,   storm:1.5  },
  DESERT:   { heat:5,   cold:2,   radiation:1,   toxic:0,   storm:3.0  },
  CRYSTAL:  { heat:0,   cold:0,   radiation:2,   toxic:0,   storm:0    },
};

export const PLAYER_CONFIG = {
  WALK_SPEED:12, SPRINT_SPEED:26, JETPACK_THRUST:40,
  JETPACK_FUEL:100, MAX_HP:100, MAX_SHIELD:80,
  SHIELD_REGEN_DELAY:5, SHIELD_REGEN_RATE:15,
  LIFE_SUPPORT_DRAIN:2, MINING_RANGE:8
};

export const TECH_UPGRADES = {
  SUIT:{
    LIFE_SUPPORT:{name:'Life Support Module',tiers:[
      {cost:{Carbon:50},bonus:{lifeSupportRate:-0.5}},
      {cost:{'Condensed Carbon':50},bonus:{lifeSupportRate:-1.0}}
    ]},
    HAZARD:{name:'Hazard Protection',tiers:[
      {cost:{'Ferrite Dust':80},bonus:{hazardProtection:20}},
      {cost:{'Pure Ferrite':50},bonus:{hazardProtection:40}}
    ]},
    JETPACK:{name:'Jetpack Upgrade',tiers:[
      {cost:{Titanium:100},bonus:{jetpackCapacity:25}},
      {cost:{Cobalt:80},bonus:{jetpackCapacity:50}}
    ]},
    SHIELD:{name:'Personal Shield',tiers:[
      {cost:{Copper:60},bonus:{shieldMax:20}},
      {cost:{'Chromatic Metal':40},bonus:{shieldMax:40}}
    ]}
  },
  MULTITOOL:{
    MINING_BEAM:{name:'Mining Beam Upgrade',tiers:[
      {cost:{Copper:50},bonus:{miningSpeed:1.5}},
      {cost:{Gold:30},bonus:{miningSpeed:2.5}}
    ]},
    SCANNER:{name:'Analysis Visor',tiers:[
      {cost:{'Chromatic Metal':50},bonus:{scanRange:50}},
      {cost:{Platinum:20},bonus:{scanRange:100}}
    ]},
    COMBAT:{name:'Boltcaster Upgrade',tiers:[
      {cost:{Cobalt:80},bonus:{weaponDamage:15}},
      {cost:{Titanium:60},bonus:{weaponDamage:30}}
    ]}
  },
  SHIP:{
    PULSE_ENGINE:{name:'Pulse Engine Upgrade',tiers:[
      {cost:{Uranium:50},bonus:{shipSpeed:20}},
      {cost:{Indium:30},bonus:{shipSpeed:40}}
    ]},
    HYPERDRIVE:{name:'Hyperdrive Upgrade',tiers:[
      {cost:{Indium:100},bonus:{warpRange:200}},
      {cost:{Emeril:50},bonus:{warpRange:500}}
    ]},
    SHIELDS:{name:'Deflector Shield',tiers:[
      {cost:{Cobalt:120},bonus:{shipShield:25}},
      {cost:{'Pure Ferrite':80},bonus:{shipShield:50}}
    ]},
    WEAPONS:{name:'Photon Cannon',tiers:[
      {cost:{Gold:40},bonus:{shipWeaponDamage:20}},
      {cost:{Platinum:30},bonus:{shipWeaponDamage:40}}
    ]},
    LAUNCH_THRUSTER:{name:'Launch Thruster',tiers:[
      {cost:{'Di-Hydrogen':50},bonus:{launchCost:-20}},
      {cost:{Uranium:40},bonus:{launchCost:-40}}
    ]}
  }
};

export const SOLAR_SYSTEMS = [
  {
    id:'sys_0', name:'Euclid Prime', seed:12345, starColor:'#ffeeaa',
    starType:'G', economy:'Mining', conflictLevel:1,
    starRadius:800, starIntensity:1.4,
    binaryCompanion: null,
    planets:[
      {typeOverride:'LUSH',     orbitRadius:400,  seed:10001, moonCount:1},
      {typeOverride:'TROPICAL', orbitRadius:650,  seed:10005, moonCount:0},
      {typeOverride:'BARREN',   orbitRadius:900,  seed:10002, moonCount:2},
      {typeOverride:'OCEAN',    orbitRadius:1200, seed:10003, moonCount:3},
      {typeOverride:'FROZEN',   orbitRadius:1600, seed:10006, moonCount:1},
    ]
  },
  {
    id:'sys_1', name:'Nyreth Expanse', seed:54321, starColor:'#aaddff',
    starType:'B', economy:'Technology', conflictLevel:3,
    starRadius:1100, starIntensity:2.0,
    binaryCompanion: { color:'#80aaff', radius:400, offset:3000, intensity:0.6 },
    planets:[
      {typeOverride:'ARCTIC',  orbitRadius:500,  seed:20001, moonCount:0},
      {typeOverride:'CRYSTAL', orbitRadius:800,  seed:20005, moonCount:1},
      {typeOverride:'TOXIC',   orbitRadius:1100, seed:20002, moonCount:2},
      {typeOverride:'EXOTIC',  orbitRadius:1500, seed:20003, moonCount:2},
      {typeOverride:'DEAD',    orbitRadius:2000, seed:20004, moonCount:0},
    ]
  },
  {
    id:'sys_2', name:"Vel'Kira Reach", seed:99887, starColor:'#ff8855',
    starType:'M', economy:'Agricultural', conflictLevel:2,
    starRadius:600, starIntensity:1.0,
    binaryCompanion: null,
    planets:[
      {typeOverride:'VOLCANIC', orbitRadius:280,  seed:30001, moonCount:0},
      {typeOverride:'DESERT',   orbitRadius:550,  seed:30006, moonCount:1},
      {typeOverride:'BARREN',   orbitRadius:800,  seed:30002, moonCount:1},
      {typeOverride:'LUSH',     orbitRadius:1100, seed:30003, moonCount:2},
      {typeOverride:'SWAMP',    orbitRadius:1500, seed:30007, moonCount:1},
      {typeOverride:'EXOTIC',   orbitRadius:2000, seed:30004, moonCount:3},
    ]
  },
  {
    id:'sys_3', name:'Drovaxis Nebula', seed:77321, starColor:'#ffffcc',
    starType:'F', economy:'Science', conflictLevel:0,
    starRadius:900, starIntensity:1.6,
    binaryCompanion: null,
    planets:[
      {typeOverride:'LUSH',    orbitRadius:500,  seed:40001, moonCount:2},
      {typeOverride:'OCEAN',   orbitRadius:800,  seed:40002, moonCount:1},
      {typeOverride:'CRYSTAL', orbitRadius:1200, seed:40003, moonCount:0},
      {typeOverride:'DEAD',    orbitRadius:1700, seed:40004, moonCount:1},
    ]
  },
  {
    id:'sys_4', name:'Kezrath Void', seed:13579, starColor:'#ffddaa',
    starType:'K', economy:'Piracy', conflictLevel:5,
    starRadius:700, starIntensity:1.2,
    binaryCompanion: { color:'#ff6644', radius:300, offset:2000, intensity:0.4 },
    planets:[
      {typeOverride:'BURNING',  orbitRadius:350,  seed:50001, moonCount:0},
      {typeOverride:'VOLCANIC', orbitRadius:600,  seed:50002, moonCount:1},
      {typeOverride:'TOXIC',    orbitRadius:900,  seed:50003, moonCount:0},
      {typeOverride:'DESERT',   orbitRadius:1300, seed:50004, moonCount:2},
      {typeOverride:'BARREN',   orbitRadius:1800, seed:50005, moonCount:1},
    ]
  },
];

export const BIOME_COLORS = {
  LUSH:    {low:'#1a5c1a',mid:'#2d8c2d',high:'#a0c8a0',accent:'#40ff40',fog:'#c8e8c8',water:'#1a6aff'},
  BARREN:  {low:'#5c3a1a',mid:'#8c6040',high:'#c0a080',accent:'#d08040',fog:'#d8c8b0',water:'#4060a0'},
  TOXIC:   {low:'#3a5c1a',mid:'#60a020',high:'#a8c840',accent:'#d0ff00',fog:'#90c040',water:'#60c020'},
  FROZEN:  {low:'#405080',mid:'#8090b0',high:'#d0e0f0',accent:'#a0c8ff',fog:'#c0d8f0',water:'#2040c0'},
  BURNING: {low:'#5c2010',mid:'#a04020',high:'#e06030',accent:'#ff8020',fog:'#c08040',water:'#a03010'},
  EXOTIC:  {low:'#5020a0',mid:'#8040c0',high:'#c080ff',accent:'#ff40ff',fog:'#a060d0',water:'#4020c0'},
  DEAD:    {low:'#303030',mid:'#505050',high:'#808080',accent:'#606060',fog:'#606060',water:'#202040'},
  OCEAN:   {low:'#103050',mid:'#1850a0',high:'#50a0d0',accent:'#80d0ff',fog:'#80c0e0',water:'#0830a0'},
  // New subtypes
  TROPICAL:{low:'#1a6020',mid:'#3da040',high:'#80d080',accent:'#60ff80',fog:'#b0f0c0',water:'#0a50ff'},
  ARCTIC:  {low:'#506888',mid:'#90b0c8',high:'#e8f4ff',accent:'#c0e8ff',fog:'#d8eeff',water:'#1030b0'},
  VOLCANIC:{low:'#3a0808',mid:'#882010',high:'#cc4422',accent:'#ff6600',fog:'#804020',water:'#cc2200'},
  SWAMP:   {low:'#1a3010',mid:'#305020',high:'#608040',accent:'#80cc40',fog:'#70a050',water:'#204420'},
  DESERT:  {low:'#7a5020',mid:'#c08040',high:'#e0c080',accent:'#ffaa40',fog:'#e8d098',water:'#4070c0'},
  CRYSTAL: {low:'#206880',mid:'#40a0c0',high:'#80e0ff',accent:'#c0ffff',fog:'#a0e8ff',water:'#2060a0'},
};

export const CLASSES = {
  EXPLORER:{name:'Explorer',walkSpeed:12,jetpackCapacity:120,scanRange:150,miningSpeed:1.0},
  WARRIOR: {name:'Warrior', walkSpeed:8, maxHP:130,shieldMax:100,weaponDamage:1.5},
  TRADER:  {name:'Trader',  inventorySlots:64,walkSpeed:10,cargoBonus:2.0}
};

export const GAME_STATES = {
  LOADING:'LOADING', MAIN_MENU:'MAIN_MENU', PLANET_SURFACE:'PLANET_SURFACE',
  SHIP_ATMOSPHERE:'SHIP_ATMOSPHERE', SPACE_LOCAL:'SPACE_LOCAL',
  HYPERSPACE:'HYPERSPACE', SPACE_STATION:'SPACE_STATION', GALAXY_MAP:'GALAXY_MAP'
};
