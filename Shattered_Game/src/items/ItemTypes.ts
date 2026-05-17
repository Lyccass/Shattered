import type { EffectId } from '../effects/EffectTypes';
import type {
  PlayerItemKey,
  PlayerResourceKey,
} from '../player/PlayerInventoryState';
import type { MapSpaceType, MapZoneTag } from '../world/maps/MapTypes';

export type ItemId = PlayerResourceKey | PlayerItemKey;

export type ItemCategory = 'resource' | 'placeable' | 'consumable' | 'crafted';

export type ItemUseMode = 'none' | 'place' | 'consume';

export type PlacementRules = {
  allowedSpaceTypes?: MapSpaceType[];
  forbiddenSpaceTypes?: MapSpaceType[];
  allowedZoneTags?: MapZoneTag[];
  forbiddenZoneTags?: MapZoneTag[];
  mustBeWalkable?: boolean;
  mustNotBeBlocked?: boolean;
  maxActivePerSession?: number;
  durationMs?: number;
  minTransitionDistanceTiles?: number;
};

export type ItemDefinition = {
  id: ItemId;
  displayName: string;
  description: string;
  category: ItemCategory;
  stackable: boolean;
  useMode: ItemUseMode;
  placementRules?: PlacementRules;
  placementObjectDefinitionId?: string;
  consumableEffectId?: EffectId;
  consumeMessage?: string;
};
