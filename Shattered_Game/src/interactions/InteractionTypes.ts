import type { SfxEventId } from '../audio/SfxTypes';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import type { GridFootprint } from '../objects/ObjectTypes';
import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { LevelUpEvent, SkillXpDelta } from '../skills/SkillTypes';
import type { ToastKind } from '../ui/ToastTypes';
import type {
  MapContractBoardAnchor,
  MapGenericDebugAnchor,
  MapNpcAnchor,
  MapResourceNodeAnchor,
  MapTransition,
  MapWorkbenchAnchor,
} from '../world/maps/MapTypes';

export type InteractionType =
  | 'map_transition'
  | 'resource_node'
  | 'npc'
  | 'workbench'
  | 'contract_board'
  | 'placed_object'
  | 'item_use'
  | 'generic_debug'
  | 'ground_item';

export type InteractionTile = {
  x: number;
  y: number;
};

export type InteractionDefinition = {
  id: string;
  interactionType: InteractionType;
  promptText: string;
  interactionRangeTiles: number;
  priority: number;
};

type BaseInteractionTarget = {
  definition: InteractionDefinition;
  tiles: InteractionTile[];
};

export type MapTransitionInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'map_transition' };
  transition: MapTransition;
};

export type ResourceNodeInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'resource_node' };
  anchor: MapResourceNodeAnchor;
};

export type NpcInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'npc' };
  anchor: MapNpcAnchor;
};

export type WorkbenchInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'workbench' };
  anchor: MapWorkbenchAnchor;
};

export type ContractBoardInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'contract_board' };
  anchor: MapContractBoardAnchor;
};

export type GenericDebugInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'generic_debug' };
  anchor: MapGenericDebugAnchor;
};

export type PlacedObjectInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'placed_object' };
  placedObjectId: string;
  placedObjectKind: 'placed_firestarter_set' | 'campfire';
};

export type GroundItemInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'ground_item' };
  dropId: string;
  itemId: string;
  count: number;
};

export type InteractionTarget =
  | MapTransitionInteractionTarget
  | ResourceNodeInteractionTarget
  | NpcInteractionTarget
  | WorkbenchInteractionTarget
  | ContractBoardInteractionTarget
  | PlacedObjectInteractionTarget
  | GenericDebugInteractionTarget
  | GroundItemInteractionTarget;

export type ActiveInteraction = {
  target: InteractionTarget;
  distanceTiles: number;
  promptText: string;
};

export type InteractionResult = {
  ok: boolean;
  interactionType: InteractionType;
  targetId: string;
  message: string;
  sfxId?: SfxEventId;
  transitionRequest?: {
    targetMapId: string;
    targetSpawnId: string;
  };
  inventoryDelta?: Record<string, number>;
  itemDelta?: Record<string, number>;
  placementItemId?: string;
  depleted?: boolean;
  createdObjectId?: string;
  currencyDelta?: Partial<CurrencySnapshot>;
  reputationDelta?: Partial<ReputationSnapshot>;
  xpDelta?: SkillXpDelta;
  levelUps?: LevelUpEvent[];
  toastKind?: ToastKind;
  /** If set, the game should open the shop popup for this shop ID. */
  openShopId?: string;
};

export type InteractionHandlers = {
  onMapTransition: (target: MapTransitionInteractionTarget) => InteractionResult;
  onResourceNode: (target: ResourceNodeInteractionTarget) => InteractionResult;
  onNpc: (target: NpcInteractionTarget) => InteractionResult;
  onWorkbench: (target: WorkbenchInteractionTarget) => InteractionResult;
  onContractBoard: (target: ContractBoardInteractionTarget) => InteractionResult;
  onPlacedObject: (target: PlacedObjectInteractionTarget) => InteractionResult;
  onGenericDebug: (target: GenericDebugInteractionTarget) => InteractionResult;
  onGroundItem: (target: GroundItemInteractionTarget) => InteractionResult;
};

// ─── Type predicates ─────────────────────────────────────────────────────────

export function isMapTransitionTarget(t: InteractionTarget): t is MapTransitionInteractionTarget {
  return t.definition.interactionType === 'map_transition';
}

export function isResourceNodeTarget(t: InteractionTarget): t is ResourceNodeInteractionTarget {
  return t.definition.interactionType === 'resource_node';
}

export function isNpcTarget(t: InteractionTarget): t is NpcInteractionTarget {
  return t.definition.interactionType === 'npc';
}

export function isWorkbenchTarget(t: InteractionTarget): t is WorkbenchInteractionTarget {
  return t.definition.interactionType === 'workbench';
}

export function isContractBoardTarget(t: InteractionTarget): t is ContractBoardInteractionTarget {
  return t.definition.interactionType === 'contract_board';
}

export function isPlacedObjectTarget(t: InteractionTarget): t is PlacedObjectInteractionTarget {
  return t.definition.interactionType === 'placed_object';
}

export function isGenericDebugTarget(t: InteractionTarget): t is GenericDebugInteractionTarget {
  return t.definition.interactionType === 'generic_debug';
}

export function isGroundItemTarget(t: InteractionTarget): t is GroundItemInteractionTarget {
  return t.definition.interactionType === 'ground_item';
}

// ─── Tile helpers ─────────────────────────────────────────────────────────────

export function createSingleTileInteractionTiles(tileX: number, tileY: number): InteractionTile[] {
  return [{ x: tileX, y: tileY }];
}

export function createFootprintInteractionTiles(
  tileX: number,
  tileY: number,
  footprint: GridFootprint,
): InteractionTile[] {
  const resolvedFootprint = footprint.length > 0 ? footprint : [{ x: 0, y: 0 }];

  return resolvedFootprint.map((offset) => ({
    x: tileX + offset.x,
    y: tileY + offset.y,
  }));
}
