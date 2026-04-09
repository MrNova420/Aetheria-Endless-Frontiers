/**
 * src/creatures.js
 * Procedural genome-based alien fauna.
 * Each creature is built from basic Three.js geometry – no external assets needed.
 */
import * as THREE from 'three';

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

// ─── Genome generation ────────────────────────────────────────────────────────
function generateGenome(seed) {
  const r = seededRng(seed);
  const legCounts = [2, 4, 4, 6, 6, 0]; // 0 = slitherer
  return {
    seed,
    bodySize     : 0.4 + r() * 1.2,
    legCount     : legCounts[Math.floor(r() * legCounts.length)],
    bodyColor    : new THREE.Color().setHSL(r(), 0.5 + r() * 0.4, 0.3 + r() * 0.35),
    patternColor : new THREE.Color().setHSL(r(), 0.6 + r() * 0.3, 0.5 + r() * 0.3),
    headShape    : Math.floor(r() * 3), // 0=sphere 1=box 2=cone
    tailLength   : r() * 2.5,
    hornCount    : Math.floor(r() * 4),
    isBiolum     : r() < 0.25,
    speed        : 2 + r() * 6,
    aggression   : r() < 0.2 ? 'hostile' : r() < 0.5 ? 'curious' : 'passive',
    maxHp        : 30 + Math.floor(r() * 120),
    scale        : 0.6 + r() * 1.8,
    eyeCount     : 1 + Math.floor(r() * 4),
    wingCount    : r() < 0.15 ? 2 : 0,
  };
}

// ─── Build creature mesh from genome ─────────────────────────────────────────
function buildCreatureMesh(genome) {
  const root  = new THREE.Group();
  const bs    = genome.bodySize;
  const bMat  = new THREE.MeshLambertMaterial({ color: genome.bodyColor });
  const eMat  = new THREE.MeshLambertMaterial({
    color   : genome.isBiolum ? genome.patternColor : genome.bodyColor,
    emissive: genome.isBiolum ? genome.patternColor : new THREE.Color(0, 0, 0),
    emissiveIntensity: genome.isBiolum ? 0.6 : 0,
  });

  // Body
  const bodyGeo = new THREE.SphereGeometry(bs, 10, 8);
  bodyGeo.scale(1.4, 1.0, 1.0);
  const body = new THREE.Mesh(bodyGeo, bMat);
  body.position.y = bs * genome.scale;
  body.castShadow = true;
  root.add(body);

  // Head
  let headGeo;
  if (genome.headShape === 1) headGeo = new THREE.BoxGeometry(bs * 0.7, bs * 0.6, bs * 0.7);
  else if (genome.headShape === 2) headGeo = new THREE.ConeGeometry(bs * 0.4, bs * 0.8, 8);
  else headGeo = new THREE.SphereGeometry(bs * 0.55, 8, 6);
  const head = new THREE.Mesh(headGeo, bMat);
  head.position.set(bs * 1.3, bs * genome.scale + bs * 0.4, 0);
  head.castShadow = true;
  root.add(head);

  // Eyes
  for (let e = 0; e < genome.eyeCount; e++) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(bs * 0.12, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 })
    );
    const a = (e / genome.eyeCount) * Math.PI - Math.PI / 2;
    eye.position.set(
      head.position.x + bs * 0.35,
      head.position.y + Math.sin(a) * bs * 0.2,
      Math.cos(a) * bs * 0.35
    );
    root.add(eye);
  }

  // Horns
  for (let h = 0; h < genome.hornCount; h++) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(bs * 0.08, bs * 0.5, 5),
      new THREE.MeshLambertMaterial({ color: genome.patternColor })
    );
    const a = (h / genome.hornCount) * Math.PI * 2;
    horn.position.set(
      head.position.x + Math.cos(a) * bs * 0.3,
      head.position.y + bs * 0.6,
      Math.sin(a) * bs * 0.3
    );
    root.add(horn);
  }

  // Legs
  const legs = [];
  if (genome.legCount > 0) {
    const legLen  = bs * 1.0;
    const halfLeg = legLen / 2;
    for (let l = 0; l < genome.legCount; l++) {
      const side = l % 2 === 0 ? 1 : -1;
      const zOff = ((l >> 1) / (genome.legCount / 2) - 0.5) * bs * 2;
      const leg  = new THREE.Group();
      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(bs * 0.1, bs * 0.09, halfLeg, 6),
        bMat
      );
      upper.position.y = -halfLeg / 2;
      const lower = new THREE.Mesh(
        new THREE.CylinderGeometry(bs * 0.09, bs * 0.07, halfLeg, 6),
        bMat
      );
      lower.position.y = -halfLeg;
      upper.add(lower);
      leg.add(upper);
      leg.position.set(side * bs * 0.7, bs * genome.scale, zOff);
      root.add(leg);
      legs.push({ group: leg, side, phase: (l / genome.legCount) * Math.PI * 2 });
    }
  }

  // Tail
  if (genome.tailLength > 0.2) {
    const segments = 4;
    let parent = body;
    for (let t = 0; t < segments; t++) {
      const r = bs * (0.15 - t * 0.02);
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.04, r), 6, 5),
        t % 2 === 0 ? bMat : eMat
      );
      seg.position.set(-bs * 0.6 - t * bs * 0.35, 0, 0);
      parent.add(seg);
      parent = seg;
    }
  }

  // Wings
  if (genome.wingCount > 0) {
    for (let w = 0; w < 2; w++) {
      const wing = new THREE.Mesh(
        new THREE.PlaneGeometry(bs * 2, bs * 1.2),
        new THREE.MeshLambertMaterial({
          color: genome.patternColor, side: THREE.DoubleSide,
          transparent: true, opacity: 0.7
        })
      );
      wing.position.set(0, bs * genome.scale + bs * 0.3, (w === 0 ? 1 : -1) * bs);
      wing.rotation.z = w === 0 ? 0.4 : -0.4;
      root.add(wing);
    }
  }

  root.scale.setScalar(genome.scale);
  root._legs = legs;
  root._body = body;
  root._bs   = bs;
  return root;
}

// ─── Creature class ───────────────────────────────────────────────────────────
export const CREATURE_STATE = { IDLE: 0, WANDERING: 1, FLEEING: 2, ATTACKING: 3, DEAD: 4 };
const STATE = CREATURE_STATE;

class Creature {
  constructor(scene, position, genome) {
    this.scene   = scene;
    this.genome  = genome;
    this.hp      = genome.maxHp;
    this.state   = STATE.IDLE;
    this._stateTimer = 2 + Math.random() * 3;
    this._walkTime   = 0;
    this._velocity   = new THREE.Vector3();
    this._target     = null;
    this._wanderDir  = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();

    this.mesh = buildCreatureMesh(genome);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);
  }

  update(dt, playerPos, getHeightAt) {
    if (this.state === STATE.DEAD) return;

    this._stateTimer -= dt;
    const pos = this.mesh.position;

    // State transitions
    if (this._stateTimer <= 0) {
      const distToPlayer = pos.distanceTo(playerPos);
      if (this.genome.aggression === 'hostile' && distToPlayer < 20) {
        this.state = STATE.ATTACKING;
        this._stateTimer = 3;
      } else if (this.genome.aggression === 'curious' && distToPlayer < 15) {
        this.state = STATE.WANDERING;
        this._wanderDir.subVectors(playerPos, pos).setY(0).normalize();
        this._stateTimer = 2;
      } else if (distToPlayer < 10) {
        this.state = STATE.FLEEING;
        this._wanderDir.subVectors(pos, playerPos).setY(0).normalize();
        this._stateTimer = 4;
      } else {
        this.state = STATE.WANDERING;
        this._wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        this._stateTimer = 2 + Math.random() * 4;
        if (Math.random() < 0.3) this.state = STATE.IDLE;
      }
    }

    // Movement
    let speed = 0;
    if (this.state === STATE.WANDERING) speed = this.genome.speed * 0.5;
    else if (this.state === STATE.FLEEING) speed = this.genome.speed;
    else if (this.state === STATE.ATTACKING) {
      this._wanderDir.subVectors(playerPos, pos).setY(0).normalize();
      speed = this.genome.speed * 0.8;
    }

    if (speed > 0) {
      pos.x += this._wanderDir.x * speed * dt;
      pos.z += this._wanderDir.z * speed * dt;
      // Face direction of movement
      this.mesh.rotation.y = Math.atan2(this._wanderDir.x, this._wanderDir.z);
    }

    // Stick to terrain
    if (getHeightAt) {
      const groundY = getHeightAt(pos.x, pos.z);
      pos.y = groundY;
    }

    // Leg walk animation
    this._walkTime += dt * speed * 0.5;
    if (this.mesh._legs) {
      for (const leg of this.mesh._legs) {
        leg.group.rotation.x = Math.sin(this._walkTime + leg.phase) * 0.5;
      }
    }

    // Body bob
    if (this.mesh._body) {
      this.mesh._body.position.y = this.genome.bodySize * this.genome.scale +
        Math.abs(Math.sin(this._walkTime * 2)) * 0.1;
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.die();
    else {
      this.state = STATE.FLEEING;
      this._stateTimer = 5;
    }
    return this.hp <= 0;
  }

  die() {
    this.state = STATE.DEAD;
    // Fall over
    this.mesh.rotation.z = Math.PI / 2;
    setTimeout(() => {
      this.scene.remove(this.mesh);
      this.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    }, 3000);
  }

  getPosition() { return this.mesh.position; }
  isAlive()     { return this.state !== STATE.DEAD; }
  isDead()      { return this.state === STATE.DEAD; }
}

// ─── Manager ──────────────────────────────────────────────────────────────────
export class CreatureManager {
  constructor(scene, planet) {
    this.scene   = scene;
    this.planet  = planet;
    this._chunks = new Map();   // key → Creature[]
    this._all    = [];
  }

  spawnForChunk(cx, cz, getHeightAt, rng) {
    const key     = `${cx},${cz}`;
    if (this._chunks.has(key)) return;
    const creatures = [];
    const density   = this.planet.faunaDensity || 0;
    if (density <= 0) { this._chunks.set(key, creatures); return; }
    const count = Math.floor(rng() * density * 8);
    const originX = cx * 192, originZ = cz * 192;

    for (let i = 0; i < count; i++) {
      const wx = originX + (rng() - 0.5) * 192;
      const wz = originZ + (rng() - 0.5) * 192;
      const wy = getHeightAt(wx, wz);
      if (wy < (this.planet.waterLevel || 0) + 1) continue;
      const seed    = Math.floor(rng() * 0xFFFFFF) ^ (cx * 397 + cz * 113 + i * 7);
      const genome  = generateGenome(seed);
      const pos     = new THREE.Vector3(wx, wy, wz);
      const cr      = new Creature(this.scene, pos, genome);
      creatures.push(cr);
      this._all.push(cr);
    }
    this._chunks.set(key, creatures);
  }

  removeForChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const list = this._chunks.get(key);
    if (!list) return;
    for (const cr of list) {
      this.scene.remove(cr.mesh);
      cr.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    }
    this._all = this._all.filter(c => !list.includes(c));
    this._chunks.delete(key);
  }

  update(dt, playerPos, getHeightAt) {
    for (const cr of this._all) {
      if (cr.isAlive()) cr.update(dt, playerPos, getHeightAt);
    }
    // Clean dead
    this._all = this._all.filter(c => c.isAlive());
  }

  getNearbyCreatures(pos, radius) {
    return this._all.filter(c => c.isAlive() && c.getPosition().distanceTo(pos) <= radius);
  }

  dispose() {
    for (const [key] of this._chunks) {
      const [cx, cz] = key.split(',').map(Number);
      this.removeForChunk(cx, cz);
    }
  }
}
