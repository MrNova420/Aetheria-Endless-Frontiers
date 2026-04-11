/**
 * src/physics.js  –  Aetheria physics engine
 *
 * Provides:
 *  • PhysicsBody          – kinematic rigid body with gravity, drag, coyote time
 *  • PhysicsWorld         – world step, sphere-sphere separation, gravity wells
 *  • Projectile           – flying shot with gravity droop + hit detection
 *  • PHYSICS constants    – all tuning values in one place
 *
 * Designed to be imported by player.js, creatures.js and game.js.
 */

import * as THREE from 'three';

// ─── Tuning constants ─────────────────────────────────────────────────────────
export const PHYSICS = {
  TERMINAL_VELOCITY  : -55,    // m/s  – maximum downward speed
  AIR_DRAG_PER_SEC   : 0.88,   // exponential horizontal drag while airborne
  GROUND_FRICTION_PS : 0.72,   // exponential horizontal deceleration on ground
  SLOPE_THRESHOLD    : 0.55,   // normal.y below this → slide (cos 56°)
  SLIDE_ACCEL        : 9,      // m/s² sliding acceleration down slope
  COYOTE_TIME        : 0.14,   // seconds after leaving edge – still counts as grounded
  JUMP_BUFFER        : 0.10,   // seconds before landing – buffer a queued jump
  STEP_HEIGHT        : 0.45,   // max bump height stepped over automatically
  ACCEL_GROUND       : 60,     // m/s² – horizontal acceleration on ground
  ACCEL_AIR          : 18,     // m/s² – air control
  PROJECTILE_SPEED   : 120,    // m/s
  PROJECTILE_DROOP   : 4,      // m/s² downward gravity on shots
  PROJECTILE_LIFETIME: 3.0,    // seconds
  PROJECTILE_RADIUS  : 0.45,   // hit sphere radius
  CREATURE_RADIUS    : 0.7,    // separation sphere radius
  MIN_SEPARATION     : 0.02,   // stop resolving if overlap < this
};

// ─── PhysicsBody ─────────────────────────────────────────────────────────────
export class PhysicsBody {
  /**
   * @param {object} opts
   *   position   THREE.Vector3   initial position
   *   mass       number          kg (affects impulse response)
   *   radius     number          sphere radius for separation
   *   height     number          capsule height (for step detection)
   *   friction   number          ground friction override (default from PHYSICS)
   *   drag       number          air drag override
   *   restitution number         bounciness 0–1
   */
  constructor(opts = {}) {
    this.position    = opts.position ? opts.position.clone() : new THREE.Vector3();
    this.velocity    = new THREE.Vector3();
    this.mass        = opts.mass        ?? 80;
    this.radius      = opts.radius      ?? 0.4;
    this.height      = opts.height      ?? 1.8;
    this.friction    = opts.friction    ?? PHYSICS.GROUND_FRICTION_PS;
    this.drag        = opts.drag        ?? PHYSICS.AIR_DRAG_PER_SEC;
    this.restitution = opts.restitution ?? 0;

    this.grounded      = false;
    this._coyoteTimer  = 0;
    this._jumpBuf      = 0;    // jump buffer countdown
    this._wasGrounded  = false;
    this._groundNormal = new THREE.Vector3(0, 1, 0);
    this._slopeSliding = false;
  }

  /** Instantly change velocity by impulse / mass. */
  applyImpulse(vec) {
    this.velocity.addScaledVector(vec, 1 / this.mass);
  }

  /** True if still logically grounded (includes coyote window). */
  get isGroundedOrCoyote() {
    return this.grounded || this._coyoteTimer > 0;
  }

  /** Queue a jump for JUMP_BUFFER seconds. */
  queueJump() { this._jumpBuf = PHYSICS.JUMP_BUFFER; }
}

// ─── Projectile ───────────────────────────────────────────────────────────────
export class Projectile {
  constructor(position, direction, ownerId, speed, color) {
    this.position = position.clone();
    this.velocity = direction.clone().normalize()
                              .multiplyScalar(speed ?? PHYSICS.PROJECTILE_SPEED);
    this.lifetime = PHYSICS.PROJECTILE_LIFETIME;
    this.radius   = PHYSICS.PROJECTILE_RADIUS;
    this.ownerId  = ownerId;
    this.alive    = true;
    this.mesh     = null;
    this._col     = color ?? 0x00aaff;
  }

  buildMesh(scene) {
    const geo = new THREE.SphereGeometry(0.18, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: this._col,
      emissive: new THREE.Color(this._col),
      emissiveIntensity: 3.0,
      roughness: 0,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = false;
    this.mesh.position.copy(this.position);

    // Additive glow halo
    const gGeo = new THREE.SphereGeometry(0.4, 6, 4);
    const gMat = new THREE.MeshBasicMaterial({
      color: this._col, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh.add(new THREE.Mesh(gGeo, gMat));
    scene.add(this.mesh);
    return this.mesh;
  }

  update(dt) {
    if (!this.alive) return;
    this.position.addScaledVector(this.velocity, dt);
    this.velocity.y -= PHYSICS.PROJECTILE_DROOP * dt;
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.alive = false;
    if (this.mesh) this.mesh.position.copy(this.position);
  }

  dispose(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.mesh = null;
    }
    this.alive = false;
  }
}

// ─── GravityWell ──────────────────────────────────────────────────────────────
export class GravityWell {
  constructor(position, strength, radius) {
    this.position = position.clone();
    this.strength = strength;   // m/s² at the rim
    this.radius   = radius;
  }

  /** Compute acceleration vector for a position. Returns zero outside radius. */
  accelerationAt(pos, out = new THREE.Vector3()) {
    const delta = out.subVectors(this.position, pos);
    const dist  = delta.length();
    if (dist >= this.radius || dist < 0.1) return out.set(0, 0, 0);
    // Linear falloff (stronger when closer)
    const mag = this.strength * (1 - dist / this.radius);
    return delta.normalize().multiplyScalar(mag);
  }
}

// ─── PhysicsWorld ─────────────────────────────────────────────────────────────
export class PhysicsWorld {
  constructor() {
    this.bodies      = [];
    this.projectiles = [];
    this.gravityWells = [];
    this._gravity = 9.8;   // overridden per planet via setGravity()
    this._tmp  = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  /** Set world gravity (m/s²) — call this whenever the player lands on a new planet. */
  setGravity(g) { this._gravity = Math.max(0.5, g ?? 9.8); }

  addBody(body)    { this.bodies.push(body); return body; }
  removeBody(body) { this.bodies = this.bodies.filter(b => b !== body); }

  addGravityWell(position, strength, radius) {
    const w = new GravityWell(position, strength, radius);
    this.gravityWells.push(w);
    return w;
  }
  removeGravityWell(w) { this.gravityWells = this.gravityWells.filter(g => g !== w); }
  clearGravityWells()  { this.gravityWells = []; }

  // ─── Projectile API ────────────────────────────────────────────────────────
  /**
   * Fire a new projectile from position in direction.
   * @param {THREE.Vector3} position
   * @param {THREE.Vector3} direction  (normalised)
   * @param {string} ownerId           'player' or creature id
   * @param {THREE.Scene} scene
   * @param {number} [color]           hex colour
   * @param {number} [speed]           m/s override
   */
  fireProjectile(position, direction, ownerId, scene, color, speed) {
    const p = new Projectile(position, direction, ownerId, speed, color);
    p.buildMesh(scene);
    this.projectiles.push(p);
    return p;
  }

  /**
   * Step all projectiles and return array of hit events.
   * @param {number} dt
   * @param {THREE.Scene} scene
   * @param {Array}  targets  objects with .getPosition() and optionally .radius
   * @param {function} getHeightAt  (x,z)=>y  terrain height for ground impact
   * @returns {{ projectile:Projectile, target:object }[]}
   */
  stepProjectiles(dt, scene, targets, getHeightAt) {
    const hits = [];
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);

      if (!p.alive) {
        p.dispose(scene);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Ground impact
      if (getHeightAt) {
        const groundY = getHeightAt(p.position.x, p.position.z);
        if (p.position.y < groundY) {
          p.dispose(scene);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      // Target hit detection (sphere vs sphere)
      let hit = false;
      for (const tgt of targets) {
        const tgtPos = tgt.getPosition?.() ?? tgt.position;
        if (!tgtPos) continue;
        const tgtR = tgt.radius ?? 0.8;
        if (p.position.distanceTo(tgtPos) < p.radius + tgtR) {
          hits.push({ projectile: p, target: tgt });
          p.dispose(scene);
          this.projectiles.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }
    return hits;
  }

  // ─── Body integration ─────────────────────────────────────────────────────
  /**
   * Integrate a single body with full physics.
   * @param {PhysicsBody} body
   * @param {number}   dt
   * @param {number}   gravity  m/s² (positive downward)
   * @param {function} getHeightAt  (x,z)=>y | null
   */
  integrateBody(body, dt, gravity, getHeightAt) {
    const vel = body.velocity;
    const pos = body.position;

    // Gravity wells
    for (const w of this.gravityWells) {
      w.accelerationAt(pos, this._tmp);
      vel.addScaledVector(this._tmp, dt);
    }

    // Vertical gravity
    if (!body.grounded) {
      vel.y -= gravity * dt;
      if (vel.y < PHYSICS.TERMINAL_VELOCITY) vel.y = PHYSICS.TERMINAL_VELOCITY;
    }

    // Horizontal friction / drag
    if (body.grounded) {
      const f = Math.pow(body.friction, dt * 60);
      vel.x *= f;
      vel.z *= f;
    } else {
      const d = Math.pow(body.drag, dt * 60);
      vel.x *= d;
      vel.z *= d;
    }

    // Integrate
    pos.addScaledVector(vel, dt);

    // Terrain collision + slope
    if (getHeightAt) {
      // Sample at 4 cardinal probe points for slope normal
      const r = body.radius * 0.9;
      const hC = getHeightAt(pos.x,     pos.z);
      const hN = getHeightAt(pos.x,     pos.z + r);
      const hE = getHeightAt(pos.x + r, pos.z);
      const hS = getHeightAt(pos.x,     pos.z - r);
      const hW = getHeightAt(pos.x - r, pos.z);
      const groundY = hC;

      // Approximate surface normal
      const nx = hW - hE;
      const nz = hN - hS;
      const ny = 2 * r;
      const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
      body._groundNormal.set(nx/nLen, ny/nLen, nz/nLen);

      const feetY = groundY;
      const steepSlope = body._groundNormal.y < PHYSICS.SLOPE_THRESHOLD;

      if (pos.y <= feetY + PHYSICS.STEP_HEIGHT) {
        if (steepSlope) {
          // Slide – apply force along slope, don't ground
          body._slopeSliding = true;
          const slide = this._tmp2.copy(body._groundNormal).cross(
            this._tmp.set(body._groundNormal.z, 0, -body._groundNormal.x)
          ).normalize();
          vel.addScaledVector(slide, -PHYSICS.SLIDE_ACCEL * dt);
          // Still land on surface
          if (pos.y < feetY) pos.y = feetY;
        } else {
          body._slopeSliding = false;
          // Step up smoothly
          if (pos.y < feetY) pos.y = feetY;
          if (vel.y < 0) {
            if (body.restitution > 0 && vel.y < -3) {
              vel.y = -vel.y * body.restitution;
            } else {
              vel.y = 0;
            }
          }
          body._wasGrounded = body.grounded;
          body.grounded = true;
          body._coyoteTimer = PHYSICS.COYOTE_TIME;
        }
      } else {
        body._wasGrounded = body.grounded;
        body.grounded = false;
        body._slopeSliding = false;
        if (body._coyoteTimer > 0) body._coyoteTimer -= dt;
      }
    }

    // Jump buffer countdown
    if (body._jumpBuf > 0) body._jumpBuf -= dt;

    return body;
  }

  /**
   * Resolve sphere-sphere overlap between two bodies.
   * Returns true if they were overlapping.
   */
  resolveSeparation(a, b) {
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dz = a.position.z - b.position.z;
    const dist2 = dx*dx + dy*dy + dz*dz;
    const minDist = a.radius + b.radius;
    if (dist2 >= minDist * minDist || dist2 < 1e-8) return false;

    const dist = Math.sqrt(dist2);
    const overlap = minDist - dist;
    if (overlap < PHYSICS.MIN_SEPARATION) return false;

    const inv = 1 / dist;
    const nx = dx * inv;
    const nz = dz * inv; // ignore Y for horizontal separation

    // Mass-weighted push (heavier object moves less)
    const totalMass = a.mass + b.mass;
    const wA = b.mass / totalMass;
    const wB = a.mass / totalMass;

    a.position.x += nx * overlap * wA;
    a.position.z += nz * overlap * wA;
    b.position.x -= nx * overlap * wB;
    b.position.z -= nz * overlap * wB;
    return true;
  }

  /**
   * Full world step: integrate all bodies, then separate overlaps.
   * @param {number}   dt
   * @param {number}   gravity
   * @param {function} getHeightAt
   */
  step(dt, gravity, getHeightAt) {
    // Use per-planet world gravity if caller doesn't pass one explicitly
    const g = (gravity != null && gravity > 0) ? gravity : this._gravity;
    for (const body of this.bodies) {
      this.integrateBody(body, dt, g, getHeightAt);
    }
    // N² separation pass (acceptable for <30 creatures)
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this.resolveSeparation(this.bodies[i], this.bodies[j]);
      }
    }
  }

  /** Dispose all projectiles and clear state. */
  dispose(scene) {
    for (const p of this.projectiles) p.dispose(scene);
    this.projectiles = [];
    this.bodies = [];
    this.gravityWells = [];
  }
}
