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
  /** Generate a high-quality canvas-based fallback texture with noise patterns */
  _generateProceduralTexture(key, def) {
    const SCHEMES = {
      terrain_grass_albedo:  { base: '#2d5a1b', dark: '#1a3d0d', light: '#4a8a2a', noise: 'organic', grain: 0.4 },
      terrain_rock_albedo:   { base: '#6b5d4f', dark: '#4a3d33', light: '#8a7a6a', noise: 'cracked', grain: 0.5 },
      terrain_sand_albedo:   { base: '#c9a96e', dark: '#a8874d', light: '#e0c48a', noise: 'smooth', grain: 0.25 },
      terrain_snow_albedo:   { base: '#dde8f0', dark: '#b8ccd8', light: '#f0f5f8', noise: 'smooth', grain: 0.15 },
      terrain_alien_albedo:  { base: '#3a1f6e', dark: '#25124a', light: '#6a3aaa', noise: 'organic', grain: 0.45 },
      terrain_grass_normal:  { base: '#8080ff', dark: '#6070e0', light: '#90a0ff', noise: 'normal', grain: 0.3 },
      terrain_rock_normal:   { base: '#8080ff', dark: '#5565d5', light: '#9090ff', noise: 'normal', grain: 0.5 },
      sky_stars:             { base: '#00040f', dark: '#000008', light: '#ffffff', noise: 'stars', grain: 0.02 },
      sky_nebula:            { base: '#080518', dark: '#040210', light: '#3a1a6e', noise: 'nebula', grain: 0.1 },
      fx_particle:           { base: '#ffffff', dark: '#aaaaff', light: '#ffffff', noise: 'radial', grain: 0.0 },
      fx_flare:              { base: '#ffffaa', dark: '#ffcc44', light: '#ffffff', noise: 'radial', grain: 0.0 },
      ui_hex_frame:          { base: '#0af0ff', dark: '#0088aa', light: '#80ffff', noise: 'frame', grain: 0.0 },
    };
    const scheme = SCHEMES[key] || { base: '#555555', dark: '#333333', light: '#777777', noise: 'smooth', grain: 0.3 };
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return [r,g,b];
    }
    function lerpColor(c1,c2,t) {
      return [Math.round(c1[0]+(c2[0]-c1[0])*t), Math.round(c1[1]+(c2[1]-c1[1])*t), Math.round(c1[2]+(c2[2]-c1[2])*t)];
    }

    const baseRgb  = hexToRgb(scheme.base);
    const darkRgb  = hexToRgb(scheme.dark);
    const lightRgb = hexToRgb(scheme.light);

    function hash2(x,y) { let h = (x * 374761393 + y * 1234577) ^ ((x+y) * 1234577); h = ((h^(h>>>13))*1274126177)>>>0; return (h>>>0)/4294967296; }
    function smoothNoise(x,y,s) {
      const xi=Math.floor(x/s), yi=Math.floor(y/s);
      const xf=(x/s-xi), yf=(y/s-yi);
      const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
      return hash2(xi,yi)*(1-u)*(1-v) + hash2(xi+1,yi)*u*(1-v) + hash2(xi,yi+1)*(1-u)*v + hash2(xi+1,yi+1)*u*v;
    }
    function fbm(x,y,oct,s) {
      let val=0,amp=0.5,freq=1;
      for(let i=0;i<oct;i++){val+=smoothNoise(x*freq,y*freq,s)*amp;amp*=0.5;freq*=2.1;}
      return val;
    }

    const imgData = ctx.createImageData(size,size);
    const data = imgData.data;

    if (scheme.noise === 'stars') {
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const i=(y*size+x)*4;
        const n = fbm(x,y,3,64);
        const starChance = hash2(x*3,y*3);
        const brightness = starChance > 0.97 ? Math.pow((starChance-0.97)/0.03,2)*255 : 0;
        const nebula = n * 20;
        data[i]=nebula; data[i+1]=nebula; data[i+2]=nebula+brightness; data[i+3]=255;
      }
    } else if (scheme.noise === 'nebula') {
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const i=(y*size+x)*4;
        const n1=fbm(x,y,5,80), n2=fbm(x+300,y+200,4,60);
        const t=n1*n2*2;
        const [r,g,b]=lerpColor(darkRgb,lightRgb,Math.min(t,1));
        const star = hash2(x*7,y*7)>0.98?100:0;
        data[i]=r+star; data[i+1]=g; data[i+2]=b+star; data[i+3]=255;
      }
    } else if (scheme.noise === 'radial') {
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const i=(y*size+x)*4;
        const cx2=x-size/2, cy2=y-size/2;
        const dist=Math.sqrt(cx2*cx2+cy2*cy2)/(size*0.5);
        const alpha=Math.max(0,1-dist*dist);
        const [r,g,b]=lerpColor(darkRgb,lightRgb,alpha);
        data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=Math.round(alpha*255);
      }
    } else if (scheme.noise === 'normal') {
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const i=(y*size+x)*4;
        const h0=fbm(x,y,4,32), hx=fbm(x+1,y,4,32), hy=fbm(x,y+1,4,32);
        const nx=((h0-hx)*8+0.5)*255, ny=((h0-hy)*8+0.5)*255;
        data[i]=Math.round(Math.min(255,Math.max(0,nx)));
        data[i+1]=Math.round(Math.min(255,Math.max(0,ny)));
        data[i+2]=255; data[i+3]=255;
      }
    } else if (scheme.noise === 'cracked') {
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const i=(y*size+x)*4;
        const n=fbm(x,y,6,48);
        const crack=Math.abs(fbm(x*1.7,y*1.7,3,24)-0.5)*2;
        const t=n*crack;
        const grain=(hash2(x,y)-0.5)*scheme.grain;
        const [r,g,b]=lerpColor(darkRgb,lightRgb,Math.min(1,Math.max(0,t+grain)));
        data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
      }
    } else if (scheme.noise === 'organic') {
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const i=(y*size+x)*4;
        const n1=fbm(x,y,5,40), n2=fbm(x+100,y+100,3,20);
        const t=n1*0.7+n2*0.3;
        const grain=(hash2(x*2,y*3)-0.5)*scheme.grain;
        const [r,g,b]=lerpColor(darkRgb,lightRgb,Math.min(1,Math.max(0,t+grain)));
        data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
      }
    } else {
      // smooth / sand / snow / frame fallback
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const i=(y*size+x)*4;
        const n=fbm(x,y,4,56);
        const grain=(hash2(x,y)-0.5)*scheme.grain;
        const [r,g,b]=lerpColor(darkRgb,lightRgb,Math.min(1,Math.max(0,n+grain)));
        data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
      }
    }

    ctx.putImageData(imgData,0,0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (def?.repeat) tex.repeat.set(def.repeat[0], def.repeat[1]);
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
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
