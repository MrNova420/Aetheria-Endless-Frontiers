/**
 * src/flora.js
 */
import * as THREE from 'three';
import { FloraShader } from './shaders.js';
import { getAssets } from './assets.js';

function buildTallAlienTree(planet) {
  const assets = getAssets?.();
  const modelClone = assets?.cloneModel('flora_tree_alien');
  if (modelClone) return modelClone;

  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x553300, roughness: 0.85, metalness: 0.0 });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.7, 4, 12),
    trunkMat
  );
  trunk.position.y = 2;
  group.add(trunk);
  const leafCol = planet.vegetationColor || new THREE.Color(0.2, 0.6, 0.2);
  const leafMat = new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.75, metalness: 0.0 });
  for (let i = 0; i < 3; i++) {
    const cr = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 + i * 0.3, 12, 10),
      leafMat
    );
    cr.position.set(Math.cos(i*2.1)*0.8, 4.5 + i*0.5, Math.sin(i*2.1)*0.8);
    group.add(cr);
  }
  return group;
}

function buildCrystalFormation(planet) {
  const assets = getAssets?.();
  const modelClone = assets?.cloneModel('flora_crystal');
  if (modelClone) return modelClone;

  const group = new THREE.Group();
  const col = planet.rockColor || new THREE.Color(0.5, 0.3, 0.8);
  const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.3 });
  const count = 3 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const h = 1 + Math.random() * 3;
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, h, 6),
      mat
    );
    mesh.position.set((Math.random()-0.5)*1.5, h/2, (Math.random()-0.5)*1.5);
    mesh.rotation.z = (Math.random()-0.5)*0.4;
    group.add(mesh);
  }
  const cap = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4, 2),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.4 })
  );
  cap.position.y = 3.5;
  group.add(cap);
  return group;
}

function buildMushroomGiant(planet) {
  const assets = getAssets?.();
  const modelClone = assets?.cloneModel('flora_mushroom');
  if (modelClone) return modelClone;

  const group = new THREE.Group();
  const capCol = planet.vegetationColor || new THREE.Color(0.7, 0.3, 0.2);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.6, 3, 14),
    new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.8, metalness: 0.0 })
  );
  stem.position.y = 1.5;
  group.add(stem);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 16, 10, 0, Math.PI*2, 0, Math.PI*0.5),
    new THREE.MeshStandardMaterial({ color: capCol, emissive: capCol, emissiveIntensity: 0.2, roughness: 0.65, metalness: 0.0, side: THREE.DoubleSide })
  );
  cap.position.y = 3.2;
  group.add(cap);
  return group;
}

function buildSpinePlant(planet) {
  const group = new THREE.Group();
  const col = planet.vegetationColor || new THREE.Color(0.3, 0.7, 0.4);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.0 });
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 10),
    mat
  );
  center.position.y = 0.8;
  group.add(center);
  for (let i = 0; i < 12; i++) {
    const angle = (i/12)*Math.PI*2;
    const h = 0.5 + Math.random()*2;
    const spine = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, h, 5),
      mat
    );
    spine.position.set(Math.cos(angle)*0.8, 0.8+h*0.3, Math.sin(angle)*0.8);
    spine.rotation.z = Math.cos(angle)*0.7;
    spine.rotation.x = Math.sin(angle)*0.7;
    group.add(spine);
  }
  return group;
}

function buildFloatingOrb(planet) {
  const group = new THREE.Group();
  const col = planet.nightGlowColor || new THREE.Color(0.5, 0.8, 1.0);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 16),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8, transparent: true, opacity: 0.85, roughness: 0.05, metalness: 0.2 })
  );
  orb.position.y = 3;
  group.add(orb);
  const pGeo = new THREE.BufferGeometry();
  const pts = new Float32Array(30*3);
  for (let i=0;i<30;i++) {
    const a=(i/30)*Math.PI*2;
    pts[i*3]=Math.cos(a)*1.2; pts[i*3+1]=3; pts[i*3+2]=Math.sin(a)*1.2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const pMat = new THREE.PointsMaterial({ color: col, size: 0.1, transparent: true, opacity: 0.6 });
  group.add(new THREE.Points(pGeo, pMat));
  return group;
}

function buildGroundFern(planet) {
  const group = new THREE.Group();
  const col = planet.vegetationColor || new THREE.Color(0.2, 0.6, 0.3);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 1.5, 2, 4),
      mat
    );
    leaf.position.set(Math.cos(i*1.05)*0.5, 0.75, Math.sin(i*1.05)*0.5);
    leaf.rotation.y = i*1.05;
    leaf.rotation.z = 0.4;
    group.add(leaf);
  }
  return group;
}

function buildCactus(planet) {
  const assets = getAssets?.();
  const modelClone = assets?.cloneModel('flora_cactus');
  if (modelClone) return modelClone;

  const group = new THREE.Group();
  const col = planet.vegetationColor || new THREE.Color(0.3, 0.55, 0.2);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, metalness: 0.0 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3, 10), mat);
  trunk.position.y = 1.5;
  group.add(trunk);
  for (let i = 0; i < 2; i++) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.5, 8), mat);
    const side = i === 0 ? 1 : -1;
    arm.rotation.z = side * Math.PI * 0.4;
    arm.position.set(side * 0.6, 1.8, 0);
    group.add(arm);
  }
  return group;
}

function buildRockFormation(planet, variant) {
  const assets = getAssets?.();
  const key = variant === 'b' ? 'flora_rock_b' : 'flora_rock_a';
  const modelClone = assets?.cloneModel(key);
  if (modelClone) return modelClone;

  const group = new THREE.Group();
  const col = planet.rockColor || new THREE.Color(0.55, 0.5, 0.45);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0.05 });
  const count = variant === 'b' ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const r = 0.4 + Math.random() * 0.8;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), mat);
    rock.position.set((Math.random()-0.5)*1.8, r*0.5, (Math.random()-0.5)*1.8);
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    group.add(rock);
  }
  return group;
}

const FLORA_BUILDERS = [
  (p) => buildTallAlienTree(p),
  (p) => buildCrystalFormation(p),
  (p) => buildMushroomGiant(p),
  (p) => buildSpinePlant(p),
  (p) => buildFloatingOrb(p),
  (p) => buildGroundFern(p),
  (p) => buildCactus(p),
  (p) => buildRockFormation(p, 'a'),
  (p) => buildRockFormation(p, 'b'),
];

export class FloraManager {
  constructor(scene, planet) {
    this.scene = scene;
    this.planet = planet;
    this._chunkFlora = new Map();
    this._windTime = 0;
    this._instances = new Map();
  }

  spawnForChunk(cx, cz, chunkSize, getHeightAt, getBiomeAt, rng) {
    const key = `${cx},${cz}`;
    if (this._chunkFlora.has(key)) return;
    const flora = [];
    const density = this.planet.floraDensity || 0.5;
    if (density <= 0) { this._chunkFlora.set(key, flora); return; }
    const count = Math.floor(density * 30 * rng());
    const originX = cx * chunkSize;
    const originZ = cz * chunkSize;

    for (let i = 0; i < count; i++) {
      const lx = (rng()-0.5)*chunkSize;
      const lz = (rng()-0.5)*chunkSize;
      const wx = originX + lx;
      const wz = originZ + lz;
      const biome = getBiomeAt(wx, wz);
      if (biome.type === 'SNOW' || biome.type === 'BEACH') continue;
      const h = biome.height;
      const wl = this.planet.waterLevel != null ? this.planet.waterLevel : 10;
      if (h < wl + 1) continue;

      const typeIdx = Math.floor(rng() * FLORA_BUILDERS.length);
      const group = FLORA_BUILDERS[typeIdx](this.planet);
      const scale = 0.5 + rng() * 1.5;
      group.scale.setScalar(scale);
      group.position.set(wx, h, wz);
      group.rotation.y = rng() * Math.PI * 2;
      this.scene.add(group);
      flora.push(group);
    }
    this._chunkFlora.set(key, flora);
  }

  removeForChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const flora = this._chunkFlora.get(key);
    if (!flora) return;
    for (const g of flora) {
      this.scene.remove(g);
      g.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
    this._chunkFlora.delete(key);
  }

  update(dt, windTime) {
    this._windTime += dt;
    const t = this._windTime;
    const windAngle = t * 0.15;
    const windX = Math.cos(windAngle);
    const windZ = Math.sin(windAngle);
    const windStr = 0.25 + Math.sin(t * 0.5) * 0.15;
    for (const [, flora] of this._chunkFlora) {
      for (const g of flora) {
        g.traverse(obj => {
          if (obj.material?.uniforms) {
            if (obj.material.uniforms.uTime)         obj.material.uniforms.uTime.value = t;
            if (obj.material.uniforms.uWindDir)      obj.material.uniforms.uWindDir.value.set(windX, 0, windZ);
            if (obj.material.uniforms.uWindStrength) obj.material.uniforms.uWindStrength.value = windStr;
            if (obj.material.uniforms.uSunDir)       obj.material.uniforms.uSunDir.value.set(0.4, 0.8, 0.3);
          }
        });
      }
    }
  }

  dispose() {
    for (const [key] of this._chunkFlora) {
      const [cx, cz] = key.split(',').map(Number);
      this.removeForChunk(cx, cz);
    }
  }
}

