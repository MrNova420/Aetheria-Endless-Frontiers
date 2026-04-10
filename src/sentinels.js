/**
 * src/sentinels.js  –  AETHERIA: Endless Frontiers  –  Sentinel System
 *
 * NMS-style Sentinel threat system. Wanted level rises through mining and
 * combat, falls gradually while hidden, and spawns increasingly dangerous
 * sentinel drones as it escalates.
 */
import * as THREE from 'three';

// ─── Drone state constants ────────────────────────────────────────────────────
export const DRONE_STATE = {
  PATROL: 'PATROL',
  CHASE:  'CHASE',
  ATTACK: 'ATTACK',
};

// ─── Config ───────────────────────────────────────────────────────────────────
const DRONE_HP          = { normal: 40, heavy: 80 };
const DRONE_DAMAGE      = { normal: 10, heavy: 20 };
const DRONE_ATTACK_RATE = 1.5;      // seconds between damage pulses
const HOVER_HEIGHT      = 7;        // units above terrain
const BOB_AMPLITUDE     = 0.4;
const BOB_SPEED         = 1.8;      // radians per second
const PATROL_SPEED      = 5;
const CHASE_SPEED       = 9;
const CHASE_RANGE       = 30;
const ATTACK_RANGE      = 8;
const DISENGAGE_RANGE   = 60;
const SPAWN_INTERVAL    = 3.0;      // seconds between spawn checks

const COOLDOWN_RATE = [0, 0.05, 0.05, 0.02, 0.01, 0]; // per wanted level 0-5
const DRONE_COUNTS  = [0, 1, 2, 4, 4, 4];

const HEAVY_THRESHOLD   = 4;        // wanted level at which isHeavy becomes true
const HEAVY_SCALE       = 1.8;

// ─── Drone mesh builder ───────────────────────────────────────────────────────
function buildDroneMesh(isHeavy) {
  const root = new THREE.Group();
  const scale = isHeavy ? HEAVY_SCALE : 1.0;
  root.scale.setScalar(scale);

  // Body – icosahedron
  const bodyGeo = new THREE.IcosahedronGeometry(0.55, 0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color:     isHeavy ? 0x1a0000 : 0x111111,
    metalness: 0.8,
    roughness: 0.3,
    emissive:  isHeavy ? new THREE.Color(0x440000) : new THREE.Color(0x000000),
    emissiveIntensity: isHeavy ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  root.add(body);

  // Eye – small red glowing sphere
  const eyeGeo = new THREE.SphereGeometry(0.18, 8, 6);
  const eyeMat = new THREE.MeshStandardMaterial({
    color:             0xff0000,
    emissive:          new THREE.Color(0xff0000),
    emissiveIntensity: 2.2,
    roughness:         0.05,
    metalness:         0.0,
  });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0.45, 0.1, 0);
  root.add(eye);

  // Eye glow point light
  const light = new THREE.PointLight(0xff2200, isHeavy ? 2.0 : 1.2, isHeavy ? 8 : 5);
  light.position.copy(eye.position);
  root.add(light);

  // Wings – two flat boxes
  const wingGeo = new THREE.BoxGeometry(0.12, 0.06, 0.9);
  const wingMat = new THREE.MeshStandardMaterial({
    color:     isHeavy ? 0x330000 : 0x222222,
    metalness: 0.9,
    roughness: 0.2,
  });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(0, 0, 0.7);
  root.add(wingL);

  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.set(0, 0, -0.7);
  root.add(wingR);

  return root;
}

// ─── SentinelDrone ────────────────────────────────────────────────────────────
class SentinelDrone {
  constructor(scene, spawnPos, isHeavy) {
    this.scene   = scene;
    this.isHeavy = isHeavy;
    this.hp      = isHeavy ? DRONE_HP.heavy : DRONE_HP.normal;
    this.alive   = true;
    this.state   = DRONE_STATE.PATROL;

    this._attackTimer = 0;
    this._bobTime     = Math.random() * Math.PI * 2;

    this._patrolTarget = new THREE.Vector3(
      spawnPos.x + (Math.random() - 0.5) * 40,
      spawnPos.y,
      spawnPos.z + (Math.random() - 0.5) * 40,
    );

    this.mesh = buildDroneMesh(isHeavy);
    this.mesh.position.copy(spawnPos);
    this.mesh.position.y = spawnPos.y + HOVER_HEIGHT;
    scene.add(this.mesh);

    this.position = this.mesh.position;
  }

  // Update returns the amount of damage dealt to the player this tick (0 if none)
  update(dt, playerPos, getHeight) {
    if (!this.alive) return 0;

    this._bobTime += BOB_SPEED * dt;
    const bob = Math.sin(this._bobTime) * BOB_AMPLITUDE;

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);

    // State transitions
    if (this.state === DRONE_STATE.PATROL) {
      if (distXZ < CHASE_RANGE) this.state = DRONE_STATE.CHASE;
    } else if (this.state === DRONE_STATE.CHASE) {
      if (distXZ < ATTACK_RANGE)    this.state = DRONE_STATE.ATTACK;
      else if (distXZ > DISENGAGE_RANGE) this.state = DRONE_STATE.PATROL;
    } else if (this.state === DRONE_STATE.ATTACK) {
      if (distXZ > ATTACK_RANGE)    this.state = DRONE_STATE.CHASE;
      if (distXZ > DISENGAGE_RANGE) this.state = DRONE_STATE.PATROL;
    }

    // Movement
    if (this.state === DRONE_STATE.PATROL) {
      this._doPatrol(dt, getHeight, bob);
    } else if (this.state === DRONE_STATE.CHASE) {
      this._doChase(dt, playerPos, getHeight, bob);
    } else {
      // ATTACK – hover in place near player
      this._doChase(dt, playerPos, getHeight, bob);
    }

    // Rotate to face movement direction
    if (this.state !== DRONE_STATE.PATROL) {
      const angle = Math.atan2(dx, dz);
      this.mesh.rotation.y = angle;
    }

    // Attack damage
    let damage = 0;
    if (this.state === DRONE_STATE.ATTACK) {
      this._attackTimer -= dt;
      if (this._attackTimer <= 0) {
        this._attackTimer = DRONE_ATTACK_RATE;
        damage = this.isHeavy ? DRONE_DAMAGE.heavy : DRONE_DAMAGE.normal;
      }
    }

    return damage;
  }

  _doPatrol(dt, getHeight, bob) {
    const tx = this._patrolTarget.x - this.position.x;
    const tz = this._patrolTarget.z - this.position.z;
    const dist = Math.sqrt(tx * tx + tz * tz);

    if (dist < 2) {
      this._patrolTarget.set(
        this.position.x + (Math.random() - 0.5) * 50,
        0,
        this.position.z + (Math.random() - 0.5) * 50,
      );
    } else {
      const speed = PATROL_SPEED * dt;
      this.position.x += (tx / dist) * speed;
      this.position.z += (tz / dist) * speed;
    }

    const groundY = getHeight ? getHeight(this.position.x, this.position.z) : 0;
    this.position.y = groundY + HOVER_HEIGHT + bob;
  }

  _doChase(dt, playerPos, getHeight, bob) {
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.5) {
      const speed = CHASE_SPEED * dt;
      this.position.x += (dx / dist) * Math.min(speed, dist);
      this.position.z += (dz / dist) * Math.min(speed, dist);
    }

    const groundY = getHeight ? getHeight(this.position.x, this.position.z) : 0;
    this.position.y = groundY + HOVER_HEIGHT + bob;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this._die();
      return true;
    }
    return false;
  }

  _die() {
    this.alive = false;
    if (this.scene && this.mesh) {
      this.scene.remove(this.mesh);
      this._disposeMesh(this.mesh);
    }
  }

  _disposeMesh(obj) {
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  dispose() {
    this._die();
  }
}

// ─── SentinelManager ─────────────────────────────────────────────────────────
export class SentinelManager {
  constructor(scene) {
    this._scene      = scene;
    this._wanted     = 0;
    this._drones     = [];
    this._spawnTimer = 0;
    this._alertPhase = 0;
    this._getHeight  = null;
  }

  setHeightFn(fn) {
    this._getHeight = fn;
  }

  addWanted(amount) {
    this._wanted = Math.min(5.0, this._wanted + amount);
    this._checkSpawn();
  }

  getWantedLevel() {
    return Math.floor(this._wanted);
  }

  getWantedFraction() {
    return this._wanted % 1.0;
  }

  /** @returns {{pendingDamage: number}} */
  update(dt, playerPos, getHeight) {
    const heightFn = getHeight || this._getHeight || (() => 0);

    // Cooldown
    const level = this.getWantedLevel();
    if (level < 5) {
      const alive = this._drones.filter(d => d.alive).length;
      if (alive === 0) {
        const rate = COOLDOWN_RATE[Math.min(level, 5)];
        this._wanted = Math.max(0, this._wanted - rate * dt);
      }
    }

    // Alert blink
    this._alertPhase += dt * 3.5;

    // Spawn timer
    if (this._wanted >= 0.5) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        this._spawnTimer = SPAWN_INTERVAL;
        this._checkSpawn();
      }
    }

    // Update drones
    let pendingDamage = 0;
    for (const drone of this._drones) {
      if (drone.alive && playerPos) {
        pendingDamage += drone.update(dt, playerPos, heightFn);
      }
    }

    // Prune dead drones
    this._drones = this._drones.filter(d => d.alive);

    return { pendingDamage };
  }

  hitDrone(drone, damage) {
    if (!drone || !drone.alive) return false;
    const killed = drone.takeDamage(damage);
    if (killed) {
      // Killing a sentinel drone escalates wanted
      this.addWanted(1.0);
    }
    return killed;
  }

  getNearestDrone(pos, radius) {
    let best = null;
    let bestDist = radius * radius;
    for (const drone of this._drones) {
      if (!drone.alive) continue;
      const dx = drone.position.x - pos.x;
      const dy = drone.position.y - pos.y;
      const dz = drone.position.z - pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestDist) { bestDist = d2; best = drone; }
    }
    return best;
  }

  getDrones() {
    return this._drones.filter(d => d.alive);
  }

  isActive() {
    return this._wanted >= 0.5;
  }

  getAlertFlash() {
    return (Math.sin(this._alertPhase) * 0.5 + 0.5);
  }

  clearWanted() {
    this._wanted = 0;
    for (const drone of this._drones) drone.dispose();
    this._drones = [];
  }

  dispose() {
    this.clearWanted();
    this._scene = null;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _checkSpawn() {
    const level  = this.getWantedLevel();
    const target = DRONE_COUNTS[Math.min(level, 5)];
    const alive  = this._drones.filter(d => d.alive).length;

    if (alive >= target) return;

    const isHeavy = level >= HEAVY_THRESHOLD;
    const spawn   = this._makeSpawnPos();
    const drone   = new SentinelDrone(this._scene, spawn, isHeavy);
    this._drones.push(drone);
  }

  _makeSpawnPos() {
    const angle  = Math.random() * Math.PI * 2;
    const radius = 20 + Math.random() * 15;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      (this._getHeight ? this._getHeight(Math.cos(angle) * radius, Math.sin(angle) * radius) : 0) + HOVER_HEIGHT,
      Math.sin(angle) * radius,
    );
  }
}
