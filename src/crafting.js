/**
 * src/crafting.js
 */

export const RECIPES = {
  pure_ferrite: {
    id: 'pure_ferrite', name: 'Pure Ferrite', category: 'materials',
    inputs: { 'Ferrite Dust': 50 },
    outputs: { 'Pure Ferrite': 50 }
  },
  condensed_carbon: {
    id: 'condensed_carbon', name: 'Condensed Carbon', category: 'materials',
    inputs: { 'Carbon': 50 },
    outputs: { 'Condensed Carbon': 50 }
  },
  chromatic_metal: {
    id: 'chromatic_metal', name: 'Chromatic Metal', category: 'materials',
    inputs: { 'Copper': 100 },
    outputs: { 'Chromatic Metal': 50 }
  },
  carbon_nanotubes: {
    id: 'carbon_nanotubes', name: 'Carbon Nanotubes', category: 'materials',
    inputs: { 'Carbon': 150 },
    outputs: { 'Carbon Nanotubes': 1 }
  },
  warp_cell: {
    id: 'warp_cell', name: 'Warp Cell', category: 'fuel',
    inputs: { 'Di-Hydrogen': 50, 'Chromatic Metal': 30 },
    outputs: { 'Warp Cell': 1 }
  },
  launch_fuel: {
    id: 'launch_fuel', name: 'Launch Thruster Fuel', category: 'fuel',
    inputs: { 'Di-Hydrogen': 100 },
    outputs: { 'Launch Thruster Fuel': 1 }
  },
  hazard_suit_upgrade: {
    id: 'hazard_suit_upgrade', name: 'Hazard Protection Upgrade', category: 'tech',
    inputs: { 'Ferrite Dust': 80, 'Carbon': 50 },
    outputs: { 'Hazard Protection Upgrade': 1 }
  },
  life_support_upgrade: {
    id: 'life_support_upgrade', name: 'Life Support Upgrade', category: 'tech',
    inputs: { 'Carbon': 100, 'Sodium': 30 },
    outputs: { 'Life Support Upgrade': 1 }
  },
  shield_upgrade: {
    id: 'shield_upgrade', name: 'Personal Shield Upgrade', category: 'tech',
    inputs: { 'Copper': 60, 'Pure Ferrite': 20 },
    outputs: { 'Personal Shield Upgrade': 1 }
  },
  jetpack_upgrade: {
    id: 'jetpack_upgrade', name: 'Jetpack Upgrade', category: 'tech',
    inputs: { 'Titanium': 100, 'Cobalt': 40 },
    outputs: { 'Jetpack Upgrade': 1 }
  },
  mining_upgrade: {
    id: 'mining_upgrade', name: 'Mining Beam Upgrade', category: 'tech',
    inputs: { 'Copper': 50, 'Carbon Nanotubes': 1 },
    outputs: { 'Mining Beam Upgrade': 1 }
  },
  scanner_upgrade: {
    id: 'scanner_upgrade', name: 'Scanner Upgrade', category: 'tech',
    inputs: { 'Chromatic Metal': 50, 'Gold': 10 },
    outputs: { 'Scanner Upgrade': 1 }
  },
  pulse_engine_upgrade: {
    id: 'pulse_engine_upgrade', name: 'Pulse Engine Upgrade', category: 'tech',
    inputs: { 'Uranium': 50, 'Titanium': 30 },
    outputs: { 'Pulse Engine Upgrade': 1 }
  },
  hyperdrive_upgrade: {
    id: 'hyperdrive_upgrade', name: 'Hyperdrive Upgrade', category: 'tech',
    inputs: { 'Indium': 100, 'Warp Cell': 2 },
    outputs: { 'Hyperdrive Upgrade': 1 }
  },
  solar_panel: {
    id: 'solar_panel', name: 'Solar Panel', category: 'base',
    inputs: { 'Copper': 80, 'Pure Ferrite': 40 },
    outputs: { 'Solar Panel': 1 }
  },
  storage_container: {
    id: 'storage_container', name: 'Storage Container', category: 'base',
    inputs: { 'Pure Ferrite': 100, 'Carbon': 50 },
    outputs: { 'Storage Container': 1 }
  },
  roamer: {
    id: 'roamer', name: 'Roamer Geobay', category: 'base',
    inputs: { 'Pure Ferrite': 200, 'Carbon Nanotubes': 5 },
    outputs: { 'Roamer Geobay': 1 }
  },
  terrain_manipulator: {
    id: 'terrain_manipulator', name: 'Terrain Manipulator', category: 'tech',
    inputs: { 'Carbon': 60, 'Ferrite Dust': 60 },
    outputs: { 'Terrain Manipulator': 1 }
  },
  oxygen_capsule: {
    id: 'oxygen_capsule', name: 'Oxygen Capsule', category: 'consumable',
    inputs: { 'Oxygen': 100 },
    outputs: { 'Oxygen Capsule': 2 }
  },
  sodium_nitrate: {
    id: 'sodium_nitrate', name: 'Sodium Nitrate', category: 'materials',
    inputs: { 'Sodium': 50 },
    outputs: { 'Sodium Nitrate': 50 }
  },
  biofuel: {
    id: 'biofuel', name: 'Biofuel Reactor', category: 'base',
    inputs: { 'Carbon': 60, 'Cobalt': 30 },
    outputs: { 'Biofuel Reactor': 1 }
  },
  portable_reactor: {
    id: 'portable_reactor', name: 'Portable Reactor', category: 'consumable',
    inputs: { 'Uranium': 30, 'Cobalt': 30 },
    outputs: { 'Portable Reactor': 1 }
  },
  combat_amplifier: {
    id: 'combat_amplifier', name: 'Combat Amplifier', category: 'tech',
    inputs: { 'Cobalt': 80, 'Chromatic Metal': 30 },
    outputs: { 'Combat Amplifier': 1 }
  },
  ship_shield_upgrade: {
    id: 'ship_shield_upgrade', name: 'Ship Shield Upgrade', category: 'tech',
    inputs: { 'Cobalt': 120, 'Pure Ferrite': 60 },
    outputs: { 'Ship Shield Upgrade': 1 }
  },
  emeril_drive: {
    id: 'emeril_drive', name: 'Emeril Drive', category: 'tech',
    inputs: { 'Emeril': 30, 'Chromatic Metal': 50 },
    outputs: { 'Emeril Drive': 1 }
  },
  indium_drive: {
    id: 'indium_drive', name: 'Indium Drive', category: 'tech',
    inputs: { 'Indium': 50, 'Warp Cell': 1 },
    outputs: { 'Indium Drive': 1 }
  },
  auto_extractor: {
    id: 'auto_extractor', name: 'Auto-Extractor', category: 'base',
    inputs: { 'Pure Ferrite': 80, 'Carbon Nanotubes': 2, 'Copper': 40 },
    outputs: { 'Auto-Extractor': 1 }
  },
  medkit: {
    id: 'medkit', name: 'Medkit', category: 'consumable',
    inputs: { 'Sodium': 40, 'Oxygen': 30 },
    outputs: { 'Medkit': 2 }
  },
  shield_battery: {
    id: 'shield_battery', name: 'Shield Battery', category: 'consumable',
    inputs: { 'Copper': 50, 'Cobalt': 25 },
    outputs: { 'Shield Battery': 2 }
  }
};

export class CraftingSystem {
  constructor(inventory) {
    this.inventory = inventory;
    this.knownBlueprints = new Set(Object.keys(RECIPES));
    this.onCraft = null; // (recipeId, recipe) => void – called on successful craft
  }

  canCraft(recipeId) {
    const recipe = RECIPES[recipeId];
    if (!recipe) return false;
    if (!this.knownBlueprints.has(recipeId)) return false;
    return this.inventory.hasIngredients(recipe);
  }

  craft(recipeId) {
    if (!this.canCraft(recipeId)) return false;
    const recipe = RECIPES[recipeId];
    for (const [type, amount] of Object.entries(recipe.inputs)) {
      this.inventory.removeItem(type, amount);
    }
    for (const [type, amount] of Object.entries(recipe.outputs)) {
      this.inventory.addItem(type, amount);
    }
    if (this.onCraft) this.onCraft(recipeId, recipe);
    return true;
  }

  getAvailableRecipes() {
    return Object.values(RECIPES).filter(r => this.knownBlueprints.has(r.id));
  }

  learnBlueprint(id) {
    if (RECIPES[id]) this.knownBlueprints.add(id);
  }
}

export class TechTree {
  constructor() {
    this.upgrades = {};
    this.onUpgrade = null; // (category, techId, bonuses) => void – called on successful upgrade
  }

  /** Build the "tree" property that ui.js iterates over */
  get tree() {
    const { TECH_UPGRADES } = (typeof window !== 'undefined' ? window._aetheriaCfg || {} : {});
    // We import TECH_UPGRADES at file top; build a compatible shape for _renderTechTree
    // ui.js expects: { [cat]: { [id]: { name, tiers } } }
    return this._techConfig || {};
  }

  /** Call once to supply the tech config from config.js */
  setConfig(techConfig) {
    this._techConfig = techConfig;
  }

  /** Whether a specific tech item has at least one tier installed */
  isUnlocked(category, techId) {
    return (this.upgrades[`${category}.${techId}`] || 0) > 0;
  }

  /** Whether the player can afford the next tier */
  canAfford(category, techId, inventory) {
    if (!this._techConfig) return false;
    const key  = `${category}.${techId}`;
    const tier = this.upgrades[key] || 0;
    const def  = this._techConfig[category]?.[techId];
    if (!def || tier >= def.tiers.length) return false;
    const cost = def.tiers[tier].cost;
    for (const [type, amount] of Object.entries(cost)) {
      if (inventory.getAmount(type) < amount) return false;
    }
    return true;
  }

  upgrade(category, tech, inventory, techConfig) {
    const cfg = techConfig || this._techConfig;
    if (!cfg) return false;
    const key = `${category}.${tech}`;
    const tier = (this.upgrades[key] || 0);
    const techDef = cfg[category]?.[tech];
    if (!techDef) return false;
    if (tier >= techDef.tiers.length) return false;
    const tierDef = techDef.tiers[tier];
    for (const [type, amount] of Object.entries(tierDef.cost)) {
      if (inventory.getAmount(type) < amount) return false;
    }
    for (const [type, amount] of Object.entries(tierDef.cost)) {
      inventory.removeItem(type, amount);
    }
    this.upgrades[key] = tier + 1;
    if (this.onUpgrade) this.onUpgrade(category, tech, tierDef.bonus);
    return true;
  }

  getUnlocked() { return { ...this.upgrades }; }

  getStats(techConfig) {
    const cfg = techConfig || this._techConfig || {};
    const stats = {};
    for (const [key, tier] of Object.entries(this.upgrades)) {
      const [cat, tech] = key.split('.');
      const def = cfg[cat]?.[tech];
      if (!def) continue;
      for (let i = 0; i < tier; i++) {
        if (def.tiers[i]) {
          for (const [stat, val] of Object.entries(def.tiers[i].bonus)) {
            stats[stat] = (stats[stat] || 0) + val;
          }
        }
      }
    }
    return stats;
  }

  serialize() { return { upgrades: this.upgrades }; }
  load(data) { this.upgrades = data.upgrades || {}; }
}
