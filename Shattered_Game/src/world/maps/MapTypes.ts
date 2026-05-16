import type { GridFootprint } from '../../objects/ObjectTypes';
import type { TileType } from '../IsoTilemapTypes';

export type MapSpawnPoint = {
  id: string;
  tileX: number;
  tileY: number;
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
  metadata?: Record<string, unknown>;
};

export type MapDefinitionFactory = () => MapDefinition;

export type MapRegistration = {
  id: string;
  displayName: string;
  factory: MapDefinitionFactory;
};
