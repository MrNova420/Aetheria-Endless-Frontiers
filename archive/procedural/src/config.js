/**
 * src/config.js  –  NMS-inspired game configuration
 */

export const PLANET_TYPES = {
  LUSH:'LUSH', BARREN:'BARREN', TOXIC:'TOXIC', FROZEN:'FROZEN',
  BURNING:'BURNING', EXOTIC:'EXOTIC', DEAD:'DEAD', OCEAN:'OCEAN'
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
  CHUNK_SIZE:192, CHUNK_VERTS:65, LOD_LEVELS:[65,33,17,9],
  RENDER_DISTANCE:4, HEIGHT_SCALE:80, WATER_LEVEL:10,
  GRAVITY:22, SEED:12345, DAY_DURATION:600
};

export const PLAYER_CONFIG = {
  WALK_SPEED:10, SPRINT_SPEED:20, JETPACK_THRUST:30,
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
    planets:[
      {typeOverride:'LUSH',   orbitRadius:400,  seed:10001},
      {typeOverride:'BARREN', orbitRadius:700,  seed:10002},
      {typeOverride:'OCEAN',  orbitRadius:950,  seed:10003}
    ]
  },
  {
    id:'sys_1', name:'Nyreth Expanse', seed:54321, starColor:'#aaddff',
    starType:'B', economy:'Technology', conflictLevel:3,
    planets:[
      {typeOverride:'FROZEN', orbitRadius:500,  seed:20001},
      {typeOverride:'TOXIC',  orbitRadius:800,  seed:20002},
      {typeOverride:'EXOTIC', orbitRadius:1100, seed:20003},
      {typeOverride:'DEAD',   orbitRadius:1400, seed:20004}
    ]
  },
  {
    id:'sys_2', name:"Vel'Kira Reach", seed:99887, starColor:'#ffaaaa',
    starType:'M', economy:'Agricultural', conflictLevel:2,
    planets:[
      {typeOverride:'BURNING', orbitRadius:300,  seed:30001},
      {typeOverride:'BARREN',  orbitRadius:600,  seed:30002},
      {typeOverride:'LUSH',    orbitRadius:900,  seed:30003},
      {typeOverride:'EXOTIC',  orbitRadius:1200, seed:30004},
      {typeOverride:'DEAD',    orbitRadius:1600, seed:30005}
    ]
  }
];

export const BIOME_COLORS = {
  LUSH:   {low:'#1a5c1a',mid:'#2d8c2d',high:'#a0c8a0',accent:'#40ff40',fog:'#c8e8c8',water:'#1a6aff'},
  BARREN: {low:'#5c3a1a',mid:'#8c6040',high:'#c0a080',accent:'#d08040',fog:'#d8c8b0',water:'#4060a0'},
  TOXIC:  {low:'#3a5c1a',mid:'#60a020',high:'#a8c840',accent:'#d0ff00',fog:'#90c040',water:'#60c020'},
  FROZEN: {low:'#405080',mid:'#8090b0',high:'#d0e0f0',accent:'#a0c8ff',fog:'#c0d8f0',water:'#2040c0'},
  BURNING:{low:'#5c2010',mid:'#a04020',high:'#e06030',accent:'#ff8020',fog:'#c08040',water:'#a03010'},
  EXOTIC: {low:'#5020a0',mid:'#8040c0',high:'#c080ff',accent:'#ff40ff',fog:'#a060d0',water:'#4020c0'},
  DEAD:   {low:'#303030',mid:'#505050',high:'#808080',accent:'#606060',fog:'#606060',water:'#202040'},
  OCEAN:  {low:'#103050',mid:'#1850a0',high:'#50a0d0',accent:'#80d0ff',fog:'#80c0e0',water:'#0830a0'}
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
