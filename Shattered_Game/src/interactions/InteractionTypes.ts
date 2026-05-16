import type { GridFootprint } from '../objects/ObjectTypes';
import type {
  PlayerInventoryDelta,
  PlayerItemDelta,
  PlayerItemKey,
} from '../player/PlayerInventoryState';
import type {
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
  | 'placed_object'
  | 'generic_debug';

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

export type GenericDebugInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'generic_debug' };
  anchor: MapGenericDebugAnchor;
};

export type PlacedObjectInteractionTarget = BaseInteractionTarget & {
  definition: InteractionDefinition & { interactionType: 'placed_object' };
  placedObjectId: string;
  placedObjectKind: 'placed_firestarter_set' | 'campfire';
};

export type InteractionTarget =
  | MapTransitionInteractionTarget
  | ResourceNodeInteractionTarget
  | NpcInteractionTarget
  | WorkbenchInteractionTarget
  | PlacedObjectInteractionTarget
  | GenericDebugInteractionTarget;

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
  transitionRequest?: {
    targetMapId: string;
    targetSpawnId: string;
  };
  inventoryDelta?: PlayerInventoryDelta;
  itemDelta?: PlayerItemDelta;
  placementItemId?: PlayerItemKey;
  depleted?: boolean;
  createdObjectId?: string;
};

export type InteractionHandlers = {
  onMapTransition: (target: MapTransitionInteractionTarget) => InteractionResult;
  onResourceNode: (target: ResourceNodeInteractionTarget) => InteractionResult;
  onNpc: (target: NpcInteractionTarget) => InteractionResult;
  onWorkbench: (target: WorkbenchInteractionTarget) => InteractionResult;
  onPlacedObject: (target: PlacedObjectInteractionTarget) => InteractionResult;
  onGenericDebug: (target: GenericDebugInteractionTarget) => InteractionResult;
};

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
