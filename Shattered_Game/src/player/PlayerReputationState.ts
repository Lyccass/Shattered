export type ReputationSnapshot = {
  harborReputation: number;
};

export class PlayerReputationState {
  private harborReputation = 0;

  addHarborReputation(amount: number): void {
    this.harborReputation += Math.max(0, amount);
  }

  getSnapshot(): ReputationSnapshot {
    return {
      harborReputation: this.harborReputation,
    };
  }

  createSaveSnapshot(): Record<string, number> {
    return this.getSnapshot();
  }

  restoreSaveSnapshot(snapshot: Record<string, number>): void {
    this.harborReputation = sanitizeCount(snapshot.harborReputation);
  }
}

function sanitizeCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}
