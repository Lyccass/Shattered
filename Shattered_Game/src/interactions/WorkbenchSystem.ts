import type { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import type { PlayerInventoryState } from '../player/PlayerInventoryState';
import type { MapWorkbenchAnchor } from '../world/maps/MapTypes';
import type { InteractionResult, WorkbenchInteractionTarget } from './InteractionTypes';
import { createSingleTileInteractionTiles } from './InteractionTypes';

type WorkbenchPlacementSystem = Pick<ObjectPlacementSystem, 'placeObject' | 'getInstance'>;

type WorkbenchState = {
  mapId: string;
  anchor: MapWorkbenchAnchor;
};

export class WorkbenchSystem {
  private readonly completedWorkbenchIdsByMap = new Map<string, Set<string>>();
  private currentWorkbenches = new Map<string, WorkbenchState>();

  setMapWorkbenches(
    mapId: string,
    anchors: MapWorkbenchAnchor[],
    objectPlacementSystem?: WorkbenchPlacementSystem,
  ): void {
    this.currentWorkbenches = new Map(
      anchors.map((anchor) => [
        anchor.id,
        {
          mapId,
          anchor,
        },
      ]),
    );

    if (!objectPlacementSystem) {
      return;
    }

    const completedWorkbenchIds = this.getCompletedWorkbenchIds(mapId);

    completedWorkbenchIds.forEach((workbenchId) => {
      const state = this.currentWorkbenches.get(workbenchId);

      if (!state) {
        return;
      }

      const builtInstanceId = getBuiltInstanceId(state.mapId, state.anchor.id);

      if (!objectPlacementSystem.getInstance(builtInstanceId)) {
        const placedObject = objectPlacementSystem.placeObject(
          state.anchor.buildObjectDefinitionId,
          state.anchor.buildTileX,
          state.anchor.buildTileY,
          builtInstanceId,
        );

        if (!placedObject) {
          throw new Error(
            `WorkbenchSystem: failed to restore built object "${state.anchor.buildObjectDefinitionId}" for workbench "${state.anchor.id}" on map "${state.mapId}". Suggested fix: ensure the authored build tile stays clear.`,
          );
        }
      }
    });
  }

  createInteractionTargets(): WorkbenchInteractionTarget[] {
    return Array.from(this.currentWorkbenches.values())
      .filter((state) => !this.getCompletedWorkbenchIds(state.mapId).has(state.anchor.id))
      .map((state) => ({
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

  useWorkbench(
    workbenchId: string,
    inventory: PlayerInventoryState,
    objectPlacementSystem?: WorkbenchPlacementSystem,
  ): InteractionResult {
    const state = this.currentWorkbenches.get(workbenchId);

    if (!state) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'Nothing happens.',
      };
    }

    if (this.getCompletedWorkbenchIds(state.mapId).has(workbenchId)) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: state.anchor.alreadyBuiltMessage ?? 'The build spot is already used.',
      };
    }

    const requiredWood = state.anchor.requiredWood ?? 1;

    if (!inventory.hasAtLeast('wood', requiredWood)) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: state.anchor.missingResourceMessage ?? `You need ${requiredWood} wood.`,
      };
    }

    if (!objectPlacementSystem) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'The workbench is unavailable right now.',
      };
    }

    const builtInstanceId = getBuiltInstanceId(state.mapId, workbenchId);
    const placedObject = objectPlacementSystem.placeObject(
      state.anchor.buildObjectDefinitionId,
      state.anchor.buildTileX,
      state.anchor.buildTileY,
      builtInstanceId,
    );

    if (!placedObject) {
      return {
        ok: false,
        interactionType: 'workbench',
        targetId: workbenchId,
        message: 'The build spot is blocked.',
      };
    }

    inventory.consumeDelta({ wood: requiredWood });
    this.getCompletedWorkbenchIds(state.mapId).add(workbenchId);

    return {
      ok: true,
      interactionType: 'workbench',
      targetId: workbenchId,
      message: state.anchor.successMessage ?? `Built ${state.anchor.buildObjectDefinitionId}.`,
      inventoryDelta: { wood: -requiredWood },
      createdObjectId: builtInstanceId,
    };
  }

  private getCompletedWorkbenchIds(mapId: string): Set<string> {
    const completedWorkbenchIds = this.completedWorkbenchIdsByMap.get(mapId) ?? new Set<string>();
    this.completedWorkbenchIdsByMap.set(mapId, completedWorkbenchIds);
    return completedWorkbenchIds;
  }
}

function getBuiltInstanceId(mapId: string, workbenchId: string): string {
  return `${mapId}:${workbenchId}:built`;
}
