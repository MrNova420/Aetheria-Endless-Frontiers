/**
 * src/status.js
 * Player status-effect system.
 *
 * Status effects are short-term buffs/debuffs applied by environment or combat.
 * Each effect has a duration, a tick callback, and an icon for the HUD.
 *
 * Built-in effects:
 *   burning   – heat damage over time (BURNING planet, close to lava)
 *   frozen    – slows movement (blizzard)
 *   poisoned  – life-support drain + DoT (toxic fog)
 *   energised – bonus move speed (exotic biome aurora)
 *   shielded  – temporary shield regeneration boost
 */

export const STATUS_ICONS = {
  burning  : '🔥',
  frozen   : '❄',
  poisoned : '☣',
  energised: '⚡',
  shielded : '🛡',
};

export class StatusEffectManager {
  constructor() {
    this._effects = new Map(); // effectId → { remaining, def }
  }

  // ─── Definitions ──────────────────────────────────────────────────────────────
  static get DEFS() {
    return {
      burning  : { duration: 6,  tickRate: 1.0, hpDmg: 8,  lsDrain: 0,    speedMult: 1.0, icon: '🔥', label: 'Burning'   },
      frozen   : { duration: 8,  tickRate: 2.0, hpDmg: 0,  lsDrain: 1.5,  speedMult: 0.5, icon: '❄',  label: 'Frozen'    },
      poisoned : { duration: 10, tickRate: 1.5, hpDmg: 4,  lsDrain: 3,    speedMult: 0.9, icon: '☣',  label: 'Poisoned'  },
      energised: { duration: 15, tickRate: 0,   hpDmg: 0,  lsDrain: 0,    speedMult: 1.4, icon: '⚡', label: 'Energised' },
      shielded : { duration: 12, tickRate: 0,   hpDmg: 0,  lsDrain: 0,    speedMult: 1.0, icon: '🛡', label: 'Shielded'  },
    };
  }

  /** Apply or refresh a status effect.  Returns true if newly applied. */
  apply(effectId) {
    const def = StatusEffectManager.DEFS[effectId];
    if (!def) return false;
    const existing = this._effects.get(effectId);
    if (existing) {
      // Refresh duration
      existing.remaining = def.duration;
      return false;
    }
    this._effects.set(effectId, { remaining: def.duration, tickAccum: 0, def });
    return true;
  }

  remove(effectId) { this._effects.delete(effectId); }

  has(effectId) { return this._effects.has(effectId); }

  /**
   * Update all active effects.
   * @param {number} dt
   * @param {Player} player – must expose applyDamage(), drainLifeSupport()
   * @returns {string[]} list of newly-expired effect IDs
   */
  update(dt, player) {
    const expired = [];
    for (const [id, state] of this._effects) {
      state.remaining -= dt;

      // Tick DoT
      if (state.def.tickRate > 0) {
        state.tickAccum = (state.tickAccum || 0) + dt;
        while (state.tickAccum >= state.def.tickRate) {
          state.tickAccum -= state.def.tickRate;
          if (state.def.hpDmg > 0) player.applyDamage(state.def.hpDmg, 'status');
          if (state.def.lsDrain > 0) player.drainLifeSupport(state.def.lsDrain);
        }
      }

      if (state.remaining <= 0) {
        this._effects.delete(id);
        expired.push(id);
      }
    }
    return expired;
  }

  /** Combined speed multiplier from all active effects */
  getSpeedMult() {
    let m = 1.0;
    for (const [, s] of this._effects) m *= s.def.speedMult;
    return m;
  }

  /** Returns an array of { icon, label, remaining } for HUD display */
  getHudIcons() {
    const out = [];
    for (const [id, s] of this._effects) {
      out.push({ id, icon: s.def.icon, label: s.def.label, remaining: Math.ceil(s.remaining) });
    }
    return out;
  }

  serialize() {
    const data = {};
    for (const [id, s] of this._effects) {
      data[id] = { remaining: s.remaining };
    }
    return data;
  }

  load(data) {
    for (const [id, d] of Object.entries(data || {})) {
      const def = StatusEffectManager.DEFS[id];
      if (def) this._effects.set(id, { remaining: d.remaining, tickAccum: 0, def });
    }
  }
}
