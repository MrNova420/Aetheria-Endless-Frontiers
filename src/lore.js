/**
 * src/lore.js  –  AETHERIA: Endless Frontiers  –  Procedural Lore Generator
 *
 * NMS-style lore: planet descriptions, taxonomic creature names, flora names,
 * scan results, and system flavour text. All methods are static; no instances
 * are required.
 */

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Planet description banks ─────────────────────────────────────────────────
const PLANET_DESCRIPTIONS = {
  LUSH: [
    'A vibrant world of sprawling bio-luminescent forests and mineral-rich valleys. Atmospheric oxygen levels are unusually high, supporting dense megafauna populations.',
    'Verdant lowland plains stretch between towering igneous plateaus, fed by warm equatorial rainfall. Indigenous flora exhibits complex symbiotic root-networks across the soil strata.',
    'Temperate and teeming with life, this world hosts a diverse biosphere shaped by mild tidal rhythms. Aerial fauna ride thermal updrafts above canopied valleys that never know true night.',
  ],
  BARREN: [
    'A wind-scoured expanse of oxidised rock. Millennia of solar bombardment have stripped the upper atmosphere; whatever biosphere once existed is preserved only as trace-fossil sediment.',
    'Featureless plains of compacted mineral dust extend to every horizon. Rare thermal vents sustain sparse extremophile colonies in the deep bedrock, invisible from orbit.',
    'Once a world with shallow seas, catastrophic volcanic uplift sealed the ocean basins under kilometres of igneous rock. The silence here is absolute.',
  ],
  TOXIC: [
    'A caustic atmosphere of sulphur compounds and heavy aerosols shrouds the surface in a permanent amber murk. Resilient flora extract minerals through corrosion of exposed rock faces.',
    'Pools of hypersaline acidic liquid dot a landscape of crystallised toxic precipitate. Fauna here excrete neutralising enzymes to move safely between feeding grounds.',
    'Thick clouds of reactive particulate drift at low altitude, corroding unprotected equipment within minutes. Surprisingly, a rich ecosystem thrives beneath the chemical fog.',
  ],
  FROZEN: [
    'Permanent ice sheets kilometres thick overlay a rocky substrate. Deep sub-glacial oceans, warmed by geothermal activity, sustain bioluminescent aquatic ecosystems entirely unseen from the surface.',
    'Cryogenic winds reshape the tundra hourly, carving organic ice sculptures that dissolve come planetary spring. Only the most cold-adapted organisms endure on the exposed plateau.',
    'Blizzard conditions dominate most of the year cycle. Short temperate windows allow explosive surface flora blooms, which lie dormant the rest of the time as freeze-dried spores.',
  ],
  BURNING: [
    'Surface temperatures exceed survival thresholds within seconds of sun exposure. Lava channels snake between obsidian bluffs, and the sky glows amber with perpetual volcanic ash.',
    'Hyper-dense with heavy metals, this world\'s crust is threaded with magma conduits. Exothermic mineral reactions sustain pockets of heat-adapted microbial life in gas vents.',
    'A dying world, consumed by its own runaway greenhouse effect. Ancient ruins near the polar regions hint at a civilisation lost before the temperature became unsurvivable.',
  ],
  EXOTIC: [
    'Reality itself seems unstable here. Gravitational eddies warp light into prismatic halos around floating mineral spires. Creatures that evolved in this environment exhibit non-Euclidean locomotive patterns.',
    'Bioluminescent spore clouds drift at all altitudes, reacting to sound and motion. The surface pulses with coordinated colour shifts — the signature of a planet-scale fungal network.',
    'Crystal formations of unknown mineralogical class refract the star\'s light into shifting spectra across the valley floors. Fauna here are drawn to these light-wells as feeding grounds.',
  ],
  DEAD: [
    'Stripped of atmosphere by a proximate gamma-ray burst, this world is a sterile monument. Irradiated rock and ancient impact craters are all that remain of any former complexity.',
    'Residual radioactivity bathes the surface in a faint blue Cherenkov glow. No biological process has occurred here in an estimated forty million cycles.',
    'A world past its biological epoch. Fossilised root casts in the bedrock indicate a once-thriving biosphere, now reduced to bare minerals and background radiation.',
  ],
  OCEAN: [
    'Continuous global ocean, interrupted only by scattered volcanic archipelagos. The water column sustains extraordinary biodiversity from the photic surface to the abyssal trenches.',
    'Shallow warm seas cover ninety-three percent of the surface, fed by geothermal vents. Bio-engineered reef structures built by colonial organisms span entire continental shelves.',
    'Beneath permanent overcast skies, the ocean surface is calm and featureless. Below, a staggering density of macrofauna competes for territory around deep hydrothermal fields.',
  ],
  TROPICAL: [
    'Equatorial heat and near-constant precipitation fuel a world of towering canopy growth. Every surface is colonised — organisms here evolved not on the ground but in the upper forest strata.',
    'Warm seasonal monsoons have carved river deltas visible from orbit. Megafauna congregate at the river mouths, driving complex predator-prey dynamics observed nowhere else in this system.',
    'Thick humidity accelerates decomposition and nutrient cycling to such extremes that fallen organisms are absorbed and redistributed within planetary hours.',
  ],
  ARCTIC: [
    'A world near-locked in perpetual polar conditions. Only a narrow temperate band at the equator permits complex surface life; everything beyond it belongs to glacier and blizzard.',
    'White-out conditions persist across ninety percent of the surface. Beneath the ice, however, bio-thermal vents sustain ecosystems of remarkable complexity and density.',
    'Ultra-low temperatures have reduced atmospheric pressure to trace levels at the poles. Fauna here are compact, heavily insulated, and demonstrate extraordinary metabolic efficiency.',
  ],
  VOLCANIC: [
    'Tectonic hyperactivity has raised a landscape of jagged calderas and active lava flows. Sulphurous atmospheric columns reach the stratosphere; visibility is measured in metres.',
    'An interior world still in geological adolescence. New surface is produced faster than erosion can work — the crust is months old in some regions, billions of years old in others.',
    'Magmatic venting sustains a mineral-rich atmosphere that coats every surface in metallic precipitate. Fauna here are armoured with natural metallic exoskeletons via dietary mineral uptake.',
  ],
  SWAMP: [
    'Saturated ground and shallow standing water define every landscape feature. An organic rich substrate supports a dense trophic hierarchy, anchored by vast mat-forming micro-organisms.',
    'Methane pockets erupt from the surface sporadically, visible as slow geysers of luminescent gas. Flora have evolved to exploit this gas, using it as both nutrient and defence mechanism.',
    'Tidal fluctuations drive periodic flooding across the lowland plains, redistributing nutrients and organisms with each cycle. Biodiversity here rivals even the richest lush-class worlds.',
  ],
  DESERT: [
    'Vast sand seas of fine mineral particulate stretch between isolated mesa formations. Subsurface water concentrations sustain deep-root flora invisible from the surface.',
    'A world of extreme diurnal temperature swings. Organisms here are crepuscular — active only during the brief thermal windows of dawn and dusk, sheltering otherwise in deep burrows.',
    'Vast electrical storms generated by charged particulate sweep the desert surface regularly. Fauna have evolved electrosensory organs and charge-dissipating mineral coatings.',
  ],
  CRYSTAL: [
    'Silicate crystalline structures of extraordinary scale emerge from every surface. Their internal lattice geometry bends ambient radiation into standing-wave patterns that are faintly audible.',
    'Crystal towers tens of metres tall are the dominant geographical feature. They grow slowly by condensation from a saturated mineral atmosphere, and shatter dramatically during seismic events.',
    'A world of geometric precision imposed by crystallographic growth dynamics. Even native organisms exhibit regular lattice-like structural features, having co-evolved with the mineral substrate.',
  ],
};

// ─── Threat descriptions ──────────────────────────────────────────────────────
const THREAT_DESCRIPTIONS = {
  none:      'Atmosphere is breathable. No environmental hazards detected.',
  heat:      'Extreme thermal conditions registered. Life support cooling systems will be under sustained load.',
  cold:      'Cryogenic atmospheric temperatures recorded. Thermal insulation integrity is critical.',
  radiation: 'Elevated ionising radiation flux detected across the surface. Hazard protection advised.',
  toxic:     'Caustic aerosols and corrosive chemical particulate present throughout lower atmosphere.',
  exotic:    'Anomalous energy readings detected. Physics localisation may cause unexpected equipment behaviour.',
};

// ─── Taxonomic name components ────────────────────────────────────────────────
const GENUS_SYLLABLES = [
  'Xeno','Aether','Vex','Kryp','Lumor','Gyro','Neth','Ostro','Calyx','Pyra',
  'Myriad','Endo','Para','Meta','Proto','Iso','Crypto','Poly','Mono','Omni',
  'Ferro','Litho','Chloro','Chromo','Baro','Hygro','Thermo','Photo','Chemo','Bio',
  'Macro','Micro','Nano','Mega','Ultra','Infra','Sub','Super','Trans','Extra',
  'Archi','Arbo','Aqua','Amphi','Aniso','Anthe','Aura','Avia','Carni','Coelo',
  'Dendro','Echino','Entomo','Formi','Gastro','Hemi','Herbi','Hexo','Horto','Hydra',
];
const SPECIES_SUFFIXES = [
  'morphus','ventor','vestis','ferox','gracilis','maximus','minimus','robustus',
  'elegans','horridus','latus','longus','brevis','magnus','parvus','validus',
  'ingens','nobilis','pulcher','mirus','acer','velox','segnis','strenuus',
  'obscurus','lucidus','viridis','caeruleus','ruber','albus','niger','flavus',
  'spectrus','umbris','luminis','ignis','glacies','ventus','aquae','terrae',
  'primordius','novus','antiquus','alienus','vastus','acutus','densus','rarus',
];

// ─── Flora name components ────────────────────────────────────────────────────
const FLORA_GENERA = [
  'Aethera','Vexilla','Lumina','Crystara','Pyrantha','Nethia','Calixia','Gyrata',
  'Ferrosa','Chloris','Chromara','Photara','Therma','Endora','Paradox','Protoxa',
  'Xenoflora','Aurantha','Arboria','Aquifera','Dendrosa','Hydrana','Lithoxa',
  'Polyantha','Monoxa','Omnivora','Macroxa','Microxa','Megantha','Ultraxa',
];
const FLORA_EPITHETS = [
  'flos','viridis','alba','rubra','aurea','caerulea','magna','parva','longa',
  'acuta','densa','rara','nova','antiqua','elegans','ferox','nobilis','lucida',
  'umbria','ignifera','glaciata','ventosa','aquatica','terrestris','spectrans',
  'primordia','aliena','vasta','gracilis','robusta','velutina','crystallis',
];

// ─── Resource icons ────────────────────────────────────────────────────────────
const RESOURCE_ICONS = {
  Carbon: '🌿', 'Ferrite Dust': '🪨', Copper: '🟠', Gold: '🟡',
  Uranium: '☢', Sodium: '🧂', Oxygen: '💨', 'Di-Hydrogen': '⚛',
  'Chromatic Metal': '🔮', 'Pure Ferrite': '🔩', 'Condensed Carbon': '💎',
  Platinum: '⚪', Cobalt: '🔵', Titanium: '⚙', Emeril: '💚', Indium: '🟣',
};

// ─── Star class flavour ────────────────────────────────────────────────────────
const STAR_CLASS_FLAVOUR = {
  M: 'Class-M red dwarf. Low luminosity; long-lived and planet-rich.',
  K: 'Class-K orange subgiant. Stable output; high exoplanet habitability index.',
  G: 'Class-G yellow main-sequence. Benchmark stellar type; moderate emission spectrum.',
  F: 'Class-F yellow-white. Higher UV output than G-class; shorter lifespan.',
  A: 'Class-A white. Intense UV and visible output; rapid stellar evolution likely.',
  B: 'Class-B blue-white giant. Extreme luminosity; significant radiation hazard in inner system.',
  O: 'Class-O blue supergiant. The rarest stellar classification. Ionises nearby interstellar gas.',
};

// ─── Conflict level flavour ───────────────────────────────────────────────────
const CONFLICT_FLAVOUR = [
  'No conflict. Sentinel activity is minimal; travellers are undisturbed.',
  'Low conflict. Occasional pirate patrol; local security forces maintain order.',
  'Moderate conflict. Territorial disputes active; armed escort recommended.',
  'High conflict. Multiple faction operations underway. Combat imminent.',
  'War zone. Sustained multi-faction combat. Survival probability low without combat upgrades.',
];

// ─── Noteworthy system features ───────────────────────────────────────────────
const NOTEWORTHY_FEATURES = [
  'Anomalous gravitational lens detected in inner system.',
  'Abandoned freighter in a decaying orbit around the third planet.',
  'Active space station transmitting on standard Alliance frequencies.',
  'Dense asteroid field in the outer belt; rich in rare minerals.',
  'Derelict research outpost on the second moon.',
  'Planetary alignment creates navigational distortion; warp recalibration advised.',
  'Unusually high concentration of ringed gas giants.',
  'Signal beacon of unknown origin detected on the primary planet.',
  'Multiple active trade routes converge in this system.',
  'Historical site: ancient transmission array still broadcasting.',
  'Wormhole aperture observed near the star; destination uncharted.',
  'High density of portals detected on the primary landmass.',
  'Crashed sentinel carrier on the fourth planet surface.',
  'Rogue planetoid on hyperbolic trajectory through the inner system.',
  'Stellar flare activity elevated; shields should be at full capacity.',
];

// ─── LoreSystem ───────────────────────────────────────────────────────────────
export class LoreSystem {

  static planetLore(planet) {
    const type   = (planet.type || 'BARREN').toUpperCase();
    const seed   = (planet.seed || 1) >>> 0;
    const rng    = seededRng(seed);

    const descs  = PLANET_DESCRIPTIONS[type] || PLANET_DESCRIPTIONS.BARREN;
    const desc   = descs[Math.floor(rng() * descs.length)];

    const hazardType = planet.hazardType || 'none';
    const threat     = THREAT_DESCRIPTIONS[hazardType] || THREAT_DESCRIPTIONS.none;

    // Flora / fauna levels
    const floraDensity = planet.floraDensity ?? rng();
    const faunaDensity = planet.faunaDensity ?? rng();
    const floraLevel   = floraDensity < 0.15 ? 'Scarce'
                       : floraDensity < 0.45 ? 'Sparse'
                       : floraDensity < 0.70 ? 'Moderate'
                       : floraDensity < 0.90 ? 'Abundant'
                       : 'Teeming';
    const faunaLevel   = faunaDensity < 0.10 ? 'Devoid'
                       : faunaDensity < 0.35 ? 'Uncommon'
                       : faunaDensity < 0.60 ? 'Moderate'
                       : faunaDensity < 0.85 ? 'Full'
                       : 'Overrun';

    // Primary resources
    const rw = planet.resourceWeights || {};
    const primaryResources = Object.entries(rw)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => name);

    const gravityG    = planet.gravity != null ? planet.gravity : parseFloat((0.6 + rng() * 1.2).toFixed(2));
    const temperature = planet.temperature != null ? planet.temperature : Math.round((rng() * 200) - 80);
    const moonCount   = Array.isArray(planet.moons) ? planet.moons.length : (planet.moons ?? Math.floor(rng() * 4));
    const hasRings    = planet.hasRings ?? (rng() < 0.18);

    return { description: desc, threat, floraLevel, faunaLevel, primaryResources, gravityG, temperature, moonCount, hasRings };
  }

  static creatureName(genome) {
    const seed = ((genome && genome.seed) || 42) >>> 0;
    const rng  = seededRng(seed);
    const genus   = pick(GENUS_SYLLABLES, rng);
    const species = pick(SPECIES_SUFFIXES, rng);
    return `${genus} ${species}`;
  }

  static floraName(seed) {
    const rng    = seededRng((seed || 1) >>> 0);
    const genus  = pick(FLORA_GENERA, rng);
    const epith  = pick(FLORA_EPITHETS, rng);
    return `${genus} ${epith}`;
  }

  static scanResult(entity) {
    const type = entity.type || 'resource';

    if (type === 'creature' || type === 'fauna') {
      const name   = entity.name || LoreSystem.creatureName(entity.genome || { seed: entity.seed || 1 });
      const rng    = seededRng((entity.seed || entity.genome?.seed || 1) >>> 0);
      const traits = [
        pick(['Carnivorous', 'Herbivorous', 'Omnivorous', 'Filter-feeder', 'Parasitic', 'Photosynthetic'], rng),
        pick(['Territorial', 'Nomadic', 'Colonial', 'Solitary', 'Pack-hunter', 'Migratory'], rng),
        pick(['Diurnal', 'Nocturnal', 'Crepuscular', 'Arrhythmic'], rng),
      ];
      return { icon: '🐾', label: 'Fauna', name, traits };
    }

    if (type === 'flora') {
      const name   = entity.name || LoreSystem.floraName(entity.seed || 1);
      const rng    = seededRng((entity.seed || 1) >>> 0);
      const traits = [
        pick(['Photosynthetic', 'Chemosynthetic', 'Parasitic', 'Saprophytic'], rng),
        pick(['Deciduous', 'Evergreen', 'Annual', 'Perennial', 'Ephemeral'], rng),
        pick(['Wind-pollinated', 'Fauna-pollinated', 'Self-fertilising', 'Spore-bearing'], rng),
      ];
      return { icon: '🌿', label: 'Flora', name, traits };
    }

    if (type === 'resource') {
      const rType  = entity.resourceType || 'Carbon';
      const amount = entity.amount != null ? entity.amount : Math.floor(Math.random() * 80 + 20);
      const icon   = RESOURCE_ICONS[rType] || '💠';
      return { icon, label: 'Resource', name: rType, traits: [`${amount} units available`, 'Mineable deposit'] };
    }

    // Generic fallback
    const name = entity.name || 'Unknown Entity';
    return { icon: '❓', label: 'Unknown', name, traits: ['Analysis inconclusive'] };
  }

  static systemLore(system) {
    if (!system) return { economyDesc: '', starClass: '', conflictDesc: '', noteworthy: '' };

    const rng = seededRng(system.seed >>> 0);

    const economyDesc   = system.economyDescr || `${system.economy || 'Unknown'} economy.`;
    const starClass     = STAR_CLASS_FLAVOUR[system.starType] || `Stellar class ${system.starType || '?'}.`;
    const conflictDesc  = CONFLICT_FLAVOUR[Math.min(system.conflictLevel ?? 0, 4)];
    const noteworthy    = pick(NOTEWORTHY_FEATURES, rng);

    return { economyDesc, starClass, conflictDesc, noteworthy };
  }
}
