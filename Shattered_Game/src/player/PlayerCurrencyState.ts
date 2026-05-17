export type CurrencyKey = 'copper' | 'silver' | 'gold' | 'platinum';

export type CurrencySnapshot = Record<CurrencyKey, number>;

const COPPER_PER_SILVER = 100;
const SILVER_PER_GOLD = 100;
const GOLD_PER_PLATINUM = 100;

export class PlayerCurrencyState {
  private totalCopperValue = 0;

  addCopper(amount: number): void {
    this.totalCopperValue = Math.max(0, this.totalCopperValue + Math.max(0, amount));
  }

  getTotalCopperValue(): number {
    return this.totalCopperValue;
  }

  getSnapshot(): CurrencySnapshot {
    let remaining = this.totalCopperValue;
    const copperPerGold = COPPER_PER_SILVER * SILVER_PER_GOLD;
    const copperPerPlatinum = copperPerGold * GOLD_PER_PLATINUM;

    const platinum = Math.floor(remaining / copperPerPlatinum);
    remaining -= platinum * copperPerPlatinum;

    const gold = Math.floor(remaining / copperPerGold);
    remaining -= gold * copperPerGold;

    const silver = Math.floor(remaining / COPPER_PER_SILVER);
    remaining -= silver * COPPER_PER_SILVER;

    return {
      copper: remaining,
      silver,
      gold,
      platinum,
    };
  }

  createSaveSnapshot(): Record<string, number> {
    return this.getSnapshot();
  }

  restoreSaveSnapshot(snapshot: Record<string, number>): void {
    const copper = sanitizeCount(snapshot.copper);
    const silver = sanitizeCount(snapshot.silver);
    const gold = sanitizeCount(snapshot.gold);
    const platinum = sanitizeCount(snapshot.platinum);

    this.totalCopperValue =
      copper
      + (silver * COPPER_PER_SILVER)
      + (gold * COPPER_PER_SILVER * SILVER_PER_GOLD)
      + (platinum * COPPER_PER_SILVER * SILVER_PER_GOLD * GOLD_PER_PLATINUM);
  }
}

function sanitizeCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}
