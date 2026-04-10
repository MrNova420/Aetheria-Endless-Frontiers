/**
 * src/player.js
 * Full player controller: movement, jetpack, mining, scanner, third-person camera.
 * Player model built entirely from Three.js geometry – no external assets.
 */
import * as THREE from 'three';
import { PLAYER_CONFIG, WORLD } from './config.js';

// ─── Build detailed astronaut / explorer mesh ─────────────────────────────────
function buildPlayerModel(classColor = 0x4488ff) {
  const root   = new THREE.Group();
  const accent = new THREE.MeshPhongMaterial({ color: classColor, emissive: classColor, emissiveIntensity: 0.15, shininess: 80 });
  const suit   = new THREE.MeshPhongMaterial({ color: 0x223344, shininess: 60 });
  const visor  = new THREE.MeshPhongMaterial({ color: classColor, emissive: classColor, emissiveIntensity: 0.5, transparent: true, opacity: 0.7, shininess: 200 });
  const dark   = new THREE.MeshLambertMaterial({ color: 0x111111 });

  // Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.55, 10), suit);
  torso.position.y = 0.9;
  torso.castShadow = true;
  root.add(torso);

  // Chest plate detail
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.12), accent);
  chest.position.set(0, 0.95, 0.22);
  root.add(chest);

  // Helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), suit);
  helmet.position.y = 1.42;
  helmet.castShadow = true;
  root.add(helmet);

  // Visor
  const visorMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 8, 0, Math.PI * 1.4, 0.5, Math.PI * 0.7),
    visor
  );
  visorMesh.position.set(0.04, 1.42, 0.08);
  visorMesh.rotation.y = -0.1;
  root.add(visorMesh);

  // Arms
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), suit);
    shoulder.position.set(side * 0.38, 1.05, 0);
    root.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.3, 8), suit);
    upper.position.set(side * 0.42, 0.85, 0);
    root.add(upper);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), accent);
    elbow.position.set(side * 0.44, 0.68, 0);
    root.add(elbow);

    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.28, 8), suit);
    lower.position.set(side * 0.44, 0.48, 0.04);
    lower.rotation.x = 0.2;
    root.add(lower);

    // Glove
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), dark);
    glove.position.set(side * 0.44, 0.32, 0.06);
    root.add(glove);
  }

  // Hips
  const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.22, 10), suit);
  hip.position.y = 0.60;
  root.add(hip);

  // Legs
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.10, 0.34, 8), suit);
    thigh.position.set(side * 0.13, 0.38, 0);
    root.add(thigh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.10, 6, 5), accent);
    knee.position.set(side * 0.13, 0.22, 0);
    root.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.32, 8), suit);
    shin.position.set(side * 0.13, 0.04, 0);
    root.add(shin);

    // Boot
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), dark);
    boot.position.set(side * 0.13, -0.12, 0.04);
    root.add(boot);
  }

  // Jetpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.14), accent);
  pack.position.set(0, 0.92, -0.28);
  root.add(pack);

  // Jetpack nozzles
  for (const side of [-0.08, 0.08]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.1, 8), dark);
    nozzle.position.set(side, 0.72, -0.32);
    root.add(nozzle);
  }

  // Multitool (right hand)
  const tool = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), accent);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = 0.17;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), dark);
  handle.position.set(0, -0.06, 0);
  tool.add(barrel);
  tool.add(handle);
  tool.position.set(0.44, 0.35, 0.10);
  tool.rotation.y = -0.3;
  root.add(tool);

  return root;
}

// ─── Mining beam visual ───────────────────────────────────────────────────────
function buildMiningBeam(color = 0x00aaff) {
  const points = [new THREE.Vector3(), new THREE.Vector3(0, 0, -1)];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

// ─── Player class ─────────────────────────────────────────────────────────────
export class Player {
  constructor(scene, camera) {
    this.scene  = scene;
    this.camera = camera;

    // ── Stats ────────────────────────────────────────────────────────────────
    this.maxHp        = PLAYER_CONFIG.MAX_HP;
    this.hp           = this.maxHp;
    this.maxShield    = PLAYER_CONFIG.MAX_SHIELD;
    this.shield       = this.maxShield;
    this.jetpackFuel  = PLAYER_CONFIG.JETPACK_FUEL;
    this.lifeSup      = 100;    // 0–100
    this.hazardProt   = 0;      // reduces hazard damage
    this.classId      = 'explorer';
    this.classColor   = 0x4488ff;

    // ── Physics ──────────────────────────────────────────────────────────────
    this._vel       = new THREE.Vector3();
    this._grounded  = false;
    this._gravity   = WORLD.GRAVITY;
    this._shieldRegenTimer = 0;
    this._dodgeCooldown    = 0;
    this._scanTimer        = 0;
    this.isMining          = false;
    this.isScanning        = false;

    // ── Camera ───────────────────────────────────────────────────────────────
    this._camYaw    = 0;
    this._camPitch  = -0.18;
    this._camDist   = 5.5;
    this._camTarget = new THREE.Vector3();

    // ── Mesh ─────────────────────────────────────────────────────────────────
    this.model = buildPlayerModel(this.classColor);
    this.scene.add(this.model);

    // ── Mining beam ──────────────────────────────────────────────────────────
    this._miningBeam = buildMiningBeam(this.classColor);
    this._miningBeam.visible = false;
    this.scene.add(this._miningBeam);

    // ── Jetpack flame particles ───────────────────────────────────────────────
    this._thrustParts = this._buildThrustParticles();
    this.scene.add(this._thrustParts);

    // ── Footdust ─────────────────────────────────────────────────────────────
    this._footDust = this._buildFootDust();
    this.scene.add(this._footDust);

    // ── Walk animation ───────────────────────────────────────────────────────
    this._walkTime = 0;
    this._lastY    = 0;
  }

  _buildThrustParticles() {
    const count = 40;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: this.classColor, size: 0.15,
      transparent: true, opacity: 0.8, depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    return pts;
  }

  _buildFootDust() {
    const count = 20;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbbaa88, size: 0.08,
      transparent: true, opacity: 0.4, depthWrite: false
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    return pts;
  }

  setClass(classId, classColor) {
    this.classId    = classId;
    this.classColor = classColor || 0x4488ff;
    this.scene.remove(this.model);
    this.model = buildPlayerModel(this.classColor);
    this.scene.add(this.model);
  }

  getPosition()     { return this.model.position.clone(); }
  setPosition(v3)   { this.model.position.copy(v3); }

  update(dt, input, terrain, mining) {
    const pos  = this.model.position;
    const cfg  = PLAYER_CONFIG;

    // ── Move direction from input ────────────────────────────────────────────
    const forward = new THREE.Vector3(
      -Math.sin(this._camYaw), 0, -Math.cos(this._camYaw)
    );
    const right = new THREE.Vector3(
      Math.cos(this._camYaw), 0, -Math.sin(this._camYaw)
    );

    const moveDir = new THREE.Vector3();
    if (input.forward) moveDir.addScaledVector(forward, 1);
    if (input.back)    moveDir.addScaledVector(forward, -1);
    if (input.left)    moveDir.addScaledVector(right, -1);
    if (input.right)   moveDir.addScaledVector(right, 1);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const spd = input.sprint ? cfg.SPRINT_SPEED : cfg.WALK_SPEED;

    // ── Horizontal velocity ──────────────────────────────────────────────────
    const moving = moveDir.lengthSq() > 0;
    this._vel.x = moveDir.x * spd;
    this._vel.z = moveDir.z * spd;

    if (moving) {
      this.model.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    }

    // ── Jetpack ──────────────────────────────────────────────────────────────
    if (input.jump && this.jetpackFuel > 0) {
      this._vel.y   = Math.min(this._vel.y + cfg.JETPACK_THRUST * dt, 16);
      this.jetpackFuel = Math.max(0, this.jetpackFuel - 30 * dt);
      this._grounded   = false;
      this._thrustParts.visible = true;
      this._updateThrustParticles(pos);
    } else {
      this._thrustParts.visible = false;
      // Fuel regen
      if (this._grounded || !input.jump) {
        this.jetpackFuel = Math.min(cfg.JETPACK_FUEL, this.jetpackFuel + 25 * dt);
      }
    }

    // ── Gravity ──────────────────────────────────────────────────────────────
    if (!this._grounded) {
      this._vel.y -= this._gravity * dt;
    }

    // ── Apply velocity ───────────────────────────────────────────────────────
    pos.addScaledVector(this._vel, dt);

    // ── Terrain collision ────────────────────────────────────────────────────
    if (terrain) {
      const groundY = terrain.getHeightAt(pos.x, pos.z);
      if (pos.y <= groundY + 0.01) {
        pos.y       = groundY;
        this._vel.y = 0;
        this._grounded = true;
      } else {
        this._grounded = false;
      }
    }

    // ── Dodge cooldown ────────────────────────────────────────────────────────
    if (this._dodgeCooldown > 0) this._dodgeCooldown -= dt;

    // ── Mining ───────────────────────────────────────────────────────────────
    this.isMining = false;
    this._miningBeam.visible = false;
    if (input.mine && mining) {
      const hit = mining.getNodesNear(pos, cfg.MINING_RANGE);
      if (hit.length > 0) {
        const node = hit[0];
        this.isMining = true;
        this._miningBeam.visible = true;
        const bPos = this._miningBeam.geometry.attributes.position;
        bPos.setXYZ(0, pos.x, pos.y + 1, pos.z);
        bPos.setXYZ(1, node.group.position.x, node.group.position.y + 0.5, node.group.position.z);
        bPos.needsUpdate = true;
      }
    }

    // ── Scanning ─────────────────────────────────────────────────────────────
    this.isScanning = !!input.scan;

    // ── Shield regen ─────────────────────────────────────────────────────────
    if (this._shieldRegenTimer > 0) {
      this._shieldRegenTimer -= dt;
    } else {
      this.shield = Math.min(this.maxShield, this.shield + cfg.SHIELD_REGEN_RATE * dt);
    }

    // ── Walk animation ────────────────────────────────────────────────────────
    if (moving && this._grounded) {
      this._walkTime += dt * spd * 0.5;
      this.model.position.y += Math.abs(Math.sin(this._walkTime * 6)) * 0.03;

      // Foot dust
      this._footDust.visible = true;
      const fdPos = this._footDust.geometry.attributes.position;
      for (let i = 0; i < 20; i++) {
        fdPos.setXYZ(i,
          pos.x + (Math.random() - 0.5) * 0.4,
          pos.y + Math.random() * 0.1,
          pos.z + (Math.random() - 0.5) * 0.4
        );
      }
      fdPos.needsUpdate = true;
    } else {
      this._footDust.visible = false;
    }

    // ── Camera ───────────────────────────────────────────────────────────────
    this._camYaw   += input.mouseDX * 0.003;
    this._camPitch  = Math.max(-0.6, Math.min(0.5, this._camPitch + input.mouseDY * 0.003));

    const camOffset = new THREE.Vector3(
      Math.sin(this._camYaw) * Math.cos(this._camPitch) * this._camDist,
      Math.sin(this._camPitch) * this._camDist + 1.6,
      Math.cos(this._camYaw) * Math.cos(this._camPitch) * this._camDist
    );

    const target = pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this._camTarget.lerp(target, 0.15);
    this.camera.position.lerp(target.clone().add(camOffset), 0.12);
    this.camera.lookAt(this._camTarget);

    // Store for external use
    input.mouseDX = 0;
    input.mouseDY = 0;
  }

  _updateThrustParticles(pos) {
    const pPos = this._thrustParts.geometry.attributes.position;
    for (let i = 0; i < 40; i++) {
      pPos.setXYZ(i,
        pos.x + (Math.random() - 0.5) * 0.15,
        pos.y + 0.55 + Math.random() * 0.3,
        pos.z + (Math.random() - 0.5) * 0.15
      );
    }
    pPos.needsUpdate = true;
  }

  applyDamage(amount, type = 'physical') {
    let dmg = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg * 0.7);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    this.hp = Math.max(0, this.hp - dmg);
    this._shieldRegenTimer = PLAYER_CONFIG.SHIELD_REGEN_DELAY;
    return dmg;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  drainLifeSupport(amount) {
    this.lifeSup = Math.max(0, this.lifeSup - amount);
    if (this.lifeSup <= 0) this.applyDamage(5, 'environment');
  }

  refillLifeSupport(amount) {
    this.lifeSup = Math.min(100, this.lifeSup + amount);
  }

  isAlive() { return this.hp > 0; }

  getStats() {
    return {
      hp: Math.floor(this.hp),
      maxHp: this.maxHp,
      shield: Math.floor(this.shield),
      maxShield: this.maxShield,
      jetpack: Math.floor(this.jetpackFuel),
      maxJetpack: PLAYER_CONFIG.JETPACK_FUEL,
      lifeSup: Math.floor(this.lifeSup),
    };
  }

  // Serialisation for save/load
  serializeState() {
    const p = this.model.position;
    return {
      x: p.x, y: p.y, z: p.z,
      hp: this.hp, shield: this.shield,
      jetpackFuel: this.jetpackFuel,
      classId: this.classId,
    };
  }

  loadState(data) {
    this.model.position.set(data.x, data.y, data.z);
    this.hp          = data.hp;
    this.shield      = data.shield;
    this.jetpackFuel = data.jetpackFuel;
    if (data.classId) this.setClass(data.classId);
  }

  dispose() {
    this.scene.remove(this.model);
    this.scene.remove(this._miningBeam);
    this.scene.remove(this._thrustParts);
    this.scene.remove(this._footDust);
  }
}
