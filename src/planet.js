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
  { name:'Rocky Moon',  color:'#909090', size:0.04, emissive:0.0 },
  { name:'Ice Moon',    color:'#cce8ff', size:0.03, emissive:0.0 },
  { name:'Volcanic Moon',color:'#cc4422',size:0.05, emissive:0.15 },
  { name:'Crystal Moon', color:'#80e0ff',size:0.035,emissive:0.1 },
  { name:'Barren Moon',  color:'#b0a090',size:0.025,emissive:0.0 },
];

/** Seed of the starting planet (New Meridian) — used for special-case overrides. */
const STARTING_PLANET_SEED = 10001;

export class PlanetGenerator {
  static generate(seed, typeOverride) {
    const rng  = seededRng(seed);
    const types = Object.keys(PLANET_TYPES);
    const type  = typeOverride || types[Math.floor(rng() * types.length)];
    const def   = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.LUSH;

    // Varied LUSH palettes for visual diversity
    const LUSH_PALETTES = [
      { low:'#1a5c1a', mid:'#2d8c2d', high:'#a0c8a0', fog:'#c8e8c8', water:'#1a6aff', accent:'#40ff40' },
      { low:'#1a6030', mid:'#2aa060', high:'#70d090', fog:'#b0e8c8', water:'#1058e0', accent:'#30ffaa' },
      { low:'#2a5010', mid:'#5a9820', high:'#a8cc60', fog:'#d0e8a0', water:'#2060e0', accent:'#aaff30' },
      { low:'#3a4010', mid:'#7a9030', high:'#c0c880', fog:'#e0e8b0', water:'#2040cc', accent:'#e0ff20' },
      { low:'#104020', mid:'#1c7040', high:'#60b080', fog:'#90d0b0', water:'#0850d0', accent:'#20ffa0' },
      { low:'#1c4830', mid:'#388060', high:'#80c0a0', fog:'#a8dcc0', water:'#1048c8', accent:'#50ffb0' },
    ];

    let bc;
    if (type === 'LUSH') {
      const palette = LUSH_PALETTES[Math.floor(rng() * LUSH_PALETTES.length)];
      // First planet seed (New Meridian) always gets rich palette index 0
      bc = seed === STARTING_PLANET_SEED ? LUSH_PALETTES[0] : palette;
    } else {
      bc = BIOME_COLORS[type] || BIOME_COLORS.LUSH;
    }

    // Override biome colors for EXOTIC, CRYSTAL, and VOLCANIC for vibrancy
    if (type === 'EXOTIC') {
      bc = {
        low:    '#6010c0', mid:    '#b020e0', high:   '#e060ff',
        accent: '#ff40ff', fog:    '#c050e8', water:  '#6020d0',
      };
    } else if (type === 'CRYSTAL') {
      bc = {
        low:    '#0080a0', mid:    '#20c0e8', high:   '#80ffff',
        accent: '#c0ffff', fog:    '#80e0ff', water:  '#1060c0',
      };
    } else if (type === 'VOLCANIC') {
      bc = {
        low:    '#500000', mid:    '#cc2200', high:   '#ff6600',
        accent: '#ff8800', fog:    '#802010', water:  '#cc2200',
      };
    }

    const nameIdx = Math.floor(rng() * PLANET_NAMES.length);
    const suffix  = String.fromCharCode(65 + Math.floor(rng()*26));

    // Special name override for the starting planet
    const planetName = seed === STARTING_PLANET_SEED ? 'New Meridian' : `${PLANET_NAMES[nameIdx]}-${suffix}`;

    // Moon descriptors (rendered in atmosphere shader as small discs)
    const moonCount = Math.floor(rng() * 3);
    const moons = [];
    for (let m = 0; m < moonCount; m++) {
      const mt = MOON_TYPES[Math.floor(rng() * MOON_TYPES.length)];
      moons.push({
        ...mt,
        orbitSpeed: 0.0002 + rng() * 0.0003,
        orbitAngle: rng() * Math.PI * 2,
        orbitTilt:  (rng() - 0.5) * 0.4,
      });
    }

    // Height scale modified per subtype
    const heightMult = def.heightMult || 1.0;

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
      sunColor: new THREE.Color(seed === STARTING_PLANET_SEED ? '#ffe8a0' : def.sunColor),
      ambientColor: new THREE.Color(seed === STARTING_PLANET_SEED ? '#3a6a2a' : def.ambientColor),
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
      heightScale: WORLD.HEIGHT_SCALE * heightMult,
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
