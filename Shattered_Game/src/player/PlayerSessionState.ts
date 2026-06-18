import { ConsumableEffectSystem } from '../effects/ConsumableEffectSystem';
import { EFFECT_DEFINITIONS } from '../effects/EffectDefinitions';
import { EffectRegistry } from '../effects/EffectRegistry';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import type { EquipmentSnapshot, PlayerDerivedStats } from '../equipment/EquipmentTypes';
import type { PlayerSaveState } from '../persistence/SaveTypes';
import { PlayerCurrencyState, type CurrencySnapshot } from './PlayerCurrencyState';
import { PlayerEquipmentState } from './PlayerEquipmentState';
import { PlayerInventoryState, type PlayerInventorySnapshot } from './PlayerInventoryState';
import { PlayerReputationState, type ReputationSnapshot } from './PlayerReputationState';
import { PlayerSpellbookState, type SpellbookSnapshot } from './PlayerSpellbookState';
import { SkillProgressionSystem } from '../skills/SkillProgressionSystem';
import type { SkillId, SkillSnapshot } from '../skills/SkillTypes';
import { TaskJournalState } from '../tasks/TaskJournalState';
import type { TurnCombatAbility } from '../combat/turn/TurnCombatTypes';
import type { AbilitySlotType } from '../combat/abilities/CombatAbilityDefinitions';
import type { QuestRuntimeState } from '../quests/QuestTypes';

type CombatCooldownSnapshot = {
  attackCooldowns: Record<string, number>;
  abilityCooldowns: Record<string, number>;
};

export class PlayerSessionState {
  private readonly inventoryState = new PlayerInventoryState();
  private readonly currencyState = new PlayerCurrencyState();
  private readonly reputationState = new PlayerReputationState();
  private readonly skillProgressionSystem = new SkillProgressionSystem();
  private readonly taskJournalState = new TaskJournalState();
  private readonly effectSystem = new ConsumableEffectSystem(
    new EffectRegistry(EFFECT_DEFINITIONS),
  );
  private readonly equipmentState = new PlayerEquipmentState();
  private readonly spellbookState = new PlayerSpellbookState();
  private combatCooldowns: CombatCooldownSnapshot = {
    attackCooldowns: {},
    abilityCooldowns: {},
  };

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

  getSkillLevel(skillId: SkillId): number {
    return this.skillProgressionSystem.getLevel(skillId);
  }

  getSpellbookSnapshot(): SpellbookSnapshot {
    return this.spellbookState.getSnapshot((skillId) => this.getSkillLevel(skillId));
  }

  getEquippedTurnAbilities(): TurnCombatAbility[] {
    return this.spellbookState.getEquippedTurnAbilities((skillId) => this.getSkillLevel(skillId));
  }

  equipSpellbookAbility(slotType: AbilitySlotType, slotIndex: number, abilityId: string | null): boolean {
    return this.spellbookState.equip(slotType, slotIndex, abilityId, (skillId) => this.getSkillLevel(skillId));
  }

  getCombatCooldownSnapshot(): CombatCooldownSnapshot {
    return {
      attackCooldowns: { ...this.combatCooldowns.attackCooldowns },
      abilityCooldowns: { ...this.combatCooldowns.abilityCooldowns },
    };
  }

  setCombatCooldownSnapshot(snapshot: CombatCooldownSnapshot): void {
    this.combatCooldowns = {
      attackCooldowns: sanitizeCooldowns(snapshot.attackCooldowns),
      abilityCooldowns: sanitizeCooldowns(snapshot.abilityCooldowns),
    };
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

  startQuest(questId: string): boolean {
    return this.taskJournalState.getQuestState().startQuest(questId);
  }

  isQuestActive(questId: string): boolean {
    return this.taskJournalState.getQuestState().isQuestActive(questId);
  }

  isQuestCompleted(questId: string): boolean {
    return this.taskJournalState.getQuestState().isQuestCompleted(questId);
  }

  getQuestCompletionCount(questId: string): number {
    return this.taskJournalState.getQuestState().getQuestCompletionCount(questId);
  }

  getActiveQuestIds(): string[] {
    return this.taskJournalState.getQuestState().getActiveQuestIds();
  }

  getCompletedQuestIds(): string[] {
    return this.taskJournalState.getQuestState().getCompletedQuestIds();
  }

  getQuestRuntimeState(questId: string): QuestRuntimeState | null {
    return this.taskJournalState.getQuestState().getQuestRuntimeState(questId);
  }

  mutateQuestRuntimeState(
    questId: string,
    mutate: (state: QuestRuntimeState) => void,
  ): boolean {
    return this.taskJournalState.getQuestState().mutateQuestRuntimeState(questId, mutate);
  }

  completeQuest(questId: string, repeatable: boolean): number {
    return this.taskJournalState.getQuestState().completeQuest(questId, repeatable);
  }

  getEquipmentState(): PlayerEquipmentState {
    return this.equipmentState;
  }

  getDerivedStats(): PlayerDerivedStats {
    return this.equipmentState.getDerivedStats({
      melee: this.skillProgressionSystem.getLevel('melee'),
      ranged: this.skillProgressionSystem.getLevel('ranged'),
      magic: this.skillProgressionSystem.getLevel('magic'),
      devotion: this.skillProgressionSystem.getLevel('devotion'),
    });
  }

  getEquipmentSnapshot(): EquipmentSnapshot {
    return this.equipmentState.getSnapshot({
      melee: this.skillProgressionSystem.getLevel('melee'),
      ranged: this.skillProgressionSystem.getLevel('ranged'),
      magic: this.skillProgressionSystem.getLevel('magic'),
      devotion: this.skillProgressionSystem.getLevel('devotion'),
    });
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
    const inventorySave = this.inventoryState.createSaveSnapshot();

    return {
      currentWorldId,
      currentMapId,
      playerTile: {
        tileX: Math.trunc(playerTile.tileX),
        tileY: Math.trunc(playerTile.tileY),
      },
      resources: {},
      items: inventorySave,
      currency: this.currencyState.createSaveSnapshot(),
      reputation: this.reputationState.createSaveSnapshot(),
      skillXp: this.skillProgressionSystem.createSaveSnapshot(),
      journal: this.taskJournalState.createSaveSnapshot(),
      activeEffects: this.effectSystem.createSaveSnapshot(nowMs),
      equippedSlots: this.equipmentState.createSaveSnapshot(),
      spellbookLoadout: this.spellbookState.createSaveSnapshot(),
      combatCooldowns: this.getCombatCooldownSnapshot(),
    };
  }

  restoreSaveState(snapshot: PlayerSaveState, nowMs: number): void {
    this.inventoryState.restoreSaveSnapshot({
      ...snapshot.resources,
      ...snapshot.items,
    });
    this.currencyState.restoreSaveSnapshot(snapshot.currency);
    this.reputationState.restoreSaveSnapshot(snapshot.reputation);
    this.skillProgressionSystem.restoreSaveSnapshot(snapshot.skillXp);
    this.taskJournalState.restoreSaveSnapshot(snapshot.journal);
    this.effectSystem.restoreSaveSnapshot(snapshot.activeEffects, nowMs);
    if (snapshot.equippedSlots) {
      this.equipmentState.restoreSaveSnapshot(snapshot.equippedSlots);
    }
    this.spellbookState.restoreSaveSnapshot(snapshot.spellbookLoadout);
    this.setCombatCooldownSnapshot({
      attackCooldowns: snapshot.combatCooldowns?.attackCooldowns ?? {},
      abilityCooldowns: snapshot.combatCooldowns?.abilityCooldowns ?? {},
    });
  }
}

function sanitizeCooldowns(cooldowns: Record<string, number>): Record<string, number> {
  const sanitized: Record<string, number> = {};
  for (const [id, value] of Object.entries(cooldowns)) {
    const remaining = Math.max(0, Math.floor(value));
    if (remaining > 0) sanitized[id] = remaining;
  }
  return sanitized;
}
