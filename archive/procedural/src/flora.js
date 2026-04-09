/**
 * src/flora.js
 */
import * as THREE from 'three';
import { FloraShader } from './shaders.js';

const MAX_INSTANCES = 500;

function buildTallAlienTree(planet) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.7, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0x553300 })
  );
  trunk.position.y = 2;
  group.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cr = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 + i * 0.3, 8, 6),
      new THREE.MeshLambertMaterial({ color: planet.vegetationColor || new THREE.Color(0.2,0.6,0.2) })
    );
    cr.position.set(Math.cos(i*2.1)*0.8, 4.5 + i*0.5, Math.sin(i*2.1)*0.8);
    group.add(cr);
  }
  return group;
}

function buildCrystalFormation(planet) {
  const group = new THREE.Group();
  const col = planet.rockColor || new THREE.Color(0.5, 0.3, 0.8);
  const count = 3 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const h = 1 + Math.random() * 3;
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, h, 5),
      new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, shininess: 100 })
    );
    mesh.position.set((Math.random()-0.5)*1.5, h/2, (Math.random()-0.5)*1.5);
    mesh.rotation.z = (Math.random()-0.5)*0.4;
    group.add(mesh);
  }
  const cap = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4, 1),
    new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 })
  );
  cap.position.y = 3.5;
  group.add(cap);
  return group;
}

function buildMushroomGiant(planet) {
  const group = new THREE.Group();
  const capCol = planet.vegetationColor || new THREE.Color(0.7, 0.3, 0.2);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.6, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0xccbbaa })
  );
  stem.position.y = 1.5;
  group.add(stem);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI*2, 0, Math.PI*0.5),
    new THREE.MeshLambertMaterial({
      color: capCol, emissive: capCol, emissiveIntensity: 0.2, side: THREE.DoubleSide
    })
  );
  cap.position.y = 3.2;
  group.add(cap);
  return group;
}

function buildSpinePlant(planet) {
  const group = new THREE.Group();
  const col = planet.vegetationColor || new THREE.Color(0.3, 0.7, 0.4);
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshLambertMaterial({ color: col })
  );
  center.position.y = 0.8;
  group.add(center);
  for (let i = 0; i < 12; i++) {
    const angle = (i/12)*Math.PI*2;
    const h = 0.5 + Math.random()*2;
    const spine = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, h, 4),
      new THREE.MeshLambertMaterial({ color: col })
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
    new THREE.SphereGeometry(0.8, 12, 12),
    new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 })
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
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 1.5),
      new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 })
    );
    leaf.position.set(Math.cos(i*1.05)*0.5, 0.75, Math.sin(i*1.05)*0.5);
    leaf.rotation.y = i*1.05;
    leaf.rotation.z = 0.4;
    group.add(leaf);
  }
  return group;
}

const FLORA_BUILDERS = [
  buildTallAlienTree,
  buildCrystalFormation,
  buildMushroomGiant,
  buildSpinePlant,
  buildFloatingOrb,
  buildGroundFern
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
      g.traverse(c => { if(c.geometry) c.geometry.dispose(); });
    }
    this._chunkFlora.delete(key);
  }

  update(dt, windTime) {
    this._windTime += dt;
  }

  dispose() {
    for (const [key] of this._chunkFlora) {
      const [cx, cz] = key.split(',').map(Number);
      this.removeForChunk(cx, cz);
    }
  }
}
