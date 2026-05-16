export type PlayerResourceKey = 'wood' | 'stone' | 'herb';

export type PlayerInventoryCounts = Record<PlayerResourceKey, number>;

export type PlayerInventoryDelta = Partial<PlayerInventoryCounts>;

const EMPTY_COUNTS: PlayerInventoryCounts = {
  wood: 0,
  stone: 0,
  herb: 0,
};

export class PlayerInventoryState {
  private readonly counts: PlayerInventoryCounts = { ...EMPTY_COUNTS };

  getCounts(): PlayerInventoryCounts {
    return { ...this.counts };
  }

  getCount(resource: PlayerResourceKey): number {
    return this.counts[resource];
  }

  add(resource: PlayerResourceKey, amount = 1): void {
    this.counts[resource] += Math.max(0, amount);
  }

  addDelta(delta: PlayerInventoryDelta): void {
    for (const [resource, amount] of Object.entries(delta) as Array<[PlayerResourceKey, number | undefined]>) {
      if (amount && amount > 0) {
        this.add(resource, amount);
      }
    }
  }

  hasAtLeast(resource: PlayerResourceKey, amount: number): boolean {
    return this.counts[resource] >= amount;
  }

  hasDelta(delta: PlayerInventoryDelta): boolean {
    for (const [resource, amount] of Object.entries(delta) as Array<[PlayerResourceKey, number | undefined]>) {
      if ((amount ?? 0) > this.counts[resource]) {
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
        this.counts[resource] -= amount;
      }
    }

    return true;
  }
}
