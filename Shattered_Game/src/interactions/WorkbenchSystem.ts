import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { MapWorkbenchAnchor } from '../world/maps/MapTypes';
import type { InteractionResult, WorkbenchInteractionTarget } from './InteractionTypes';
import { createSingleTileInteractionTiles } from './InteractionTypes';

type WorkbenchState = {
  mapId: string;
  anchor: MapWorkbenchAnchor;
};

export class WorkbenchSystem {
  private currentWorkbenches = new Map<string, WorkbenchState>();

  setMapWorkbenches(mapId: string, anchors: MapWorkbenchAnchor[]): void {
    this.currentWorkbenches = new Map(
      anchors.map((anchor) => [
        anchor.id,
        {
          mapId,
          anchor,
        },
      ]),
    );
  }

  createInteractionTargets(): WorkbenchInteractionTarget[] {
    return Array.from(this.currentWorkbenches.values()).map((state) => ({
      definition: {
        id: state.anchor.id,
        interactionType: 'workbench',
        promptText: 'Press E: Use Workbench',
        interactionRangeTiles: state.anchor.interactionRangeTiles ?? 1,
        priority: 95,
      },
      tiles: createSingleTileInteractionTiles(state.anchor.tileX, state.anchor.tileY),
      anchor: state.anchor,
    }));
  }

  useWorkbench(workbenchId: string, inventory: PlayerInventoryState): InteractionResult {
    const state = this.currentWorkbenches.get(workbenchId);

    if (!state) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'Nothing happens.',
      };
    }

    const requiredWood = state.anchor.requiredWood ?? 1;
    const craftedItemId = state.anchor.craftedItemId ?? 'firestarter_set';

    if (!inventory.hasAtLeast('wood', requiredWood)) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: state.anchor.missingResourceMessage ?? `You need ${requiredWood} wood.`,
      };
    }

    inventory.consumeDelta({ wood: requiredWood });
    inventory.addItem(craftedItemId, 1);

    return {
      ok: true,
      interactionType: 'workbench',
      targetId: workbenchId,
      message: state.anchor.successMessage ?? 'You put together a firestarter set. Press Space to place it.',
      inventoryDelta: { wood: -requiredWood },
      itemDelta: { [craftedItemId]: 1 },
      placementItemId: craftedItemId,
    };
  }
}
