import Phaser from 'phaser';
import { IsoTilemap } from '../IsoTilemap';
import type { MapDefinition, MapInteractionAnchor, MapTransition } from './MapTypes';

export type LoadedMapRuntime = {
  definition: MapDefinition;
  isoTilemap: IsoTilemap;
  worldBounds: Phaser.Geom.Rectangle;
  activeSpawnId: string;
  transitions: MapTransition[];
  interactionAnchors: MapInteractionAnchor[];
};
