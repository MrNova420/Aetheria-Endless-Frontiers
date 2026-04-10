/**
 * src/hardware-mesh.js  –  AETHERIA: Endless Frontiers
 *
 * HardwareMeshContribution — manages the idle-time mesh relay Worker.
 *
 * Players opt-in (default ON at 2%) and contribute a tiny slice of their
 * device's CPU/network to relay universe & building updates between peers.
 * This improves everyone's experience without affecting gameplay:
 *
 *   • Worker runs on a separate OS thread → zero impact on render/input.
 *   • Sleep-loop inside worker enforces 1–5% CPU cap.
 *   • requestIdleCallback used for any main-thread stats processing.
 *   • Contribution is paused automatically when the tab is hidden.
 *   • Persisted preference in localStorage ('aetheria_mesh_contribution').
 *
 * Usage:
 *   import { HardwareMeshContribution } from './hardware-mesh.js';
 *   const mesh = new HardwareMeshContribution();
 *   mesh.start(2);               // 2% contribution
 *   mesh.setPeers([{id, url}]);
 *   mesh.relayToAll(payload);
 *   mesh.stop();
 *   mesh.getStats()  → { enabled, cpuBudgetPct, messagesRelayed, … }
 */

const PREF_KEY = 'aetheria_mesh_contribution';

export class HardwareMeshContribution {
  constructor() {
    /** @type {Worker|null} */
    this._worker       = null;
    this._enabled      = false;
    this._contributionPct = 2;
    this._stats        = {
      enabled:         false,
      cpuBudgetPct:    0,
      messagesRelayed: 0,
      bytesRelayed:    0,
      peerCount:       0,
      uptimeMs:        0,
    };

    // Callbacks
    this._onStatsUpdate = null;   // (stats) => void
    this._onReady       = null;   // () => void
    this._onRelay       = null;   // (from, payload) => void

    // Pause on tab hide to save battery / bandwidth
    this._boundVisibilityChange = () => this._onVisibilityChange();
    document.addEventListener('visibilitychange', this._boundVisibilityChange);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load saved preference from localStorage.
   * Returns true if mesh contribution was enabled last session.
   */
  loadPreference() {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      this._contributionPct = Math.max(1, Math.min(5, p.pct ?? 2));
      return !!p.enabled;
    } catch (_) {
      return false;
    }
  }

  savePreference() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        enabled: this._enabled,
        pct: this._contributionPct,
      }));
    } catch (_) {}
  }

  /**
   * Start the mesh worker with the given CPU budget.
   * @param {number} pct  1–5 (default 2)
   * @param {string} peerId  local player's unique ID
   */
  start(pct = 2, peerId = '') {
    this._contributionPct = Math.max(1, Math.min(5, pct));
    if (this._worker) this.stop(); // restart fresh

    if (typeof Worker === 'undefined') {
      console.warn('[HardwareMesh] Web Workers not supported in this environment.');
      return;
    }

    try {
      this._worker = new Worker(new URL('./mesh-worker.js', import.meta.url), { type: 'module' });
    } catch (err) {
      // Fallback for browsers that don't support module workers
      try {
        this._worker = new Worker('./src/mesh-worker.js');
      } catch (e2) {
        console.warn('[HardwareMesh] Worker creation failed:', e2.message);
        return;
      }
    }

    this._worker.addEventListener('message', evt => this._handleWorkerMessage(evt.data));
    this._worker.addEventListener('error',   err => {
      console.warn('[HardwareMesh] Worker error:', err.message);
    });

    // Configure the worker
    this._worker.postMessage({
      cmd:             'configure',
      contributionPct: this._contributionPct,
      peerId,
    });

    this._enabled = true;
    this._stats.enabled = true;
    this.savePreference();
  }

  /** Stop the worker and clean up. */
  stop() {
    if (this._worker) {
      this._worker.postMessage({ cmd: 'stop' });
      this._worker.terminate();
      this._worker = null;
    }
    this._enabled = false;
    this._stats.enabled = false;
    this.savePreference();
  }

  /** @returns {boolean} */
  isEnabled() {
    return this._enabled;
  }

  /**
   * Set the contribution percentage (1–5).
   * Hot-reconfigures the running worker.
   * @param {number} pct
   */
  setContributionPct(pct) {
    this._contributionPct = Math.max(1, Math.min(5, pct));
    if (this._worker) {
      this._worker.postMessage({ cmd: 'configure', contributionPct: this._contributionPct });
    }
    this.savePreference();
  }

  /** @returns {number} current % setting */
  getContributionPct() {
    return this._contributionPct;
  }

  /**
   * Update the peer list in the worker.
   * @param {{id:string, url:string}[]} peers
   */
  setPeers(peers) {
    if (!this._worker) return;
    this._worker.postMessage({ cmd: 'peers', list: peers });
  }

  /**
   * Ask the worker to relay a payload to all peers (or a specific peer).
   * @param {object} payload
   * @param {string} [to='all']
   */
  relayToAll(payload, to = 'all') {
    if (!this._worker) return;
    this._worker.postMessage({ cmd: 'relay', to, payload });
  }

  /**
   * Store a value in the worker's shared cache (universe data, buildings, etc).
   * The worker will re-serve this to peers that request it.
   * @param {string} key
   * @param {*}      value
   */
  cacheData(key, value) {
    if (!this._worker) return;
    this._worker.postMessage({ cmd: 'cache', key, value });
  }

  /** Request a fresh stats snapshot from the worker. */
  requestStats() {
    if (!this._worker) return;
    this._worker.postMessage({ cmd: 'stats' });
  }

  /** @returns {object} last known stats */
  getStats() {
    return { ...this._stats };
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /** @param {function(object):void} cb */
  onStatsUpdate(cb)  { this._onStatsUpdate = cb; }

  /** @param {function():void} cb */
  onReady(cb)        { this._onReady = cb; }

  /**
   * Called when a peer relays a message through this device.
   * @param {function(string, object):void} cb  (fromPeerId, payload)
   */
  onRelay(cb)        { this._onRelay = cb; }

  /** Clean up event listeners. */
  dispose() {
    this.stop();
    document.removeEventListener('visibilitychange', this._boundVisibilityChange);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _handleWorkerMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'ready':
        this._stats.cpuBudgetPct = msg.cpuBudgetPct;
        this._stats.enabled      = true;
        // Use requestIdleCallback so stats processing never interrupts a frame
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => this._onReady?.());
        } else {
          setTimeout(() => this._onReady?.(), 0);
        }
        break;

      case 'stats':
        // Merge stats; use idle callback to avoid impacting game frames
        Object.assign(this._stats, {
          messagesRelayed: msg.messagesRelayed ?? this._stats.messagesRelayed,
          bytesRelayed:    msg.bytesRelayed    ?? this._stats.bytesRelayed,
          cpuBudgetPct:    msg.cpuBudgetPct    ?? this._stats.cpuBudgetPct,
          uptimeMs:        msg.uptimeMs        ?? this._stats.uptimeMs,
          peerCount:       msg.peerCount       ?? this._stats.peerCount,
        });
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => this._onStatsUpdate?.(this.getStats()));
        } else {
          setTimeout(() => this._onStatsUpdate?.(this.getStats()), 0);
        }
        break;

      case 'relay':
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => this._onRelay?.(msg.from, msg.payload));
        } else {
          setTimeout(() => this._onRelay?.(msg.from, msg.payload), 0);
        }
        break;

      case 'error':
        console.warn('[HardwareMesh] Worker:', msg.message);
        break;

      default:
        break;
    }
  }

  _onVisibilityChange() {
    if (!this._worker) return;
    if (document.hidden) {
      // Tab is hidden — drop to minimum (1%) to save battery
      this._worker.postMessage({ cmd: 'configure', contributionPct: 1 });
    } else {
      // Tab visible again — restore configured %
      this._worker.postMessage({ cmd: 'configure', contributionPct: this._contributionPct });
    }
  }
}

/**
 * Format stats into a human-readable string for the HUD.
 * @param {object} stats — from HardwareMeshContribution.getStats()
 * @returns {string}
 */
export function formatMeshStats(stats) {
  if (!stats.enabled) return '🔴 Mesh: off';
  const kb  = (stats.bytesRelayed / 1024).toFixed(1);
  const up  = Math.floor(stats.uptimeMs / 60000);
  return `🟢 Mesh ${stats.cpuBudgetPct}% | ${stats.messagesRelayed} msgs | ${kb} KB | ${stats.peerCount} peers | ${up}m`;
}
