import { ConsumableEffectSystem } from '../effects/ConsumableEffectSystem';
import { EFFECT_DEFINITIONS } from '../effects/EffectDefinitions';
import { EffectRegistry } from '../effects/EffectRegistry';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import type { PlayerSaveState } from '../persistence/SaveTypes';
import { PlayerCurrencyState, type CurrencySnapshot } from './PlayerCurrencyState';
import { PlayerInventoryState, type PlayerInventorySnapshot } from './PlayerInventoryState';
import { PlayerReputationState, type ReputationSnapshot } from './PlayerReputationState';
import { SkillProgressionSystem } from '../skills/SkillProgressionSystem';
import type { SkillSnapshot } from '../skills/SkillTypes';
import { TaskJournalState } from '../tasks/TaskJournalState';

export class PlayerSessionState {
  private readonly inventoryState = new PlayerInventoryState();
  private readonly currencyState = new PlayerCurrencyState();
  private readonly reputationState = new PlayerReputationState();
  private readonly skillProgressionSystem = new SkillProgressionSystem();
  private readonly taskJournalState = new TaskJournalState();
  private readonly effectSystem = new ConsumableEffectSystem(
    new EffectRegistry(EFFECT_DEFINITIONS),
  );

  getInventoryState(): PlayerInventoryState {
    return this.inventoryState;
  }

  getInventorySnapshot(): PlayerInventorySnapshot {
    return this.inventoryState.getSnapshot();
  }

  getCurrencyState(): PlayerCurrencyState {
    return this.currencyState;
  }

  getCurrencySnapshot(): CurrencySnapshot {
    return this.currencyState.getSnapshot();
  }

  getReputationState(): PlayerReputationState {
    return this.reputationState;
  }

  getReputationSnapshot(): ReputationSnapshot {
    return this.reputationState.getSnapshot();
  }

  getSkillProgressionSystem(): SkillProgressionSystem {
    return this.skillProgressionSystem;
  }

  getSkillSnapshots(): SkillSnapshot[] {
    return this.skillProgressionSystem.getAllSkills();
  }

  getTaskJournalState(): TaskJournalState {
    return this.taskJournalState;
  }

  getEffectSystem(): ConsumableEffectSystem {
    return this.effectSystem;
  }

  getContractCompletionCount(contractId: string): number {
    return this.taskJournalState.getContractCompletionCount(contractId);
  }

  isContractAccepted(contractId: string): boolean {
    return this.taskJournalState.isContractAccepted(contractId);
  }

  acceptContract(contractId: string): boolean {
    return this.taskJournalState.acceptContract(contractId);
  }

  isContractCompletedNonRepeatable(contractId: string): boolean {
    return this.taskJournalState.isContractCompletedNonRepeatable(contractId);
  }

  getAcceptedContractIds(): string[] {
    return this.taskJournalState.getAcceptedContractIds();
  }

  completeContract(contractId: string, repeatable: boolean): number {
    return this.taskJournalState.completeContract(contractId, repeatable);
  }

  getActiveEffects(nowMs: number): ActiveEffectSnapshot[] {
    return this.effectSystem.getActiveEffects(nowMs);
  }

  update(nowMs: number): boolean {
    return this.effectSystem.update(nowMs);
  }

  createSaveState({
    currentWorldId,
    currentMapId,
    playerTile,
    nowMs,
  }: {
    currentWorldId: string;
    currentMapId: string;
    playerTile: { tileX: number; tileY: number };
    nowMs: number;
  }): PlayerSaveState {
    const inventorySnapshot = this.inventoryState.createSaveSnapshot();

    return {
      currentWorldId,
      currentMapId,
      playerTile: {
        tileX: Math.trunc(playerTile.tileX),
        tileY: Math.trunc(playerTile.tileY),
      },
      resources: inventorySnapshot.resources,
      items: inventorySnapshot.items,
      currency: this.currencyState.createSaveSnapshot(),
      reputation: this.reputationState.createSaveSnapshot(),
      skillXp: this.skillProgressionSystem.createSaveSnapshot(),
      journal: this.taskJournalState.createSaveSnapshot(),
      activeEffects: this.effectSystem.createSaveSnapshot(nowMs),
    };
  }

  restoreSaveState(snapshot: PlayerSaveState, nowMs: number): void {
    this.inventoryState.restoreSaveSnapshot({
      resources: snapshot.resources,
      items: snapshot.items,
    });
    this.currencyState.restoreSaveSnapshot(snapshot.currency);
    this.reputationState.restoreSaveSnapshot(snapshot.reputation);
    this.skillProgressionSystem.restoreSaveSnapshot(snapshot.skillXp);
    this.taskJournalState.restoreSaveSnapshot(snapshot.journal);
    this.effectSystem.restoreSaveSnapshot(snapshot.activeEffects, nowMs);
  }
}
