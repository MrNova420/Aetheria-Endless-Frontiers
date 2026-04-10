/**
 * building.js — Satisfactory-style factory/empire building system
 * Handles placement, automation, power grids, and serialization.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ─── Building type definitions ────────────────────────────────────────────────

export const BUILDING_TYPES = {
  extractor: {
    id: 'extractor',
    name: 'Resource Extractor',
    icon: '⛏',
    description: 'Automatically mines the planet\'s primary resource at a steady rate.',
    cost: { iron: 10, carbon: 5 },
    powerCost: 20,
    powerGen: 0,
    category: 'production',
    maxHp: 200,
    buildTime: 5,
  },
  conveyor: {
    id: 'conveyor',
    name: 'Conveyor Link',
    icon: '➡',
    description: 'Transfers resources between buildings automatically.',
    cost: { iron: 4 },
    powerCost: 2,
    powerGen: 0,
    category: 'infrastructure',
    maxHp: 80,
    buildTime: 2,
  },
  storage: {
    id: 'storage',
    name: 'Storage Container',
    icon: '📦',
    description: 'Stores up to 500 units of any single resource.',
    cost: { iron: 8, carbon: 4 },
    powerCost: 0,
    powerGen: 0,
    category: 'infrastructure',
    maxHp: 300,
    buildTime: 4,
  },
  power_generator: {
    id: 'power_generator',
    name: 'Power Generator',
    icon: '⚡',
    description: 'Generates 100 power units from fuel cells. Powers nearby buildings.',
    cost: { iron: 15, carbon: 10, sodium: 5 },
    powerCost: 5,
    powerGen: 100,
    category: 'infrastructure',
    maxHp: 250,
    buildTime: 8,
  },
  research_station: {
    id: 'research_station',
    name: 'Research Station',
    icon: '🔬',
    description: 'Generates Nanites over time and unlocks new technologies.',
    cost: { iron: 20, gold: 5, carbon: 10 },
    powerCost: 30,
    powerGen: 0,
    category: 'production',
    maxHp: 150,
    buildTime: 12,
  },
  turret: {
    id: 'turret',
    name: 'Defense Turret',
    icon: '🔫',
    description: 'Automatically targets and fires on hostile Sentinels within range.',
    cost: { iron: 25, gold: 3 },
    powerCost: 15,
    powerGen: 0,
    category: 'defense',
    maxHp: 180,
    buildTime: 6,
  },
  town_hub: {
    id: 'town_hub',
    name: 'Town Hub',
    icon: '🏛',
    description: 'Anchor for your settlement. Extends influence radius 300u. Required for advanced buildings.',
    cost: { iron: 50, gold: 10, carbon: 25 },
    powerCost: 10,
    powerGen: 0,
    category: 'social',
    maxHp: 500,
    buildTime: 20,
    influenceRadius: 300,
  },
  wall: {
    id: 'wall',
    name: 'Fortified Wall',
    icon: '🧱',
    description: 'Defensive wall segment. High HP, blocks movement.',
    cost: { iron: 6 },
    powerCost: 0,
    powerGen: 0,
    category: 'defense',
    maxHp: 400,
    buildTime: 2,
  },
  door: {
    id: 'door',
    name: 'Blast Door',
    icon: '🚪',
    description: 'Automated door for your base perimeter.',
    cost: { iron: 8, carbon: 2 },
    powerCost: 1,
    powerGen: 0,
    category: 'infrastructure',
    maxHp: 250,
    buildTime: 3,
  },
  farm: {
    id: 'farm',
    name: 'Hydroponic Farm',
    icon: '🌿',
    description: 'Grows Carbon, Mordite, and edible flora passively.',
    cost: { carbon: 15, iron: 5 },
    powerCost: 10,
    powerGen: 0,
    category: 'social',
    maxHp: 120,
    buildTime: 8,
  },
};

// ─── Geometry & colour helpers ────────────────────────────────────────────────

const CATEGORY_COLOR = {
  infrastructure: 0x445566,
  production:     0x664422,
  defense:        0x442244,
  social:         0x224444,
};

/** Returns a simple Three.js mesh representing a building type. */
function _createMesh(typeId, transparent = false) {
  const def = BUILDING_TYPES[typeId];
  if (!def) return new THREE.Group();

  const color   = CATEGORY_COLOR[def.category] ?? 0x556677;
  const opacity = transparent ? 0.45 : 1.0;

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness:   0.6,
    metalness:   0.4,
    transparent: transparent,
    opacity,
  });

  let geometry;
  switch (typeId) {
    case 'extractor':
      geometry = new THREE.CylinderGeometry(1.2, 1.8, 3.5, 8);
      break;
    case 'conveyor':
      geometry = new THREE.BoxGeometry(4, 0.4, 0.6);
      break;
    case 'storage':
      geometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
      break;
    case 'power_generator':
      geometry = new THREE.CylinderGeometry(1.0, 1.4, 4, 6);
      break;
    case 'research_station':
      geometry = new THREE.BoxGeometry(3, 2.5, 3);
      break;
    case 'turret':
      geometry = new THREE.CylinderGeometry(0.5, 0.8, 2, 8);
      break;
    case 'town_hub':
      geometry = new THREE.BoxGeometry(5, 4, 5);
      break;
    case 'wall':
      geometry = new THREE.BoxGeometry(4, 3, 0.5);
      break;
    case 'door':
      geometry = new THREE.BoxGeometry(2, 3, 0.4);
      break;
    case 'farm':
      geometry = new THREE.BoxGeometry(4, 0.6, 4);
      break;
    default:
      geometry = new THREE.BoxGeometry(2, 2, 2);
  }

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow    = !transparent;
  mesh.receiveShadow = !transparent;
  mesh.userData.typeId = typeId;

  // Small accent detail on top for most buildings
  if (!['wall', 'door', 'conveyor', 'farm'].includes(typeId)) {
    const accentGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, metalness: 0.8, roughness: 0.2 });
    const accent    = new THREE.Mesh(accentGeo, accentMat);
    accent.position.y = geometry.parameters.height / 2 + 0.25;
    mesh.add(accent);
  }

  return mesh;
}

/** Attach a PointLight to a powered-building mesh. */
function _addPowerLight(mesh, typeId) {
  const def   = BUILDING_TYPES[typeId];
  const hue   = def?.category === 'defense'    ? 0xff4444
              : def?.category === 'production'  ? 0xffaa22
              : def?.category === 'social'      ? 0x22ffcc
              : 0x44aaff;
  const light = new THREE.PointLight(hue, 0.8, 12);
  light.position.y = 3;
  mesh.add(light);
  return light;
}

// ─── BuildingSystem ────────────────────────────────────────────────────────────

let _nextId = 1;

export class BuildingSystem {
  /**
   * @param {THREE.Scene}  scene
   * @param {object|null}  terrain  — terrain object (optional, used for y-snap)
   */
  constructor(scene, terrain = null) {
    this._scene    = scene;
    this._terrain  = terrain;
    this._group    = new THREE.Group();
    this._group.name = 'buildings';
    scene.add(this._group);

    /** @type {Map<string, object>} buildingId → building record */
    this._buildings = new Map();

    /** Timers for extractor automation (buildingId → seconds since last harvest) */
    this._extractorTimers = new Map();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** @returns {object[]} all BUILDING_TYPES as an array */
  getBuildingTypes() {
    return Object.values(BUILDING_TYPES);
  }

  /**
   * Check whether the player has enough resources to build typeId.
   * @param {string} typeId
   * @param {object} inventory  key→amount
   * @returns {boolean}
   */
  canAfford(typeId, inventory) {
    const def = BUILDING_TYPES[typeId];
    if (!def) return false;
    for (const [res, amt] of Object.entries(def.cost)) {
      if ((inventory[res] ?? 0) < amt) return false;
    }
    return true;
  }

  /**
   * Place a building at worldPos.
   * @param {string}        typeId
   * @param {THREE.Vector3} worldPos
   * @param {object}        inventory  — mutated in-place (resources deducted)
   * @returns {object|null} building record, or null on failure
   */
  place(typeId, worldPos, inventory) {
    const def = BUILDING_TYPES[typeId];
    if (!def) return null;
    if (!this.canAfford(typeId, inventory)) return null;

    // Deduct resources
    for (const [res, amt] of Object.entries(def.cost)) {
      inventory[res] = (inventory[res] ?? 0) - amt;
    }

    // Snap y to terrain surface if possible
    let pos = worldPos.clone();
    if (this._terrain?.getHeightAt) {
      pos.y = this._terrain.getHeightAt(pos.x, pos.z) ?? pos.y;
    }

    const id       = `b_${_nextId++}`;
    const mesh     = _createMesh(typeId);
    mesh.position.copy(pos);
    mesh.name = id;
    this._group.add(mesh);

    const building = {
      id,
      typeId,
      position:     { x: pos.x, y: pos.y, z: pos.z },
      hp:           def.maxHp,
      maxHp:        def.maxHp,
      powered:      false,
      active:       false,
      placedAt:     Date.now(),
      connections:  [],
      _mesh:        mesh,
      _light:       null,
    };

    // Town hub extra data
    if (typeId === 'town_hub') {
      building.influenceRadius = def.influenceRadius ?? 300;
    }

    this._buildings.set(id, building);

    if (typeId === 'extractor') {
      this._extractorTimers.set(id, 0);
    }

    return building;
  }

  /**
   * Remove a building by id. Returns 50 % of its cost to inventory (if provided).
   * @param {string} buildingId
   * @param {object|null} inventory
   * @returns {boolean}
   */
  remove(buildingId, inventory = null) {
    const b = this._buildings.get(buildingId);
    if (!b) return false;

    // Refund 50 %
    if (inventory) {
      const def = BUILDING_TYPES[b.typeId];
      if (def) {
        for (const [res, amt] of Object.entries(def.cost)) {
          inventory[res] = (inventory[res] ?? 0) + Math.floor(amt * 0.5);
        }
      }
    }

    this._group.remove(b._mesh);
    b._mesh.geometry?.dispose();
    if (Array.isArray(b._mesh.material)) {
      b._mesh.material.forEach(m => m.dispose());
    } else {
      b._mesh.material?.dispose();
    }

    this._buildings.delete(buildingId);
    this._extractorTimers.delete(buildingId);
    return true;
  }

  /**
   * Returns all buildings within `radius` units of `pos`.
   * @param {THREE.Vector3} pos
   * @param {number}        radius
   * @returns {object[]}
   */
  getBuildingsNear(pos, radius) {
    const r2 = radius * radius;
    const out = [];
    for (const b of this._buildings.values()) {
      const dx = b.position.x - pos.x;
      const dz = b.position.z - pos.z;
      if (dx * dx + dz * dz <= r2) out.push(b);
    }
    return out;
  }

  /** @returns {object[]} all building records (public, no _mesh/_light) */
  getAll() {
    return Array.from(this._buildings.values()).map(b => ({
      id:             b.id,
      typeId:         b.typeId,
      position:       b.position,
      hp:             b.hp,
      maxHp:          b.maxHp,
      powered:        b.powered,
      active:         b.active,
      placedAt:       b.placedAt,
      connections:    b.connections,
      influenceRadius: b.influenceRadius,
    }));
  }

  /**
   * Game-loop tick.
   * @param {number} dt        — delta time in seconds
   * @param {object} inventory — player inventory, mutated by extractors
   * @param {string} [primaryResource='carbon'] — planet's primary resource
   */
  update(dt, inventory, primaryResource = 'carbon') {
    this._recalculatePower();

    for (const b of this._buildings.values()) {
      // Extractor automation
      if (b.typeId === 'extractor' && b.powered && b.active) {
        const elapsed = (this._extractorTimers.get(b.id) ?? 0) + dt;
        this._extractorTimers.set(b.id, elapsed);
        if (elapsed >= 10) {
          const amount = 2 + Math.floor(Math.random() * 4); // 2-5
          inventory[primaryResource] = (inventory[primaryResource] ?? 0) + amount;
          this._extractorTimers.set(b.id, 0);
        }
      }

      // Research station: slowly generate nanites
      if (b.typeId === 'research_station' && b.powered && b.active) {
        if (!b._naniteTimer) b._naniteTimer = 0;
        b._naniteTimer += dt;
        if (b._naniteTimer >= 30) {
          inventory.nanites = (inventory.nanites ?? 0) + 5;
          b._naniteTimer = 0;
        }
      }

      // Farm: slowly generate carbon
      if (b.typeId === 'farm' && b.powered && b.active) {
        if (!b._farmTimer) b._farmTimer = 0;
        b._farmTimer += dt;
        if (b._farmTimer >= 15) {
          inventory.carbon = (inventory.carbon ?? 0) + 3;
          b._farmTimer = 0;
        }
      }

      // Visual: pulse powered light
      if (b._light) {
        b._light.intensity = 0.6 + 0.25 * Math.sin(Date.now() * 0.003);
      }
    }
  }

  /** Serialise all buildings to a plain object. */
  serialize() {
    return {
      nextId:    _nextId,
      buildings: Array.from(this._buildings.values()).map(b => ({
        id:          b.id,
        typeId:      b.typeId,
        position:    b.position,
        hp:          b.hp,
        maxHp:       b.maxHp,
        powered:     b.powered,
        active:      b.active,
        placedAt:    b.placedAt,
        connections: b.connections,
      })),
    };
  }

  /** Load previously serialised building data. */
  load(data) {
    if (!data) return;
    if (data.nextId) _nextId = data.nextId;

    // Clear existing
    for (const b of this._buildings.values()) {
      this._group.remove(b._mesh);
    }
    this._buildings.clear();
    this._extractorTimers.clear();

    for (const rec of (data.buildings ?? [])) {
      const pos  = new THREE.Vector3(rec.position.x, rec.position.y, rec.position.z);
      const mesh = _createMesh(rec.typeId);
      mesh.position.copy(pos);
      mesh.name = rec.id;
      this._group.add(mesh);

      const building = {
        ...rec,
        _mesh:  mesh,
        _light: null,
      };
      this._buildings.set(rec.id, building);
      if (rec.typeId === 'extractor') this._extractorTimers.set(rec.id, 0);
    }

    this._recalculatePower();
  }

  /** Clean up Three.js resources. */
  dispose() {
    for (const b of this._buildings.values()) {
      this._group.remove(b._mesh);
      b._mesh.geometry?.dispose();
      if (Array.isArray(b._mesh.material)) {
        b._mesh.material.forEach(m => m.dispose());
      } else {
        b._mesh.material?.dispose();
      }
    }
    this._buildings.clear();
    this._extractorTimers.clear();
    this._scene.remove(this._group);
  }

  // ── Static helpers ──────────────────────────────────────────────────────────

  /**
   * Creates a semi-transparent preview mesh for build-mode cursor.
   * @param {string} typeId
   * @returns {THREE.Mesh|THREE.Group}
   */
  static buildMesh(typeId) {
    return _createMesh(typeId, true);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _recalculatePower() {
    // Collect total generation and demand
    let totalGen  = 0;
    let totalDraw = 0;

    for (const b of this._buildings.values()) {
      const def = BUILDING_TYPES[b.typeId];
      if (!def) continue;
      totalGen  += def.powerGen;
      totalDraw += def.powerCost;
    }

    const hasPower = totalGen >= totalDraw;

    for (const b of this._buildings.values()) {
      const def    = BUILDING_TYPES[b.typeId];
      const needsPower = (def?.powerCost ?? 0) > 0;
      const wasPowered = b.powered;

      b.powered = hasPower || (def?.powerCost === 0);
      b.active  = b.powered && (b.hp > 0);

      // Add/remove glow light based on power state change
      if (b.powered && !wasPowered && needsPower) {
        b._light = _addPowerLight(b._mesh, b.typeId);
      } else if (!b.powered && wasPowered && b._light) {
        b._mesh.remove(b._light);
        b._light.dispose?.();
        b._light = null;
      }
    }
  }
}
