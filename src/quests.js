/**
 * src/quests.js
 * Simple quest / objective system.
 *
 * Quests have one or more objectives.  Objectives track progress against
 * a target value.  When all objectives are complete the quest is marked done.
 *
 * Quest types:
 *   collect  – gather N units of a resource
 *   kill     – defeat N creatures
 *   explore  – travel to a location (planet warp counts)
 *   scan     – use scanner N times
 *   craft    – craft N items
 */

// ─── Starter quest definitions ────────────────────────────────────────────────
export const QUEST_DEFS = {
  first_steps: {
    id: 'first_steps',
    title: '🛸 First Steps',
    description: 'Collect basic resources to get started on your journey.',
    objectives: [
      { id: 'carbon',  type: 'collect', resource: 'Carbon',       target: 100, label: 'Collect Carbon'      },
      { id: 'ferrite', type: 'collect', resource: 'Ferrite Dust',  target: 50,  label: 'Collect Ferrite Dust' },
    ],
    reward: { xp: 200, items: { 'Di-Hydrogen': 30 } },
    chain: 'survival_basics',
  },
  survival_basics: {
    id: 'survival_basics',
    title: '⚔ Survival Basics',
    description: 'Hunt local fauna and craft a Warp Cell to prepare for departure.',
    objectives: [
      { id: 'kill3',     type: 'kill',  target: 3,  label: 'Defeat 3 creatures'        },
      { id: 'warp_cell', type: 'craft', item: 'Warp Cell', target: 1, label: 'Craft a Warp Cell' },
    ],
    reward: { xp: 500, items: { 'Chromatic Metal': 50 } },
    chain: 'explorer_path',
  },
  explorer_path: {
    id: 'explorer_path',
    title: '🌌 Explorer\'s Path',
    description: 'Scan your surroundings and warp to a new star system.',
    objectives: [
      { id: 'scan5',  type: 'scan',    target: 5, label: 'Use scanner 5 times' },
      { id: 'warp1',  type: 'explore', target: 1, label: 'Warp to a new system' },
    ],
    reward: { xp: 1000, items: { 'Emeril': 30, 'Indium': 20 } },
    chain: 'sentinel_alert',
  },
  sentinel_alert: {
    id: 'sentinel_alert',
    title: '⚠ Sentinel Alert',
    description: 'Sentinel forces have detected your activities. Deal with the threat.',
    objectives: [
      { id: 'kill_sentinels', type: 'kill_sentinel', target: 3, label: 'Defeat 3 Sentinel Drones' },
      { id: 'scan_after',     type: 'scan',          target: 3, label: 'Scan 3 entities after the battle' },
    ],
    reward: { xp: 800, items: { 'Nanite Cluster': 50 } },
    chain: 'anomaly_investigation',
  },
  anomaly_investigation: {
    id: 'anomaly_investigation',
    title: '📡 Anomaly Detected',
    description: 'Strange signals have been detected. Investigate 3 new systems.',
    objectives: [
      { id: 'warp3',  type: 'explore', target: 3,  label: 'Warp to 3 different systems' },
      { id: 'scan10', type: 'scan',    target: 10, label: 'Catalogue 10 life forms' },
    ],
    reward: { xp: 1500, items: { 'Emeril': 50, 'Chromatic Metal': 100 } },
    chain: 'atlas_path',
  },
  atlas_path: {
    id: 'atlas_path',
    title: '🔮 The Atlas Interface',
    description: 'Something vast has taken notice. Follow the Atlas signal deeper into the universe.',
    objectives: [
      { id: 'warp_galaxy',   type: 'warp_galaxy', target: 1,            label: 'Reach a new galaxy' },
      { id: 'collect_atlas', type: 'collect',      resource: 'Atlas Stone', target: 1, label: 'Obtain an Atlas Stone' },
    ],
    reward: { xp: 3000, items: { 'Warp Cell': 5, 'Quantum Essence': 1 } },
    chain: 'tech_mastery',
  },
  tech_mastery: {
    id: 'tech_mastery',
    title: '⚙ Technology Mastery',
    description: 'Upgrade your exosuit, multi-tool and build an automated base.',
    objectives: [
      { id: 'craft5',  type: 'craft', target: 5,  label: 'Craft 5 technology upgrades' },
      { id: 'build3',  type: 'build', target: 3,  label: 'Place 3 base structures' },
      { id: 'kill10',  type: 'kill',  target: 10, label: 'Defeat 10 creatures' },
    ],
    reward: { xp: 5000, items: { 'Indium': 200, 'Platinum': 100 } },
    chain: 'convergence',
  },
  convergence: {
    id: 'convergence',
    title: '✨ The Convergence',
    description: 'The universe reveals its true nature. Build an empire across the stars.',
    objectives: [
      { id: 'build_hub',    type: 'build',   buildingType: 'town_hub', target: 1, label: 'Establish a Town Hub' },
      { id: 'warp5',        type: 'explore', target: 5,                           label: 'Explore 5 more systems' },
      { id: 'collect_rare', type: 'collect', resource: 'Quantum Essence', target: 3, label: 'Gather Quantum Essences' },
    ],
    reward: { xp: 10000, items: { 'Nanite Cluster': 500 } },
    chain: null,
  },
};

// ─── QuestSystem ──────────────────────────────────────────────────────────────
export class QuestSystem {
  constructor() {
    this._active    = new Map();  // questId → questState
    this._completed = new Set();
    this._listeners = [];         // { event, handler }
  }

  /** Activate a quest by ID. Noop if already active or completed. */
  start(questId) {
    const def = QUEST_DEFS[questId];
    if (!def || this._active.has(questId) || this._completed.has(questId)) return false;
    const state = {
      id    : questId,
      def,
      objectives: def.objectives.map(o => ({ ...o, progress: 0, done: false })),
      done  : false,
    };
    this._active.set(questId, state);
    this._emit('started', state);
    return true;
  }

  /** Report a game event – the quest system checks for matching objectives. */
  reportEvent(type, payload = {}) {
    for (const [, qs] of this._active) {
      if (qs.done) continue;
      let anyChanged = false;
      for (const obj of qs.objectives) {
        if (obj.done) continue;
        let inc = 0;
        switch (type) {
          case 'collect':
            if (obj.type === 'collect' && obj.resource === payload.resource) inc = payload.amount || 1;
            break;
          case 'kill':
            if (obj.type === 'kill') inc = 1;
            break;
          case 'kill_sentinel':
            if (obj.type === 'kill_sentinel') inc = 1;
            break;
          case 'scan':
            if (obj.type === 'scan') inc = 1;
            break;
          case 'warp':
            if (obj.type === 'explore') inc = 1;
            break;
          case 'warp_galaxy':
            if (obj.type === 'warp_galaxy') inc = 1;
            break;
          case 'craft':
            if (obj.type === 'craft' && (!obj.item || obj.item === payload.item)) inc = payload.amount || 1;
            break;
          case 'build':
            if (obj.type === 'build') {
              if (!obj.buildingType || obj.buildingType === payload.buildingType) inc = 1;
            }
            break;
        }
        if (inc > 0) {
          obj.progress = Math.min(obj.target, obj.progress + inc);
          if (obj.progress >= obj.target) obj.done = true;
          anyChanged = true;
        }
      }
      if (anyChanged) {
        this._emit('progress', qs);
        if (qs.objectives.every(o => o.done)) {
          qs.done = true;
          this._completed.add(qs.id);
          this._active.delete(qs.id);
          this._emit('completed', qs);
          // Auto-start chain quest synchronously
          if (qs.def.chain) this.start(qs.def.chain);
        }
      }
    }
  }

  getActive()    { return [...this._active.values()]; }
  isCompleted(id) { return this._completed.has(id); }

  /** Current progress summary for HUD display */
  getHudSummary() {
    const active = this.getActive();
    if (!active.length) return null;
    const q = active[0];
    const incomplete = q.objectives.filter(o => !o.done);
    if (!incomplete.length) return null;
    const obj = incomplete[0];
    return {
      title   : q.def.title,
      label   : obj.label,
      progress: obj.progress,
      target  : obj.target,
    };
  }

  on(event, handler) { this._listeners.push({ event, handler }); }
  _emit(event, data) {
    for (const l of this._listeners) {
      if (l.event === event) l.handler(data);
    }
  }

  serialize() {
    const active = {};
    for (const [id, qs] of this._active) {
      active[id] = { objectives: qs.objectives.map(o => ({ progress: o.progress, done: o.done })) };
    }
    return { active, completed: [...this._completed] };
  }

  load(data) {
    if (!data) return;
    for (const id of (data.completed || [])) this._completed.add(id);
    for (const [id, s] of Object.entries(data.active || {})) {
      const started = this.start(id);
      if (started) {
        const qs = this._active.get(id);
        if (qs) {
          qs.objectives.forEach((o, i) => {
            if (s.objectives?.[i]) {
              o.progress = s.objectives[i].progress || 0;
              o.done     = s.objectives[i].done     || false;
            }
          });
        }
      }
    }
  }
}
