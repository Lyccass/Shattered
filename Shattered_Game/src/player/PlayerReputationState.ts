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
}
