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
}
