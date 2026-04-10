/**
 * src/trading.js  –  AETHERIA: Endless Frontiers  –  Economy & Trading System
 *
 * NMS+GTA-style economy: market prices, buy/sell, ships for sale,
 * trade drones, and trading posts.
 */

import { FACTIONS } from './factions.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

let _droneUid = 1;
function nextDroneId() { return _droneUid++; }

// ─── Ship Classes ────────────────────────────────────────────────────────────
export const SHIP_CLASSES = {
  fighter: {
    name:       'Fighter',
    icon:       '🚀',
    statRanges: { slots: [12, 24], speed: [140, 200], shield: [60, 120], weaponSlots: [3, 6] },
  },
  hauler: {
    name:       'Hauler',
    icon:       '🛸',
    statRanges: { slots: [30, 48], speed: [80, 110], shield: [80, 140], weaponSlots: [1, 2] },
  },
  explorer: {
    name:       'Explorer',
    icon:       '🌌',
    statRanges: { slots: [18, 30], speed: [120, 160], shield: [50, 90], weaponSlots: [1, 3] },
  },
  exotic: {
    name:       'Exotic',
    icon:       '✨',
    statRanges: { slots: [20, 28], speed: [160, 220], shield: [70, 110], weaponSlots: [2, 4] },
  },
  living_ship: {
    name:       'Living Ship',
    icon:       '🦑',
    statRanges: { slots: [16, 24], speed: [130, 180], shield: [90, 130], weaponSlots: [2, 3] },
  },
};

// ─── Commodities ─────────────────────────────────────────────────────────────
export const COMMODITIES = {
  carbon: {
    id: 'carbon', name: 'Carbon', icon: '🌿',
    basePrice: 30, volatility: 0.2, category: 'mineral',
  },
  ferrite_dust: {
    id: 'ferrite_dust', name: 'Ferrite Dust', icon: '🪨',
    basePrice: 25, volatility: 0.15, category: 'mineral',
  },
  di_hydrogen: {
    id: 'di_hydrogen', name: 'Di-Hydrogen', icon: '💧',
    basePrice: 55, volatility: 0.25, category: 'gas',
  },
  chromatic_metal: {
    id: 'chromatic_metal', name: 'Chromatic Metal', icon: '🔵',
    basePrice: 200, volatility: 0.3, category: 'mineral',
  },
  nanite_cluster: {
    id: 'nanite_cluster', name: 'Nanite Cluster', icon: '🔬',
    basePrice: 150, volatility: 0.4, category: 'technology',
  },
  pugneum: {
    id: 'pugneum', name: 'Pugneum', icon: '🤖',
    basePrice: 310, volatility: 0.35, category: 'mineral',
  },
  platinum: {
    id: 'platinum', name: 'Platinum', icon: '⚪',
    basePrice: 500, volatility: 0.2, category: 'mineral',
  },
  gold: {
    id: 'gold', name: 'Gold', icon: '🟡',
    basePrice: 620, volatility: 0.25, category: 'mineral',
  },
  emeril: {
    id: 'emeril', name: 'Emeril', icon: '💚',
    basePrice: 800, volatility: 0.3, category: 'mineral',
  },
  indium: {
    id: 'indium', name: 'Indium', icon: '🔷',
    basePrice: 950, volatility: 0.3, category: 'mineral',
  },
  atlas_stone: {
    id: 'atlas_stone', name: 'Atlas Stone', icon: '🔴',
    basePrice: 25000, volatility: 0.05, category: 'mystery',
  },
  iron_plate: {
    id: 'iron_plate', name: 'Iron Plate', icon: '🔩',
    basePrice: 120, volatility: 0.15, category: 'technology',
  },
  copper_wire: {
    id: 'copper_wire', name: 'Copper Wire', icon: '🟤',
    basePrice: 90, volatility: 0.2, category: 'technology',
  },
  circuit_board: {
    id: 'circuit_board', name: 'Circuit Board', icon: '🖥️',
    basePrice: 350, volatility: 0.3, category: 'technology',
  },
  concrete: {
    id: 'concrete', name: 'Concrete', icon: '🏗️',
    basePrice: 60, volatility: 0.1, category: 'mineral',
  },
  void_crystal: {
    id: 'void_crystal', name: 'Void Crystal', icon: '🔮',
    basePrice: 1800, volatility: 0.5, category: 'mystery',
  },
  stellar_ash: {
    id: 'stellar_ash', name: 'Stellar Ash', icon: '🌑',
    basePrice: 400, volatility: 0.45, category: 'gas',
  },
  bio_matrix: {
    id: 'bio_matrix', name: 'Bio-Matrix', icon: '🧬',
    basePrice: 750, volatility: 0.4, category: 'biological',
  },
  quantum_essence: {
    id: 'quantum_essence', name: 'Quantum Essence', icon: '⚡',
    basePrice: 3200, volatility: 0.6, category: 'mystery',
  },
  mordite: {
    id: 'mordite', name: 'Mordite', icon: '💀',
    basePrice: 70, volatility: 0.2, category: 'biological',
  },
  star_bulb: {
    id: 'star_bulb', name: 'Star Bulb', icon: '🌸',
    basePrice: 180, volatility: 0.3, category: 'biological',
  },
  gravitino_ball: {
    id: 'gravitino_ball', name: 'Gravitino Ball', icon: '🟠',
    basePrice: 12000, volatility: 0.1, category: 'contraband',
  },
  vortex_cube: {
    id: 'vortex_cube', name: 'Vortex Cube', icon: '🌀',
    basePrice: 7600, volatility: 0.1, category: 'contraband',
  },
  albumen_pearl: {
    id: 'albumen_pearl', name: 'Albumen Pearl', icon: '🤍',
    basePrice: 9200, volatility: 0.12, category: 'contraband',
  },
  whispering_eggs: {
    id: 'whispering_eggs', name: 'Whispering Eggs', icon: '🥚',
    basePrice: 11500, volatility: 0.08, category: 'contraband',
  },
  fungal_mould: {
    id: 'fungal_mould', name: 'Fungal Mould', icon: '🍄',
    basePrice: 140, volatility: 0.25, category: 'food',
  },
  frost_crystal: {
    id: 'frost_crystal', name: 'Frost Crystal', icon: '❄️',
    basePrice: 230, volatility: 0.3, category: 'mineral',
  },
  cactus_flesh: {
    id: 'cactus_flesh', name: 'Cactus Flesh', icon: '🌵',
    basePrice: 165, volatility: 0.2, category: 'food',
  },
  solanium: {
    id: 'solanium', name: 'Solanium', icon: '🔥',
    basePrice: 290, volatility: 0.3, category: 'biological',
  },
  marrow_bulb: {
    id: 'marrow_bulb', name: 'Marrow Bulb', icon: '🦴',
    basePrice: 320, volatility: 0.35, category: 'biological',
  },
};

// ─── TradingSystem ────────────────────────────────────────────────────────────
export class TradingSystem {
  constructor() {
    this._marketSeeds   = new Map();
    this._priceCache    = new Map();
    this._priceTimers   = new Map();
    this._priceHistory  = new Map();
    this._playerShips   = [];
    this._tradeDrones   = [];
    this._tradingPosts  = [];

    this._REFRESH_INTERVAL = 300; // 5 real minutes
  }

  // ── Price Engine ─────────────────────────────────────────────────────────────
  getPrice(systemId, itemId, seed) {
    const item = COMMODITIES[itemId];
    if (!item) return 0;

    const sysHash  = hashStr(String(systemId));
    const itemHash = hashStr(itemId);
    const rng      = seededRng((seed ?? sysHash) ^ itemHash);

    // base * (0.5 + rng * 1.0) → range: 50 % – 150 % of base
    const multiplier = 0.5 + rng() * 1.0;
    return Math.round(item.basePrice * multiplier * (1 + item.volatility * (rng() - 0.5)));
  }

  getPrices(systemId, seed) {
    // Return cached prices if still fresh
    if (this._priceCache.has(systemId)) {
      return this._priceCache.get(systemId);
    }

    const prices = {};
    for (const id of Object.keys(COMMODITIES)) {
      prices[id] = this.getPrice(systemId, id, seed);
    }

    this._priceCache.set(systemId, prices);
    this._priceTimers.set(systemId, this._REFRESH_INTERVAL);

    // Store history (last 10 snapshots per system per item)
    for (const [id, price] of Object.entries(prices)) {
      const key = `${systemId}:${id}`;
      if (!this._priceHistory.has(key)) this._priceHistory.set(key, []);
      const hist = this._priceHistory.get(key);
      hist.push(price);
      if (hist.length > 10) hist.shift();
    }

    return prices;
  }

  getPriceHistory(systemId, itemId) {
    return this._priceHistory.get(`${systemId}:${itemId}`) ?? [];
  }

  // ── Buy / Sell ────────────────────────────────────────────────────────────────
  buy(systemId, itemId, qty, inventory, units) {
    const item = COMMODITIES[itemId];
    if (!item)           return { ok: false, cost: 0,    message: 'Unknown item.' };
    if (qty <= 0)        return { ok: false, cost: 0,    message: 'Invalid quantity.' };

    const prices = this.getPrices(systemId);
    const price  = prices[itemId] ?? item.basePrice;
    const cost   = price * qty;

    if (units < cost)    return { ok: false, cost, message: `Not enough Units. Need ${cost}, have ${units}.` };

    const overflow = inventory.addItem(itemId, qty);
    if (overflow > 0)    return { ok: false, cost: 0, message: 'Inventory full.' };

    return { ok: true, cost, message: `Purchased ${qty}× ${item.name} for ${cost} Units.` };
  }

  sell(systemId, itemId, qty, inventory) {
    const item = COMMODITIES[itemId];
    if (!item)    return { ok: false, revenue: 0, message: 'Unknown item.' };
    if (qty <= 0) return { ok: false, revenue: 0, message: 'Invalid quantity.' };

    const removed = inventory.removeItem(itemId, qty);
    if (removed < qty) {
      // Re-add partial if we couldn't remove all
      if (removed > 0) inventory.addItem(itemId, removed);
      return { ok: false, revenue: 0, message: `You only have ${removed} of that item.` };
    }

    const prices  = this.getPrices(systemId);
    const price   = prices[itemId] ?? item.basePrice;
    const revenue = price * qty;

    return { ok: true, revenue, message: `Sold ${qty}× ${item.name} for ${revenue} Units.` };
  }

  // ── Ships for Sale ────────────────────────────────────────────────────────────
  getShipsForSale(systemSeed) {
    const rng        = seededRng(systemSeed ^ 0xDEAD);
    const classKeys  = Object.keys(SHIP_CLASSES);
    const ships      = [];

    for (let i = 0; i < 3; i++) {
      const classId  = classKeys[Math.floor(rng() * classKeys.length)];
      const cls      = SHIP_CLASSES[classId];
      const [sLo, sHi] = cls.statRanges.slots;
      const [spLo, spHi] = cls.statRanges.speed;
      const [shLo, shHi] = cls.statRanges.shield;
      const [wLo, wHi] = cls.statRanges.weaponSlots;

      const lerp = (lo, hi, t) => Math.round(lo + (hi - lo) * t);
      const t = rng();

      const slots       = lerp(sLo, sHi, t);
      const speed       = lerp(spLo, spHi, rng());
      const shield      = lerp(shLo, shHi, rng());
      const weaponSlots = lerp(wLo, wHi, rng());

      const price = (slots * 1200 + speed * 400 + shield * 300 + weaponSlots * 2500)
                    * (0.8 + rng() * 0.4);

      ships.push({
        id:          `ship_${systemSeed}_${i}`,
        name:        `${cls.name} ${String.fromCharCode(65 + Math.floor(rng() * 26))}-${Math.floor(rng() * 900 + 100)}`,
        icon:        cls.icon,
        class:       classId,
        slots,
        speed,
        shield,
        weaponSlots,
        price:       Math.round(price),
      });
    }

    return ships;
  }

  buyShip(shipDef, units) {
    if (units < shipDef.price) {
      return { ok: false, ship: null, message: `Need ${shipDef.price} Units, have ${units}.` };
    }
    this._playerShips.push({ ...shipDef, acquired: Date.now() });
    return { ok: true, ship: shipDef, message: `${shipDef.name} is now yours.` };
  }

  // ── Trade Drones ─────────────────────────────────────────────────────────────
  deployTradeDrone(fromSystemId, toSystemId, itemId, qty) {
    const item = COMMODITIES[itemId];
    if (!item) return null;

    const buyPrice  = this.getPrice(fromSystemId, itemId);
    const sellPrice = this.getPrice(toSystemId,   itemId);
    const profit    = (sellPrice - buyPrice) * qty;

    const drone = {
      id:           nextDroneId(),
      fromSystemId,
      toSystemId,
      itemId,
      qty,
      status:       'outbound',
      cargo:        qty,
      profit,
      eta:          60,       // seconds for round trip
      timer:        0,
      collected:    false,
    };

    this._tradeDrones.push(drone);
    return drone.id;
  }

  recallDrone(droneId) {
    const idx = this._tradeDrones.findIndex(d => d.id === droneId);
    if (idx !== -1) this._tradeDrones.splice(idx, 1);
  }

  getDrones() {
    return this._tradeDrones.map(d => ({
      id:     d.id,
      status: d.status,
      cargo:  d.cargo,
      profit: d.profit,
      eta:    Math.max(0, Math.round(d.eta - d.timer)),
    }));
  }

  updateDrones(dt, inventory) {
    for (const drone of this._tradeDrones) {
      if (drone.collected) continue;

      drone.timer += dt;

      if (drone.status === 'outbound' && drone.timer >= drone.eta * 0.5) {
        drone.status = 'returning';
      }

      if (drone.status === 'returning' && drone.timer >= drone.eta) {
        drone.status    = 'arrived';
        drone.collected = true;

        // Auto-collect profit as Units equivalent item or just log
        const item = COMMODITIES[drone.itemId];
        console.log(`[Trading] Drone returned: sold ${drone.qty}× ${item?.name}. Profit: ${drone.profit} Units.`);

        // Add sold goods value back into inventory if inventory provided
        if (inventory && drone.profit > 0) {
          // Represent profit as Nanite Clusters for simplicity
          const naniteVal = Math.max(1, Math.floor(drone.profit / 150));
          inventory.addItem('nanite_cluster', naniteVal);
        }
      }
    }

    // Clean up collected drones
    this._tradeDrones = this._tradeDrones.filter(d => !d.collected);
  }

  // ── Trading Posts ─────────────────────────────────────────────────────────────
  registerTradingPost(pos, factionId, systemId) {
    this._tradingPosts.push({
      pos,
      factionId,
      systemId,
      registeredAt: Date.now(),
    });
  }

  getTradingPostsNear(pos, radius) {
    return this._tradingPosts.filter(tp => {
      const dx = tp.pos.x - pos.x;
      const dz = (tp.pos.z ?? 0) - (pos.z ?? 0);
      return Math.sqrt(dx * dx + dz * dz) <= radius;
    });
  }

  // ── Price refresh timer ───────────────────────────────────────────────────────
  update(dt) {
    for (const [systemId, timer] of this._priceTimers) {
      const remaining = timer - dt;
      if (remaining <= 0) {
        this._priceCache.delete(systemId);
        this._priceTimers.delete(systemId);
      } else {
        this._priceTimers.set(systemId, remaining);
      }
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────────
  serialize() {
    return {
      playerShips:   this._playerShips,
      tradingPosts:  this._tradingPosts,
      // drones in-flight are intentionally not persisted (they complete on reload)
    };
  }

  load(data) {
    if (!data) return;
    if (data.playerShips)  this._playerShips  = data.playerShips;
    if (data.tradingPosts) this._tradingPosts  = data.tradingPosts;
  }
}
