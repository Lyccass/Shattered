// Typed aliases kept for compile-time safety with existing code.
// New resources/items can be added via the generic API without
// extending these unions — eventually these can become plain string.
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

export type PlayerInventorySaveSnapshot = {
  resources: Record<string, number>;
  items: Record<string, number>;
};

// Known keys used to build typed snapshots. When a new resource or item
// is added via the generic API, add it here too.
const KNOWN_RESOURCE_KEYS: PlayerResourceKey[] = ['wood', 'stone', 'herb'];
const KNOWN_ITEM_KEYS: PlayerItemKey[] = [
  'firestarter_set',
  'wooden_marker',
  'camp_supplies',
  'warm_tea',
];

export class PlayerInventoryState {
  // Internal storage is a flat Record<string, number> so new items can be
  // added via addGeneric/consumeGeneric without touching the union types.
  private readonly resources: Record<string, number> = { wood: 0, stone: 0, herb: 0 };
  private readonly items: Record<string, number> = {
    firestarter_set: 0,
    wooden_marker: 0,
    camp_supplies: 0,
    warm_tea: 0,
  };

  // --- Typed resource helpers (existing API, unchanged) ---

  getCounts(): PlayerInventoryCounts {
    return this.getResourceCounts();
  }

  getResourceCounts(): PlayerInventoryCounts {
    return buildTypedSnapshot(this.resources, KNOWN_RESOURCE_KEYS) as PlayerInventoryCounts;
  }

  getItemCounts(): PlayerItemCounts {
    return buildTypedSnapshot(this.items, KNOWN_ITEM_KEYS) as PlayerItemCounts;
  }

  getSnapshot(): PlayerInventorySnapshot {
    return {
      resources: this.getResourceCounts(),
      items: this.getItemCounts(),
    };
  }

  createSaveSnapshot(): PlayerInventorySaveSnapshot {
    return {
      resources: { ...this.resources },
      items: { ...this.items },
    };
  }

  restoreSaveSnapshot(snapshot: PlayerInventorySaveSnapshot): void {
    resetStore(this.resources, KNOWN_RESOURCE_KEYS);
    resetStore(this.items, KNOWN_ITEM_KEYS);

    Object.entries(snapshot.resources).forEach(([id, amount]) => {
      this.resources[id] = sanitizeCount(amount);
    });

    Object.entries(snapshot.items).forEach(([id, amount]) => {
      this.items[id] = sanitizeCount(amount);
    });
  }

  static emptySnapshot(): PlayerInventorySnapshot {
    return {
      resources: { wood: 0, stone: 0, herb: 0 },
      items: { firestarter_set: 0, wooden_marker: 0, camp_supplies: 0, warm_tea: 0 },
    };
  }

  getCount(resource: PlayerResourceKey): number {
    return this.resources[resource] ?? 0;
  }

  getItemCount(itemId: PlayerItemKey): number {
    return this.items[itemId] ?? 0;
  }

  add(resource: PlayerResourceKey, amount = 1): void {
    this.resources[resource] = (this.resources[resource] ?? 0) + Math.max(0, amount);
  }

  addDelta(delta: PlayerInventoryDelta): void {
    for (const [resource, amount] of Object.entries(delta)) {
      if (amount && amount > 0) {
        this.add(resource as PlayerResourceKey, amount);
      }
    }
  }

  hasAtLeast(resource: PlayerResourceKey, amount: number): boolean {
    return (this.resources[resource] ?? 0) >= amount;
  }

  addItem(itemId: PlayerItemKey, amount = 1): void {
    this.items[itemId] = (this.items[itemId] ?? 0) + Math.max(0, amount);
  }

  addItemDelta(delta: PlayerItemDelta): void {
    for (const [itemId, amount] of Object.entries(delta)) {
      if (amount && amount > 0) {
        this.addItem(itemId as PlayerItemKey, amount);
      }
    }
  }

  hasItemAtLeast(itemId: PlayerItemKey, amount: number): boolean {
    return (this.items[itemId] ?? 0) >= amount;
  }

  consumeItem(itemId: PlayerItemKey, amount = 1): boolean {
    if (!this.hasItemAtLeast(itemId, amount)) {
      return false;
    }

    this.items[itemId] = (this.items[itemId] ?? 0) - amount;
    return true;
  }

  hasDelta(delta: PlayerInventoryDelta): boolean {
    for (const [resource, amount] of Object.entries(delta)) {
      if ((amount ?? 0) > (this.resources[resource] ?? 0)) {
        return false;
      }
    }

    return true;
  }

  consumeDelta(delta: PlayerInventoryDelta): boolean {
    if (!this.hasDelta(delta)) {
      return false;
    }

    for (const [resource, amount] of Object.entries(delta)) {
      if (amount && amount > 0) {
        this.resources[resource] = (this.resources[resource] ?? 0) - amount;
      }
    }

    return true;
  }

  // --- Generic API: safe for future items/resources not in the typed unions ---

  getGenericCount(id: string): number {
    return (this.resources[id] ?? 0) + (this.items[id] ?? 0);
  }

  addGenericResource(id: string, amount = 1): void {
    this.resources[id] = (this.resources[id] ?? 0) + Math.max(0, amount);
  }

  addGenericItem(id: string, amount = 1): void {
    this.items[id] = (this.items[id] ?? 0) + Math.max(0, amount);
  }

  hasGenericResourceAtLeast(id: string, amount: number): boolean {
    return (this.resources[id] ?? 0) >= amount;
  }

  hasGenericItemAtLeast(id: string, amount: number): boolean {
    return (this.items[id] ?? 0) >= amount;
  }

  consumeGenericResource(id: string, amount = 1): boolean {
    if (!this.hasGenericResourceAtLeast(id, amount)) {
      return false;
    }

    this.resources[id] = (this.resources[id] ?? 0) - amount;
    return true;
  }

  consumeGenericItem(id: string, amount = 1): boolean {
    if (!this.hasGenericItemAtLeast(id, amount)) {
      return false;
    }

    this.items[id] = (this.items[id] ?? 0) - amount;
    return true;
  }

  listAllOccupied(): Array<{ id: string; amount: number }> {
    const result: Array<{ id: string; amount: number }> = [];

    for (const [id, amount] of Object.entries(this.resources)) {
      if (amount > 0) result.push({ id, amount });
    }

    for (const [id, amount] of Object.entries(this.items)) {
      if (amount > 0) result.push({ id, amount });
    }

    return result;
  }

  clearAll(): void {
    for (const key of Object.keys(this.resources)) this.resources[key] = 0;
    for (const key of Object.keys(this.items)) this.items[key] = 0;
  }
}

function buildTypedSnapshot<K extends string>(
  source: Record<string, number>,
  keys: K[],
): Record<K, number> {
  const result = {} as Record<K, number>;

  for (const key of keys) {
    result[key] = source[key] ?? 0;
  }

  return result;
}

function resetStore(store: Record<string, number>, knownKeys: string[]): void {
  Object.keys(store).forEach((key) => {
    delete store[key];
  });

  knownKeys.forEach((key) => {
    store[key] = 0;
  });
}

function sanitizeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function snapshotGetCount(snapshot: PlayerInventorySnapshot, id: string): number {
  return (snapshot.resources as Record<string, number>)[id]
    ?? (snapshot.items as Record<string, number>)[id]
    ?? 0;
}

export function snapshotActiveEntries(snapshot: PlayerInventorySnapshot): Map<string, number> {
  const result = new Map<string, number>();
  for (const [id, count] of Object.entries(snapshot.resources as Record<string, number>)) {
    if (count > 0) result.set(id, count);
  }
  for (const [id, count] of Object.entries(snapshot.items as Record<string, number>)) {
    if (count > 0) result.set(id, count);
  }
  return result;
}
