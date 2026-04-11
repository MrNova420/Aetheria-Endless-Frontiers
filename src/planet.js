/**
 * src/planet.js
 */
import * as THREE from 'three';
import { AtmosphereShader } from './shaders.js';
import { BIOME_COLORS, PLANET_TYPES, PLANET_GRAVITY, PLANET_HAZARD_RATES, WORLD } from './config.js';

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s,1664525)+1013904223)>>>0; return s/0x100000000; };
}

function hashCoord(a, b, c) {
  let h = (a * 2654435761) >>> 0;
  h = (h ^ (b * 2246822519)) >>> 0;
  h = (h ^ (c * 3266489917)) >>> 0;
  h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) >>> 0;
  return (h ^ (h >>> 16)) >>> 0 || 1;
}

const PLANET_NAMES = [
  'Xion','Velara','Nythus','Cruor','Helix','Zorath','Primen','Kalyx',
  'Duvek','Triox','Fenmara','Gloeth','Solva','Vortix','Ryekon','Umbra',
  'Aexis','Bravon','Celtis','Dravan','Exyra','Foltus','Gryvon','Hexis',
  'Ireth','Juvon','Kethis','Lomra','Mneth','Nexor'
];

const TYPE_DEFAULTS = {
  LUSH:     { temperature:18,  toxicity:0,   radiation:0,   stormFreq:0.3, floraDens:1.0, faunaDens:0.8, hazard:'none',      waterLevel:10, hasWater:true,  sunColor:'#fff4c0', ambientColor:'#2a4a2a', emissiveStr:0.0, heightMult:1.0 },
  BARREN:   { temperature:35,  toxicity:0,   radiation:0.3, stormFreq:0.6, floraDens:0.1, faunaDens:0.2, hazard:'heat',      waterLevel:0,  hasWater:false, sunColor:'#ffa060', ambientColor:'#3a2010', emissiveStr:0.0, heightMult:0.8 },
  TOXIC:    { temperature:25,  toxicity:0.9, radiation:0.2, stormFreq:0.5, floraDens:0.5, faunaDens:0.4, hazard:'toxic',     waterLevel:5,  hasWater:true,  sunColor:'#c8ff60', ambientColor:'#203a10', emissiveStr:0.05,heightMult:0.9 },
  FROZEN:   { temperature:-40, toxicity:0,   radiation:0,   stormFreq:0.4, floraDens:0.2, faunaDens:0.3, hazard:'cold',      waterLevel:8,  hasWater:true,  sunColor:'#c0d8ff', ambientColor:'#1a2840', emissiveStr:0.0, heightMult:1.1 },
  BURNING:  { temperature:80,  toxicity:0.3, radiation:0.5, stormFreq:0.8, floraDens:0.0, faunaDens:0.1, hazard:'heat',      waterLevel:0,  hasWater:false, sunColor:'#ff6020', ambientColor:'#3a1008', emissiveStr:0.4, heightMult:1.2 },
  EXOTIC:   { temperature:22,  toxicity:0.1, radiation:0.1, stormFreq:0.2, floraDens:1.0, faunaDens:1.0, hazard:'exotic',    waterLevel:12, hasWater:true,  sunColor:'#e060ff', ambientColor:'#200a40', emissiveStr:1.0, heightMult:0.7 },
  DEAD:     { temperature:10,  toxicity:0,   radiation:0.8, stormFreq:0.1, floraDens:0.0, faunaDens:0.0, hazard:'radiation', waterLevel:0,  hasWater:false, sunColor:'#d8d0c0', ambientColor:'#181818', emissiveStr:0.0, heightMult:0.6 },
  OCEAN:    { temperature:15,  toxicity:0,   radiation:0,   stormFreq:0.4, floraDens:0.6, faunaDens:0.7, hazard:'none',      waterLevel:30, hasWater:true,  sunColor:'#a8e0ff', ambientColor:'#082840', emissiveStr:0.0, heightMult:0.5 },
  // New subtypes
  TROPICAL: { temperature:32,  toxicity:0,   radiation:0,   stormFreq:0.7, floraDens:1.0, faunaDens:0.9, hazard:'heat',      waterLevel:14, hasWater:true,  sunColor:'#ffe060', ambientColor:'#1a4010', emissiveStr:0.0, heightMult:0.8 },
  ARCTIC:   { temperature:-60, toxicity:0,   radiation:0.1, stormFreq:0.9, floraDens:0.1, faunaDens:0.2, hazard:'cold',      waterLevel:6,  hasWater:true,  sunColor:'#d0e8ff', ambientColor:'#101830', emissiveStr:0.0, heightMult:1.3 },
  VOLCANIC: { temperature:120, toxicity:0.5, radiation:0.6, stormFreq:0.4, floraDens:0.0, faunaDens:0.05,hazard:'heat',      waterLevel:0,  hasWater:false, sunColor:'#ff4400', ambientColor:'#400800', emissiveStr:1.5, heightMult:1.8 },
  SWAMP:    { temperature:28,  toxicity:0.6, radiation:0,   stormFreq:0.6, floraDens:0.9, faunaDens:0.7, hazard:'toxic',     waterLevel:8,  hasWater:true,  sunColor:'#aac840', ambientColor:'#1a3010', emissiveStr:0.05,heightMult:0.6 },
  DESERT:   { temperature:50,  toxicity:0,   radiation:0.2, stormFreq:0.8, floraDens:0.05,faunaDens:0.15,hazard:'heat',      waterLevel:0,  hasWater:false, sunColor:'#ffc040', ambientColor:'#402010', emissiveStr:0.0, heightMult:0.7 },
  CRYSTAL:  { temperature:5,   toxicity:0,   radiation:0.3, stormFreq:0.1, floraDens:0.2, faunaDens:0.3, hazard:'radiation', waterLevel:4,  hasWater:true,  sunColor:'#a0e8ff', ambientColor:'#102838', emissiveStr:0.9, heightMult:1.4 },
};

const RESOURCE_WEIGHTS_BY_TYPE = {
  LUSH:     { Carbon:10, Oxygen:8, Sodium:5, 'Ferrite Dust':4, Copper:3, Gold:1 },
  BARREN:   { 'Ferrite Dust':10, Copper:6, Gold:3, Titanium:4, Cobalt:3, Platinum:2 },
  TOXIC:    { Sodium:8, Cobalt:6, Gold:4, Uranium:3, 'Ferrite Dust':5 },
  FROZEN:   { 'Di-Hydrogen':8, 'Pure Ferrite':6, Cobalt:5, Platinum:3, Titanium:4 },
  BURNING:  { Uranium:10, Titanium:6, Gold:4, 'Ferrite Dust':5, Cobalt:3 },
  EXOTIC:   { Emeril:8, Indium:6, 'Chromatic Metal':5, Platinum:4, Gold:3 },
  DEAD:     { Platinum:8, 'Pure Ferrite':7, Titanium:5, Cobalt:7 },
  OCEAN:    { Carbon:8, Oxygen:10, 'Di-Hydrogen':6, Sodium:5, Copper:4 },
  TROPICAL: { Carbon:10, Oxygen:12, Sodium:6, 'Di-Hydrogen':5, Gold:2, Emeril:1 },
  ARCTIC:   { 'Di-Hydrogen':10, Cobalt:8, Platinum:5, Titanium:6, 'Pure Ferrite':4 },
  VOLCANIC: { Uranium:12, Titanium:8, Gold:6, Cobalt:5, 'Ferrite Dust':4 },
  SWAMP:    { Carbon:8, Sodium:10, Cobalt:6, Oxygen:7, 'Ferrite Dust':3 },
  DESERT:   { 'Ferrite Dust':12, Copper:8, Gold:5, Titanium:4, Platinum:2 },
  CRYSTAL:  { Emeril:10, Indium:8, Platinum:6, 'Chromatic Metal':7, Cobalt:3 },
};

/** Moon type definitions – displayed in sky at night. */
const MOON_TYPES = [
  { name:'Rocky Moon',   color:'#909090', size:0.040, emissive:0.00 },
  { name:'Ice Moon',     color:'#cce8ff', size:0.030, emissive:0.00 },
  { name:'Volcanic Moon',color:'#cc4422', size:0.050, emissive:0.15 },
  { name:'Crystal Moon', color:'#80e0ff', size:0.035, emissive:0.10 },
  { name:'Barren Moon',  color:'#b0a090', size:0.025, emissive:0.00 },
  { name:'Exotic Moon',  color:'#cc44ff', size:0.042, emissive:0.20 },
  { name:'Frozen Moon',  color:'#d0eeff', size:0.032, emissive:0.00 },
  { name:'Toxic Moon',   color:'#88cc20', size:0.028, emissive:0.08 },
  { name:'Lava Moon',    color:'#ff6600', size:0.055, emissive:0.35 },
  { name:'Ringed Moon',  color:'#c8aa88', size:0.048, emissive:0.05 },
];

// ─── Multi-palette system: every type gets 6–12 visual variants ──────────────
// Each palette: { low, mid, high, fog, water, accent }
// "low"=ground/vegetation, "mid"=rock/soil, "high"=peaks/snow, "fog"=atmosphere, "water"=sea, "accent"=emissive details
const TYPE_PALETTES = {
  LUSH: [
    { low:'#1a5c1a', mid:'#2d8c2d', high:'#a0c8a0', fog:'#c8e8c8', water:'#1a6aff', accent:'#40ff40' },
    { low:'#1a6030', mid:'#2aa060', high:'#70d090', fog:'#b0e8c8', water:'#1058e0', accent:'#30ffaa' },
    { low:'#2a5010', mid:'#5a9820', high:'#a8cc60', fog:'#d0e8a0', water:'#2060e0', accent:'#aaff30' },
    { low:'#3a4010', mid:'#7a9030', high:'#c0c880', fog:'#e0e8b0', water:'#2040cc', accent:'#e0ff20' },
    { low:'#104020', mid:'#1c7040', high:'#60b080', fog:'#90d0b0', water:'#0850d0', accent:'#20ffa0' },
    { low:'#1c4830', mid:'#388060', high:'#80c0a0', fog:'#a8dcc0', water:'#1048c8', accent:'#50ffb0' },
    { low:'#402010', mid:'#806030', high:'#c0a870', fog:'#d8c8a0', water:'#2058d0', accent:'#ffd040' },  // amber lush
    { low:'#3a1040', mid:'#702060', high:'#c060a0', fog:'#e0a0d0', water:'#6030d0', accent:'#ff60ff' },  // magenta lush
    { low:'#103050', mid:'#205080', high:'#6090c0', fog:'#90c0e0', water:'#1040c0', accent:'#60d0ff' },  // slate lush
  ],
  BARREN: [
    { low:'#5c3a1a', mid:'#8c6040', high:'#c0a080', fog:'#d8c8b0', water:'#4060a0', accent:'#d08040' },
    { low:'#6a1010', mid:'#a03020', high:'#d06040', fog:'#e09070', water:'#4040c0', accent:'#ff6030' },  // rust red
    { low:'#303030', mid:'#585858', high:'#909090', fog:'#a0a0a0', water:'#303060', accent:'#888888' },  // grey obsidian
    { low:'#7a6020', mid:'#b09040', high:'#e0c870', fog:'#e8d8a0', water:'#2050a0', accent:'#ffd840' },  // chalk gold
    { low:'#2a2040', mid:'#504870', high:'#9080b0', fog:'#b0a8d0', water:'#203080', accent:'#a090ff' },  // purple dust
    { low:'#503a10', mid:'#906030', high:'#c89860', fog:'#d8c098', water:'#2040a0', accent:'#c87830' },  // tan caramel
  ],
  TOXIC: [
    { low:'#3a5c1a', mid:'#60a020', high:'#a8c840', fog:'#90c040', water:'#60c020', accent:'#d0ff00' },
    { low:'#1a5c3a', mid:'#20a060', high:'#40d080', fog:'#60d0a0', water:'#20a060', accent:'#00ffa0' },  // teal acid
    { low:'#5c5c1a', mid:'#a0a020', high:'#d8d840', fog:'#e8e840', water:'#60a020', accent:'#ffff00' },  // yellow sulfur
    { low:'#3a1a5c', mid:'#6020a0', high:'#a040e0', fog:'#c080ff', water:'#4020a0', accent:'#c040ff' },  // purple haze
    { low:'#1a3a1a', mid:'#306030', high:'#608060', fog:'#708070', water:'#104020', accent:'#80ff80' },  // dark bog
    { low:'#5c2a1a', mid:'#a04030', high:'#d07050', fog:'#e0a080', water:'#601810', accent:'#ff8060' },  // orange toxic
  ],
  FROZEN: [
    { low:'#405080', mid:'#8090b0', high:'#d0e0f0', fog:'#c0d8f0', water:'#2040c0', accent:'#a0c8ff' },
    { low:'#506090', mid:'#9090c0', high:'#e0e8ff', fog:'#d0d8f8', water:'#3050d0', accent:'#c0d8ff' },
    { low:'#204060', mid:'#406080', high:'#8090b0', fog:'#a0b8d0', water:'#1030b0', accent:'#60b0ff' },  // deep ice
    { low:'#608090', mid:'#a0b0c0', high:'#e8f0f8', fog:'#d8e8f0', water:'#4060c0', accent:'#b0e0ff' },  // pale blue
    { low:'#304858', mid:'#507090', high:'#c0d8e8', fog:'#b8d0e4', water:'#1840a0', accent:'#80c8f0' },
    { low:'#183040', mid:'#304860', high:'#8090a8', fog:'#909cb0', water:'#0820a0', accent:'#4080d0' },  // midnight tundra
  ],
  BURNING: [
    { low:'#5c2010', mid:'#a04020', high:'#e06030', fog:'#c08040', water:'#a03010', accent:'#ff8020' },
    { low:'#4a1000', mid:'#881800', high:'#cc3010', fog:'#a03810', water:'#801000', accent:'#ff4000' },  // deep scarlet
    { low:'#6a3000', mid:'#c06000', high:'#ff9020', fog:'#e07020', water:'#a04000', accent:'#ffc020' },  // amber fire
    { low:'#381018', mid:'#702030', high:'#c04050', fog:'#a03040', water:'#581020', accent:'#ff3060' },  // crimson
    { low:'#5a3820', mid:'#986040', high:'#d09060', fog:'#d0a070', water:'#803810', accent:'#ffaa60' },  // ochre flame
  ],
  EXOTIC: [
    { low:'#6010c0', mid:'#b020e0', high:'#e060ff', fog:'#c050e8', water:'#6020d0', accent:'#ff40ff' },
    { low:'#0030c0', mid:'#2060e0', high:'#60a0ff', fog:'#4080e0', water:'#1030c0', accent:'#00ffff' },  // electric blue
    { low:'#008040', mid:'#00c060', high:'#40ff90', fog:'#40e090', water:'#006040', accent:'#00ffa0' },  // neon jungle
    { low:'#c03060', mid:'#e05080', high:'#ff80a0', fog:'#f08090', water:'#a02050', accent:'#ff40a0' },  // rose exotic
    { low:'#c08000', mid:'#e0c000', high:'#fff040', fog:'#f0e040', water:'#a05000', accent:'#ffff00' },  // golden anomaly
    { low:'#400060', mid:'#800090', high:'#c030d0', fog:'#a040b0', water:'#300050', accent:'#f040ff' },  // deep violet
    { low:'#004040', mid:'#008080', high:'#00d0d0', fog:'#00c0c0', water:'#003060', accent:'#00ffff' },  // teal void
    { low:'#600020', mid:'#a00040', high:'#e04060', fog:'#d03050', water:'#500018', accent:'#ff2050' },  // blood exotic
  ],
  DEAD: [
    { low:'#303030', mid:'#505050', high:'#808080', fog:'#606060', water:'#202040', accent:'#606060' },
    { low:'#201818', mid:'#403030', high:'#706060', fog:'#585858', water:'#181830', accent:'#505050' },  // dark rust dead
    { low:'#282820', mid:'#484838', high:'#787860', fog:'#606050', water:'#202018', accent:'#707060' },  // olive dead
    { low:'#101820', mid:'#203040', high:'#405060', fog:'#404858', water:'#0a1020', accent:'#304050' },  // dark slate
    { low:'#3a2810', mid:'#604820', high:'#908050', fog:'#806840', water:'#281808', accent:'#806040' },  // ochre wasteland
  ],
  OCEAN: [
    { low:'#103050', mid:'#1850a0', high:'#50a0d0', fog:'#80c0e0', water:'#0830a0', accent:'#80d0ff' },
    { low:'#082840', mid:'#1040a0', high:'#3080c0', fog:'#5090c0', water:'#061880', accent:'#40b0ff' },  // deep ocean
    { low:'#104060', mid:'#2080a0', high:'#50d0c0', fog:'#80e8d0', water:'#0848a0', accent:'#00ffd8' },  // tropical ocean
    { low:'#0a2838', mid:'#144868', high:'#3888a8', fog:'#609898', water:'#081840', accent:'#50a8c8' },
    { low:'#183848', mid:'#3070a0', high:'#60b0e0', fog:'#90d0f0', water:'#103080', accent:'#80d8ff' },
    { low:'#201040', mid:'#401880', high:'#8040c0', fog:'#9060d0', water:'#180848', accent:'#b060ff' },  // mystic ocean
  ],
  TROPICAL: [
    { low:'#1a6020', mid:'#3da040', high:'#80d080', fog:'#b0f0c0', water:'#0a50ff', accent:'#60ff80' },
    { low:'#2a7030', mid:'#4ab050', high:'#90e090', fog:'#c0f8d0', water:'#0838e0', accent:'#80ff90' },
    { low:'#3a5810', mid:'#6a9830', high:'#a8d060', fog:'#d0f080', water:'#1048e0', accent:'#c0ff40' },
    { low:'#1a5030', mid:'#309060', high:'#60c090', fog:'#90e0c0', water:'#1040c0', accent:'#40ffc0' },
    { low:'#503010', mid:'#907040', high:'#d0b080', fog:'#e8d8a0', water:'#1848e0', accent:'#ffd860' },  // golden tropical
    { low:'#501040', mid:'#902060', high:'#d06090', fog:'#f090b0', water:'#3820b0', accent:'#ff60c0' },  // violet tropical
    { low:'#103820', mid:'#207040', high:'#409870', fog:'#60c890', water:'#0830c0', accent:'#20ff90' },
  ],
  ARCTIC: [
    { low:'#506888', mid:'#90b0c8', high:'#e8f4ff', fog:'#d8eeff', water:'#1030b0', accent:'#c0e8ff' },
    { low:'#405878', mid:'#7090a8', high:'#d0e8f8', fog:'#c8e0f0', water:'#0820a0', accent:'#a0d8ff' },
    { low:'#304860', mid:'#506880', high:'#c0d8e8', fog:'#b0c8d8', water:'#1828a0', accent:'#80c0e8' },
    { low:'#181c30', mid:'#303850', high:'#707898', fog:'#808898', water:'#101428', accent:'#5060a0' },  // dark arctic
    { low:'#6878a0', mid:'#a0b0d0', high:'#f0f4ff', fog:'#e4e8f8', water:'#3040b8', accent:'#d0e0ff' },  // silver arctic
  ],
  VOLCANIC: [
    { low:'#500000', mid:'#cc2200', high:'#ff6600', fog:'#802010', water:'#cc2200', accent:'#ff8800' },
    { low:'#300000', mid:'#880000', high:'#ee2200', fog:'#601010', water:'#880000', accent:'#ff2200' },  // deep lava
    { low:'#502010', mid:'#a04020', high:'#e08040', fog:'#c06030', water:'#a03010', accent:'#ffa030' },  // orange volcano
    { low:'#180008', mid:'#400018', high:'#8a0040', fog:'#500028', water:'#300010', accent:'#ff0060' },  // magma crimson
    { low:'#4a3000', mid:'#906000', high:'#cc9000', fog:'#a07020', water:'#703800', accent:'#ffa800' },  // golden volcano
    { low:'#3a2030', mid:'#705060', high:'#a08090', fog:'#906878', water:'#502040', accent:'#d090b0' },  // ash purple
  ],
  SWAMP: [
    { low:'#1a3010', mid:'#305020', high:'#608040', fog:'#70a050', water:'#204420', accent:'#80cc40' },
    { low:'#102018', mid:'#203828', high:'#406040', fog:'#507058', water:'#0c2818', accent:'#60a058' },  // dark peat
    { low:'#283a10', mid:'#4a6818', high:'#80a030', fog:'#80a040', water:'#183010', accent:'#a0d020' },  // lime swamp
    { low:'#2a1820', mid:'#503040', high:'#806060', fog:'#706058', water:'#201428', accent:'#a06880' },  // purple mire
    { low:'#183028', mid:'#305048', high:'#607060', fog:'#607868', water:'#0c2018', accent:'#50b080' },
    { low:'#383010', mid:'#686028', high:'#a09850', fog:'#c0b870', water:'#202810', accent:'#d0c040' },  // golden bog
  ],
  DESERT: [
    { low:'#7a5020', mid:'#c08040', high:'#e0c080', fog:'#e8d098', water:'#4070c0', accent:'#ffaa40' },
    { low:'#884418', mid:'#c07830', high:'#e0b070', fog:'#e8c888', water:'#3858c0', accent:'#ff9830' },
    { low:'#6a5030', mid:'#a08050', high:'#d8c090', fog:'#e0d0a8', water:'#3060c0', accent:'#e8c060' },
    { low:'#8a3828', mid:'#c06040', high:'#e89868', fog:'#e8b090', water:'#4040c0', accent:'#ffb068' },  // terracotta
    { low:'#5a4818', mid:'#907838', high:'#c0a860', fog:'#d8c888', water:'#2848a0', accent:'#d0a830' },
    { low:'#302028', mid:'#604848', high:'#a08080', fog:'#b09090', water:'#201830', accent:'#c09090' },  // dusk desert
    { low:'#703030', mid:'#b05050', high:'#e09090', fog:'#e0a8a0', water:'#304080', accent:'#ff8070' },  // red desert
  ],
  CRYSTAL: [
    { low:'#0080a0', mid:'#20c0e8', high:'#80ffff', fog:'#80e0ff', water:'#1060c0', accent:'#c0ffff' },
    { low:'#6020a0', mid:'#a040e0', high:'#e0a0ff', fog:'#c080f0', water:'#4018c0', accent:'#f0c0ff' },  // amethyst
    { low:'#00a060', mid:'#20e090', high:'#80ffc0', fog:'#60f0b0', water:'#008050', accent:'#a0ffd8' },  // emerald
    { low:'#a09000', mid:'#e0c800', high:'#fff080', fog:'#f8e860', water:'#806000', accent:'#ffff80' },  // citrine
    { low:'#a02020', mid:'#e04040', high:'#ff9090', fog:'#f08080', water:'#801818', accent:'#ffb0b0' },  // ruby
    { low:'#0040a0', mid:'#2060e0', high:'#80a8ff', fog:'#6090f0', water:'#002080', accent:'#b0c8ff' },  // sapphire
    { low:'#c08020', mid:'#e0c040', high:'#fff880', fog:'#f8e880', water:'#a06010', accent:'#fff840' },  // topaz
  ],
};

// ─── Planet modifiers (applied on top of base type) ──────────────────────────
// Each modifier tweaks generation parameters and adds a name tag
const PLANET_MODIFIERS = [
  { id:'paradise',   tag:'Paradise',    prob:0.04, floraMult:1.3,  faunaMult:1.4, heightMult:0.9,  gravMult:0.85, fogDensM:0.7,  cloudM:0.3  },
  { id:'mega',       tag:'Giant',       prob:0.05, floraMult:0.8,  faunaMult:0.9, heightMult:2.0,  gravMult:1.5,  fogDensM:1.2,  cloudM:0.0  },
  { id:'micro',      tag:'Micro',       prob:0.05, floraMult:1.1,  faunaMult:1.1, heightMult:0.35, gravMult:0.5,  fogDensM:0.6,  cloudM:0.0  },
  { id:'irradiated', tag:'Irradiated',  prob:0.06, floraMult:0.3,  faunaMult:0.3, heightMult:1.0,  gravMult:1.0,  fogDensM:1.5,  cloudM:0.2  },
  { id:'storm',      tag:'Storm-Wracked',prob:0.07,floraMult:0.8,  faunaMult:0.7, heightMult:1.1,  gravMult:1.0,  fogDensM:2.0,  cloudM:0.5  },
  { id:'tidally',    tag:'Tidally Locked',prob:0.05,floraMult:0.9, faunaMult:0.8, heightMult:1.0,  gravMult:1.0,  fogDensM:0.9,  cloudM:0.1  },
  { id:'biolum',     tag:'Bioluminescent',prob:0.06,floraMult:1.2, faunaMult:1.3, heightMult:0.85, gravMult:0.9,  fogDensM:1.1,  cloudM:0.4  },
  { id:'ancient',    tag:'Ancient',     prob:0.04, floraMult:0.9,  faunaMult:1.0, heightMult:1.4,  gravMult:1.1,  fogDensM:0.8,  cloudM:0.3  },
  { id:'sparse',     tag:'Sparse',      prob:0.06, floraMult:0.2,  faunaMult:0.2, heightMult:0.7,  gravMult:0.8,  fogDensM:0.5,  cloudM:0.0  },
  { id:'lush_ext',   tag:'Verdant',     prob:0.07, floraMult:1.5,  faunaMult:1.5, heightMult:0.95, gravMult:1.0,  fogDensM:0.8,  cloudM:0.4  },
];

// ─── Galaxy chromatic tint (per galaxy index, shifts all planet colours) ──────
// Returns { dH, dS, dL } — delta HSL added to every terrain colour
function galaxyChromaTint(galaxyIdx) {
  // Use galaxy index to generate a gentle but distinct hue shift
  const rng = seededRng((galaxyIdx * 2654435761) >>> 0);
  const dH  = (rng() - 0.5) * 0.18;   // ±0.18 hue shift (~65° max)
  const dS  = (rng() - 0.5) * 0.20;   // ±0.20 saturation shift
  const dL  = (rng() - 0.5) * 0.10;   // ±0.10 lightness shift
  return { dH, dS, dL };
}

/** Apply a chromatic tint to a hex colour string */
function applyTint(hexColor, tint) {
  if (!tint || (tint.dH === 0 && tint.dS === 0 && tint.dL === 0)) return hexColor;
  const c = new THREE.Color(hexColor);
  const hsl = { h:0, s:0, l:0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + tint.dH + 2) % 1,
    Math.max(0, Math.min(1, hsl.s + tint.dS)),
    Math.max(0.04, Math.min(0.96, hsl.l + tint.dL))
  );
  return '#' + c.getHexString();
}

/** Legacy seed retained for backward compatibility only. */
const STARTING_PLANET_SEED = 10001;

export class PlanetGenerator {
  /**
   * @param {number}  seed
   * @param {string}  [typeOverride]
   * @param {{isHomeworld?: boolean}} [options]
   */
  static generate(seed, typeOverride, options = {}) {
    const isHomeworld  = options.isHomeworld  === true;
    const galaxyIdx    = options.galaxyIdx    ?? 0;
    const rng          = seededRng(seed);
    const types        = Object.keys(PLANET_TYPES);
    const type         = typeOverride || types[Math.floor(rng() * types.length)];
    const def          = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.LUSH;

    // ── Pick a visual palette variant for this planet type ───────────────────
    const palPool = TYPE_PALETTES[type] || TYPE_PALETTES.LUSH;
    const palIdx  = Math.floor(rng() * palPool.length);
    const bcRaw   = isHomeworld ? palPool[0] : palPool[palIdx];

    // ── Apply galaxy chromatic tint ──────────────────────────────────────────
    const tint = isHomeworld ? null : galaxyChromaTint(galaxyIdx);
    const bc = tint ? {
      low   : applyTint(bcRaw.low,    tint),
      mid   : applyTint(bcRaw.mid,    tint),
      high  : applyTint(bcRaw.high,   tint),
      fog   : applyTint(bcRaw.fog,    tint),
      water : applyTint(bcRaw.water,  tint),
      accent: applyTint(bcRaw.accent, tint),
    } : bcRaw;

    // ── Planet modifier (paradise, mega, irradiated, etc.) ───────────────────
    let modifier = null;
    if (!isHomeworld) {
      for (const m of PLANET_MODIFIERS) {
        if (rng() < m.prob) { modifier = m; break; }
      }
    }
    const modTag     = modifier ? ` (${modifier.tag})` : '';
    const floraMult  = (def.floraDens)  * (modifier?.floraMult  ?? 1.0);
    const faunaMult  = (def.faunaDens)  * (modifier?.faunaMult  ?? 1.0);
    const heightMult = (def.heightMult) * (modifier?.heightMult ?? 1.0);
    const gravMult   = modifier?.gravMult   ?? 1.0;
    const fogDensM   = modifier?.fogDensM   ?? 1.0;
    const extraCloud = modifier?.cloudM     ?? 0.0;

    // ── Name ─────────────────────────────────────────────────────────────────
    const nameIdx    = Math.floor(rng() * PLANET_NAMES.length);
    const suffix     = String.fromCharCode(65 + Math.floor(rng() * 26));
    const romanNum   = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][Math.floor(rng() * 6)];
    const planetName = isHomeworld ? 'New Meridian'
                     : `${PLANET_NAMES[nameIdx]}-${suffix}${romanNum}${modTag}`;

    // ── Moons (up to 4, richer variety) ─────────────────────────────────────
    const moonCount = modifier?.id === 'mega' ? Math.floor(rng() * 5)
                    : modifier?.id === 'micro' ? Math.floor(rng() * 2)
                    : Math.floor(rng() * 4);
    const moons = [];
    for (let m = 0; m < moonCount; m++) {
      const mt = MOON_TYPES[Math.floor(rng() * MOON_TYPES.length)];
      moons.push({
        ...mt,
        orbitSpeed: 0.00015 + rng() * 0.00035,
        orbitAngle: rng() * Math.PI * 2,
        orbitTilt:  (rng() - 0.5) * 0.5,
        orbitDist:  1.4 + m * 0.5 + rng() * 0.3,
      });
    }

    // ── Ring system (more common with certain types) ─────────────────────────
    const ringProb = type === 'CRYSTAL' ? 0.45 : type === 'FROZEN' ? 0.30 : type === 'BARREN' ? 0.22 : 0.15;
    const hasRings = !isHomeworld && rng() < ringProb;

    // ── Habitability + Settlement generation ─────────────────────────────────
    const habBase = {
      LUSH:8, TROPICAL:7, OCEAN:6, SWAMP:5, BARREN:3, FROZEN:3, ARCTIC:2,
      TOXIC:2, BURNING:1, VOLCANIC:1, DESERT:3, EXOTIC:5, CRYSTAL:4, DEAD:1,
    };
    const habitability = Math.min(10, Math.max(0,
      (habBase[type] || 3) + Math.floor((rng()-0.5)*3)
    ));

    const SETTLE_POOLS = {
      LUSH:    ['city','trading_post','research_base','outpost'],
      TROPICAL:['city','trading_post','outpost','space_port'],
      OCEAN:   ['research_base','outpost','trading_post'],
      SWAMP:   ['outpost','mining_camp','research_base'],
      BARREN:  ['mining_camp','outpost'],
      DESERT:  ['mining_camp','outpost','trading_post'],
      FROZEN:  ['outpost','mining_camp'],
      ARCTIC:  ['outpost','mining_camp'],
      TOXIC:   ['mining_camp','outpost'],
      BURNING: ['mining_camp'],
      VOLCANIC:['mining_camp'],
      EXOTIC:  ['research_base','outpost','ruins'],
      CRYSTAL: ['research_base','mining_camp','ruins'],
      DEAD:    ['ruins','outpost'],
    };
    const pool = SETTLE_POOLS[type] || ['outpost'];

    const FACTION_BY_TYPE = {
      LUSH:'gek', TROPICAL:'gek', OCEAN:'korvax', SWAMP:'gek',
      BARREN:'outlaw', DESERT:'outlaw', FROZEN:'vykeen', ARCTIC:'vykeen',
      TOXIC:'vykeen', BURNING:'vykeen', VOLCANIC:'vykeen',
      EXOTIC:'atlas', CRYSTAL:'korvax', DEAD:'sentinel_order',
    };
    const dominantFaction = FACTION_BY_TYPE[type] || 'gek';

    const FACTION_IDS = ['gek','korvax','vykeen','outlaw','atlas','sentinel_order'];
    const settleCount = habitability <= 2 ? 0 : habitability <= 5 ? Math.floor(rng()*2) : 1 + Math.floor(rng()*3);
    const settlements = [];
    for (let si = 0; si < settleCount; si++) {
      const sType  = pool[Math.floor(rng() * pool.length)];
      const angle  = rng() * Math.PI * 2;
      const dist   = 150 + rng() * 600;
      const npcCount = sType === 'city' ? 8 + Math.floor(rng()*12)
                     : sType === 'trading_post' ? 4 + Math.floor(rng()*4)
                     : sType === 'research_base' ? 3 + Math.floor(rng()*3)
                     : sType === 'ruins' ? 0
                     : 2 + Math.floor(rng()*3);
      const factionOverride = rng() < 0.15 ? FACTION_IDS[Math.floor(rng()*FACTION_IDS.length)] : dominantFaction;
      settlements.push({
        id:      `settle_${seed}_${si}`,
        type:    sType,
        x:       Math.cos(angle) * dist,
        z:       Math.sin(angle) * dist,
        faction: factionOverride,
        npcCount,
        seed:    hashCoord(seed, si * 7, 99),
      });
    }

    return {
      id: `planet_${seed}`,
      name: planetName,
      seed,
      type,
      radius: 800 + rng() * 400,
      orbitRadius: 500,
      orbitSpeed: 0.00005 + rng() * 0.0001,
      atmosphereColor: new THREE.Color(bc.fog),
      rayleighColor: new THREE.Color(bc.mid),
      mieColor: new THREE.Color(1, 0.9, 0.8),
      fogColor: new THREE.Color(bc.fog),
      fogDensity: 0.005 + rng() * 0.01,
      waterLevel: def.waterLevel + rng() * 5,
      waterColor: new THREE.Color(bc.water),
      vegetationColor: new THREE.Color(bc.mid),
      rockColor: new THREE.Color(bc.high),
      sandColor: new THREE.Color(bc.low).multiplyScalar(1.3),
      snowColor: new THREE.Color(0.9, 0.93, 0.98),
      sunColor: new THREE.Color(isHomeworld ? '#ffe8a0' : def.sunColor),
      ambientColor: new THREE.Color(isHomeworld ? '#3a6a2a' : def.ambientColor),
      temperature: def.temperature + (rng()-0.5)*20,
      toxicity: def.toxicity + rng()*0.1,
      radiation: def.radiation + rng()*0.1,
      stormFrequency: def.stormFreq,
      floraDensity: def.floraDens,
      faunaDensity: def.faunaDens,
      resourceWeights: RESOURCE_WEIGHTS_BY_TYPE[type] || RESOURCE_WEIGHTS_BY_TYPE.LUSH,
      hazardType: def.hazard,
      hazardRates: PLANET_HAZARD_RATES[type] || PLANET_HAZARD_RATES.LUSH,
      hasWater: def.hasWater,
      emissiveStrength: def.emissiveStr,
      nightGlowColor: new THREE.Color(
        type==='EXOTIC'||type==='CRYSTAL' ? 0.4:0.1,
        type==='LUSH'||type==='EXOTIC'||type==='TROPICAL' ? 0.6:0.1,
        type==='OCEAN'||type==='EXOTIC'||type==='CRYSTAL' ? 0.8:0.1
      ),
      hasRings: rng() > 0.75,
      moons,
      cloudCoverage: 0.3 + rng() * 0.4,
      gravity: (PLANET_GRAVITY[type] || 1.0) * WORLD.GRAVITY,
      // ── Day/night cycle ─────────────────────────────────────────────────
      dayDuration: (() => {
        const isTidal = modifier?.id === 'tidally';
        if (isTidal) return 999999;
        // Full cycle lengths (day + night).  With the 75/25 day-bias in game.js
        // these yield ~15 min day / 5 min night at the target value of 1200s,
        // with per-type variety from slow-rotating Dead worlds (3000 s) to
        // fast-spinning Crystal or Exotic worlds (720 s).
        const BASE = {
          LUSH:1200, BARREN:1600, TOXIC:800,  FROZEN:2400, BURNING:1400,
          EXOTIC:600, DEAD:3000, OCEAN:1100,  TROPICAL:960, ARCTIC:2800,
          VOLCANIC:1800, SWAMP:1000, DESERT:1600, CRYSTAL:720,
        };
        const base = BASE[type] || 1200;
        return Math.round(base * (0.6 + rng() * 0.8));
      })(),
      isTidallyLocked: modifier?.id === 'tidally' || false,
      axialTilt: (() => {
        const maxTilt = type === 'ARCTIC' ? 45 : type === 'EXOTIC' ? 50 : type === 'DEAD' ? 35 : 25;
        return rng() * maxTilt;
      })(),
      dayTimeOffset: rng(),
      // ── Star / solar data ────────────────────────────────────────────────
      starType:           'G',
      starColor:          new THREE.Color(def.sunColor),
      starIntensity:      1.0,
      starAngularSize:    0.05,
      hasBinarySun:       false,
      binarySunColor:     new THREE.Color(0xffaa55),
      binarySunIntensity: 0.0,
      binarySunPhase:     0.0,
      heightScale: WORLD.HEIGHT_SCALE * heightMult,
      habitability,
      settlements,
      dominantFaction,
      ownedBy: null,
    };
  }

  static getSystemPlanets(systemSeed, systemData) {
    if (systemData && systemData.planets) {
      return systemData.planets.map((p, i) => {
        const planetSeed = p.seed || ((systemSeed + i * 1031) >>> 0);
        const planet = PlanetGenerator.generate(planetSeed, p.typeOverride);
        if (p.moonCount != null) {
          // Override moon count if explicitly specified in system data
          const rng = seededRng(planetSeed + 99);
          const n = Math.min(p.moonCount, 4);
          const moons2 = [];
          for (let m = 0; m < n; m++) {
            const mt = MOON_TYPES[Math.floor(rng() * MOON_TYPES.length)];
            moons2.push({ ...mt, orbitSpeed:0.0002+rng()*0.0003, orbitAngle:rng()*Math.PI*2, orbitTilt:(rng()-0.5)*0.4 });
          }
          planet.moons = moons2;
        }
        return planet;
      });
    }
    const rng = seededRng(systemSeed);
    const count = 3 + Math.floor(rng() * 3);
    const planets = [];
    for (let i = 0; i < count; i++) {
      const p = PlanetGenerator.generate((systemSeed + i * 1031) >>> 0);
      p.orbitRadius = 400 + i * 280;
      planets.push(p);
    }
    return planets;
  }
}

export class PlanetAtmosphere {
  constructor(scene, planetConfig) {
    this.scene = scene;
    this.planet = planetConfig;
    this.mesh = null;
    this.material = null;
    this._moonAngles = (planetConfig.moons || []).map(m => m.orbitAngle || 0);
    this._build();
  }

  _build() {
    const geo = new THREE.SphereGeometry(450, 32, 32);
    geo.scale(-1, 1, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(AtmosphereShader.uniforms),
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false
    });
    const p = this.planet;
    this.material.uniforms.uRayleighColor.value  = p.rayleighColor.clone();
    this.material.uniforms.uMieColor.value        = p.mieColor.clone();
    this.material.uniforms.uAtmosphereColor.value = p.atmosphereColor.clone();
    this.material.uniforms.uCloudCoverage.value   = p.cloudCoverage || 0.5;
    this.material.uniforms.uSunDir.value = new THREE.Vector3(0.5, 0.6, 0.3).normalize();
    this.material.uniforms.uSunIntensity.value    = 2.0;
    this.material.uniforms.uDayFactor.value       = 1.0;
    this.material.uniforms.uAuroraColor.value     = p.nightGlowColor.clone();
    // Moon disc uniforms (up to 3)
    if (this.material.uniforms.uMoon0Dir) {
      this._syncMoonUniforms();
    }
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = -1;
    this.scene.add(this.mesh);
  }

  _syncMoonUniforms() {
    const moons = this.planet.moons || [];
    for (let i = 0; i < 3; i++) {
      const m = moons[i];
      if (m && this.material.uniforms[`uMoon${i}Dir`]) {
        const angle = this._moonAngles[i] || 0;
        const dir = new THREE.Vector3(
          Math.cos(angle + m.orbitTilt), Math.sin(angle * 0.5 + 0.3), Math.sin(angle)
        ).normalize();
        this.material.uniforms[`uMoon${i}Dir`].value.copy(dir);
        this.material.uniforms[`uMoon${i}Color`].value.set(m.color);
        this.material.uniforms[`uMoon${i}Size`].value = m.size;
      }
    }
  }

  update(dt, sunDir, playerPos) {
    if (!this.material) return;
    this.material.uniforms.uTime.value += dt;
    if (sunDir) {
      this.material.uniforms.uSunDir.value.copy(sunDir);
      const day = Math.max(0, sunDir.y);
      this.material.uniforms.uDayFactor.value = day;
      this.material.uniforms.uSunIntensity.value = 1.0 + day * 1.5;
    }
    // Advance moon orbits
    const moons = this.planet.moons || [];
    for (let i = 0; i < moons.length; i++) {
      this._moonAngles[i] = (this._moonAngles[i] || 0) + moons[i].orbitSpeed * dt;
    }
    if (this.material.uniforms.uMoon0Dir) this._syncMoonUniforms();
    if (playerPos && this.mesh) this.mesh.position.copy(playerPos);
  }

  setSunPosition(dir) {
    if (this.material) this.material.uniforms.uSunDir.value.copy(dir);
  }

  dispose() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.material.dispose(); }
  }
}
