import type { PlayerItemKey } from '../player/PlayerInventoryState';

export type ItemDefinition = {
  id: PlayerItemKey;
  displayName: string;
  description: string;
  stackable: boolean;
  placeable: boolean;
  placementObjectDefinitionId?: string;
};
