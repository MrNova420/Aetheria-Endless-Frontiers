/**
 * src/npcs.js  –  AETHERIA: Endless Frontiers  –  Alien NPC System
 *
 * Spawns, updates, and manages alien NPCs using Three.js meshes.
 * Integrates with FactionManager for rep-based dialogue options.
 */

import * as THREE from 'three';
import { FACTIONS } from './factions.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 1;
function nextId() { return _uid++; }

function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

// ─── NPC Type Definitions ────────────────────────────────────────────────────
export const NPC_TYPES = {
  merchant: {
    role: 'merchant',
    factionAffinity: 'gek',
    dialoguePools: {
      greeting: [
        'Finest goods this side of the Fade — step closer!',
        'You look like someone with Units to spend. Welcome.',
        'Trade or move on, traveller. Time is profit.',
      ],
      trade: [
        "I've got wares you won't find at any station.",
        'Good choice. My prices are fair — for today.',
        'Stack it high, sell it low. That is the First Spawn way.',
      ],
      farewell: [
        'May your cargo hold stay full.',
        'Come back when your pockets are heavier.',
        'Safe travels, friend. Avoid the pirates.',
      ],
    },
  },

  guard: {
    role: 'guard',
    factionAffinity: 'sentinel_order',
    dialoguePools: {
      greeting: [
        'Halt. State your business.',
        'Move along unless you have authorisation.',
        'I am watching you, traveller.',
      ],
      hostile: [
        'You should not have come here.',
        'Surrender or be destroyed.',
        'Trespassers will be eliminated.',
      ],
      farewell: [
        'Keep moving.',
        'Do not test my patience.',
        'You are permitted to leave.',
      ],
    },
  },

  wanderer: {
    role: 'wanderer',
    factionAffinity: null,
    dialoguePools: {
      greeting: [
        'Just passing through, same as you.',
        'Strange skies here. I like it.',
        'Have you seen the aurora over the southern ridge?',
      ],
      rumour: [
        'Word is, there is a buried ship two ridges east.',
        'The Atlas interfaces have been flickering lately. Unsettling.',
        'I heard the pirates found something big in the outer belt.',
      ],
      farewell: [
        'Safe paths.',
        'The horizon calls.',
        'Until next time.',
      ],
    },
  },

  quest_giver: {
    role: 'quest_giver',
    factionAffinity: 'korvax',
    dialoguePools: {
      greeting: [
        'Traveller! I require assistance with a matter of some urgency.',
        'You appear capable. I have a proposition.',
        'The Convergence has a task that demands an outside perspective.',
      ],
      quest: [
        'Recover the data core from the abandoned site to the north.',
        'Locate our missing survey team — last signal from grid seven.',
        'Bring me three samples of Quantum Essence for analysis.',
      ],
      farewell: [
        'Return swiftly. Time erodes opportunity.',
        'The Convergence remembers its debts.',
        'Your assistance will be logged.',
      ],
    },
  },

  faction_agent: {
    role: 'faction_agent',
    factionAffinity: 'atlas',
    dialoguePools: {
      greeting: [
        'The Atlas watches. Always.',
        'You have arrived as the patterns predicted.',
        'Another loop, another meeting. Welcome.',
      ],
      faction: [
        'Your service to the Foundation does not go unnoticed.',
        'There are assignments for those who prove themselves.',
        'The simulation requires balance. Will you help maintain it?',
      ],
      farewell: [
        'The path continues.',
        'Seek the stations. They will guide you.',
        'Until the simulation resets.',
      ],
    },
  },

  bounty_hunter: {
    role: 'bounty_hunter',
    factionAffinity: 'outlaw',
    dialoguePools: {
      greeting: [
        'Your bounty is worth more than your company.',
        'I have been tracking you for three systems.',
        'Nothing personal. This is business.',
      ],
      chase: [
        'There is nowhere left to run.',
        'You made this harder than it needed to be.',
        'I always collect.',
      ],
      negotiate: [
        'Pay double the bounty and I walk away.',
        'My employer wants you alive. That can change.',
        'I could be persuaded to forget I found you.',
      ],
    },
  },

  settler: {
    role: 'settler',
    factionAffinity: 'gek',
    dialoguePools: {
      greeting: [
        'Built this place with my own hands. Three years and counting.',
        'You are the first traveller we have seen in months.',
        'Welcome to our little corner of the galaxy.',
      ],
      local: [
        'The soil here is rich — excellent for farming.',
        'We had a sentinel incident last cycle. Still rebuilding.',
        'The northern caves hold something ancient. We leave them alone.',
      ],
      farewell: [
        'Come back any time. We keep the lights on.',
        'Safe skies, friend.',
        'Tell others about us — we could use the trade.',
      ],
    },
  },
};

// ─── Shared geometry/material cache ──────────────────────────────────────────
const _geoCache  = {};
const _matCache  = {};

function getBodyGeo() {
  if (!_geoCache.body) _geoCache.body = new THREE.CapsuleGeometry(0.35, 1.4, 8, 16);
  return _geoCache.body;
}
function getHeadGeo() {
  if (!_geoCache.head) _geoCache.head = new THREE.SphereGeometry(0.28, 16, 12);
  return _geoCache.head;
}
function getRingGeo() {
  if (!_geoCache.ring) _geoCache.ring = new THREE.TorusGeometry(0.42, 0.035, 8, 32);
  return _geoCache.ring;
}

function getFactionMat(factionId) {
  const key = factionId ?? 'none';
  if (!_matCache[key]) {
    const color = FACTIONS[factionId]?.color ?? '#ffffff';
    _matCache[key] = new THREE.MeshStandardMaterial({
      color:     new THREE.Color(color),
      emissive:  new THREE.Color(color),
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.3,
    });
  }
  return _matCache[key];
}

function buildNpcMesh(factionId) {
  const group    = new THREE.Group();
  const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.7, metalness: 0.2 });
  const headMat  = new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.5, metalness: 0.1 });

  const body = new THREE.Mesh(getBodyGeo(), bodyMat);
  body.position.y = 0.7;
  body.castShadow  = true;

  const head = new THREE.Mesh(getHeadGeo(), headMat);
  head.position.y = 1.7;
  head.castShadow  = true;

  const ring = new THREE.Mesh(getRingGeo(), getFactionMat(factionId));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;

  group.add(body, head, ring);
  return group;
}

// ─── NpcManager ───────────────────────────────────────────────────────────────
export class NpcManager {
  constructor(scene, terrain) {
    this._scene    = scene;
    this._terrain  = terrain;
    this._npcs     = [];
    this._maxNpcs  = 20;
    this._fm       = null;

    // Wanderer direction timers
    this._wanderTimers = new Map();
    this._wanderDirs   = new Map();
  }

  setFactionManager(fm) {
    this._fm = fm;
  }

  // ── Spawn ────────────────────────────────────────────────────────────────────
  spawnNpc(type, worldPos, factionId) {
    if (this._npcs.length >= this._maxNpcs) return null;

    const typeData = NPC_TYPES[type] ?? NPC_TYPES.wanderer;
    const resolvedFaction = factionId ?? typeData.factionAffinity ?? 'gek';

    const mesh = buildNpcMesh(resolvedFaction);
    mesh.position.copy(worldPos instanceof THREE.Vector3 ? worldPos : v3(...worldPos));
    this._scene?.add(mesh);

    const npc = {
      id:            nextId(),
      type,
      pos:           mesh.position,
      factionId:     resolvedFaction,
      hp:            100,
      state:         'idle',
      dialogueIndex: 0,
      mesh,
      patrolA:       mesh.position.clone().add(v3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)),
      patrolB:       mesh.position.clone().add(v3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)),
      patrolTarget:  0,
    };

    this._npcs.push(npc);
    this._wanderTimers.set(npc.id, 5 + Math.random() * 10);
    this._wanderDirs.set(npc.id, new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    return npc;
  }

  despawnNpc(id) {
    const idx = this._npcs.findIndex(n => n.id === id);
    if (idx === -1) return;
    const npc = this._npcs[idx];
    this._scene?.remove(npc.mesh);
    npc.mesh.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
    this._npcs.splice(idx, 1);
    this._wanderTimers.delete(id);
    this._wanderDirs.delete(id);
  }

  getNearbyNpcs(pos, radius) {
    const p = pos instanceof THREE.Vector3 ? pos : v3(...pos);
    return this._npcs.filter(n => n.pos.distanceTo(p) <= radius);
  }

  // ── Interaction / Dialogue ───────────────────────────────────────────────────
  interact(npcId, playerPos) {
    const npc = this._npcs.find(n => n.id === npcId);
    if (!npc) return null;
    return this._buildDialogue(npc);
  }

  getDialogue(npcId) {
    const npc = this._npcs.find(n => n.id === npcId);
    if (!npc) return null;
    return this._buildDialogue(npc);
  }

  _buildDialogue(npc) {
    const typeData  = NPC_TYPES[npc.type] ?? NPC_TYPES.wanderer;
    const faction   = FACTIONS[npc.factionId];
    const rep       = this._fm?.getRep(npc.factionId) ?? 0;
    const rank      = this._fm?.getRank(npc.factionId) ?? 'neutral';

    const greetPool = typeData.dialoguePools.greeting ?? [];
    const lines     = greetPool.length > 0
      ? [greetPool[npc.dialogueIndex % greetPool.length]]
      : ['...' ];

    npc.dialogueIndex++;

    // Build contextual options based on rep
    const options = [{ label: 'Leave', action: 'leave' }];

    if (npc.type === 'merchant' || npc.type === 'settler') {
      options.unshift({ label: 'Browse shop', action: 'shop' });
    }
    if (npc.type === 'quest_giver') {
      options.unshift({ label: 'Hear the quest', action: 'quest' });
    }
    if (npc.type === 'bounty_hunter' && rep >= 0) {
      options.unshift({ label: 'Negotiate', action: 'negotiate' });
    }
    if (rep >= 20) {
      options.unshift({ label: 'Ask for rumours', action: 'rumour' });
    }
    if (rep >= 60) {
      options.unshift({ label: 'Request faction mission', action: 'faction_mission' });
    }

    // Shop items for merchants
    let shopItems = null;
    if (npc.type === 'merchant') {
      const exclusives = faction?.uniqueItems ?? [];
      shopItems = [...exclusives.slice(0, 1), 'Carbon', 'Ferrite Dust', 'Di-Hydrogen'];
    }

    return {
      npcName:     `${faction?.name ?? 'Unknown'} ${typeData.role}`,
      factionName: faction?.name ?? '???',
      factionIcon: faction?.icon ?? '?',
      lines,
      options,
      shopItems,
      rank,
    };
  }

  // ── Update loop ──────────────────────────────────────────────────────────────
  update(dt, playerPos) {
    const pPos = playerPos instanceof THREE.Vector3 ? playerPos : v3(...(playerPos ?? [0, 0, 0]));
    const SPEED = 2.0;

    for (const npc of this._npcs) {
      const dist = npc.pos.distanceTo(pPos);

      // Face player when close
      if (dist < 8) {
        npc.mesh.lookAt(pPos.x, npc.pos.y, pPos.z);
      }

      if (npc.type === 'wanderer') {
        this._updateWanderer(npc, dt, SPEED);
      } else if (npc.type === 'guard') {
        this._updateGuard(npc, dt, SPEED);
      } else if (npc.type === 'bounty_hunter') {
        this._updateBountyHunter(npc, dt, SPEED, pPos);
      }
    }
  }

  _updateWanderer(npc, dt, speed) {
    let timer = this._wanderTimers.get(npc.id) - dt;
    if (timer <= 0) {
      timer = 5 + Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;
      this._wanderDirs.set(npc.id, new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
    }
    this._wanderTimers.set(npc.id, timer);

    const dir = this._wanderDirs.get(npc.id);
    if (dir) {
      npc.pos.addScaledVector(dir, speed * dt * 0.3);
    }
  }

  _updateGuard(npc, dt, speed) {
    const target = npc.patrolTarget === 0 ? npc.patrolA : npc.patrolB;
    const diff   = target.clone().sub(npc.pos);
    diff.y = 0;
    const dist = diff.length();

    if (dist < 0.5) {
      npc.patrolTarget = 1 - npc.patrolTarget;
    } else {
      npc.pos.addScaledVector(diff.normalize(), speed * dt * 0.5);
    }
  }

  _updateBountyHunter(npc, dt, speed, pPos) {
    // Chase player when wanted — caller should pass wantedLevel if available
    const diff = pPos.clone().sub(npc.pos);
    diff.y = 0;
    const dist = diff.length();
    if (dist > 1.5) {
      npc.pos.addScaledVector(diff.normalize(), speed * dt);
    }
    npc.mesh.position.copy(npc.pos);
  }

  // ── Settlement spawner ────────────────────────────────────────────────────────
  spawnSettlement(worldPos, factionId, size) {
    const sizes = { camp: 3, village: 8, town: 15, city: 30 };
    const count = sizes[size] ?? 3;
    const base  = worldPos instanceof THREE.Vector3 ? worldPos : v3(...worldPos);
    const cols  = Math.ceil(Math.sqrt(count));
    const spawned = [];

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isPerimeter = col === 0 || col === cols - 1 || row === 0 || row === cols - 1;
      const type = isPerimeter ? 'guard' : (i === 0 ? 'merchant' : 'settler');
      const pos  = base.clone().add(v3(col * 3, 0, row * 3));
      const npc  = this.spawnNpc(type, pos, factionId);
      if (npc) spawned.push(npc);
    }

    return spawned;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  serialize() {
    return this._npcs.map(n => ({
      id:        n.id,
      type:      n.type,
      pos:       { x: n.pos.x, y: n.pos.y, z: n.pos.z },
      factionId: n.factionId,
      hp:        n.hp,
      state:     n.state,
    }));
  }

  load(data) {
    if (!Array.isArray(data)) return;
    for (const d of data) {
      const pos = v3(d.pos.x, d.pos.y, d.pos.z);
      const npc = this.spawnNpc(d.type, pos, d.factionId);
      if (npc) {
        npc.id    = d.id;
        npc.hp    = d.hp;
        npc.state = d.state;
      }
    }
  }

  dispose() {
    for (const npc of [...this._npcs]) {
      this.despawnNpc(npc.id);
    }
    for (const geo of Object.values(_geoCache)) geo.dispose();
    for (const mat of Object.values(_matCache)) mat.dispose();
  }
}
