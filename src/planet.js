/**
 * src/planet.js
 */
import * as THREE from 'three';
import { AtmosphereShader } from './shaders.js';
import { BIOME_COLORS, PLANET_TYPES } from './config.js';

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s,1664525)+1013904223)>>>0; return s/0x100000000; };
}

const PLANET_NAMES = [
  'Xion','Velara','Nythus','Cruor','Helix','Zorath','Primen','Kalyx',
  'Duvek','Triox','Fenmara','Gloeth','Solva','Vortix','Ryekon','Umbra'
];

const TYPE_DEFAULTS = {
  LUSH:    { temperature:18, toxicity:0,  radiation:0,  stormFreq:0.3, floraDens:0.9, faunaDens:0.8, hazard:'none',      waterLevel:10, hasWater:true,  sunColor:'#fff4c0', ambientColor:'#2a4a2a' },
  BARREN:  { temperature:35, toxicity:0,  radiation:0.3,stormFreq:0.6, floraDens:0.1, faunaDens:0.2, hazard:'heat',      waterLevel:0,  hasWater:false, sunColor:'#ffa060', ambientColor:'#3a2010' },
  TOXIC:   { temperature:25, toxicity:0.9,radiation:0.2,stormFreq:0.5, floraDens:0.5, faunaDens:0.4, hazard:'toxic',     waterLevel:5,  hasWater:true,  sunColor:'#c8ff60', ambientColor:'#203a10' },
  FROZEN:  { temperature:-40,toxicity:0,  radiation:0,  stormFreq:0.4, floraDens:0.2, faunaDens:0.3, hazard:'cold',      waterLevel:8,  hasWater:true,  sunColor:'#c0d8ff', ambientColor:'#1a2840' },
  BURNING: { temperature:80, toxicity:0.3,radiation:0.5,stormFreq:0.8, floraDens:0.0, faunaDens:0.1, hazard:'heat',      waterLevel:0,  hasWater:false, sunColor:'#ff6020', ambientColor:'#3a1008' },
  EXOTIC:  { temperature:22, toxicity:0.1,radiation:0.1,stormFreq:0.2, floraDens:1.0, faunaDens:1.0, hazard:'exotic',    waterLevel:12, hasWater:true,  sunColor:'#e060ff', ambientColor:'#200a40' },
  DEAD:    { temperature:10, toxicity:0,  radiation:0.8,stormFreq:0.1, floraDens:0.0, faunaDens:0.0, hazard:'radiation', waterLevel:0,  hasWater:false, sunColor:'#d8d0c0', ambientColor:'#181818' },
  OCEAN:   { temperature:15, toxicity:0,  radiation:0,  stormFreq:0.4, floraDens:0.6, faunaDens:0.7, hazard:'none',      waterLevel:30, hasWater:true,  sunColor:'#a8e0ff', ambientColor:'#082840' }
};

const RESOURCE_WEIGHTS_BY_TYPE = {
  LUSH:    { Carbon:10, Oxygen:8, Sodium:5, 'Ferrite Dust':4, Copper:3, Gold:1 },
  BARREN:  { 'Ferrite Dust':10, Copper:6, Gold:3, Titanium:4, Cobalt:3, Platinum:2 },
  TOXIC:   { Sodium:8, Cobalt:6, Gold:4, Uranium:3, 'Ferrite Dust':5 },
  FROZEN:  { 'Di-Hydrogen':8, 'Pure Ferrite':6, Cobalt:5, Platinum:3, Titanium:4 },
  BURNING: { Uranium:10, Titanium:6, Gold:4, 'Ferrite Dust':5, Cobalt:3 },
  EXOTIC:  { Emeril:8, Indium:6, 'Chromatic Metal':5, Platinum:4, Gold:3 },
  DEAD:    { Platinum:8, 'Pure Ferrite':7, Titanium:5, Cobalt:7 },
  OCEAN:   { Carbon:8, Oxygen:10, 'Di-Hydrogen':6, Sodium:5, Copper:4 }
};

export class PlanetGenerator {
  static generate(seed, typeOverride) {
    const rng = seededRng(seed);
    const types = Object.keys(PLANET_TYPES);
    const type = typeOverride || types[Math.floor(rng() * types.length)];
    const def = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.LUSH;
    const bc = BIOME_COLORS[type] || BIOME_COLORS.LUSH;
    const nameIdx = Math.floor(rng() * PLANET_NAMES.length);
    const suffix = String.fromCharCode(65 + Math.floor(rng()*26));

    return {
      id: `planet_${seed}`,
      name: `${PLANET_NAMES[nameIdx]}-${suffix}`,
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
      sunColor: new THREE.Color(def.sunColor),
      ambientColor: new THREE.Color(def.ambientColor),
      temperature: def.temperature + (rng()-0.5)*20,
      toxicity: def.toxicity + rng()*0.1,
      radiation: def.radiation + rng()*0.1,
      stormFrequency: def.stormFreq,
      floraDensity: def.floraDens,
      faunaDensity: def.faunaDens,
      resourceWeights: RESOURCE_WEIGHTS_BY_TYPE[type] || RESOURCE_WEIGHTS_BY_TYPE.LUSH,
      hazardType: def.hazard,
      hasWater: def.hasWater,
      nightGlowColor: new THREE.Color(
        type==='EXOTIC' ? 0.4:0.1,
        type==='LUSH'||type==='EXOTIC' ? 0.6:0.1,
        type==='OCEAN'||type==='EXOTIC' ? 0.8:0.1
      ),
      hasRings: rng() > 0.75,
      moonCount: Math.floor(rng() * 3),
      cloudCoverage: 0.3 + rng() * 0.4
    };
  }

  static getSystemPlanets(systemSeed, systemData) {
    if (systemData && systemData.planets) {
      return systemData.planets.map((p, i) => {
        // Use a deterministic seed derived from systemSeed + index so the same
        // system always generates the same planets regardless of call order.
        const planetSeed = p.seed || ((systemSeed + i * 1031) >>> 0);
        return PlanetGenerator.generate(planetSeed, p.typeOverride);
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
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = -1;
    this.scene.add(this.mesh);
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
    if (playerPos && this.mesh) this.mesh.position.copy(playerPos);
  }

  setSunPosition(dir) {
    if (this.material) this.material.uniforms.uSunDir.value.copy(dir);
  }

  dispose() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.material.dispose(); }
  }
}
