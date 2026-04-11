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

// ── Alien species definitions ──────────────────────────────────────────────
// [bodyScaleX, bodyScaleY, bodyScaleZ, headScale, neckLen, limbScale, hasExtraArms]
const SPECIES = [
  { name:'humanoid',    bx:1.0, by:1.0, bz:1.0, head:1.0, neck:0.0,  limb:1.0, extra:false },
  { name:'tall_lanky',  bx:0.7, by:1.4, bz:0.7, head:0.8, neck:0.05, limb:1.2, extra:false },
  { name:'squat_broad', bx:1.3, by:0.8, bz:1.3, head:1.2, neck:0.0,  limb:0.9, extra:false },
  { name:'four_armed',  bx:1.1, by:1.0, bz:1.1, head:0.9, neck:0.02, limb:0.9, extra:true  },
];

// Role-based outfit palettes [outfitTopH, outfitTopS, outfitTopL, bottomH, bottomS, bottomL, bootH]
const ROLE_PALETTES = {
  merchant:      [0.10, 0.60, 0.55,  0.10, 0.50, 0.40,  0.08],
  guard:         [0.60, 0.35, 0.25,  0.60, 0.30, 0.20,  0.00],
  wanderer:      [0.08, 0.30, 0.40,  0.10, 0.25, 0.30,  0.06],
  quest_giver:   [0.55, 0.50, 0.45,  0.55, 0.45, 0.35,  0.00],
  faction_agent: [0.75, 0.60, 0.35,  0.75, 0.55, 0.25,  0.00],
  bounty_hunter: [0.02, 0.55, 0.25,  0.00, 0.20, 0.15,  0.00],
  settler:       [0.12, 0.40, 0.45,  0.10, 0.35, 0.35,  0.10],
};

// Skin/chitin tone palettes (HSL)
const SKIN_TONES = [
  [0.07,0.40,0.55], [0.07,0.35,0.45], [0.07,0.30,0.38],
  [0.55,0.25,0.55], [0.55,0.30,0.45], [0.65,0.35,0.40],
  [0.35,0.30,0.45], [0.85,0.30,0.50], [0.05,0.15,0.65],
  [0.00,0.00,0.20], [0.00,0.00,0.55], [0.00,0.00,0.75],
];

function buildNpcMesh(factionId, seed) {
  const r    = seededRng(seed || 1);
  const group = new THREE.Group();

  // Species
  const sp   = SPECIES[Math.floor(r() * SPECIES.length)];

  // Skin tone
  const skinT = SKIN_TONES[Math.floor(r() * SKIN_TONES.length)];
  const skinCol = new THREE.Color().setHSL(
    (skinT[0] + (r()-0.5)*0.04+1)%1,
    Math.max(0, skinT[1] + (r()-0.5)*0.06),
    Math.max(0.15, skinT[2] + (r()-0.5)*0.08)
  );

  // Role palette
  const roleKey = ['merchant','guard','wanderer','quest_giver','faction_agent','bounty_hunter','settler'];
  const role    = roleKey[Math.floor(r() * roleKey.length)];
  const rp      = ROLE_PALETTES[role] || ROLE_PALETTES.wanderer;

  // Outfit variation
  const outTopCol  = new THREE.Color().setHSL((rp[0]+(r()-0.5)*0.10+1)%1, Math.min(1,rp[1]+(r()-0.5)*0.12), Math.min(0.85,rp[2]+(r()-0.5)*0.10));
  const outBotCol  = new THREE.Color().setHSL((rp[3]+(r()-0.5)*0.08+1)%1, Math.min(1,rp[4]+(r()-0.5)*0.10), Math.min(0.85,rp[5]+(r()-0.5)*0.08));
  const bootCol    = new THREE.Color().setHSL((rp[6]+(r()-0.5)*0.05+1)%1, 0.35+(r()-0.5)*0.10,              0.22+(r()-0.5)*0.08);
  const beltCol    = new THREE.Color(0x4a2e10);
  const factionCol = new THREE.Color(FACTIONS[factionId]?.color ?? '#aabbcc');

  // Materials
  const skinMat    = new THREE.MeshStandardMaterial({ color: skinCol,   roughness:0.75, metalness:0.05 });
  const topMat     = new THREE.MeshStandardMaterial({ color: outTopCol,  roughness:0.65, metalness:0.15 });
  const botMat     = new THREE.MeshStandardMaterial({ color: outBotCol,  roughness:0.70, metalness:0.10 });
  const bootMat    = new THREE.MeshStandardMaterial({ color: bootCol,    roughness:0.85, metalness:0.20 });
  const beltMat    = new THREE.MeshStandardMaterial({ color: beltCol,    roughness:0.90, metalness:0.08 });
  const factionMat = new THREE.MeshStandardMaterial({ color: factionCol, emissive: factionCol, emissiveIntensity:0.55, roughness:0.35, metalness:0.30 });

  // ── Body (torso) ──
  const bodyGeo = new THREE.CapsuleGeometry(0.25 * sp.bx, 0.7 * sp.by, 6, 12);
  const body    = new THREE.Mesh(bodyGeo, topMat);
  body.position.y = 0.75 * sp.by;
  body.scale.set(sp.bx, 1, sp.bz);
  body.castShadow = true;
  group.add(body);

  // ── Head ──
  const headGeo = new THREE.SphereGeometry(0.22 * sp.head, 14, 10);
  const head    = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.55 * sp.by + sp.neck;
  head.castShadow = true;
  group.add(head);

  // ── Eyes (emissive) ──
  const eyeCol  = new THREE.Color().setHSL(r(), 0.9, 0.6);
  const eyeMat  = new THREE.MeshStandardMaterial({ color: eyeCol, emissive: eyeCol, emissiveIntensity:1.0, roughness:0.05 });
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035*sp.head, 6, 5), eyeMat);
    eye.position.set(ex, 1.58*sp.by + sp.neck, 0.18*sp.head);
    group.add(eye);
  }

  // ── Hips / Pants ──
  const hipGeo = new THREE.CylinderGeometry(0.20*sp.bx, 0.18*sp.bx, 0.22, 10);
  const hip    = new THREE.Mesh(hipGeo, botMat);
  hip.position.y = 0.32;
  group.add(hip);

  // ── Legs ──
  for (const lx of [-0.10*sp.bx, 0.10*sp.bx]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.08,0.30*sp.by,8), botMat);
    thigh.position.set(lx, 0.14, 0);
    group.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.08,0.28*sp.by,8), botMat);
    shin.position.set(lx, -0.16, 0);
    group.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.10,0.22), bootMat);
    boot.position.set(lx, -0.34, 0.04);
    group.add(boot);
  }

  // ── Belt ──
  const beltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22*sp.bx,0.22*sp.bx,0.06,12), beltMat);
  beltMesh.position.y = 0.35;
  group.add(beltMesh);

  // ── Arms ──
  const armAngles = sp.extra ? [-0.35,-0.15,0.15,0.35] : [-0.28,0.28];
  for (const ax of armAngles) {
    const sign = ax < 0 ? -1 : 1;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.065,0.28*sp.limb,8), topMat);
    upper.position.set(sign*(0.30*sp.bx + Math.abs(ax)*0.15), 0.95*sp.by, 0);
    upper.rotation.z = ax * 1.5;
    group.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07*sp.limb,7,6), skinMat);
    hand.position.set(sign*(0.38*sp.bx + Math.abs(ax)*0.25), 0.70*sp.by - 0.08, 0);
    group.add(hand);
  }

  // ── Faction insignia ring (ground level) ──
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36*sp.bx, 0.032, 7, 28), factionMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  // ── Role accessories ──
  if (role === 'merchant' || role === 'settler') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22*sp.bx,0.28*sp.by,0.12), botMat);
    pack.position.set(0, 0.90*sp.by, -0.22*sp.bz);
    group.add(pack);
  }
  if (role === 'guard' || role === 'bounty_hunter') {
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.04), bootMat);
    holster.position.set(0.24*sp.bx, 0.18, 0);
    group.add(holster);
  }

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

    const npcId = nextId();
    const mesh = buildNpcMesh(resolvedFaction, (npcId * 1664525 + 1013904223) >>> 0);
    mesh.position.copy(worldPos instanceof THREE.Vector3 ? worldPos : v3(...worldPos));
    this._scene?.add(mesh);

    const npc = {
      id:            npcId,
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
