// Single flat stack store — all items keyed by string ID.
// stackable: false items (most things) will each occupy their own inventory slot
// once the slot-based inventory UI is implemented; the count store here backs the bank.
// stackable: true items (ammo, runes) stack in the inventory too.

export type PlayerInventorySnapshot = {
  stacks: Record<string, number>;
};

export type PlayerInventorySaveSnapshot = Record<string, number>;

export class PlayerInventoryState {
  private readonly stacks: Record<string, number> = {};

  // ─── Read ──────────────────────────────────────────────────────────────────

  getCount(id: string): number {
    return this.stacks[id] ?? 0;
  }

  hasAtLeast(id: string, amount: number): boolean {
    return (this.stacks[id] ?? 0) >= amount;
  }

  hasAll(requirements: Record<string, number>): boolean {
    return Object.entries(requirements).every(([id, amount]) => this.hasAtLeast(id, amount));
  }

  listOccupied(): Array<{ id: string; count: number }> {
    return Object.entries(this.stacks)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, count }));
  }

  // ─── Capacity ──────────────────────────────────────────────────────────────

  usedSlots(isStackable: (id: string) => boolean): number {
    let count = 0;
    for (const [id, qty] of Object.entries(this.stacks)) {
      if (qty <= 0) continue;
      count += isStackable(id) ? 1 : qty;
    }
    return count;
  }

  canAdd(itemId: string, amount: number, isStackable: (id: string) => boolean, capacity: number): boolean {
    if (amount <= 0) return true;
    const stackable = isStackable(itemId);
    const alreadyHas = (this.stacks[itemId] ?? 0) > 0;
    const newSlots = stackable
      ? (alreadyHas ? 0 : 1)
      : amount;
    return this.usedSlots(isStackable) + newSlots <= capacity;
  }

  // ─── Write ─────────────────────────────────────────────────────────────────

  add(id: string, amount = 1): void {
    if (amount <= 0) return;
    this.stacks[id] = (this.stacks[id] ?? 0) + amount;
  }

  addMany(items: Record<string, number>): void {
    for (const [id, amount] of Object.entries(items)) {
      this.add(id, amount);
    }
  }

  consume(id: string, amount = 1): boolean {
    if (!this.hasAtLeast(id, amount)) return false;
    this.stacks[id] = (this.stacks[id] ?? 0) - amount;
    if (this.stacks[id] === 0) delete this.stacks[id];
    return true;
  }

  consumeAll(requirements: Record<string, number>): boolean {
    if (!this.hasAll(requirements)) return false;
    for (const [id, amount] of Object.entries(requirements)) {
      this.consume(id, amount);
    }
    return true;
  }

  clearAll(): void {
    for (const key of Object.keys(this.stacks)) delete this.stacks[key];
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  getSnapshot(): PlayerInventorySnapshot {
    return { stacks: { ...this.stacks } };
  }

  static emptySnapshot(): PlayerInventorySnapshot {
    return { stacks: {} };
  }

  createSaveSnapshot(): PlayerInventorySaveSnapshot {
    return { ...this.stacks };
  }

  restoreSaveSnapshot(saved: PlayerInventorySaveSnapshot): void {
    for (const key of Object.keys(this.stacks)) delete this.stacks[key];
    for (const [id, count] of Object.entries(saved)) {
      this.stacks[id] = sanitizeCount(count);
    }
  }
}

function sanitizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

// ─── Snapshot utilities ────────────────────────────────────────────────────────

export function snapshotGetCount(snapshot: PlayerInventorySnapshot, id: string): number {
  return snapshot.stacks[id] ?? 0;
}

export function snapshotActiveEntries(snapshot: PlayerInventorySnapshot): Map<string, number> {
  const result = new Map<string, number>();
  for (const [id, count] of Object.entries(snapshot.stacks)) {
    if (count > 0) result.set(id, count);
  }
  return result;
}
