/**
 * src/universe.js  –  AETHERIA: Endless Frontiers  –  Infinite Universe System
 *
 * NMS-scale universe: 255 galaxies × 32,768 regions × 1,000 systems per region
 * = ~8.4 billion unique star systems per galaxy, hundreds of billions total.
 * Systems are generated deterministically on-demand; only the current
 * region (1,000 systems) is held in memory at once.
 */

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

// ─── Hash a (galaxy, region, system) triple to a stable 32-bit seed ──────────
function hashCoord(g, r, s) {
  let h = (g * 2654435761) >>> 0;
  h = (h ^ (r * 2246822519)) >>> 0;
  h = (h ^ (s * 3266489917)) >>> 0;
  h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) >>> 0;
  h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) >>> 0;
  return (h ^ (h >>> 16)) >>> 0 || 1;
}

// ─── Galaxy names (255 NMS-style) ─────────────────────────────────────────────
const GALAXY_NAMES = [
  'Euclid','Hilbert Dimension','Calypso','Hesperius Dimension','Hyades',
  'Ickjamatew','Budullangr','Kikolgallr','Eltiensleen','Eissentam',
  'Aptarkaba','Ontiniangp','Hitonskyer','Ibtrevala','Lakszntosi',
  'Adjukrapl','Ontauvefa','Swettloose','Corpinyaya','Davabutem',
  'Tuychelisaor','Silokomesk','Ogtialabi','Isdoraijung','Cognosia',
  'Zukasizawa','Retasunte','Lossumbra','Rumatetros','Rywambe',
  'Olygenna','Hyrokkin','Isdoraijung','Sudzerware','Nootanore',
  'Elkupalos','Hilsenber','Zuxragaca','Aynezugot','Ontiniangp',
  'Adjukrapl','Gawatsinti','Fladiselq','Rinnakabdi','Sivaloqren',
  'Otimanber','Yasuketra','Unangtai','Xobeur120','Weznokteh',
  'Tuychelisaor','Silokomesk','Adjukrapl','Ontauvefa','Swettloose',
  'Corpinyaya','Davabutem','Teyaypiloy','Weznokteh','Yudukagaci',
  'Zukasizawa','Retasunte','Lossumbra','Rumatetros','Rywambe',
  'Hilbert Dimension II','Calypso Reach','Deep Hesperius','New Euclid',
  'Outer Rim Vega','Expanse Theta','Drift Kova','Nebula Arxen',
  'Void Sarantis','Tesseract Fold','Fracture Basin','Umbral Reach',
  'Pale Convergence','Sable Arc','Ironlight Span','Dustfall Veil',
  'Crimson Deep','Silvergate','Ghost Meridian','Twilight Spur',
  'Echo Terminus','Solar Veil','Radiant Expanse','Stormwatch',
  'Verdant Loop','Frozen Reach','Ember Crossing','Pulse Corridor',
  'Tide Wraith','Axiom Drift','Cipher Void','Lattice Deep',
  'Prismatic Gulf','Hollow Reach','Lumen Tract','Shade Passage',
  'Resonance Spur','Warp Meridian','Null Crossing','Flux Basin',
  'Iridescent Veil','Carbon Reach','Photon Deep','Quantum Fold',
  'Stellar Rift','Cosmic Weave','Gravity Well Beta','Dark Lattice',
  'Pale Horizon','Neon Expanse','Binary Drift','Helios Span',
  'Subspace Veil','Chronos Deep','Entropy Reach','Signal Spur',
  'Ether Crossing','Plasma Passage','Vortex Gulf','Orbital Weave',
  'Nova Meridian','Pulsar Drift','Quasar Basin','Radix Fold',
  'Solaris Rift','Temporal Veil','Umbra Span','Vertex Deep',
  'Xenon Reach','Yield Passage','Zenith Gulf','Abyss Crossing',
  'Bloom Meridian','Core Drift','Dawn Basin','Eclipse Fold',
  'Fission Rift','Gale Veil','Haze Span','Ion Deep',
  'Junction Reach','Kilo Passage','Light Gulf','Meld Crossing',
  'Nadir Meridian','Orbit Drift','Peak Basin','Quell Fold',
  'Raze Rift','Surge Veil','Tidal Span','Ultra Deep',
  'Vast Reach','Wave Passage','Axis Gulf','Beyond Crossing',
  'Cascade Meridian','Delta Drift','Epoch Basin','Flux Fold',
  'Glare Rift','Halo Veil','Inca Span','Jet Deep',
  'Keen Reach','Luna Passage','Macro Gulf','Nova Crossing',
  'Optic Meridian','Proto Drift','Quark Basin','Relay Fold',
  'Spark Rift','Torus Veil','Unity Span','Vapor Deep',
  'Weft Reach','Xeno Passage','Yield Gulf','Zero Crossing',
  'Alpha Meridian','Beta Drift','Gamma Basin','Delta Fold',
  'Epsilon Rift','Zeta Veil','Eta Span','Theta Deep',
  'Iota Reach','Kappa Passage','Lambda Gulf','Mu Crossing',
  'Nu Meridian','Xi Drift','Omicron Basin','Pi Fold',
  'Rho Rift','Sigma Veil','Tau Span','Upsilon Deep',
  'Phi Reach','Chi Passage','Psi Gulf','Omega Crossing',
  'Andromeda Rift','Perseus Veil','Orion Span','Cygnus Deep',
  'Cassiopeia Reach','Lyra Passage','Aquila Gulf','Sagittarius Crossing',
  'Scorpius Meridian','Leo Drift','Virgo Basin','Gemini Fold',
  'Taurus Rift','Aries Veil','Pisces Span','Aquarius Deep',
  'Capricorn Reach','Sagittarius Passage','Ophiuchus Gulf','Serpens Crossing',
  'Hercules Meridian','Bootes Drift','Corona Basin','Draco Fold',
  'Ursa Minor Rift','Ursa Major Veil','Cepheus Span','Camelopardalis Deep',
  'Auriga Reach','Perseus Passage','Triangulum Gulf','Andromeda Crossing',
  'Sculptor Meridian','Fornax Drift','Eridanus Basin','Phoenix Fold',
  'Tucana Rift','Pavo Veil','Ara Span','Corona Australis Deep',
  'Telescopium Reach','Microscopium Passage','Grus Gulf','Indus Crossing',
  'Piscis Meridian','Cetus Drift','Achernar Basin','Reticulum Fold',
  'Horologium Rift','Caelum Veil','Pictor Span','Dorado Deep',
  'Volans Reach','Carina Passage','Puppis Gulf','Pyxis Crossing',
  'Antlia Meridian','Hydra Drift','Crater Basin','Corvus Fold',
  'Centaurus Rift','Lupus Veil','Norma Span','Circinus Deep',
  'Triangulum Australe Reach','Apus Passage','Musca Gulf','Crux Crossing',
  'Chamaeleon Meridian','Volans Drift','Carina Basin','Vela Fold',
  'Columba Rift','Lepus Veil','Monoceros Span','Canis Minor Deep',
  'Canis Major Reach','Orion Passage','Taurus Gulf','Gemini Crossing',
  'Cancer Meridian','Leo Minor Drift','Coma Basin','Virgo Fold',
  'Bootes Rift','Corona Borealis Veil','Hercules Span','Ophiuchus Deep',
  'Serpens Cauda Reach','Aquila Passage','Sagitta Gulf','Vulpecula Crossing',
  'Cygnus Meridian','Lyra Drift','Corona Basin II','Draco Fold II',
  'Ursa Minor Rift II','Ursa Major Veil II','Cassiopeia Span','Perseus Deep',
];

// Pad to exactly 255
while (GALAXY_NAMES.length < 255) {
  GALAXY_NAMES.push(`Galaxy-${GALAXY_NAMES.length + 1}`);
}

// ─── 255-Galaxy Tier & Progression System ────────────────────────────────────
//
//  Tier 1  (galaxies   0– 7)  Euclid Cluster     — starter, calm, lush worlds
//  Tier 2  (galaxies   8–31)  Contested Expanse   — mix, moderate danger
//  Tier 3  (galaxies  32–63)  Outer Reaches       — harsh, high sentinels
//  Tier 4  (galaxies  64–127) Void Fringe         — extreme biomes, elite fauna
//  Tier 5  (galaxies 128–191) The Abyss           — alien/exotic dominated, ruins
//  Tier 6  (galaxies 192–254) Convergence Core    — maximum challenge, reality bends
//
export const GALAXY_TIERS = [
  //  { range, tier, name,                 colour,   dangerMult, wealthMult, unlockLevel, loreTag,       skyTheme }
  { min:  0, max:   7, tier:1, label:'Euclid Cluster',     col:'#44bbff', dangerM:1.0, wealthM:1.0, unlock:1,   tag:'starter',     sky:'#050a14' },
  { min:  8, max:  31, tier:2, label:'Contested Expanse',  col:'#44ff88', dangerM:1.4, wealthM:1.2, unlock:10,  tag:'contested',   sky:'#060d0a' },
  { min: 32, max:  63, tier:3, label:'Outer Reaches',      col:'#ffdd44', dangerM:1.9, wealthM:1.5, unlock:20,  tag:'harsh',       sky:'#0d0a05' },
  { min: 64, max: 127, tier:4, label:'Void Fringe',        col:'#ff8844', dangerM:2.5, wealthM:2.0, unlock:35,  tag:'extreme',     sky:'#0d0505' },
  { min:128, max: 191, tier:5, label:'The Abyss',          col:'#cc44ff', dangerM:3.5, wealthM:2.8, unlock:55,  tag:'alien',       sky:'#08020d' },
  { min:192, max: 254, tier:6, label:'Convergence Core',   col:'#ff4466', dangerM:5.0, wealthM:4.0, unlock:80,  tag:'convergence', sky:'#0d0008' },
];

export function getGalaxyTier(galaxyIdx) {
  for (const t of GALAXY_TIERS) {
    if (galaxyIdx >= t.min && galaxyIdx <= t.max) return t;
  }
  return GALAXY_TIERS[GALAXY_TIERS.length - 1];
}

// Per-tier star-class weight overrides — higher tiers push toward hotter/more extreme stars
const TIER_STAR_WEIGHTS = {
  1: [0.30, 0.55, 0.80, 0.90, 0.96, 0.99, 1.00],  // Tier 1: mostly M/K/G
  2: [0.22, 0.48, 0.76, 0.88, 0.95, 0.98, 1.00],
  3: [0.18, 0.42, 0.68, 0.82, 0.92, 0.97, 1.00],
  4: [0.12, 0.30, 0.56, 0.72, 0.87, 0.95, 1.00],
  5: [0.08, 0.20, 0.44, 0.62, 0.80, 0.92, 1.00],
  6: [0.05, 0.14, 0.32, 0.50, 0.72, 0.88, 1.00],  // Tier 6: more A/B/O
};

function pickStarClassTiered(rngVal, tier) {
  const weights = TIER_STAR_WEIGHTS[tier] || TIER_STAR_WEIGHTS[1];
  for (let i = 0; i < STAR_TABLE.length; i++) {
    if (rngVal < weights[i]) return STAR_TABLE[i];
  }
  return STAR_TABLE[STAR_TABLE.length - 1];
}

// Per-tier lore text banks
const GALAXY_LORE = {
  starter:     [
    'The Euclid cluster — the first galaxy seeded by the Atlas. Verdant worlds and gentle skies welcome explorers to the frontier.',
    'A cradle galaxy where life blooms on every second world. The Atlas Interfaces here are calm; the universe feels young and full of promise.',
    'Peaceful spiral arms host lush archipelago worlds and friendly trading hubs. This is where most explorers take their first breath.',
  ],
  contested:   [
    'Pirate raiding lanes and contested mining rights have made this expanse volatile. Fortunes are made and lost daily at its border stations.',
    'Faction wars have left derelict hulks orbiting a dozen systems. Navigate carefully — not every transmission is a distress call.',
    'Resources are richer here, but so are the sentinels. Independent colonies cling to survival between Gek merchant runs.',
  ],
  harsh:       [
    'Radiation storms sweep the outer spiral arms, scorching unshielded hulls. Outposts here are built to last — or not at all.',
    'Temperature extremes and toxic atmospheres dominate. The creatures that survive here have evolved armour no weapon was designed to breach.',
    'Ancient ruins are more common in this band. Whatever civilisation built them found no way to survive what the Outer Reaches became.',
  ],
  extreme:     [
    'Volcanic supergiants and irradiated dead worlds define the Void Fringe. Only the most advanced life support systems sustain explorers here.',
    'Elite fauna have adapted to extreme gravity and perpetual firestorms. Their biology is a marvel — if you can survive studying it.',
    'Black market trading thrives here. Systems change hands between pirate lords, and the Atlas interface is frequently scrambled.',
  ],
  alien:       [
    'Reality fractures at the edge of the Abyss. Flora exhibits non-Euclidean growth patterns; creatures navigate dimensions explorers cannot perceive.',
    'Ancient Korvax scrolls call this galaxy "the wound that will not close." Every anomaly map leads to ruins older than any known civilisation.',
    'Exotic worlds dominate every system. Bioluminescence paints entire hemispheres. The creatures here are beautiful, alien, and lethal.',
  ],
  convergence: [
    'The Convergence Core pulses with Atlas energy. The laws of physics are suggestions here. Every system holds something that should not exist.',
    'The final frontier of mortal exploration. Those who reach the Core report visions — the Atlas addressing them directly, demanding a choice.',
    'Crimson skies and fractured gravity wells greet those who pierce the Convergence. Only explorers who have mastered the galaxy deserve what waits at its heart.',
  ],
};

export function getGalaxyLore(galaxyIdx) {
  const tierDef = getGalaxyTier(galaxyIdx);
  const pool    = GALAXY_LORE[tierDef.tag] || GALAXY_LORE.starter;
  // Deterministic pick from pool using galaxy index
  return pool[galaxyIdx % pool.length];
}

// ─── Star class distributions (base, overridden per tier) ────────────────────
const STAR_TABLE = [
  // [cumulative weight, type, color, glowColor, minSize, maxSize, minIntensity, maxIntensity]
  [0.234, 'M', '#ff7733', '#ff4400', 0.50, 0.75, 0.6, 0.9],
  [0.534, 'K', '#ffaa55', '#ff8822', 0.70, 0.90, 0.8, 1.1],
  [0.784, 'G', '#fff4e8', '#ffe8c0', 0.90, 1.10, 1.0, 1.3],
  [0.884, 'F', '#f8f7ff', '#e8e8ff', 1.10, 1.40, 1.2, 1.5],
  [0.944, 'A', '#cad7ff', '#aabbff', 1.30, 1.80, 1.4, 1.8],
  [0.974, 'B', '#aabfff', '#8899ff', 1.80, 2.60, 1.8, 2.4],
  [1.000, 'O', '#9bb0ff', '#6677ff', 2.60, 3.80, 2.5, 3.5],
];

function pickStarClass(rngVal) {
  for (const row of STAR_TABLE) {
    if (rngVal < row[0]) return row;
  }
  return STAR_TABLE[STAR_TABLE.length - 1];
}

// ─── Economy table ────────────────────────────────────────────────────────────
const ECONOMIES = [
  { name: 'Mining',        icon: '⛏',  descr: 'Rich in ore extraction and heavy industry.' },
  { name: 'Technology',    icon: '⚙',  descr: 'Advanced engineering and nanite trade.' },
  { name: 'Agricultural',  icon: '🌿', descr: 'Fertile worlds and bio-organic exports.' },
  { name: 'Trading',       icon: '🔄', descr: 'Prosperous hub for interstellar commerce.' },
  { name: 'Military',      icon: '⚔',  descr: 'Heavy sentinel presence; weapons manufacturing.' },
  { name: 'Scientific',    icon: '🔬', descr: 'Research stations and anomaly cataloguing.' },
  { name: 'Ore Processing',icon: '🏭', descr: 'Industrial refining of raw mineral deposits.' },
  { name: 'Fuel Economy',  icon: '⚡', descr: 'Stellar fuel and warp cell production.' },
];

// ─── NMS-style syllable name generation ──────────────────────────────────────
const SYLLABLES_A = [
  'Ae','Al','An','Ar','As','At','Au','Ax',
  'Ba','Be','Bi','Bo','Bu','By',
  'Ca','Ce','Co','Cr','Cu','Cy',
  'Da','De','Di','Do','Dr','Du',
  'El','Em','En','Er','Ex',
  'Fa','Fe','Fi','Fo','Fr','Fu',
  'Ga','Ge','Gi','Gl','Go','Gr','Gu',
  'Ha','He','Hi','Ho','Hu','Hy',
  'Il','In','Ir','Is',
  'Ja','Je','Jo','Ju',
  'Ka','Ke','Ki','Ko','Kr','Ku',
  'La','Le','Li','Lo','Lu',
  'Ma','Me','Mi','Mo','Mu','My',
  'Na','Ne','Ni','No','Nu',
  'Ob','Oc','Od','Of','Om','On','Op','Or','Os','Ov',
  'Pa','Pe','Ph','Pi','Pl','Po','Pr','Pu',
  'Ra','Re','Ri','Ro','Ru',
  'Sa','Se','Si','Sk','Sl','So','Sp','St','Su','Sw',
  'Ta','Te','Th','Ti','To','Tr','Tu','Ty',
  'Ul','Um','Un','Ur','Us',
  'Va','Ve','Vi','Vo','Vu',
  'Wa','We','Wi','Wo','Wr',
  'Xa','Xe','Xi','Xo','Xu',
  'Ya','Ye','Yi','Yo','Yu',
  'Za','Ze','Zi','Zo','Zu',
  // Extended sci-fi prefixes
  'Aes','Aet','Alx','Arx','Aux','Azh',
  'Bra','Byx','Czh','Dyx','Ezh','Fyx',
  'Gyx','Hyp','Ixo','Jyx','Kyx','Lyx',
  'Myx','Nyx','Oyx','Pyx','Qyx','Ryx',
  'Syx','Tyx','Uyx','Vyx','Wyx','Zyx',
  'Aeth','Alph','Anth','Arth','Axth',
  'Balth','Calth','Delth','Elth','Falx',
  'Galth','Helx','Ialx','Jalx','Kalx',
  'Lux','Malx','Nalx','Oalx','Palx',
];
const SYLLABLES_B = [
  'bas','bek','bis','bon','bra','brek','bus',
  'cal','cem','cis','col','con','cor','cus',
  'dan','dax','del','dem','den','dex','dis','don','dur',
  'ek','el','em','en','ep','er','es','et','ex',
  'fan','fel','fen','fer','fit','fon','fos','ful',
  'gan','gel','gem','gen','ges','gis','gon','gul','gun',
  'han','hel','hem','hen','hes','his','hon','hul',
  'is','ith',
  'jan','jel','jem','jen','jes','jis','jon','jul','jun',
  'kan','kel','kem','ken','kes','kis','kon','kul','kun',
  'lan','lek','lem','len','les','lis','lon','lun','lux',
  'mas','mek','mel','men','mes','mis','mon','mul','mun',
  'nas','nel','nem','nen','nes','nis','non','nul','nun',
  'on','op','or','os',
  'pan','pek','pel','pen','pes','pis','pon','pul','pun',
  'ran','rel','rem','ren','res','ris','ron','rul','run',
  'san','sel','sem','sen','ses','sis','son','sul','sun',
  'tan','tek','tel','ten','tes','tis','ton','tul','tun',
  'ul','um','un','ur','us',
  'van','vel','vem','ven','ves','vis','von','vul','vun',
  'wan','wel','wem','wen','wes','wis','won','wul',
  'xan','xel','xem','xen','xes','xis','xon','xul',
  'yan','yel','yem','yen','yes','yis','yon','yul',
  'zan','zel','zem','zen','zes','zis','zon','zul','zun',
  // Extended alien-sounding endings
  'aeth','alyx','anox','arxis','astrum','axion',
  'belyx','borax','braxis','brix','bron',
  'calyp','ceron','chron','citrix','corvax',
  'darix','deltron','deron','dexus','draxis',
  'eclyx','ectron','elrix','elyxis','emrax',
  'faryx','felux','ferion','firon','flaxis',
  'galyx','geron','glaxis','gonix','graxis',
  'helyx','herion','hexis','hixon','horax',
  'icion','illix','imrax','ixion','ixyron',
  'jaryx','jelion','jenox','jerax','jixon',
  'karyx','kelion','kerox','kexon','kirax',
  'laryx','lelion','lerox','lexon','lirax',
  'maryx','melion','merox','mexon','mirax',
  'naryx','nelion','nerox','nexon','nirax',
  'onyx','orix','orax','oron','ortex',
  'paryx','pelion','perox','pexon','pirax',
  'raryx','relion','rerox','rexon','rirax',
  'saryx','selion','serox','sexon','sirax',
  'taryx','telion','terox','texon','tirax',
  'ulyx','umrax','unrix','urion','usrax',
  'varyx','velion','verox','vexon','virax',
  'waryx','welion','werox','wexon','wirax',
  'xaryx','xelion','xerox','xexon','xirax',
  'yaryx','yelion','yerox','yexon','yirax',
  'zaryx','zelion','zerox','zexon','zirax',
];

function genSystemName(rng) {
  const syllCount = 2 + Math.floor(rng() * 2);
  let name = '';
  for (let i = 0; i < syllCount; i++) {
    if (i === 0) name += SYLLABLES_A[Math.floor(rng() * SYLLABLES_A.length)];
    else         name += SYLLABLES_B[Math.floor(rng() * SYLLABLES_B.length)];
  }
  // Capitalise first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─── Spiral arm layout ────────────────────────────────────────────────────────
const NUM_ARMS         = 4;
const ARM_SPREAD       = 0.18;   // radians of angular scatter per unit radius
const REGION_MAP_SCALE = 800;    // pixels on galaxy map per full region range

function spiralPosition(regionIdx, systemIdx, rng) {
  const arm       = regionIdx % NUM_ARMS;
  const armAngle  = (arm / NUM_ARMS) * Math.PI * 2;
  const radial    = (regionIdx / 32768) * REGION_MAP_SCALE;
  const twist     = radial * 0.012;
  const scatter   = (rng() - 0.5) * ARM_SPREAD * (radial + 40);
  const angle     = armAngle + twist + scatter + systemIdx * 0.0031;
  const r         = radial + (rng() - 0.5) * 60;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

// ─── UniverseSystem ───────────────────────────────────────────────────────────
export class UniverseSystem {
  constructor() {
    this._galaxyIdx  = 0;
    this._regionIdx  = 0;
    this._systemIdx  = 0;
    this._cache      = new Map();   // key "g:r:s" → descriptor
    this._visited    = new Set();   // visited system ids
    this._loaded     = [];          // current region's systems

    this._loadRegion(0, 0);
    this._visitCurrent();
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  _visitCurrent() {
    const id = `${this._galaxyIdx}_${this._regionIdx}_${this._systemIdx}`;
    this._visited.add(id);
    const sys = this._genSystem(this._galaxyIdx, this._regionIdx, this._systemIdx);
    if (sys) sys.visited = true;
  }

  _genSystem(g, r, s) {
    const key = `${g}:${r}:${s}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const seed = hashCoord(g, r, s);
    const rng  = seededRng(seed);

    // Home system always named "New Meridian"
    const name = (g === 0 && r === 0 && s === 0) ? 'New Meridian' : genSystemName(rng);

    const pos = spiralPosition(r, s, rng);

    // Galaxy tier drives star class distribution + baseline danger/wealth
    const tierDef = getGalaxyTier(g);

    // Star class — biased by tier
    const starRow   = pickStarClassTiered(rng(), tierDef.tier);
    const starType  = starRow[1];
    const starColor = starRow[2];
    const starGlow  = starRow[3];
    const starSize  = starRow[4] + rng() * (starRow[5] - starRow[4]);
    const starIntensity = starRow[6] + rng() * (starRow[7] - starRow[6]);

    // Economy
    const econ     = ECONOMIES[Math.floor(rng() * ECONOMIES.length)];
    const conflict = Math.floor(rng() * 5);  // 0–4

    // Binary companion
    const hasBinary = rng() < 0.18;
    let binaryCompanion = null;
    if (hasBinary) {
      const bRow = pickStarClass(rng());
      binaryCompanion = {
        color:     bRow[2],
        radius:    bRow[4] + rng() * (bRow[5] - bRow[4]),
        offset:    3.5 + rng() * 4.0,
        intensity: bRow[6] + rng() * (bRow[7] - bRow[6]),
      };
    }

    // Planet type distribution guided by star class
    // M/K stars → more BARREN/FROZEN/DEAD; G → LUSH/OCEAN; A/B/O → BURNING/VOLCANIC/EXOTIC
    const STAR_PLANET_BIAS = {
      M: ['BARREN','BARREN','FROZEN','DEAD','ROCKY'],
      K: ['BARREN','LUSH','LUSH','DESERT','SWAMP'],
      G: ['LUSH','LUSH','OCEAN','TROPICAL','LUSH'],
      F: ['LUSH','TROPICAL','EXOTIC','CRYSTAL','OCEAN'],
      A: ['BURNING','EXOTIC','CRYSTAL','BARREN','VOLCANIC'],
      B: ['BURNING','VOLCANIC','DEAD','EXOTIC','BARREN'],
      O: ['VOLCANIC','BURNING','EXOTIC','DEAD','BURNING'],
    };
    const bias = STAR_PLANET_BIAS[starType] || STAR_PLANET_BIAS.G;

    // Planets
    const planetCount = 2 + Math.floor(rng() * 7);
    const planets = [];
    for (let p = 0; p < planetCount; p++) {
      const typeOverride = bias[Math.floor(rng() * bias.length)];
      planets.push({
        seed:        hashCoord(g * 31 + r, s * 17 + p, p * 7 + 3),
        orbitRadius: 300 + p * 250 + rng() * 100,
        moonCount:   Math.floor(rng() * 4),
        typeOverride,
      });
    }

    // System traits (0-2 per system, deterministic)
    const TRAIT_POOL = [
      'nebula','pirate_stronghold','ancient_ruins','derelict_station',
      'exotic_anomaly','rich_deposits','conflict_zone','trade_hub',
      'abandoned','paradise','quarantine','pulsar_proximity',
    ];
    const traitCount = rng() < 0.4 ? 0 : rng() < 0.7 ? 1 : 2;
    const traits = [];
    for (let t = 0; t < traitCount; t++) {
      const tr = TRAIT_POOL[Math.floor(rng() * TRAIT_POOL.length)];
      if (!traits.includes(tr)) traits.push(tr);
    }

    // Wealth (0-5) and danger (0-5) driven by tier baseline + economy + conflict + traits
    const tierDangerBonus  = Math.floor((tierDef.dangerM - 1.0) * 2);
    const tierWealthBonus  = Math.floor((tierDef.wealthM - 1.0) * 2);
    const wealth = Math.min(5, Math.floor(rng() * 3) + (econ.name === 'Trading' || econ.name === 'Technology' ? 2 : 0) + (traits.includes('trade_hub') ? 1 : 0) + tierWealthBonus);
    const danger = Math.min(5, conflict + (traits.includes('pirate_stronghold') ? 2 : 0) + (traits.includes('conflict_zone') ? 1 : 0) + tierDangerBonus);

    const id = `${g}_${r}_${s}`;
    const desc = {
      id, galaxyIdx: g, regionIdx: r, systemIdx: s, seed, name,
      position: pos,
      starType, starColor, starGlow, starSize, starIntensity,
      starRadius: Math.round(500 + starSize * 300),  // ~650–1640 units (M→O star class)
      economy: econ.name, economyIcon: econ.icon, economyDescr: econ.descr,
      conflictLevel: conflict,
      hasBinary, binaryCompanion,
      planets,
      traits, wealth, danger,
      galaxyTier: tierDef.tier,
      galaxyTierLabel: tierDef.label,
      visited: this._visited.has(id),
    };

    this._cache.set(key, desc);
    return desc;
  }

  _loadRegion(g, r) {
    this._loaded = [];
    for (let s = 0; s < 1000; s++) {
      this._loaded.push(this._genSystem(g, r, s));
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  getCurrentSystem() {
    return this._genSystem(this._galaxyIdx, this._regionIdx, this._systemIdx);
  }

  getLoadedSystems() {
    return this._loaded;
  }

  getAdjacentSystems(count = 8) {
    const cur = this.getCurrentSystem();
    return this._loaded
      .filter(s => s.id !== cur.id)
      .map(s => ({
        ...s,
        _dist: Math.hypot(s.position.x - cur.position.x, s.position.y - cur.position.y),
      }))
      .sort((a, b) => a._dist - b._dist)
      .slice(0, count);
  }

  warpTo(systemId) {
    const parts = systemId.split('_');
    if (parts.length !== 3) return false;
    const [g, r, s] = parts.map(Number);
    if (isNaN(g) || isNaN(r) || isNaN(s)) return false;

    if (r !== this._regionIdx || g !== this._galaxyIdx) {
      this._loadRegion(g, r);
    }
    this._galaxyIdx = g;
    this._regionIdx = r;
    this._systemIdx = s;
    this._visitCurrent();
    return true;
  }

  warpGalaxy() {
    this._galaxyIdx = (this._galaxyIdx + 1) % 255;
    this._regionIdx = 0;
    this._systemIdx = 0;
    this._loadRegion(this._galaxyIdx, 0);
    this._visitCurrent();
    return this.getCurrentSystem();
  }

  getGalaxyName() {
    return GALAXY_NAMES[this._galaxyIdx] || `Galaxy-${this._galaxyIdx}`;
  }

  getStats() {
    const systemsInGalaxy = 32768 * 1000;
    return {
      galaxyName:      this.getGalaxyName(),
      galaxyIdx:       this._galaxyIdx,
      totalGalaxies:   255,
      systemsInGalaxy,
      totalSystems:    systemsInGalaxy * 255,
      visitedCount:    this._visited.size,
    };
  }

  serialize() {
    const visitedArr = [...this._visited].slice(0, 500);
    return {
      g:       this._galaxyIdx,
      r:       this._regionIdx,
      s:       this._systemIdx,
      visited: visitedArr,
    };
  }

  load(data) {
    if (!data) return;
    this._galaxyIdx = data.g ?? 0;
    this._regionIdx = data.r ?? 0;
    this._systemIdx = data.s ?? 0;
    this._visited   = new Set(data.visited || []);
    this._cache.clear();
    this._loadRegion(this._galaxyIdx, this._regionIdx);
    // Re-stamp visited flags on cached descriptors
    for (const id of this._visited) {
      const parts = id.split('_');
      if (parts.length === 3) {
        const key = `${parts[0]}:${parts[1]}:${parts[2]}`;
        const desc = this._cache.get(key);
        if (desc) desc.visited = true;
      }
    }
  }
}
