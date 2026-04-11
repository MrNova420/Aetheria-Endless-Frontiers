/**
 * building.js — Satisfactory-style factory/empire building system
 * Handles placement, automation, power grids, and serialization.
 */

import * as THREE from 'three';

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

// ─── Per-type 5-layer colour palettes ────────────────────────────────────────
//   base: main body, accent: secondary surface, trim: detail lines,
//   emissive: glow/light panel, window: window/port colour
const BUILDING_PALETTES = {
  extractor:       { base:0x5c3010, accent:0xc07020, trim:0xffaa00, emissive:0xff6600, window:0xff4400, lightR:0.8,lightG:0.4,lightB:0.1 },
  conveyor:        { base:0x3a3a3a, accent:0x888800, trim:0xddcc00, emissive:null,     window:null,     lightR:0.9,lightG:0.8,lightB:0.1 },
  storage:         { base:0x1e3650, accent:0x4488aa, trim:0x88ccee, emissive:0x2266cc, window:0x2266cc, lightR:0.2,lightG:0.5,lightB:1.0 },
  power_generator: { base:0x0e0e1a, accent:0x004488, trim:0x0088ff, emissive:0x00aaff, window:0x00ccff, lightR:0.0,lightG:0.6,lightB:1.0 },
  research_station:{ base:0xe8e8f0, accent:0x00ccaa, trim:0x80ffee, emissive:0x00bbaa, window:0x00ddcc, lightR:0.0,lightG:0.9,lightB:0.8 },
  turret:          { base:0x180808, accent:0x440000, trim:0xff2222, emissive:0xff0000, window:0xff4444, lightR:1.0,lightG:0.1,lightB:0.1 },
  town_hub:        { base:0xc8aa88, accent:0x886030, trim:0xffcc44, emissive:0xffaa22, window:0xffee88, lightR:1.0,lightG:0.8,lightB:0.3 },
  wall:            { base:0x505050, accent:0x383838, trim:0x686868, emissive:null,     window:null,     lightR:0.5,lightG:0.5,lightB:0.5 },
  door:            { base:0x404040, accent:0x303030, trim:0x00ff44, emissive:0x00cc22, window:0x00ff00, lightR:0.0,lightG:1.0,lightB:0.3 },
  farm:            { base:0xc87040, accent:0x885028, trim:0x40cc40, emissive:null,     window:null,     lightR:0.4,lightG:0.9,lightB:0.2 },
};

/** Returns a detailed Three.js group representing a building type. */
function _createMesh(typeId, transparent = false) {
  const def = BUILDING_TYPES[typeId];
  if (!def) return new THREE.Group();

  const pal     = BUILDING_PALETTES[typeId] ?? { base:0x445566, accent:0x6688aa, trim:0x88aacc, emissive:0x4466aa, window:0x4488cc, lightR:0.3,lightG:0.5,lightB:1.0 };
  const opacity = transparent ? 0.45 : 1.0;
  const tr      = transparent;

  const baseMat   = new THREE.MeshStandardMaterial({ color:pal.base,   roughness:0.65, metalness:0.45, transparent:tr, opacity });
  const accMat    = new THREE.MeshStandardMaterial({ color:pal.accent,  roughness:0.45, metalness:0.65, transparent:tr, opacity });
  const trimMat_b = new THREE.MeshStandardMaterial({ color:pal.trim,    roughness:0.25, metalness:0.85, transparent:tr, opacity });
  const emMat     = pal.emissive != null
    ? new THREE.MeshStandardMaterial({ color:pal.emissive, emissive:new THREE.Color(pal.emissive), emissiveIntensity:0.80, roughness:0.20, metalness:0.10, transparent:tr, opacity })
    : null;
  const winMat    = pal.window != null
    ? new THREE.MeshStandardMaterial({ color:pal.window, emissive:new THREE.Color(pal.window), emissiveIntensity:0.60, roughness:0.05, metalness:0.05, transparent:true, opacity:tr ? 0.4 : 0.75 })
    : null;

  const root = new THREE.Group();
  root.userData.typeId = typeId;

  // ── Main body geometry ───────────────────────────────────────────────────
  let bodyGeo;
  let bodyH = 2;   // used for accent placement
  switch (typeId) {
    case 'extractor':       bodyGeo = new THREE.CylinderGeometry(1.2, 1.8, 3.5, 8); bodyH = 3.5; break;
    case 'conveyor':        bodyGeo = new THREE.BoxGeometry(4, 0.4, 0.6);            bodyH = 0.4; break;
    case 'storage':         bodyGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);          bodyH = 2.5; break;
    case 'power_generator': bodyGeo = new THREE.CylinderGeometry(1.0, 1.4, 4, 6);   bodyH = 4.0; break;
    case 'research_station':bodyGeo = new THREE.BoxGeometry(3, 2.5, 3);              bodyH = 2.5; break;
    case 'turret':          bodyGeo = new THREE.CylinderGeometry(0.5, 0.8, 2, 8);   bodyH = 2.0; break;
    case 'town_hub':        bodyGeo = new THREE.BoxGeometry(5, 4, 5);                bodyH = 4.0; break;
    case 'wall':            bodyGeo = new THREE.BoxGeometry(4, 3, 0.5);              bodyH = 3.0; break;
    case 'door':            bodyGeo = new THREE.BoxGeometry(2, 3, 0.4);              bodyH = 3.0; break;
    case 'farm':            bodyGeo = new THREE.BoxGeometry(4, 0.6, 4);              bodyH = 0.6; break;
    default:                bodyGeo = new THREE.BoxGeometry(2, 2, 2);                bodyH = 2.0;
  }

  const body = new THREE.Mesh(bodyGeo, baseMat);
  body.castShadow    = !transparent;
  body.receiveShadow = !transparent;
  root.add(body);

  // ── Accent surface panels (second colour layer on sides) ─────────────────
  switch (typeId) {
    case 'extractor': {
      // Ribbed extraction bands around the cylinder
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(1.22 - i*0.06, 1.82 - i*0.06, 0.18, 8), accMat);
        band.position.y = -0.8 + i * 0.9;
        root.add(band);
      }
      // Drill bit tip
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 8), trimMat_b);
      tip.position.y = -2.35;
      root.add(tip);
      // Extraction pipe
      if (emMat) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.0, 8), emMat);
        pipe.position.set(0.9, 0.5, 0);
        root.add(pipe);
      }
      break;
    }
    case 'conveyor': {
      // Rollers along the belt
      for (let i = 0; i < 5; i++) {
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.62, 8), accMat);
        roller.rotation.z = Math.PI / 2;
        roller.position.x = -1.5 + i * 0.75;
        root.add(roller);
      }
      // Safety stripe on sides
      const strip = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.08, 0.62), trimMat_b);
      strip.position.y = 0.20;
      root.add(strip);
      break;
    }
    case 'storage': {
      // Corner reinforcement beams
      for (const cx of [-1.15, 1.15]) for (const cz of [-1.15, 1.15]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.52, 0.14), trimMat_b);
        beam.position.set(cx, 0, cz);
        root.add(beam);
      }
      // Access door panel
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.12), accMat);
      door.position.set(0, -0.25, 1.32);
      root.add(door);
      // Status light
      if (winMat) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), winMat);
        light.position.set(0.55, 0.9, 1.33);
        root.add(light);
      }
      break;
    }
    case 'power_generator': {
      // Hexagonal conduit rings
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 6, 18), trimMat_b);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -1.0 + i * 1.0;
        root.add(ring);
      }
      // Coolant pipes (emissive)
      if (emMat) {
        for (const angle of [0, Math.PI * 2/3, Math.PI * 4/3]) {
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 4.2, 6), emMat);
          pipe.position.set(Math.cos(angle) * 1.05, 0, Math.sin(angle) * 1.05);
          root.add(pipe);
        }
      }
      // Top dome vent
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.60, 10, 8, 0, Math.PI*2, 0, Math.PI*0.5), accMat);
      dome.position.y = 2.0;
      root.add(dome);
      break;
    }
    case 'research_station': {
      // White/teal panelled facade
      const facade = new THREE.Mesh(new THREE.BoxGeometry(3.02, 1.2, 0.12), accMat);
      facade.position.set(0, 0.2, 1.57);
      root.add(facade);
      // Window strip (emissive)
      if (winMat) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.40, 0.08), winMat);
        win.position.set(0, 0.3, 1.62);
        root.add(win);
      }
      // Antenna array on top
      for (const ax of [-0.8, 0, 0.8]) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 6), trimMat_b);
        ant.position.set(ax, 1.65, 0);
        root.add(ant);
        if (emMat) {
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), emMat);
          tip.position.set(ax, 2.10, 0);
          root.add(tip);
        }
      }
      break;
    }
    case 'turret': {
      // Base ring (accent)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.4, 12), accMat);
      base.position.y = -0.8;
      root.add(base);
      // Barrel housing
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 10), accMat);
      housing.position.y = 1.2;
      root.add(housing);
      // Gun barrels (emissive tips)
      for (const bx of [-0.15, 0.15]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), trimMat_b);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(bx, 1.2, -0.75);
        root.add(barrel);
        if (emMat) {
          const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.10, 8), emMat);
          muzzle.rotation.x = Math.PI / 2;
          muzzle.position.set(bx, 1.2, -1.16);
          root.add(muzzle);
        }
      }
      // Targeting sensor eye
      if (winMat) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), winMat);
        eye.position.set(0, 1.35, 0.43);
        root.add(eye);
      }
      break;
    }
    case 'town_hub': {
      // Colonnade columns on all 4 sides
      for (const cx of [-1.8, 1.8]) for (const cz of [-1.8, 1.8]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.2, 10), accMat);
        col.position.set(cx, 0, cz);
        root.add(col);
      }
      // Roof overhang
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.22, 5.8), trimMat_b);
      roof.position.y = 2.11;
      root.add(roof);
      // Dome on top
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10, 0, Math.PI*2, 0, Math.PI*0.5), accMat);
      dome.position.y = 2.22;
      root.add(dome);
      // Window band all around
      if (winMat) {
        const winBand = new THREE.Mesh(new THREE.BoxGeometry(5.02, 0.55, 0.10), winMat);
        winBand.position.set(0, 0.5, 2.56);
        root.add(winBand);
        const winBandB = winBand.clone();
        winBandB.position.set(0, 0.5, -2.56);
        root.add(winBandB);
        const winBandL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 5.02), winMat);
        winBandL.position.set(2.56, 0.5, 0);
        root.add(winBandL);
        const winBandR = winBandL.clone();
        winBandR.position.set(-2.56, 0.5, 0);
        root.add(winBandR);
      }
      // Lamp post lights
      if (emMat) {
        for (const lx of [-2.2, 2.2]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.5, 6), baseMat);
          post.position.set(lx, 0.75, 0);
          root.add(post);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 6), emMat);
          lamp.position.set(lx, 3.5, 0);
          root.add(lamp);
        }
      }
      break;
    }
    case 'wall': {
      // Top crenellations
      for (let i = 0; i < 4; i++) {
        const crenel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.55), accMat);
        crenel.position.set(-1.35 + i * 0.9, 1.75, 0);
        root.add(crenel);
      }
      // Side trim strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.10, 0.52), trimMat_b);
      strip.position.y = 1.0;
      root.add(strip);
      break;
    }
    case 'door': {
      // Door arch
      const archGeo = new THREE.TorusGeometry(0.7, 0.12, 8, 16, Math.PI);
      const arch    = new THREE.Mesh(archGeo, trimMat_b);
      arch.position.set(0, 1.5, 0.25);
      root.add(arch);
      // Status light panel
      if (winMat) {
        const status = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.08), winMat);
        status.position.set(0, 2.55, 0.25);
        root.add(status);
      }
      // Side panels (accent)
      for (const dx of [-0.75, 0.75]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.8, 0.10), accMat);
        panel.position.set(dx, 0, 0.22);
        root.add(panel);
      }
      break;
    }
    case 'farm': {
      // Soil ridge rows
      for (let i = 0; i < 4; i++) {
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 0.45), accMat);
        ridge.position.set(0, 0.39, -1.2 + i * 0.8);
        root.add(ridge);
      }
      // Irrigation pipe
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.1, 6), trimMat_b);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.y = 0.55;
      root.add(pipe);
      // Growing indicator light
      if (emMat) {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), emMat);
        glow.position.set(0, 0.65, 0);
        root.add(glow);
      }
      break;
    }
  }

  root.castShadow    = !transparent;
  root.receiveShadow = !transparent;
  return root;
}

/** Attach a PointLight to a powered-building group. */
function _addPowerLight(mesh, typeId) {
  const pal   = BUILDING_PALETTES[typeId] ?? { lightR:0.3, lightG:0.5, lightB:1.0 };
  const col   = new THREE.Color(pal.lightR, pal.lightG, pal.lightB);
  const light = new THREE.PointLight(col, 1.0, 14);
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
    b._mesh.traverse(c => {
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material?.dispose();
    });
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
