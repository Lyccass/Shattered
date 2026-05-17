export type PlayerResourceKey = 'wood' | 'stone' | 'herb';
export type PlayerItemKey =
  | 'firestarter_set'
  | 'wooden_marker'
  | 'camp_supplies'
  | 'warm_tea';

export type PlayerInventoryCounts = Record<PlayerResourceKey, number>;
export type PlayerItemCounts = Record<PlayerItemKey, number>;

export type PlayerInventoryDelta = Partial<PlayerInventoryCounts>;
export type PlayerItemDelta = Partial<PlayerItemCounts>;

export type PlayerInventorySnapshot = {
  resources: PlayerInventoryCounts;
  items: PlayerItemCounts;
};

const EMPTY_RESOURCE_COUNTS: PlayerInventoryCounts = {
  wood: 0,
  stone: 0,
  herb: 0,
};

const EMPTY_ITEM_COUNTS: PlayerItemCounts = {
  firestarter_set: 0,
  wooden_marker: 0,
  camp_supplies: 0,
  warm_tea: 0,
};

export class PlayerInventoryState {
  private readonly resourceCounts: PlayerInventoryCounts = { ...EMPTY_RESOURCE_COUNTS };
  private readonly itemCounts: PlayerItemCounts = { ...EMPTY_ITEM_COUNTS };

  getCounts(): PlayerInventoryCounts {
    return this.getResourceCounts();
  }

  getResourceCounts(): PlayerInventoryCounts {
    return { ...this.resourceCounts };
  }

  getItemCounts(): PlayerItemCounts {
    return { ...this.itemCounts };
  }

  getSnapshot(): PlayerInventorySnapshot {
    return {
      resources: this.getResourceCounts(),
      items: this.getItemCounts(),
    };
  }

  getCount(resource: PlayerResourceKey): number {
    return this.resourceCounts[resource];
  }

  getItemCount(itemId: PlayerItemKey): number {
    return this.itemCounts[itemId];
  }

  add(resource: PlayerResourceKey, amount = 1): void {
    this.resourceCounts[resource] += Math.max(0, amount);
  }

  addDelta(delta: PlayerInventoryDelta): void {
    for (const [resource, amount] of Object.entries(delta) as Array<[PlayerResourceKey, number | undefined]>) {
      if (amount && amount > 0) {
        this.add(resource, amount);
      }
    }
  }

  hasAtLeast(resource: PlayerResourceKey, amount: number): boolean {
    return this.resourceCounts[resource] >= amount;
  }

  addItem(itemId: PlayerItemKey, amount = 1): void {
    this.itemCounts[itemId] += Math.max(0, amount);
  }

  addItemDelta(delta: PlayerItemDelta): void {
    for (const [itemId, amount] of Object.entries(delta) as Array<[PlayerItemKey, number | undefined]>) {
      if (amount && amount > 0) {
        this.addItem(itemId, amount);
      }
    }
  }

  hasItemAtLeast(itemId: PlayerItemKey, amount: number): boolean {
    return this.itemCounts[itemId] >= amount;
  }

  consumeItem(itemId: PlayerItemKey, amount = 1): boolean {
    if (!this.hasItemAtLeast(itemId, amount)) {
      return false;
    }

    this.itemCounts[itemId] -= amount;
    return true;
  }

  hasDelta(delta: PlayerInventoryDelta): boolean {
    for (const [resource, amount] of Object.entries(delta) as Array<[PlayerResourceKey, number | undefined]>) {
      if ((amount ?? 0) > this.resourceCounts[resource]) {
        return false;
      }
    }

    return true;
  }

  consumeDelta(delta: PlayerInventoryDelta): boolean {
    if (!this.hasDelta(delta)) {
      return false;
    }

    for (const [resource, amount] of Object.entries(delta) as Array<[PlayerResourceKey, number | undefined]>) {
      if (amount && amount > 0) {
        this.resourceCounts[resource] -= amount;
      }
    }

    return true;
  }
}
