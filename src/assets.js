/**
 * src/assets.js  –  Unified Asset Manager
 *
 * Handles all loading of .glb models and textures with:
 *  - Progress tracking for loading screen
 *  - Graceful procedural fallback when files are missing
 *  - Caching to prevent duplicate loads
 *  - Mobile-friendly compressed texture hints
 */
import * as THREE from 'three';
import { GLTFLoader }     from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }    from 'three/addons/loaders/DRACOLoader.js';
import { OBJLoader }      from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader }      from 'three/addons/loaders/MTLLoader.js';

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

export class AssetManager {
  constructor() {
    if (_instance) return _instance;
    _instance = this;

    this._gltfLoader  = new GLTFLoader();
    this._texLoader   = new THREE.TextureLoader();
    this._objLoader   = new OBJLoader();

    // Draco compression (used by Kenney GLBs)
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    draco.setDecoderConfig({ type: 'wasm' });
    this._gltfLoader.setDRACOLoader(draco);

    this._models   = new Map();  // key → { scene, animations, clips }
    this._textures = new Map();  // key → THREE.Texture
    this._manifest = null;

    this._totalAssets    = 0;
    this._loadedAssets   = 0;
    this._failedAssets   = 0;
    this._onProgress     = null;  // callback(pct, msg)
  }

  /** Load and parse manifest.json */
  async loadManifest() {
    try {
      const res = await fetch('assets/manifest.json');
      this._manifest = await res.json();
    } catch {
      console.warn('[assets] No manifest found – all assets will use procedural fallback');
      this._manifest = { models: {}, textures: {} };
    }
    return this._manifest;
  }

  /** Preload a set of named assets.  `keys` = array of model/texture keys from manifest */
  async preload(keys, onProgress) {
    if (!this._manifest) await this.loadManifest();
    this._onProgress = onProgress;

    const jobs = [];
    for (const key of keys) {
      const mDef = this._manifest.models?.[key];
      const tDef = this._manifest.textures?.[key];
      if (mDef) jobs.push({ type: 'model',   key, def: mDef });
      else if (tDef) jobs.push({ type: 'texture', key, def: tDef });
      else console.warn('[assets] Unknown key:', key);
    }

    this._totalAssets  += jobs.length;

    await Promise.allSettled(jobs.map(j =>
      j.type === 'model'
        ? this._loadModel(j.key, j.def)
        : this._loadTexture(j.key, j.def)
    ));
  }

  /** Preload ALL assets in manifest */
  async preloadAll(onProgress) {
    if (!this._manifest) await this.loadManifest();
    const keys = [
      ...Object.keys(this._manifest.models  || {}),
      ...Object.keys(this._manifest.textures || {}),
    ];
    return this.preload(keys, onProgress);
  }

  // ─── Model loading ──────────────────────────────────────────────────────────
  async _loadModel(key, def) {
    if (this._models.has(key)) return this._models.get(key);

    try {
      const gltf = await this._tryLoadGLTF(def.file);
      const entry = {
        scene:      gltf.scene,
        animations: gltf.animations,
        clips:      {},
        def,
        loaded:     true,
      };

      // Index animations by name
      for (const clip of gltf.animations || []) {
        entry.clips[clip.name.toLowerCase()] = clip;
      }

      // Apply scale from manifest
      if (def.scale) {
        const [sx, sy, sz] = def.scale;
        gltf.scene.scale.set(sx, sy, sz);
      }
      if (def.offset) {
        const [ox, oy, oz] = def.offset;
        gltf.scene.position.set(ox, oy, oz);
      }

      // Shadow settings
      gltf.scene.traverse(child => {
        if (child.isMesh) {
          child.castShadow    = def.castShadow    !== false;
          child.receiveShadow = def.receiveShadow !== false;
          // Upgrade materials for PBR
          if (child.material && !(child.material instanceof THREE.MeshStandardMaterial)) {
            const oldColor = child.material.color?.clone() || new THREE.Color(0.5, 0.5, 0.5);
            child.material = new THREE.MeshStandardMaterial({
              color: oldColor,
              roughness: 0.7,
              metalness: 0.1,
            });
          }
        }
      });

      this._models.set(key, entry);
      this._onLoad(`Model: ${key}`);
      return entry;

    } catch (err) {
      console.warn(`[assets] Model '${key}' not found (${def.file}) – using procedural fallback`);
      const entry = { scene: null, animations: [], clips: {}, def, loaded: false };
      this._models.set(key, entry);
      this._onFail();
      return entry;
    }
  }

  _tryLoadGLTF(url) {
    return new Promise((resolve, reject) => {
      this._gltfLoader.load(
        url,
        resolve,
        undefined,
        reject
      );
    });
  }

  // ─── Texture loading ────────────────────────────────────────────────────────
  async _loadTexture(key, def) {
    if (this._textures.has(key)) return this._textures.get(key);

    try {
      const tex = await new Promise((resolve, reject) => {
        this._texLoader.load(def.file, resolve, undefined, reject);
      });

      if (def.wrap === 'repeat') {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if (def.repeat) tex.repeat.set(def.repeat[0], def.repeat[1]);
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.anisotropy = 8; // Hardware anisotropic filtering

      this._textures.set(key, tex);
      this._onLoad(`Texture: ${key}`);
      return tex;

    } catch {
      console.warn(`[assets] Texture '${key}' not found (${def.file}) – using procedural colour`);
      const fallbackTex = this._generateProceduralTexture(key, def);
      this._textures.set(key, fallbackTex);
      this._onFail();
      return fallbackTex;
    }
  }

  /** Generate a tiny canvas-based fallback texture */
  _generateProceduralTexture(key, def) {
    const COLORS = {
      terrain_grass_albedo: '#3a6e2a', terrain_rock_albedo:  '#6b5d4f',
      terrain_sand_albedo:  '#c9a96e', terrain_snow_albedo:  '#dde8f0',
      terrain_alien_albedo: '#4a2a6e', sky_stars:            '#00040f',
      sky_nebula:           '#0a051a', fx_particle:          '#ffffff',
      fx_flare:             '#ffffaa', ui_hex_frame:         '#0af0ff',
    };
    const hex = COLORS[key] || '#555555';
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, size, size);
    // Add subtle noise
    for (let i = 0; i < 400; i++) {
      const v = Math.floor(Math.random() * 30 - 15);
      ctx.fillStyle = `rgba(${v>0?v:0},${v>0?v:0},${v>0?v:0},0.25)`;
      ctx.fillRect(Math.random()*size, Math.random()*size, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (def?.repeat) tex.repeat.set(def.repeat[0], def.repeat[1]);
    return tex;
  }

  // ─── Progress callbacks ─────────────────────────────────────────────────────
  _onLoad(msg) {
    this._loadedAssets++;
    const pct = Math.floor((this._loadedAssets / Math.max(1, this._totalAssets)) * 100);
    if (this._onProgress) this._onProgress(pct, msg);
  }
  _onFail() {
    this._loadedAssets++;
    this._failedAssets++;
  }

  // ─── Public accessors ────────────────────────────────────────────────────────
  /**
   * Returns a CLONE of the loaded model scene (so multiple instances are independent).
   * Returns null if not loaded (caller should use procedural fallback).
   */
  cloneModel(key) {
    const entry = this._models.get(key);
    if (!entry || !entry.scene) return null;
    const clone = entry.scene.clone(true);
    // Deep clone materials so tinting one doesn't affect others
    clone.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }

  /**
   * Returns the raw entry {scene, animations, clips, def, loaded}.
   * Use this when you want to set up an AnimationMixer.
   */
  getModelEntry(key) {
    return this._models.get(key) || null;
  }

  /** Returns a loaded THREE.Texture or the procedural fallback. */
  getTexture(key) {
    return this._textures.get(key) || null;
  }

  /** True if the model was loaded from a file (not fallback). */
  hasRealModel(key) {
    const e = this._models.get(key);
    return !!(e && e.loaded);
  }

  /** Colour-tint a cloned model (useful for biome colouring) */
  tintModel(modelClone, color) {
    if (!modelClone) return;
    modelClone.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.color.multiply(color);
      }
    });
  }

  /** Set up AnimationMixer for a cloned model */
  createMixer(key, modelClone) {
    const entry = this._models.get(key);
    if (!entry || !entry.animations?.length || !modelClone) return null;
    const mixer  = new THREE.AnimationMixer(modelClone);
    const clips  = {};
    for (const clip of entry.animations) {
      clips[clip.name.toLowerCase()] = mixer.clipAction(clip);
    }
    return { mixer, clips };
  }

  get loadProgress() {
    return this._totalAssets > 0
      ? Math.floor((this._loadedAssets / this._totalAssets) * 100)
      : 100;
  }

  get stats() {
    return {
      total:   this._totalAssets,
      loaded:  this._loadedAssets,
      failed:  this._failedAssets,
      real:    this._loadedAssets - this._failedAssets,
    };
  }
}

// Export singleton getter
export function getAssets() {
  if (!_instance) _instance = new AssetManager();
  return _instance;
}
