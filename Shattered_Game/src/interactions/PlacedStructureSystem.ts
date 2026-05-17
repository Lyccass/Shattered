import { applyRecipeToInventory, canCraftRecipe } from '../crafting/RecipeInventory';
import type { RecipeRegistry } from '../crafting/RecipeRegistry';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { PlayerInventoryState, PlayerItemKey } from '../player/PlayerInventoryState';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { ObjectInstance } from '../objects/ObjectTypes';
import {
  type RuntimePlacedObjectRecord,
  WorldSessionState,
} from '../world/session/WorldSessionState';
import type {
  InteractionResult,
  PlacedObjectInteractionTarget,
} from './InteractionTypes';
import { createSingleTileInteractionTiles } from './InteractionTypes';

type PlacementObjectSystem = Pick<ObjectPlacementSystemLike, 'getInstance' | 'placeObject' | 'removeObject'>;

type ObjectPlacementSystemLike = {
  getInstance(instanceId: string): ObjectInstance | undefined;
  placeObject(
    definitionId: string,
    tileX: number,
    tileY: number,
    instanceId?: string,
  ): ObjectInstance | null;
  removeObject(instanceId: string): boolean;
};

const DEFAULT_FIRESTARTER_DURATION_MS = 45_000;
const CAMPFIRE_DESPAWN_MS = 90_000;

export class PlacedStructureSystem {
  private currentMapId: string | null = null;
  private currentObjects: RuntimePlacedObjectRecord[] = [];

  constructor(
    private readonly sessionState: WorldSessionState,
    private readonly recipeRegistry: RecipeRegistry,
  ) {}

  setCurrentMap(
    mapId: string,
    nowMs: number,
    objectPlacementSystem?: PlacementObjectSystem,
  ): void {
    this.currentMapId = mapId;
    this.currentObjects = this.sessionState.getPlacedObjects(mapId);
    this.updateRuntimeState(nowMs, objectPlacementSystem);

    if (!objectPlacementSystem) {
      return;
    }

    this.currentObjects.forEach((placedObject) => {
      if (objectPlacementSystem.getInstance(placedObject.id)) {
        return;
      }

      const restored = objectPlacementSystem.placeObject(
        placedObject.objectDefinitionId,
        placedObject.tileX,
        placedObject.tileY,
        placedObject.id,
      );

      if (!restored) {
        throw new Error(
          `PlacedStructureSystem: failed to restore runtime object "${placedObject.id}" (${placedObject.objectDefinitionId}) on map "${placedObject.mapId}" at tile ${placedObject.tileX},${placedObject.tileY}. Suggested fix: inspect runtime placement state for stale blocked tiles or invalid restores.`,
        );
      }
    });
  }

  updateRuntimeState(
    nowMs: number,
    objectPlacementSystem?: PlacementObjectSystem,
  ): boolean {
    if (!this.currentMapId) {
      return false;
    }

    const objects = this.sessionState.getPlacedObjects(this.currentMapId);
    const expiredObjects = objects.filter((placedObject) => nowMs >= placedObject.despawnAtMs);

    if (expiredObjects.length === 0) {
      this.currentObjects = objects;
      return false;
    }

    expiredObjects.forEach((placedObject) => {
      objectPlacementSystem?.removeObject(placedObject.id);
    });

    const remainingObjects = objects.filter((placedObject) => nowMs < placedObject.despawnAtMs);
    this.sessionState.setPlacedObjects(this.currentMapId, remainingObjects);
    this.currentObjects = remainingObjects;
    return true;
  }

  createInteractionTargets(): PlacedObjectInteractionTarget[] {
    return this.currentObjects.map((placedObject) => ({
      definition: {
        id: placedObject.id,
        interactionType: 'placed_object',
        promptText:
          placedObject.kind === 'placed_firestarter_set'
            ? 'Press E: Light Firestarter'
            : 'Press E: Use Campfire',
        interactionRangeTiles: 1,
        priority: placedObject.kind === 'placed_firestarter_set' ? 110 : 35,
      },
      tiles: createSingleTileInteractionTiles(placedObject.tileX, placedObject.tileY),
      placedObjectId: placedObject.id,
      placedObjectKind: placedObject.kind,
    }));
  }

  placeItem(
    itemId: PlayerItemKey,
    tileX: number,
    tileY: number,
    nowMs: number,
    inventory: PlayerInventoryState,
    itemRegistry: ItemRegistry,
    objectPlacementSystem: PlacementObjectSystem,
  ): InteractionResult {
    const mapId = this.requireCurrentMapId();
    const itemDefinition = itemRegistry.get(itemId);
    const placementObjectDefinitionId = itemDefinition.placementObjectDefinitionId;

    if (!placementObjectDefinitionId || itemDefinition.useMode !== 'place') {
      return {
        ok: false,
        interactionType: 'placed_object',
        targetId: itemId,
        message: `${itemDefinition.displayName} cannot be placed.`,
      };
    }

    if (!inventory.consumeItem(itemId, 1)) {
      return {
        ok: false,
        interactionType: 'placed_object',
        targetId: itemId,
        message: `You don't have a ${itemDefinition.displayName}.`,
      };
    }

    const placedObjectId = this.createPlacedObjectId(mapId, placementObjectDefinitionId);
    const placedInstance = objectPlacementSystem.placeObject(
      placementObjectDefinitionId,
      tileX,
      tileY,
      placedObjectId,
    );

    if (!placedInstance) {
      inventory.addItem(itemId, 1);
      return {
        ok: false,
        interactionType: 'placed_object',
        targetId: placedObjectId,
        message: `Couldn't place ${itemDefinition.displayName} there.`,
      };
    }

    const placedObjectState: RuntimePlacedObjectRecord = {
      id: placedObjectId,
      mapId,
      tileX,
      tileY,
      objectDefinitionId: placementObjectDefinitionId,
      kind: 'placed_firestarter_set',
      despawnAtMs: nowMs + (itemDefinition.placementRules?.durationMs ?? DEFAULT_FIRESTARTER_DURATION_MS),
    };

    this.sessionState.getPlacedObjects(mapId).push(placedObjectState);
    this.currentObjects = this.sessionState.getPlacedObjects(mapId);

    return {
      ok: true,
      interactionType: 'placed_object',
      targetId: placedObjectId,
      message: `Placed ${itemDefinition.displayName}.`,
      itemDelta: { [itemId]: -1 },
      createdObjectId: placedObjectId,
    };
  }

  interactWithPlacedObject(
    placedObjectId: string,
    nowMs: number,
    playerSessionState: PlayerSessionState,
    objectPlacementSystem: PlacementObjectSystem,
  ): InteractionResult {
    const placedObject = this.currentObjects.find((entry) => entry.id === placedObjectId);

    if (!placedObject) {
      return {
        ok: false,
        interactionType: 'placed_object',
        targetId: placedObjectId,
        message: 'Nothing happens.',
      };
    }

    const inventory = playerSessionState.getInventoryState();

    if (placedObject.kind === 'campfire') {
      const recipe = this.requireCampfireRecipe();

      if (canCraftRecipe(recipe, inventory)) {
        applyRecipeToInventory(recipe, inventory);
        playerSessionState.getSkillProgressionSystem().addXpDelta(recipe.xpRewards ?? {});
        return {
          ok: true,
          interactionType: 'placed_object',
          targetId: placedObjectId,
          message: 'You brew warm tea.',
          inventoryDelta: { herb: -1 },
          itemDelta: { warm_tea: 1 },
          xpDelta: recipe.xpRewards,
        };
      }

      return {
        ok: true,
        interactionType: 'placed_object',
        targetId: placedObjectId,
        message: 'The fire crackles.',
      };
    }

    if (!inventory.hasAtLeast('stone', 1)) {
      return {
        ok: false,
        interactionType: 'placed_object',
        targetId: placedObjectId,
        message: 'Needs a sparkstone/stone.',
      };
    }

    inventory.consumeDelta({ stone: 1 });
    objectPlacementSystem.removeObject(placedObject.id);

    const campfireInstance = objectPlacementSystem.placeObject(
      'campfire',
      placedObject.tileX,
      placedObject.tileY,
      placedObject.id,
    );

    if (!campfireInstance) {
      throw new Error(
        `PlacedStructureSystem: failed to transform "${placedObject.id}" into campfire on map "${placedObject.mapId}" at tile ${placedObject.tileX},${placedObject.tileY}. Suggested fix: inspect runtime placement state for invalid overlap or stale blockers.`,
      );
    }

    placedObject.kind = 'campfire';
    placedObject.objectDefinitionId = 'campfire';
    placedObject.despawnAtMs = nowMs + CAMPFIRE_DESPAWN_MS;

    return {
      ok: true,
      interactionType: 'placed_object',
      targetId: placedObjectId,
      message: 'The fire catches.',
      inventoryDelta: { stone: -1 },
    };
  }

  getCurrentObjects(): RuntimePlacedObjectRecord[] {
    return [...this.currentObjects];
  }

  getPlacedObjectState(placedObjectId: string): RuntimePlacedObjectRecord | null {
    return this.currentObjects.find((placedObject) => placedObject.id === placedObjectId) ?? null;
  }

  getActiveObjectCountForDefinition(objectDefinitionId: string): number {
    return this.currentObjects.filter(
      (placedObject) => placedObject.objectDefinitionId === objectDefinitionId,
    ).length;
  }

  private requireCurrentMapId(): string {
    if (!this.currentMapId) {
      throw new Error('PlacedStructureSystem: no current map is active');
    }

    return this.currentMapId;
  }

  private createPlacedObjectId(mapId: string, placementObjectDefinitionId: string): string {
    const nextSequence = this.sessionState.getNextPlacedObjectSequence(mapId);
    return [mapId, placementObjectDefinitionId, nextSequence].join(':');
  }

  private requireCampfireRecipe() {
    const recipe = this.recipeRegistry.listByStation('campfire').find(
      (candidate) => candidate.requiredActiveObjectType === 'campfire',
    );

    if (!recipe) {
      throw new Error('PlacedStructureSystem: no campfire recipe is registered');
    }

    return recipe;
  }
}
