import type { GridFootprint } from '../../objects/ObjectTypes';
import type { PlayerItemKey } from '../../player/PlayerInventoryState';
import type { TileType } from '../IsoTilemapTypes';

export type MapSpawnPoint = {
  id: string;
  tileX: number;
  tileY: number;
};

export type MapZoneTag =
  | 'personal_build'
  | 'wilderness_camp'
  | 'town'
  | 'harbor'
  | 'transition';

export type MapZone = {
  id: string;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  tags: MapZoneTag[];
};

export type MapPlacedObject = {
  id: string;
  definitionId: string;
  tileX: number;
  tileY: number;
  orientation?: string;
  state?: Record<string, unknown>;
};

export type MapTransitionType = 'dock' | 'cave' | 'door' | 'ferry' | 'portal' | 'debug';

export type MapTransitionVisualAnchor = {
  tileX: number;
  tileY: number;
  label?: string;
};

export type ResourceNodeType = 'driftwood' | 'stone_pile' | 'herb_patch';

type BaseMapInteractionAnchor = {
  id: string;
  tileX: number;
  tileY: number;
  interactionRangeTiles?: number;
  linkedObjectId?: string;
  metadata?: Record<string, unknown>;
};

export type MapResourceNodeAnchor = BaseMapInteractionAnchor & {
  interactionType: 'resource_node';
  resourceNodeType: ResourceNodeType;
};

export type MapNpcAnchor = BaseMapInteractionAnchor & {
  interactionType: 'npc';
  promptLabel?: string;
  text: string;
};

export type MapWorkbenchAnchor = BaseMapInteractionAnchor & {
  interactionType: 'workbench';
  stationType?: 'workbench';
  requiredWood?: number;
  craftedItemId?: PlayerItemKey;
  successMessage?: string;
  missingResourceMessage?: string;
};

export type MapGenericDebugAnchor = BaseMapInteractionAnchor & {
  interactionType: 'generic_debug';
  promptLabel?: string;
  message: string;
};

export type MapInteractionAnchor =
  | MapResourceNodeAnchor
  | MapNpcAnchor
  | MapWorkbenchAnchor
  | MapGenericDebugAnchor;

export type MapTransition = {
  id: string;
  fromTile: {
    tileX: number;
    tileY: number;
  };
  triggerFootprint?: GridFootprint;
  visualAnchor?: MapTransitionVisualAnchor;
  targetMapId: string;
  targetSpawnId: string;
  transitionType?: MapTransitionType;
  metadata?: Record<string, unknown>;
};

export type MapDefinition = {
  id: string;
  displayName: string;
  width: number;
  height: number;
  terrain: TileType[][];
  spawnPoints: Record<string, MapSpawnPoint>;
  objects: MapPlacedObject[];
  transitions: MapTransition[];
  zones?: MapZone[];
  interactionAnchors?: MapInteractionAnchor[];
  metadata?: Record<string, unknown>;
};

export type MapDefinitionFactory = () => MapDefinition;

export type MapRegistration = {
  id: string;
  displayName: string;
  factory: MapDefinitionFactory;
};
