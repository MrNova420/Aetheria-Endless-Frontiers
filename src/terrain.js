/**
 * src/terrain.js
 */
import * as THREE from 'three';
import { WORLD } from './config.js';
import { TerrainShader, WaterShader } from './shaders.js';
import { SimplexNoise } from './noise.js';
import { getAssets } from './assets.js';

export class TerrainManager {
  constructor(scene, planet, sunLight) {
    this.scene = scene;
    this.planet = planet;
    this.sunLight = sunLight;
    this.chunks = new Map();
    this.waterChunks = new Map();
    this.noise = new SimplexNoise(planet.seed || WORLD.SEED);
    this.noise2 = new SimplexNoise((planet.seed || WORLD.SEED) + 1);
    this.noise3 = new SimplexNoise((planet.seed || WORLD.SEED) + 2);
    this._floraManager = null;
    this._resourceManager = null;
    this._sunDir = new THREE.Vector3(0.5, 0.6, 0.3).normalize();
    this._terrainMat = this._buildTerrainMat();
    this._waterMat = this._buildWaterMat();
  }

  setManagers(floraManager, resourceManager) {
    this._floraManager = floraManager;
    this._resourceManager = resourceManager;
  }

  _buildTerrainMat() {
    const bc = this.planet;
    const hs = bc.heightScale || WORLD.HEIGHT_SCALE;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(TerrainShader.uniforms),
      vertexShader: TerrainShader.vertexShader,
      fragmentShader: TerrainShader.fragmentShader
    });
    mat.uniforms.uBiomeColorLow.value  = bc.vegetationColor ? bc.vegetationColor.clone() : new THREE.Color(0.2,0.5,0.2);
    mat.uniforms.uBiomeColorMid.value  = bc.rockColor       ? bc.rockColor.clone()       : new THREE.Color(0.5,0.4,0.3);
    mat.uniforms.uBiomeColorHigh.value = bc.snowColor       ? bc.snowColor.clone()       : new THREE.Color(0.9,0.93,0.98);
    mat.uniforms.uBiomeAccent.value    = bc.sandColor       ? bc.sandColor.clone()       : new THREE.Color(0.8,0.7,0.5);
    mat.uniforms.uWaterLevel.value     = bc.waterLevel != null ? bc.waterLevel : WORLD.WATER_LEVEL;
    mat.uniforms.uHeightScale.value    = hs;
    mat.uniforms.uFogColor.value       = bc.fogColor        ? bc.fogColor.clone()        : new THREE.Color(0.7,0.8,0.9);
    mat.uniforms.uFogDensity.value     = bc.fogDensity || 0.007;
    mat.uniforms.uSunDir.value         = this._sunDir.clone();
    mat.uniforms.uSunColor.value       = bc.sunColor ? bc.sunColor.clone() : new THREE.Color(1.0, 0.95, 0.85);
    mat.uniforms.uAmbientColor.value   = bc.ambientColor ? bc.ambientColor.clone() : new THREE.Color(0.25, 0.3, 0.4);
    // Emissive for lava/crystal/exotic glow zones
    const emissiveStr  = bc.emissiveStrength || 0;
    const emissiveCol  = bc.type === 'VOLCANIC' ? new THREE.Color(1.0, 0.3, 0.05)
                       : bc.type === 'BURNING'  ? new THREE.Color(1.0, 0.4, 0.1)
                       : bc.type === 'CRYSTAL'  ? new THREE.Color(0.4, 0.9, 1.0)
                       : bc.type === 'EXOTIC'   ? new THREE.Color(0.8, 0.2, 1.0)
                       : new THREE.Color(1.0, 0.5, 0.1);
    mat.uniforms.uEmissiveColor.value     = emissiveCol;
    mat.uniforms.uEmissiveStrength.value  = emissiveStr;
    mat.uniforms.uWetness.value           = 0.0;  // updated live by weather
    mat.uniforms.uWindTime.value          = 0.0;  // updated live each tick
    // Wire real textures if available
    this._applyTerrainTextures(mat);
    return mat;
  }

  _applyTerrainTextures(mat) {
    try {
      const assets = getAssets();
      const texGrass = assets.getTexture('terrain_grass_albedo');
      const texRock  = assets.getTexture('terrain_rock_albedo');
      const texSand  = assets.getTexture('terrain_sand_albedo');
      const texSnow  = assets.getTexture('terrain_snow_albedo');
      const texAlien = assets.getTexture('terrain_alien_albedo');
      const texGN    = assets.getTexture('terrain_grass_normal');
      const texRN    = assets.getTexture('terrain_rock_normal');
      let hasAny = false;
      if (texGrass) { mat.uniforms.uTexGrass.value = texGrass; hasAny = true; }
      if (texRock)  { mat.uniforms.uTexRock.value  = texRock;  hasAny = true; }
      if (texSand)  mat.uniforms.uTexSand.value  = texSand;
      if (texSnow)  mat.uniforms.uTexSnow.value  = texSnow;
      if (texAlien) mat.uniforms.uTexAlien.value = texAlien;
      if (texGN)    mat.uniforms.uTexGrassNorm.value = texGN;
      if (texRN)    mat.uniforms.uTexRockNorm.value  = texRN;
      if (hasAny)   mat.uniforms.uUseTextures.value  = 1.0;
    } catch (_) {}
  }

  _buildWaterMat() {
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(WaterShader.uniforms),
      vertexShader: WaterShader.vertexShader,
      fragmentShader: WaterShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const wc = this.planet.waterColor || new THREE.Color(0.1, 0.4, 0.8);
    const fc = this.planet.fogColor   || new THREE.Color(0.7, 0.8, 0.9);
    const sc = this.planet.sunColor   || new THREE.Color(1.0, 0.95, 0.85);
    mat.uniforms.uWaterColor.value = wc.clone();
    mat.uniforms.uSkyColor.value   = fc.clone();
    mat.uniforms.uFogColor.value   = fc.clone();
    mat.uniforms.uSunDir.value     = this._sunDir.clone();
    mat.uniforms.uSunColor.value   = sc.clone();
    mat.uniforms.uFogDensity.value = this.planet.fogDensity || 0.007;
    mat.uniforms.uWaterLevel.value = this.planet.waterLevel ?? 10;
    return mat;
  }

  getHeightAt(worldX, worldZ) {
    const s = this.planet.heightScale || WORLD.HEIGHT_SCALE;
    const n1 = this.noise.fbm2(worldX * 0.003, worldZ * 0.003, 6) * s;
    const n2 = this.noise2.fbm2(worldX * 0.015, worldZ * 0.015, 4) * s * 0.3;
    const n3 = this.noise3.fbm2(worldX * 0.06,  worldZ * 0.06,  3) * s * 0.1;
    return n1 + n2 + n3;
  }

  getBiomeAt(worldX, worldZ) {
    const h   = this.getHeightAt(worldX, worldZ);
    const wl  = this.planet.waterLevel != null ? this.planet.waterLevel : WORLD.WATER_LEVEL;
    const type = this.planet.type || 'LUSH';
    const norm = h / WORLD.HEIGHT_SCALE;
    let biome = type;
    if (h < wl + 2)       biome = 'BEACH';
    else if (norm > 0.75)  biome = 'SNOW';
    else if (norm > 0.5)   biome = 'ROCK';
    return { type: biome, height: h, norm };
  }

  _buildChunk(cx, cz, lodIdx) {
    const verts = WORLD.LOD_LEVELS[lodIdx] || WORLD.CHUNK_VERTS;
    const size  = WORLD.CHUNK_SIZE;
    const geo   = new THREE.PlaneGeometry(size, size, verts-1, verts-1);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const count   = posAttr.count;
    const originX = cx * size;
    const originZ = cz * size;

    for (let i = 0; i < count; i++) {
      const lx = posAttr.getX(i);
      const lz = posAttr.getZ(i);
      posAttr.setY(i, this.getHeightAt(originX + lx, originZ + lz));
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = this._terrainMat.clone();
    mat.uniforms = THREE.UniformsUtils.clone(this._terrainMat.uniforms);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(originX, 0, originZ);
    mesh.receiveShadow = true;
    mesh.castShadow    = false;
    this.scene.add(mesh);
    return mesh;
  }

  _buildWaterChunk(cx, cz) {
    const size = WORLD.CHUNK_SIZE;
    const wl   = this.planet.waterLevel != null ? this.planet.waterLevel : WORLD.WATER_LEVEL;
    if (wl <= 0 || !this.planet.hasWater) return null;
    const geo  = new THREE.PlaneGeometry(size, size, 32, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = this._waterMat.clone();
    mat.uniforms = THREE.UniformsUtils.clone(this._waterMat.uniforms);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx * size, wl, cz * size);
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    return mesh;
  }

  _getLodIndex(dist) {
    if (dist < WORLD.CHUNK_SIZE * 1.5) return 0;
    if (dist < WORLD.CHUNK_SIZE * 3)   return 1;
    if (dist < WORLD.CHUNK_SIZE * 5)   return 2;
    return 3;
  }

  update(playerWorldPos, dt) {
    const cs   = WORLD.CHUNK_SIZE;
    const rd   = WORLD.RENDER_DISTANCE;
    const pcx  = Math.floor(playerWorldPos.x / cs);
    const pcz  = Math.floor(playerWorldPos.z / cs);

    // Mark needed chunks
    const needed = new Set();
    for (let dz = -rd; dz <= rd; dz++) {
      for (let dx = -rd; dx <= rd; dx++) {
        const cx  = pcx + dx;
        const cz  = pcz + dz;
        const key = `${cx},${cz}`;
        const dist = Math.hypot(dx, dz) * cs;
        const lod  = this._getLodIndex(dist);
        needed.add(key);

        if (!this.chunks.has(key)) {
          const mesh = this._buildChunk(cx, cz, lod);
          const wMesh = this._buildWaterChunk(cx, cz);
          this.chunks.set(key, { mesh, lod, cx, cz });
          if (wMesh) this.waterChunks.set(key, wMesh);

          // Spawn flora/resources for close chunks
          if (dist < cs * 2 && this._floraManager) {
            const rng = this._makeRng((cx * 7919 + cz * 1031) >>> 0);
            this._floraManager.spawnForChunk(cx, cz, cs,
              (x,z) => this.getHeightAt(x,z),
              (x,z) => this.getBiomeAt(x,z), rng);
          }
          if (dist < cs * 2 && this._resourceManager) {
            this._resourceManager.spawnForChunk && this._resourceManager.spawnForChunk(cx, cz, this.planet);
          }
        }
      }
    }

    // Remove far chunks
    for (const [key, data] of this.chunks) {
      if (!needed.has(key)) {
        this.scene.remove(data.mesh);
        data.mesh.geometry.dispose();
        data.mesh.material.dispose();
        this.chunks.delete(key);
        if (this._floraManager) this._floraManager.removeForChunk(data.cx, data.cz);
        if (this._resourceManager && this._resourceManager.removeForChunk) {
          this._resourceManager.removeForChunk(data.cx, data.cz);
        }
        const wm = this.waterChunks.get(key);
        if (wm) { this.scene.remove(wm); wm.geometry.dispose(); wm.material.dispose(); this.waterChunks.delete(key); }
      }
    }

    // Update terrain+water shader time and ambient color
    const frameDt = dt || 0.016;
    for (const [, data] of this.chunks) {
      if (data.mesh.material.uniforms?.uTime != null) {
        data.mesh.material.uniforms.uTime.value += frameDt;
      }
    }
    for (const [, wm] of this.waterChunks) {
      if (wm.material.uniforms && wm.material.uniforms.uTime) {
        wm.material.uniforms.uTime.value += frameDt;
      }
    }
  }

  /** Update per-frame lighting from game day/night cycle. */
  updateLighting(sunDir, sunColor, ambientColor) {
    if (!sunDir) return;
    this._sunDir.copy(sunDir);
    for (const [, data] of this.chunks) {
      const u = data.mesh.material.uniforms;
      if (!u) continue;
      u.uSunDir.value.copy(sunDir);
      if (sunColor)     u.uSunColor.value.copy(sunColor);
      if (ambientColor) u.uAmbientColor.value.copy(ambientColor);
    }
    // Water chunks — update sun direction and colour each frame
    for (const [, wm] of this.waterChunks) {
      const u = wm.material?.uniforms;
      if (!u) continue;
      if (u.uSunDir)   u.uSunDir.value.copy(sunDir);
      if (u.uSunColor) u.uSunColor.value.copy(sunColor ?? new THREE.Color(1, 0.95, 0.85));
    }
  }

  /** Set wetness (0–1) driven by weather intensity. */
  setWetness(wet) {
    for (const [, data] of this.chunks) {
      const u = data.mesh.material.uniforms;
      if (u?.uWetness) u.uWetness.value = wet;
    }
  }

  /** Increment lava/wind time scroll. */
  tickWindTime(dt) {
    for (const [, data] of this.chunks) {
      const u = data.mesh.material.uniforms;
      if (u?.uWindTime) u.uWindTime.value += dt;
    }
  }

  setSunDirection(dir) {
    this._sunDir.copy(dir);
    for (const [, data] of this.chunks) {
      if (data.mesh.material.uniforms) {
        data.mesh.material.uniforms.uSunDir.value.copy(dir);
      }
    }
  }

  _makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s=(Math.imul(s,1664525)+1013904223)>>>0; return s/0x100000000; };
  }

  dispose() {
    for (const [, data] of this.chunks) {
      this.scene.remove(data.mesh);
      data.mesh.geometry.dispose();
      data.mesh.material.dispose();
    }
    for (const [, wm] of this.waterChunks) {
      this.scene.remove(wm);
      wm.geometry.dispose();
      wm.material.dispose();
    }
    this.chunks.clear();
    this.waterChunks.clear();
  }
}
