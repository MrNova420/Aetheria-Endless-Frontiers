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
          case 'scan':
            if (obj.type === 'scan') inc = 1;
            break;
          case 'warp':
            if (obj.type === 'explore') inc = 1;
            break;
          case 'craft':
            if (obj.type === 'craft' && obj.item === payload.item) inc = payload.amount || 1;
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
