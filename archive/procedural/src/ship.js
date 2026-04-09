/**
 * src/ship.js
 * Procedural ship model + three flight modes: LANDED / ATMOSPHERIC / SPACE
 */
import * as THREE from 'three';

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
}

// ─── Flight states ────────────────────────────────────────────────────────────
export const FlightMode = { LANDED: 0, ATMOSPHERIC: 1, SPACE: 2 };

// ─── Build procedural ship mesh ───────────────────────────────────────────────
function buildShipMesh(seed = 1) {
  const r    = seededRng(seed);
  const root = new THREE.Group();

  // Colour palette from seed
  const hullH  = r();
  const accH   = (hullH + 0.45) % 1;
  const hullCol  = new THREE.Color().setHSL(hullH, 0.4 + r() * 0.3, 0.35 + r() * 0.25);
  const accCol   = new THREE.Color().setHSL(accH,  0.7 + r() * 0.2, 0.5  + r() * 0.2);
  const glassCol = new THREE.Color().setHSL(accH, 0.6, 0.55);
  const thrustCol = new THREE.Color().setHSL(0.62, 0.9, 0.65);

  const hullMat  = new THREE.MeshPhongMaterial({ color: hullCol, shininess: 90 });
  const accMat   = new THREE.MeshPhongMaterial({ color: accCol,  shininess: 60 });
  const glassMat = new THREE.MeshPhongMaterial({ color: glassCol, emissive: glassCol, emissiveIntensity: 0.35, transparent: true, opacity: 0.65, shininess: 200 });
  const darkMat  = new THREE.MeshPhongMaterial({ color: 0x111122, shininess: 30 });
  const thrMat   = new THREE.MeshPhongMaterial({ color: thrustCol, emissive: thrustCol, emissiveIntensity: 1.0 });

  // ── Hull (LatheGeometry) ──────────────────────────────────────────────────
  const hullPts = [];
  hullPts.push(new THREE.Vector2(0,    -3.2));   // nose
  hullPts.push(new THREE.Vector2(0.25, -2.0));
  hullPts.push(new THREE.Vector2(0.70, -0.8));
  hullPts.push(new THREE.Vector2(0.90,  0.2));   // mid-widest
  hullPts.push(new THREE.Vector2(0.85,  1.2));
  hullPts.push(new THREE.Vector2(0.70,  2.0));
  hullPts.push(new THREE.Vector2(0.45,  2.8));   // engine mount
  hullPts.push(new THREE.Vector2(0.30,  3.2));
  const lathe = new THREE.LatheGeometry(hullPts, 24);
  const hull  = new THREE.Mesh(lathe, hullMat);
  hull.rotation.x = Math.PI / 2;
  hull.castShadow = true;
  root.add(hull);

  // ── Cockpit glass ─────────────────────────────────────────────────────────
  const cockpitPts = [];
  cockpitPts.push(new THREE.Vector2(0,    -3.18));
  cockpitPts.push(new THREE.Vector2(0.22, -2.1));
  cockpitPts.push(new THREE.Vector2(0.55, -0.9));
  cockpitPts.push(new THREE.Vector2(0.60,  0.1));
  const cockpitGeo = new THREE.LatheGeometry(cockpitPts, 18);
  const cockpit    = new THREE.Mesh(cockpitGeo, glassMat);
  cockpit.rotation.x = Math.PI / 2;
  root.add(cockpit);

  // ── Swept wings ───────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(side * 2.8, 0.6);
    shape.lineTo(side * 2.2, 1.4);
    shape.lineTo(side * 0.6, 1.4);
    shape.closePath();
    const wingGeo = new THREE.ShapeGeometry(shape);
    const wing    = new THREE.Mesh(wingGeo, accMat);
    wing.rotation.x = Math.PI / 2;
    wing.position.set(0, 0.05, 1.0);
    wing.castShadow = true;
    root.add(wing);

    // Wing detail stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 2.0, 0.08),
      thrMat
    );
    stripe.rotation.z = side * 0.22;
    stripe.position.set(side * 1.2, 0.18, 1.0);
    root.add(stripe);
  }

  // ── Engine nacelles (2 per side) ─────────────────────────────────────────
  const nacelleDef = [
    { x: -0.65, z: 2.5 }, { x: 0.65, z: 2.5 },
    { x: -1.40, z: 2.0 }, { x: 1.40, z: 2.0 },
  ];
  root._nozzles = [];
  for (const nd of nacelleDef) {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.19, 0.8, 12),
      hullMat
    );
    body.position.set(nd.x, 0, nd.z);
    root.add(body);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.04, 8, 16),
      accMat
    );
    ring.position.set(nd.x, 0.35, nd.z);
    ring.rotation.x = Math.PI / 2;
    root.add(ring);

    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.14, 0.22, 12),
      thrMat
    );
    glow.position.set(nd.x, 0.48, nd.z);
    root.add(glow);
    root._nozzles.push(glow);
  }

  // ── Landing struts (3 legs) ───────────────────────────────────────────────
  root._struts = [];
  const strutPos = [
    { x: 0,    z: -2.0 },
    { x: -0.9, z:  1.8 },
    { x:  0.9, z:  1.8 },
  ];
  for (const sp of strutPos) {
    const g = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6), darkMat);
    strut.position.y = -0.35;
    strut.rotation.x = 0.25;
    g.add(strut);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8), darkMat);
    pad.position.set(0, -0.72, 0.18);
    g.add(pad);
    g.position.set(sp.x, -0.42, sp.z);
    root.add(g);
    root._struts.push(g);
  }

  // ── Thruster particle emitters ────────────────────────────────────────────
  const thrGeo = new THREE.BufferGeometry();
  const thrPos = new Float32Array(80 * 3);
  thrGeo.setAttribute('position', new THREE.BufferAttribute(thrPos, 3));
  const thrMats = new THREE.PointsMaterial({
    color: thrustCol, size: 0.22, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  root._thruster = new THREE.Points(thrGeo, thrMats);
  root._thruster.visible = false;
  root.add(root._thruster);

  return root;
}

// ─── Ship class ───────────────────────────────────────────────────────────────
export class Ship {
  constructor(scene) {
    this.scene = scene;
    this.mode  = FlightMode.LANDED;

    // Physics
    this._vel   = new THREE.Vector3();
    this._yaw   = 0;
    this._pitch = 0;
    this._roll  = 0;
    this._thrust = 0;
    this._landed = true;
    this._landingY = 0;

    // State
    this._playerInside  = false;
    this._taking_off    = false;
    this._landing       = false;
    this._landTimer     = 0;

    // Build mesh
    const shipSeed = Math.floor(Math.random() * 0xFFFF);
    this.mesh = buildShipMesh(shipSeed);
    this.scene.add(this.mesh);

    // Entry prompt sphere (visual indicator)
    this._entryZone = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x0088ff, wireframe: true, transparent: true, opacity: 0.15 })
    );
    this.mesh.add(this._entryZone);
    this._entryZone.visible = false;
  }

  getPosition() { return this.mesh.position.clone(); }

  isPlayerNear(playerPos) {
    return this.mesh.position.distanceTo(playerPos) < 5;
  }

  isPlayerInside() { return this._playerInside; }

  showEntryZone(show) {
    this._entryZone.visible = show;
  }

  enterShip(player) {
    this._playerInside = true;
    player.model.visible = false;
    this._entryZone.visible = false;
  }

  exitShip(player) {
    this._playerInside = false;
    player.model.visible = true;
    player.setPosition(this.mesh.position.clone().add(new THREE.Vector3(3, 0.5, 0)));
  }

  // ── Takeoff sequence ────────────────────────────────────────────────────────
  takeOff() {
    if (!this._landed) return;
    this._landed      = false;
    this._taking_off  = true;
    this._landTimer   = 0;
    this.mode         = FlightMode.ATMOSPHERIC;
    this._retractStruts();
  }

  // ── Landing sequence ────────────────────────────────────────────────────────
  land(targetY) {
    this._landing   = true;
    this._landingY  = targetY;
    this._landTimer = 0;
    this._extendStruts();
  }

  // ── Strut animations ────────────────────────────────────────────────────────
  _retractStruts() {
    if (!this.mesh._struts) return;
    for (const s of this.mesh._struts) {
      s.scale.y = 0.1;
    }
  }
  _extendStruts() {
    if (!this.mesh._struts) return;
    for (const s of this.mesh._struts) {
      s.scale.y = 1.0;
    }
  }

  setSpaceMode(bool) {
    this.mode = bool ? FlightMode.SPACE : FlightMode.ATMOSPHERIC;
  }

  // ── Weapons / abilities ─────────────────────────────────────────────────────
  fireWeapon() {
    // Spawn a projectile from ship nose
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    return { origin: this.mesh.position.clone().add(dir.clone().multiplyScalar(3.5)), dir, dmg: 35 };
  }

  // ── Main update ─────────────────────────────────────────────────────────────
  update(dt, input, terrain) {
    if (!this._playerInside) {
      // Idle landed: just bob slightly
      if (this._landed) {
        this.mesh.position.y = this._landingY + Math.sin(Date.now() * 0.001) * 0.05;
      }
      return;
    }

    const pos = this.mesh.position;

    if (this.mode === FlightMode.LANDED) {
      if (input.shipThrust > 0) this.takeOff();
      return;
    }

    // ── Atmospheric flight ────────────────────────────────────────────────────
    if (this.mode === FlightMode.ATMOSPHERIC) {
      // Takeoff burst
      if (this._taking_off) {
        this._landTimer += dt;
        this._vel.y = 12 * Math.min(1, this._landTimer / 1.5);
        if (this._landTimer > 1.5) this._taking_off = false;
      }

      // Yaw (turn)
      if (input.shipYaw  !== 0) this._yaw   -= input.shipYaw  * 1.2 * dt;
      // Pitch
      const pitchTarget = input.shipPitch * 0.5;
      this._pitch = THREE.MathUtils.lerp(this._pitch, pitchTarget, 5 * dt);
      // Roll
      const rollTarget  = -input.shipYaw * 0.4;
      this._roll  = THREE.MathUtils.lerp(this._roll, rollTarget, 4 * dt);

      this.mesh.rotation.y = this._yaw;
      this.mesh.rotation.x = this._pitch;
      this.mesh.rotation.z = this._roll;

      // Thrust
      this._thrust = THREE.MathUtils.lerp(this._thrust, input.shipThrust * 40, 3 * dt);
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this._pitch, this._yaw, this._roll));
      this._vel.addScaledVector(fwd, this._thrust * dt);

      // Drag
      this._vel.multiplyScalar(0.96);
      // Gravity (light in atmosphere)
      this._vel.y -= 5 * dt;

      pos.addScaledVector(this._vel, dt);

      // Ground collision
      if (terrain) {
        const groundY = terrain.getHeightAt(pos.x, pos.z) + 0.5;
        if (pos.y < groundY) {
          pos.y = groundY;
          this._vel.y = 0;
          if (input.shipThrust < 0.1 && this._vel.length() < 3) {
            this._landed    = true;
            this._landingY  = pos.y;
            this.mode       = FlightMode.LANDED;
            this._extendStruts();
          }
        }
      }

      // Transition to space above ~3000 units
      if (pos.y > 2800) this.mode = FlightMode.SPACE;
    }

    // ── Space flight (6DOF) ───────────────────────────────────────────────────
    if (this.mode === FlightMode.SPACE) {
      if (input.shipYaw  !== 0) this.mesh.rotateY(-input.shipYaw  * dt * 1.5);
      if (input.shipPitch !== 0) this.mesh.rotateX(input.shipPitch * dt * 1.0);
      if (input.shipRoll  !== 0) this.mesh.rotateZ(-input.shipRoll * dt * 1.2);

      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
      this._thrust = THREE.MathUtils.lerp(this._thrust, input.shipThrust * 80, 2 * dt);
      this._vel.addScaledVector(fwd, this._thrust * dt);
      this._vel.multiplyScalar(0.99);
      pos.addScaledVector(this._vel, dt);

      // Re-enter atmosphere
      if (terrain && pos.y < 2600) this.mode = FlightMode.ATMOSPHERIC;
    }

    // ── Thruster particles ────────────────────────────────────────────────────
    const thrusting = input.shipThrust > 0.05;
    this.mesh._thruster.visible = thrusting;
    if (thrusting) this._updateThrusterParticles();

    // ── Nozzle glow intensity ─────────────────────────────────────────────────
    if (this.mesh._nozzles) {
      const intensity = 0.4 + input.shipThrust * 0.9;
      for (const n of this.mesh._nozzles) {
        n.material.emissiveIntensity = intensity;
      }
    }
  }

  _updateThrusterParticles() {
    const pp = this.mesh._thruster.geometry.attributes.position;
    const nacelles = [
      new THREE.Vector3(-0.65, 0, 2.5), new THREE.Vector3(0.65, 0, 2.5),
      new THREE.Vector3(-1.40, 0, 2.0), new THREE.Vector3(1.40, 0, 2.0),
    ];
    let idx = 0;
    for (const n of nacelles) {
      for (let j = 0; j < 20; j++, idx++) {
        const wp = n.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
          Math.random() * 1.2 + 0.3
        ));
        pp.setXYZ(idx % 80, wp.x, wp.y, wp.z);
      }
    }
    pp.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  }
}
