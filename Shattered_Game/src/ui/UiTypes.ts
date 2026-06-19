import type { ActionProgressSnapshot } from '../actions/ActionProgressTypes';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import type { EquipmentSnapshot } from '../equipment/EquipmentTypes';
import { emptyEquipmentSnapshot } from '../equipment/EquipmentTypes';
import type { CompanionSnapshot } from '../companions/CompanionTypes';
import type { ChoiceMenuStateSnapshot } from '../interactions/ChoiceMenuTypes';
import type { ActiveInteraction, InteractionResult } from '../interactions/InteractionTypes';
import type { PlacementPreviewState } from '../interactions/PlacementModeSystem';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import { PlayerInventoryState, type PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../player/PlayerReputationState';
import { emptySpellbookSnapshot, type SpellbookSnapshot } from '../player/PlayerSpellbookState';
import type { SkillId, SkillSnapshot } from '../skills/SkillTypes';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';
import type { TerrainFamily } from '../shared/map/TerrainTypes';

export type UiStateSnapshot = {
  activeInteraction: ActiveInteraction | null;
  choiceMenu: ChoiceMenuStateSnapshot | null;
  inventory: PlayerInventorySnapshot;
  currency: CurrencySnapshot;
  reputation: ReputationSnapshot;
  skills: SkillSnapshot[];
  activeTaskCount: number;
  journalEntries: TaskJournalEntry[];
  activeEffects: ActiveEffectSnapshot[];
  placementState: PlacementPreviewState | null;
  actionProgress: ActionProgressSnapshot | null;
  equipment: EquipmentSnapshot;
  companions: CompanionSnapshot;
  spellbook: SpellbookSnapshot;
};

export type MinimapTileInfo = {
  terrain: string | null;
  walkable: boolean;
};

export type MinimapViewport = {
  radius: number;
  /** [row = dy + radius][col = dx + radius], origin = player tile */
  tiles: MinimapTileInfo[][];
  npcs: Array<{ dx: number; dy: number }>;
  enemies: Array<{ dx: number; dy: number }>;
};

export type MinimapSnapshot = {
  mapId: string;
  mapName: string;
  playerTileX: number;
  playerTileY: number;
  mapWidth: number;
  mapHeight: number;
  terrain: TerrainFamily[][];
  viewport: MinimapViewport | null;
};

// Use this instead of an inline object literal in GameScene/tests so that
// adding a new UiStateSnapshot field does not create silent stale defaults.
export function emptyUiStateSnapshot(): UiStateSnapshot {
  return {
    activeInteraction: null,
    choiceMenu: null,
    inventory: PlayerInventoryState.emptySnapshot(),
    currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
    reputation: { harborReputation: 0 },
    skills: [],
    activeTaskCount: 0,
    journalEntries: [],
    activeEffects: [],
    placementState: null,
    actionProgress: null,
    equipment: emptyEquipmentSnapshot(),
    companions: {},
    spellbook: emptySpellbookSnapshot(),
  };
}

export type UiHandledResult = Pick<InteractionResult, 'ok' | 'message' | 'xpDelta' | 'levelUps' | 'toastKind' | 'logToChat'> & {
  combatLog?: string;
};

export type SkillToastEntry = {
  skillId: SkillId;
  amount: number;
};
