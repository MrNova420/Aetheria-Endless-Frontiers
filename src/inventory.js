/**
 * src/inventory.js
 */

export class Inventory {
  constructor(maxSlots = 48) {
    this.maxSlots = maxSlots;
    this.slots = new Array(maxSlots).fill(null);
  }

  addItem(type, amount) {
    const MAX_STACK = 9999;
    // Try to stack into existing slot(s), respecting MAX_STACK per slot
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] && this.slots[i].type === type) {
        const space = MAX_STACK - this.slots[i].amount;
        if (space <= 0) continue;
        const take = Math.min(amount, space);
        this.slots[i].amount += take;
        amount -= take;
        if (amount <= 0) return 0;
      }
    }
    // Open new slot(s) for any remaining amount
    while (amount > 0) {
      const emptyIdx = this.slots.findIndex(s => s === null);
      if (emptyIdx === -1) return amount; // inventory full – return overflow
      const take = Math.min(amount, MAX_STACK);
      this.slots[emptyIdx] = { type, amount: take };
      amount -= take;
    }
    return 0;
  }

  removeItem(type, amount) {
    let remaining = amount;
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] && this.slots[i].type === type) {
        const take = Math.min(remaining, this.slots[i].amount);
        this.slots[i].amount -= take;
        remaining -= take;
        if (this.slots[i].amount <= 0) this.slots[i] = null;
        if (remaining <= 0) return true;
      }
    }
    return remaining <= 0;
  }

  getAmount(type) {
    let total = 0;
    for (const s of this.slots) if (s && s.type === type) total += s.amount;
    return total;
  }

  getSlots() { return this.slots; }

  /** Returns a copy of all filled slots as { type, amount }[] */
  getAllItems() {
    return this.slots.filter(s => s !== null).map(s => ({ type: s.type, amount: s.amount }));
  }

  hasIngredients(recipe) {
    for (const [type, amount] of Object.entries(recipe.inputs)) {
      if (this.getAmount(type) < amount) return false;
    }
    return true;
  }

  serialize() { return { maxSlots: this.maxSlots, slots: this.slots }; }

  load(data) {
    this.maxSlots = data.maxSlots;
    this.slots = data.slots;
  }
}

export class Equipment {
  constructor() {
    this.slots = {
      weapon: null, head: null, body: null,
      backpack: null, hand: null
    };
  }

  equip(slot, item) {
    const old = this.slots[slot];
    this.slots[slot] = item;
    return old;
  }

  unequip(slot) {
    const item = this.slots[slot];
    this.slots[slot] = null;
    return item;
  }

  getStats() {
    const bonus = {
      maxHP: 0, shieldMax: 0, jetpackCapacity: 0,
      miningSpeed: 1.0, weaponDamage: 1.0,
      hazardProtection: 0, lifeSupportRate: 0,
      scanRange: 0, cargoBonus: 0
    };
    for (const item of Object.values(this.slots)) {
      if (!item || !item.stats) continue;
      for (const [k, v] of Object.entries(item.stats)) {
        if (k in bonus) bonus[k] += v;
      }
    }
    return bonus;
  }

  serialize() { return { slots: this.slots }; }
  load(data) { this.slots = data.slots; }
}
