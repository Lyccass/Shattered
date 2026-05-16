import Phaser from 'phaser';
import { IsoTilemap } from '../IsoTilemap';
import { MapZoneIndex } from './MapZoneIndex';
import type { MapDefinition, MapInteractionAnchor, MapTransition, MapZone } from './MapTypes';

export type LoadedMapRuntime = {
  definition: MapDefinition;
  isoTilemap: IsoTilemap;
  worldBounds: Phaser.Geom.Rectangle;
  activeSpawnId: string;
  transitions: MapTransition[];
  zones: MapZone[];
  zoneIndex: MapZoneIndex;
  interactionAnchors: MapInteractionAnchor[];
};
