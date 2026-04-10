/**
 * src/creatures.js
 * Procedural genome-based alien fauna.
 * Each creature is built from basic Three.js geometry – no external assets needed.
 */
import * as THREE from 'three';
import { PhysicsBody, PHYSICS } from './physics.js';

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

  // PBR body material — rougher for big beasts, shinier for exotic
  const roughness = genome.isBoss ? 0.55 : (genome.isBiolum ? 0.30 : 0.70);
  const metalness = genome.isBoss ? 0.25 : (genome.isBiolum ? 0.10 : 0.05);

  const bMat = new THREE.MeshStandardMaterial({
    color     : genome.bodyColor,
    roughness, metalness,
  });
  const eMat = new THREE.MeshStandardMaterial({
    color             : genome.isBiolum ? genome.patternColor : genome.bodyColor,
    emissive          : genome.isBiolum ? new THREE.Color(genome.patternColor) : new THREE.Color(0x000000),
    emissiveIntensity : genome.isBiolum ? 1.4 : (genome.isBoss ? 0.5 : 0),
    roughness         : roughness * 0.7,
    metalness         : metalness,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(genome.eyeCount > 2 ? genome.patternColor : 0xffffff),
    emissiveIntensity: genome.isBoss ? 2.5 : 1.2,
    roughness: 0.05, metalness: 0.0,
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
      eyeMat
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
      new THREE.MeshStandardMaterial({ color: genome.patternColor, roughness: 0.4, metalness: 0.1 })
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
        new THREE.MeshStandardMaterial({
          color: genome.patternColor, side: THREE.DoubleSide,
          transparent: true, opacity: 0.72,
          roughness: 0.5, metalness: 0.0,
          emissive: genome.isBiolum ? new THREE.Color(genome.patternColor) : new THREE.Color(0x000000),
          emissiveIntensity: genome.isBiolum ? 0.4 : 0,
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

// ─── Boss genome ─────────────────────────────────────────────────────────────
function generateBossGenome(seed, planetType) {
  const r      = seededRng(seed);
  const base   = generateGenome(seed);
  const TINTS  = {
    LUSH:'#22aa44', BARREN:'#cc8833', TOXIC:'#88ff00', FROZEN:'#88ccff',
    BURNING:'#ff4400', EXOTIC:'#dd44ff', DEAD:'#888888', OCEAN:'#2244ff'
  };
  const tint = new THREE.Color(TINTS[planetType] || '#ff4400');
  return {
    ...base,
    isBoss       : true,
    scale        : 3.0 + r() * 1.5,
    bodySize     : 1.4,
    aggression   : 'hostile',
    maxHp        : 500 + Math.floor(r() * 500),
    speed        : 3 + r() * 4,
    bodyColor    : tint.clone().multiplyScalar(0.6),
    patternColor : tint,
    hornCount    : 3 + Math.floor(r() * 3),
    isBiolum     : true,
    wingCount    : r() < 0.4 ? 2 : 0,
  };
}

// ─── Biome palette tinting ────────────────────────────────────────────────────
const BIOME_TINTS = {
  LUSH   : { h: 0.35, s: 0.5 },
  BARREN : { h: 0.08, s: 0.4 },
  TOXIC  : { h: 0.25, s: 0.7 },
  FROZEN : { h: 0.60, s: 0.4 },
  BURNING: { h: 0.04, s: 0.7 },
  EXOTIC : { h: 0.78, s: 0.6 },
  DEAD   : { h: 0.00, s: 0.0 },
  OCEAN  : { h: 0.62, s: 0.5 },
};

function tintGenomeForBiome(genome, planetType) {
  const bt = BIOME_TINTS[planetType];
  if (!bt) return genome;
  const blended = genome.bodyColor.clone();
  const orig = { h: 0, s: 0, l: 0 };
  blended.getHSL(orig);
  // Lerp hue and saturation toward biome tint
  blended.setHSL(
    orig.h * 0.5 + bt.h * 0.5,
    Math.min(1, orig.s * 0.5 + bt.s * 0.5),
    orig.l
  );
  return { ...genome, bodyColor: blended };
}

// ─── Creature class ───────────────────────────────────────────────────────────
/**
 * State machine for creature AI.
 * PATROL  : slow wander along waypoints, low alert
 * ALERT   : detected player, orienting + calling pack
 * CHASE   : actively pursuing player
 * ATTACK  : within melee range, striking
 * RECOIL  : brief pause after striking (recovery frames)
 * FLEE    : retreating (passive/injured hostile)
 * DEAD    : corpse fade-out
 */
export const CREATURE_STATE = { PATROL:0, ALERT:1, CHASE:2, ATTACK:3, RECOIL:4, FLEE:5, DEAD:6 };
/** Back-compat alias */
export const CREATURE_STATE_LEGACY = {
  IDLE:0, WANDERING:0, FLEEING:5, ATTACKING:2, DEAD:6
};
const STATE = CREATURE_STATE;

/** Detection and behaviour radii per aggression type. */
const AI_PARAMS = {
  hostile: { detectR:28, alertR:18, attackR:2.2, fleeHpPct:0.18, packCallR:20, chargeR:12 },
  curious: { detectR:20, alertR:12, attackR:3.0, fleeHpPct:0.0,  packCallR:0,  chargeR:0  },
  passive: { detectR:12, alertR:0,  attackR:0,   fleeHpPct:1.0,  packCallR:0,  chargeR:0  },
};

class Creature {
  constructor(scene, position, genome) {
    this.scene   = scene;
    this.genome  = genome;
    this.hp      = genome.maxHp;
    this.state   = STATE.PATROL;
    this._stateTimer  = 1.5 + Math.random() * 2;
    this._attackTimer = 0;
    this._recoilTimer = 0;
    this._alertTimer  = 0;
    this._walkTime    = 0;
    this._flashTimer  = 0;

    // Physics body for proper gravity + separation
    this._body = new PhysicsBody({
      position: position.clone(),
      mass: genome.mass ?? 60,
      radius: PHYSICS.CREATURE_RADIUS * (genome.scale ?? 1),
      height: genome.bodySize * 2 * (genome.scale ?? 1),
    });
    this._body.grounded = false;

    this._velocity   = this._body.velocity;   // alias
    this._wanderDir  = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
    this._patrolWaypoints = this._genWaypoints(position);
    this._waypointIdx = 0;
    this._target     = null;   // player position (Vector3)
    this._removed    = false;

    // Pack reference (set by CreatureManager)
    this.packId = null;

    this.mesh = buildCreatureMesh(genome);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);
  }

  _genWaypoints(origin) {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
      const r = 8 + Math.random() * 20;
      pts.push(new THREE.Vector3(
        origin.x + Math.cos(angle) * r,
        origin.y,
        origin.z + Math.sin(angle) * r,
      ));
    }
    return pts;
  }

  update(dt, playerPos, getHeightAt, pack) {
    if (this.state === STATE.DEAD) {
      this._dieTimer = (this._dieTimer || 0) + dt;
      if (this._dieTimer >= 3.0 && !this._removed) {
        this._removed = true;
        this.scene.remove(this.mesh);
        this.mesh.traverse(c => {
          if (c.geometry) c.geometry.dispose();
          if (c.material)  c.material.dispose();
        });
      }
      return;
    }

    const pos    = this._body.position;
    const vel    = this._body.velocity;
    const params = AI_PARAMS[this.genome.aggression] || AI_PARAMS.passive;
    const dist   = pos.distanceTo(playerPos);
    const gravity= 22; // simplified – could use planet gravity

    // ── Timers ────────────────────────────────────────────────────────────
    this._stateTimer  -= dt;
    this._attackTimer -= dt;
    this._recoilTimer -= dt;

    // ── State transitions ────────────────────────────────────────────────
    if (this.state !== STATE.DEAD) {
      this._updateStateTransition(dist, params, playerPos, pack);
    }

    // ── Movement ─────────────────────────────────────────────────────────
    let targetSpeed = 0;
    let moveDir = new THREE.Vector3();

    switch (this.state) {
      case STATE.PATROL: {
        if (this._patrolWaypoints.length) {
          const wp = this._patrolWaypoints[this._waypointIdx];
          const toWp = new THREE.Vector3().subVectors(wp, pos).setY(0);
          if (toWp.length() < 2) {
            this._waypointIdx = (this._waypointIdx + 1) % this._patrolWaypoints.length;
          } else {
            moveDir.copy(toWp).normalize();
          }
        }
        targetSpeed = this.genome.speed * 0.3;
        break;
      }
      case STATE.ALERT: {
        // Face player, brief pause (alerting)
        moveDir.subVectors(playerPos, pos).setY(0).normalize();
        targetSpeed = 0;  // stationary but watching
        this._alertTimer += dt;
        if (this._alertTimer > 1.2) this.state = STATE.CHASE;
        break;
      }
      case STATE.CHASE: {
        moveDir.subVectors(playerPos, pos).setY(0);
        const flatDist = moveDir.length();
        if (flatDist > 0.1) moveDir.normalize();
        targetSpeed = this.genome.speed * 1.0;
        // Boss charge: if within chargeR, dash at 2× speed
        if (this.genome.isBoss && dist < params.chargeR && this._stateTimer <= 0) {
          targetSpeed = this.genome.speed * 2.0;
        }
        break;
      }
      case STATE.ATTACK: {
        // Hold position near player
        moveDir.subVectors(playerPos, pos).setY(0).normalize();
        targetSpeed = 0.5;
        // Strike on timer
        if (this._attackTimer <= 0 && dist < params.attackR + 0.5) {
          this._attackTimer = this.genome.attackCooldown ?? 1.2;
          this._recoilTimer = 0.25;
          this.state = STATE.RECOIL;
          // Signal a hit (game.js detects via creature.pendingDamage)
          this.pendingDamage = this.genome.damage ?? 10;
        }
        break;
      }
      case STATE.RECOIL: {
        // Brief stumble-back
        moveDir.subVectors(pos, playerPos).setY(0).normalize();
        targetSpeed = this.genome.speed * 0.4;
        if (this._recoilTimer <= 0) {
          this.state = dist < params.attackR + 1 ? STATE.ATTACK : STATE.CHASE;
        }
        break;
      }
      case STATE.FLEE: {
        moveDir.subVectors(pos, playerPos).setY(0).normalize();
        // Flee to random direction mixed with away-from-player
        const rand = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
        moveDir.lerp(rand, 0.3).normalize();
        targetSpeed = this.genome.speed * 1.1;
        // Recover after fleeing far enough
        if (dist > 30) this.state = STATE.PATROL;
        break;
      }
    }

    // ── Acceleration toward target speed ─────────────────────────────────
    if (moveDir.lengthSq() > 0) {
      const targetVx = moveDir.x * targetSpeed;
      const targetVz = moveDir.z * targetSpeed;
      const accel = this._body.grounded ? PHYSICS.ACCEL_GROUND * 0.5 : PHYSICS.ACCEL_AIR * 0.3;
      vel.x += (targetVx - vel.x) * Math.min(accel * dt, 1);
      vel.z += (targetVz - vel.z) * Math.min(accel * dt, 1);
      if (targetSpeed > 0.1) {
        this.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
      }
    }

    // ── Physics: gravity + terrain ────────────────────────────────────────
    if (!this._body.grounded) {
      vel.y -= gravity * dt;
      if (vel.y < PHYSICS.TERMINAL_VELOCITY) vel.y = PHYSICS.TERMINAL_VELOCITY;
    }
    // Friction
    {
      const f = Math.pow(this._body.friction, dt * 60);
      vel.x *= f; vel.z *= f;
    }
    // Integrate
    pos.addScaledVector(vel, dt);

    // Terrain snap + slope check
    if (getHeightAt) {
      const groundY = getHeightAt(pos.x, pos.z);
      if (pos.y <= groundY + PHYSICS.STEP_HEIGHT * 0.5) {
        if (vel.y < 0) vel.y = 0;
        pos.y = groundY;
        this._body.grounded = true;
      } else {
        this._body.grounded = false;
      }
    }

    // Sync mesh
    this.mesh.position.copy(pos);

    // ── Walk animation ────────────────────────────────────────────────────
    const spd = Math.sqrt(vel.x*vel.x + vel.z*vel.z);
    this._walkTime += dt * spd * 0.5;
    if (this.mesh._legs) {
      for (const leg of this.mesh._legs) {
        leg.group.rotation.x = Math.sin(this._walkTime + leg.phase) * 0.5;
      }
    }
    if (this.mesh._body) {
      this.mesh._body.position.y = this.genome.bodySize * (this.genome.scale ?? 1) +
        Math.abs(Math.sin(this._walkTime * 2)) * 0.06;
    }

    // ── Damage flash ─────────────────────────────────────────────────────
    this._updateFlash(dt);
  }

  _updateStateTransition(dist, params, playerPos, pack) {
    switch (this.state) {
      case STATE.PATROL:
        if (this.genome.aggression === 'hostile' && dist < params.detectR) {
          this.state = STATE.ALERT;
          this._alertTimer = 0;
          this._stateTimer = 1.5;
          // Alert pack
          if (pack && params.packCallR > 0) {
            for (const c of pack) {
              if (c !== this && c.state === STATE.PATROL &&
                  c.mesh.position.distanceTo(this.mesh.position) < params.packCallR) {
                c.state = STATE.CHASE;
                c._stateTimer = 5;
              }
            }
          }
        } else if (this.genome.aggression === 'passive' && dist < params.detectR) {
          this.state = STATE.FLEE;
        } else if (this.genome.aggression === 'curious' && dist < params.detectR) {
          this.state = STATE.CHASE; // approach curiously
        }
        break;
      case STATE.ALERT:
        if (dist > params.detectR * 1.4) this.state = STATE.PATROL;
        break;
      case STATE.CHASE:
        if (dist < params.attackR) { this.state = STATE.ATTACK; this._attackTimer = 0.3; }
        else if (dist > params.detectR * 1.8) this.state = STATE.PATROL;
        // Flee if low hp
        if ((this.hp / this.genome.maxHp) < params.fleeHpPct) this.state = STATE.FLEE;
        break;
      case STATE.ATTACK:
        if (dist > params.attackR + 1.5) this.state = STATE.CHASE;
        if ((this.hp / this.genome.maxHp) < params.fleeHpPct) this.state = STATE.FLEE;
        break;
      case STATE.FLEE:
        if (dist > 35) { this.state = STATE.PATROL; this._stateTimer = 3; }
        break;
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.die();
    } else {
      if (this.genome.aggression === 'hostile' && this.state !== STATE.CHASE && this.state !== STATE.ATTACK) {
        this.state = STATE.CHASE;
        this._stateTimer = 5;
      } else if (this.genome.aggression === 'passive') {
        this.state = STATE.FLEE;
      }
      this._flashTimer = 0.18;
    }
    return this.hp <= 0;
  }

  _updateFlash(dt) {
    if (this._flashTimer <= 0) return;
    this._flashTimer -= dt;
    const flash = this._flashTimer > 0;
    this.mesh.traverse(c => {
      if (c.isMesh && c.material) {
        if (flash) {
          if (!c.material._origColor) c.material._origColor = c.material.color.clone();
          c.material.color.set(0xff2222);
          if (c.material.emissive) c.material.emissive.set(0xff0000);
        } else {
          if (c.material._origColor) c.material.color.copy(c.material._origColor);
          if (c.material.emissive)   c.material.emissive.set(0x000000);
          c.material._origColor = null;
        }
      }
    });
  }

  die() {
    this.state = STATE.DEAD;
    this._dieTimer = 0;
    this._removed  = false;
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.traverse(c => {
      if (c.isMesh && c.material) {
        c.material.color?.set(0x444444);
        if (c.material.emissive) c.material.emissive.set(0x000000);
      }
    });
  }

  getPosition() { return this._body.position.clone(); }
  isAlive()     { return this.state !== STATE.DEAD; }
  isDead()      { return this.state === STATE.DEAD; }
  isBoss()      { return !!this.genome.isBoss; }
  getHpPct()    { return this.hp / this.genome.maxHp; }
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
      let genome    = generateGenome(seed);
      genome        = tintGenomeForBiome(genome, this.planet.type);
      const pos     = new THREE.Vector3(wx, wy, wz);
      const cr      = new Creature(this.scene, pos, genome);
      creatures.push(cr);
      this._all.push(cr);
    }

    // Rare boss spawn (5% chance per chunk, once per chunk)
    if (rng() < 0.05 && density > 0) {
      const bx  = originX + (rng() - 0.5) * 150;
      const bz  = originZ + (rng() - 0.5) * 150;
      const by  = getHeightAt(bx, bz);
      if (by >= (this.planet.waterLevel || 0) + 1) {
        const bseed  = Math.floor(rng() * 0xFFFFFF) ^ (cx * 1999 + cz * 3571);
        const bgenome = generateBossGenome(bseed, this.planet.type);
        const boss   = new Creature(this.scene, new THREE.Vector3(bx, by, bz), bgenome);
        creatures.push(boss);
        this._all.push(boss);
      }
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
    // Assign pack IDs on first group of close hostiles
    const hostile = this._all.filter(c => c.isAlive() && c.genome.aggression === 'hostile');

    // Separation between all alive creatures (sphere push)
    for (let i = 0; i < this._all.length; i++) {
      const a = this._all[i];
      if (!a.isAlive()) continue;
      for (let j = i + 1; j < this._all.length; j++) {
        const b = this._all[j];
        if (!b.isAlive()) continue;
        const dx = a._body.position.x - b._body.position.x;
        const dz = a._body.position.z - b._body.position.z;
        const dist2 = dx*dx + dz*dz;
        const minD  = (a._body.radius + b._body.radius);
        if (dist2 < minD * minD && dist2 > 0.001) {
          const d = Math.sqrt(dist2);
          const overlap = minD - d;
          const nx = dx / d, nz = dz / d;
          const half = overlap * 0.5;
          a._body.position.x += nx * half;
          a._body.position.z += nz * half;
          b._body.position.x -= nx * half;
          b._body.position.z -= nz * half;
        }
      }
    }

    for (const cr of this._all) {
      cr.update(dt, playerPos, getHeightAt, hostile);
    }
    // Clean fully-removed corpses
    this._all = this._all.filter(c => !c._removed);
  }

  /** Drain any pending melee hits; returns array of {damage, creature} */
  drainPendingHits() {
    const hits = [];
    for (const cr of this._all) {
      if (cr.pendingDamage != null) {
        hits.push({ damage: cr.pendingDamage, creature: cr });
        cr.pendingDamage = null;
      }
    }
    return hits;
  }

  getNearbyCreatures(pos, radius) {
    return this._all.filter(c => c.isAlive() && c.getPosition().distanceTo(pos) <= radius);
  }

  getNearestBoss(pos, radius = 60) {
    const bosses = this._all.filter(c => c.isAlive() && c.isBoss() && c.getPosition().distanceTo(pos) <= radius);
    if (!bosses.length) return null;
    return bosses.reduce((a, b) => a.getPosition().distanceTo(pos) < b.getPosition().distanceTo(pos) ? a : b);
  }

  dispose() {
    for (const [key] of this._chunks) {
      const [cx, cz] = key.split(',').map(Number);
      this.removeForChunk(cx, cz);
    }
  }
}
