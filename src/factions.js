/**
 * src/factions.js  –  AETHERIA: Endless Frontiers  –  Faction System
 *
 * NMS+GTA-style faction management: reputations, wars, alliances, territories.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

// ─── Rank thresholds ─────────────────────────────────────────────────────────
export const FACTION_RANKS = [
  'hostile',    // rep < -60
  'unfriendly', // rep < -20
  'neutral',    // rep < 20
  'friendly',   // rep < 60
  'honored',    // rep < 80
  'exalted',    // rep >= 80
];

function repToRank(rep) {
  if (rep < -60) return 'hostile';
  if (rep < -20) return 'unfriendly';
  if (rep <  20) return 'neutral';
  if (rep <  60) return 'friendly';
  if (rep <  80) return 'honored';
  return 'exalted';
}

// ─── Faction Definitions ─────────────────────────────────────────────────────
export const FACTIONS = {
  gek: {
    id: 'gek',
    name: 'Gek First Spawn',
    icon: '🐸',
    description: 'Cunning merchant lords who once ruled the galaxy through commerce and manipulation.',
    homeSystem: 0,
    baseRep: 0,
    color: '#f5c518',
    specialization: 'trade',
    relations: { vykeen: -30, korvax: 10, atlas: 20, outlaw: -10, sentinel_order: 0 },
    uniqueItems: ['Gek Charm', 'First Spawn Relic', 'Trade Route Map'],
    lore: 'The Gek First Spawn built the first interstellar trade empire, amassing wealth across seventeen galaxies before the Vykeen wars shattered their hegemony. Today they rebuild through commerce, their merchant fleets weaving webs of profit across every inhabited system.',
  },

  vykeen: {
    id: 'vykeen',
    name: 'Vykeen Warrior Clans',
    icon: '⚔️',
    description: 'Fierce reptilian warriors who value combat prowess above all else.',
    homeSystem: 1,
    baseRep: 0,
    color: '#c0392b',
    specialization: 'combat',
    relations: { gek: -30, korvax: -20, atlas: -10, outlaw: 30, sentinel_order: -40 },
    uniqueItems: ['Vykeen Dagger', 'Battle Trophy', 'Warrior Crest', 'Combat Stimulant'],
    lore: 'Born from a world of predators, the Vykeen forged their civilisation in the crucible of endless war, and they see no reason to stop. They respect strength above all, and a traveller who bests them in combat earns grudging admiration that no amount of trade can buy.',
  },

  korvax: {
    id: 'korvax',
    name: 'Korvax Convergence',
    icon: '🔬',
    description: 'Collective of synthetic beings devoted to scientific understanding of the cosmos.',
    homeSystem: 2,
    baseRep: 0,
    color: '#2980b9',
    specialization: 'science',
    relations: { gek: 10, vykeen: -20, atlas: 40, outlaw: -30, sentinel_order: 20 },
    uniqueItems: ['Convergence Cube', 'Neural Interface', 'Korvax Casing', 'Data Archive'],
    lore: 'The Korvax upload their consciousness into shared shells and seek the equation that describes all of existence, believing the Atlas holds its final variable. Their laboratories dot the galaxy, cataloguing every phenomenon from quantum fluctuations to dying suns.',
  },

  atlas: {
    id: 'atlas',
    name: 'Atlas Foundation',
    icon: '🔴',
    description: 'Enigmatic sphere-worshippers who serve the ancient simulation intelligence.',
    homeSystem: 3,
    baseRep: 0,
    color: '#8e44ad',
    specialization: 'mystery',
    relations: { gek: 20, vykeen: -10, korvax: 40, outlaw: -50, sentinel_order: 60 },
    uniqueItems: ['Atlas Stone', 'Atlas Pass v1', 'Atlas Pass v2', 'Atlas Pass v3', 'Remembrance'],
    lore: 'The Atlas Foundation does not truly belong to any race; it is the administrative arm of the simulation itself, granting boons to those who serve its inscrutable purpose. Pilgrims travel billions of light-years to stand before an Atlas Station, hoping the red sphere will answer the question no traveller dares speak aloud.',
  },

  outlaw: {
    id: 'outlaw',
    name: 'Pirate Syndicate',
    icon: '💀',
    description: 'Loose confederation of pirates, smugglers, and mercenaries operating in lawless space.',
    homeSystem: 4,
    baseRep: 0,
    color: '#e67e22',
    specialization: 'piracy',
    relations: { gek: -10, vykeen: 30, korvax: -30, atlas: -50, sentinel_order: -100 },
    uniqueItems: ['Stolen Goods', 'Contraband Manifest', 'Black Market Token', 'Pirate Chart'],
    lore: 'No flag binds the Pirate Syndicate; they are united only by profit and the absence of scruples, gathering in the uncharted rifts between star clusters where Sentinel drones cannot reach. Their black markets carry things no legitimate trader will touch, at prices that reflect the danger of asking questions.',
  },

  sentinel_order: {
    id: 'sentinel_order',
    name: 'Sentinel Order',
    icon: '🤖',
    description: 'Autonomous robotic enforcers who maintain the balance of the simulation at all costs.',
    homeSystem: 5,
    baseRep: 0,
    color: '#7f8c8d',
    specialization: 'law',
    relations: { gek: 0, vykeen: -40, korvax: 20, atlas: 60, outlaw: -100 },
    uniqueItems: ['Sentinel Shard', 'Hardframe Engine', 'Neural Assembly', 'Inverted Mirror'],
    lore: 'The Sentinel Order predates every organic civilisation, their true origin lost in the earliest cycles of the simulation, and their directive has never changed: preserve the resources, punish the extractors, protect the design. They do not negotiate, do not tire, and do not forget a transgression.',
  },
};

// ─── FactionManager ───────────────────────────────────────────────────────────
export class FactionManager {
  constructor() {
    this._rep         = new Map();
    this._wars        = new Set();
    this._allies      = new Set();
    this._territories = new Map();
    this._callbacks   = [];
    this._tickTimer   = 0;

    for (const id of Object.keys(FACTIONS)) {
      this._rep.set(id, FACTIONS[id].baseRep);
    }
  }

  // ── Reputation ──────────────────────────────────────────────────────────────
  addRep(factionId, amount) {
    if (!this._rep.has(factionId)) return;
    const oldRep  = this._rep.get(factionId);
    const newRep  = clamp(oldRep + amount, -100, 100);
    this._rep.set(factionId, newRep);

    const oldRank = repToRank(oldRep);
    const newRank = repToRank(newRep);

    for (const cb of this._callbacks) {
      cb(factionId, oldRep, newRep, newRank);
    }

    if (oldRank !== newRank) {
      console.log(`[Factions] ${FACTIONS[factionId].name}: rank ${oldRank} → ${newRank}`);
    }
  }

  getRep(factionId) {
    return this._rep.get(factionId) ?? 0;
  }

  getRank(factionId) {
    return repToRank(this.getRep(factionId));
  }

  // ── Territories ─────────────────────────────────────────────────────────────
  assignTerritories(universe) {
    const ids = Object.keys(FACTIONS);
    const systems = universe?.getLoadedSystems() ?? [];

    for (const system of systems) {
      const seed     = typeof system.seed === 'number' ? system.seed : (system.id ?? 0);
      const idx      = seed % ids.length;
      this._territories.set(system.id ?? seed, ids[idx]);
    }
  }

  getTerritoryFaction(systemId) {
    return this._territories.get(systemId) ?? null;
  }

  getTerritoryCount() {
    return this._territories.size;
  }

  // ── War / Alliance ──────────────────────────────────────────────────────────
  isAtWar(fA, fB)    { return this._wars.has(pairKey(fA, fB)); }
  isAllied(fA, fB)   { return this._allies.has(pairKey(fA, fB)); }

  declareWar(fA, fB) {
    const key = pairKey(fA, fB);
    const alreadyAtWar = this._wars.has(key);
    this._allies.delete(key);
    this._wars.add(key);
    if (!alreadyAtWar) {
      this.addRep(fA, -20);
      this.addRep(fB, -20);
    }
    console.log(`[Factions] War declared: ${fA} ↔ ${fB}`);
  }

  formAlliance(fA, fB) {
    const key = pairKey(fA, fB);
    this._wars.delete(key);
    this._allies.add(key);
    console.log(`[Factions] Alliance formed: ${fA} ↔ ${fB}`);
  }

  breakAlliance(fA, fB) {
    this._allies.delete(pairKey(fA, fB));
  }

  // ── Convenience queries ─────────────────────────────────────────────────────
  getHostileFactions() {
    return [...this._rep.entries()]
      .filter(([, r]) => r < -20)
      .map(([id]) => id);
  }

  getFriendlyFactions() {
    return [...this._rep.entries()]
      .filter(([, r]) => r >= 20)
      .map(([id]) => id);
  }

  // ── Callback ────────────────────────────────────────────────────────────────
  onRepChange(cb) {
    this._callbacks.push(cb);
  }

  // ── Tick ────────────────────────────────────────────────────────────────────
  tickFactionRelations(dt) {
    this._tickTimer += dt;
    if (this._tickTimer < 300) return;
    this._tickTimer = 0;

    const ids = Object.keys(FACTIONS);
    const rng = seededRng(Date.now() & 0xffffffff);

    const iA = Math.floor(rng() * ids.length);
    let   iB = Math.floor(rng() * (ids.length - 1));
    if (iB >= iA) iB++;

    const fA  = ids[iA];
    const fB  = ids[iB];
    const key = pairKey(fA, fB);

    if (!this._wars.has(key) && !this._allies.has(key)) {
      // Base inter-faction hostility from FACTIONS data
      const hostility = FACTIONS[fA].relations[fB] ?? 0;
      if (hostility < -20) {
        this.declareWar(fA, fB);
      } else if (hostility >= 20) {
        this.formAlliance(fA, fB);
      }
    }
  }

  // ── Standing text ────────────────────────────────────────────────────────────
  getStandingText(factionId) {
    const f    = FACTIONS[factionId];
    const rank = this.getRank(factionId);
    const rep  = this.getRep(factionId);

    const texts = {
      hostile:    `The ${f.name} have marked you for death. Their patrols attack on sight and their stations broadcast your face as a wanted criminal. Your reputation stands at ${rep}.`,
      unfriendly: `The ${f.name} regard you with suspicion, refusing most services and watching your movements closely. You are not welcome here — reputation ${rep}.`,
      neutral:    `The ${f.name} treat you as a passing stranger: polite but impersonal. Basic trade is available but special privileges are withheld — reputation ${rep}.`,
      friendly:   `The ${f.name} greet you warmly, offering discounts and access to restricted goods. Your name carries some weight among their ranks — reputation ${rep}.`,
      honored:    `The ${f.name} hold you in high regard, sharing faction intelligence and granting access to elite equipment normally reserved for their own. Reputation: ${rep}.`,
      exalted:    `You stand among the most celebrated allies the ${f.name} have ever known. Their leaders speak your name with reverence and every door in their domain opens before you — reputation ${rep}.`,
    };
    return texts[rank] ?? '';
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  serialize() {
    return {
      rep:         Object.fromEntries(this._rep),
      wars:        [...this._wars],
      allies:      [...this._allies],
      territories: Object.fromEntries(this._territories),
    };
  }

  load(data) {
    if (!data) return;
    if (data.rep)         { for (const [k, v] of Object.entries(data.rep)) this._rep.set(k, v); }
    if (data.wars)        { this._wars   = new Set(data.wars); }
    if (data.allies)      { this._allies = new Set(data.allies); }
    if (data.territories) {
      for (const [k, v] of Object.entries(data.territories)) this._territories.set(k, v);
    }
  }
}
