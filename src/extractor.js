/**
 * src/extractor.js
 * Auto-Extractor module – Satisfactory-inspired factory element.
 *
 * The player can deploy an Auto-Extractor near a resource node; it will
 * automatically harvest resources at a steady rate and deposit them into
 * the shared inventory.  Multiple extractors can run simultaneously.
 *
 * Crafting cost: 80 Pure Ferrite + 2 Carbon Nanotubes + 40 Copper
 * Harvest rate:  5 units / 10 seconds (upgradeable via Tech Tree)
 * Visual:        Animated piston + glowing tether beam to nearest node
 */
import * as THREE from 'three';

const EXTRACTOR_RANGE        = 14;   // world-units – max distance to a resource node
const EXTRACTOR_RATE         = 10;   // seconds per harvest cycle
const EXTRACTOR_HARVEST_AMT  = 5;    // units harvested per cycle
const EXTRACTOR_CRAFT_COST   = {
  'Pure Ferrite'    : 80,
  'Carbon Nanotubes': 2,
  'Copper'          : 40,
};

// ─── Build extractor mesh ─────────────────────────────────────────────────────
function buildExtractorMesh() {
  const g = new THREE.Group();

  // Base plate
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.25, 12),
    new THREE.MeshPhongMaterial({ color: 0x334455, shininess: 60 })
  );
  base.position.y = 0.125;
  base.castShadow = true;
  g.add(base);

  // Body tower
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 1.8, 10),
    new THREE.MeshPhongMaterial({ color: 0x223344, shininess: 80 })
  );
  tower.position.y = 1.15;
  tower.castShadow = true;
  g.add(tower);

  // Accent ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.07, 8, 24),
    new THREE.MeshPhongMaterial({ color: 0x00ccff, emissive: 0x004488, emissiveIntensity: 0.8 })
  );
  ring.position.y = 1.8;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  // Piston arm
  const piston = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8),
    new THREE.MeshPhongMaterial({ color: 0x88aacc, shininess: 120 })
  );
  piston.position.set(0.3, 2.2, 0);
  g.add(piston);
  g._piston = piston;

  // Top drill head
  const drill = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.5, 8),
    new THREE.MeshPhongMaterial({ color: 0x00ccff, emissive: 0x0066aa, emissiveIntensity: 1.2, shininess: 200 })
  );
  drill.position.y = 2.65;
  g.add(drill);
  g._drill = drill;

  // Tether beam (will be updated each frame toward target node)
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.8, 0),
    new THREE.Vector3(0, 1.8, 0),
  ]);
  const beamMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6 });
  g._beamLine = new THREE.Line(beamGeo, beamMat);
  g.add(g._beamLine);

  return g;
}

// ─── Extractor instance ───────────────────────────────────────────────────────
class ExtractorUnit {
  constructor(scene, position) {
    this.scene    = scene;
    this.position = position.clone();
    this._timer   = EXTRACTOR_RATE;   // count up to rate
    this._target  = null;             // linked MiningSystem node
    this._active  = false;
    this._elapsed = 0;

    this.mesh = buildExtractorMesh();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  /** Link to a resource node from the MiningSystem */
  linkNode(node) {
    this._target = node;
    this._active = !!node;
  }

  update(dt, inventory, miningSystem) {
    this._elapsed += dt;

    // Spin drill
    if (this.mesh._drill) {
      this.mesh._drill.rotation.y = this._elapsed * 4;
    }
    // Piston bounce
    if (this.mesh._piston) {
      this.mesh._piston.position.y = 2.2 + Math.sin(this._elapsed * 3) * 0.12;
    }

    // If target node is depleted, find a new one
    if (this._target && this._target.amount <= 0) {
      this._target  = null;
      this._active  = false;
    }
    if (!this._target && miningSystem) {
      const near = miningSystem.getNodesNear(this.position, EXTRACTOR_RANGE);
      if (near.length > 0) {
        this._target = near[0];
        this._active = true;
      }
    }

    // Update tether beam
    if (this.mesh._beamLine) {
      const pts = this.mesh._beamLine.geometry.attributes.position;
      if (this._target) {
        const tp = this._target.pos;
        pts.setXYZ(0, 0, 1.8, 0);                                 // local origin (top ring)
        pts.setXYZ(1, tp.x - this.position.x, tp.y - this.position.y + 1, tp.z - this.position.z);
        pts.needsUpdate = true;
        this.mesh._beamLine.material.opacity = 0.6 + Math.sin(this._elapsed * 6) * 0.2;
      } else {
        pts.setXYZ(0, 0, 1.8, 0);
        pts.setXYZ(1, 0, 1.8, 0);
        pts.needsUpdate = true;
        this.mesh._beamLine.material.opacity = 0;
      }
    }

    if (!this._active || !this._target) return;

    this._timer += dt;
    if (this._timer >= EXTRACTOR_RATE) {
      this._timer = 0;
      const take = Math.min(EXTRACTOR_HARVEST_AMT, this._target.amount);
      this._target.amount -= take;
      if (inventory && take > 0) {
        inventory.addItem(this._target.resourceType, take);
      }
      if (this._target.amount <= 0) {
        this._target = null;
        this._active = false;
      }
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
  }
}

// ─── ExtractorManager (manages all placed extractors) ─────────────────────────
export class ExtractorManager {
  constructor(scene, inventory) {
    this.scene     = scene;
    this.inventory = inventory;
    this._units    = [];
  }

  canPlace(playerInventory) {
    for (const [type, amt] of Object.entries(EXTRACTOR_CRAFT_COST)) {
      if (playerInventory.getAmount(type) < amt) return false;
    }
    return true;
  }

  place(position, playerInventory, miningSystem) {
    if (!this.canPlace(playerInventory)) return false;
    // Deduct crafting cost
    for (const [type, amt] of Object.entries(EXTRACTOR_CRAFT_COST)) {
      playerInventory.removeItem(type, amt);
    }
    const unit = new ExtractorUnit(this.scene, position);
    if (miningSystem) {
      const near = miningSystem.getNodesNear(position, EXTRACTOR_RANGE);
      if (near.length > 0) unit.linkNode(near[0]);
    }
    this._units.push(unit);
    return true;
  }

  update(dt, miningSystem) {
    for (const u of this._units) {
      u.update(dt, this.inventory, miningSystem);
    }
  }

  getCount() { return this._units.length; }

  getCraftCost() { return { ...EXTRACTOR_CRAFT_COST }; }

  serialize() {
    return this._units.map(u => ({
      x: u.position.x, y: u.position.y, z: u.position.z
    }));
  }

  load(data, miningSystem) {
    for (const d of (data || [])) {
      const pos  = new THREE.Vector3(d.x, d.y, d.z);
      const unit = new ExtractorUnit(this.scene, pos);
      if (miningSystem) {
        const near = miningSystem.getNodesNear(pos, EXTRACTOR_RANGE);
        if (near.length > 0) unit.linkNode(near[0]);
      }
      this._units.push(unit);
    }
  }

  dispose() {
    for (const u of this._units) u.dispose();
    this._units = [];
  }
}

export { EXTRACTOR_CRAFT_COST, EXTRACTOR_RANGE, EXTRACTOR_RATE };
