import { describe, expect, it, vi } from 'vitest';
import { RECIPE_DEFINITIONS } from '../../crafting/RecipeDefinitions';
import { RecipeRegistry } from '../../crafting/RecipeRegistry';
import { ITEM_DEFINITIONS } from '../../items/ItemDefinitions';
import { ItemRegistry } from '../../items/ItemRegistry';
import { InteractionSystem } from '../../interactions/InteractionSystem';
import { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import type { InteractionHandlers, InteractionTarget } from '../../interactions/InteractionTypes';
import { PlayerSessionState } from '../../player/PlayerSessionState';
import { WorldSessionState } from '../session/WorldSessionState';
import type {
  MapPlacedObject,
  MapTransition,
  MapResourceNodeAnchor,
  MapWorkbenchAnchor,
} from '../maps/MapTypes';

function createHandlers(): InteractionHandlers {
  return {
    onMapTransition: (target) => ({
      ok: true,
      interactionType: 'map_transition',
      targetId: target.definition.id,
      message: 'Travel',
      transitionRequest: {
        targetMapId: target.transition.targetMapId,
        targetSpawnId: target.transition.targetSpawnId,
      },
    }),
    onResourceNode: (target) => ({
      ok: true,
      interactionType: 'resource_node',
      targetId: target.definition.id,
      message: target.anchor.id,
    }),
    onNpc: (target) => ({
      ok: true,
      interactionType: 'npc',
      targetId: target.definition.id,
      message: target.anchor.text,
    }),
    onWorkbench: (target) => ({
      ok: true,
      interactionType: 'workbench',
      targetId: target.definition.id,
      message: target.anchor.id,
    }),
    onContractBoard: (target) => ({
      ok: true,
      interactionType: 'contract_board',
      targetId: target.definition.id,
      message: target.anchor.id,
    }),
    onPlacedObject: (target) => ({
      ok: true,
      interactionType: 'placed_object',
      targetId: target.definition.id,
      message: target.placedObjectKind,
    }),
    onGenericDebug: (target) => ({
      ok: true,
      interactionType: 'generic_debug',
      targetId: target.definition.id,
      message: target.anchor.message,
    }),
    onGroundItem: (target) => ({
      ok: false,
      interactionType: 'ground_item',
      targetId: target.dropId,
      message: 'Cannot pick up item.',
    }),
  };
}

function createTransitionTarget(overrides: Partial<MapTransition> = {}): InteractionTarget {
  const transition: MapTransition = {
    id: 'home_to_harbor',
    fromTile: { tileX: 10, tileY: 10 },
    targetMapId: 'test_harbor',
    targetSpawnId: 'dock',
    ...overrides,
  };

  return {
    definition: {
      id: transition.id,
      interactionType: 'map_transition',
      promptText: 'Press E: Travel',
      interactionRangeTiles: 1,
      priority: 60,
    },
    tiles: [{ x: transition.fromTile.tileX, y: transition.fromTile.tileY }],
    transition,
  };
}

describe('InteractionSystem', () => {
  it('chooses the nearest highest-priority interaction in range', () => {
    const system = new InteractionSystem(createHandlers());
    const targets: InteractionTarget[] = [
      createTransitionTarget(),
      {
        definition: {
          id: 'driftwood_01',
          interactionType: 'resource_node',
          promptText: 'Press E: Gather Driftwood',
          interactionRangeTiles: 2,
          priority: 90,
        },
        tiles: [{ x: 11, y: 10 }],
        anchor: {
          id: 'driftwood_01',
          interactionType: 'resource_node',
          tileX: 11,
          tileY: 10,
          resourceNodeType: 'driftwood',
        },
      },
    ];

    system.setTargets(targets);
    const activeInteraction = system.updateActiveInteraction(10, 10);

    expect(activeInteraction?.target.definition.id).toBe('driftwood_01');
  });

  it('ignores interactions outside range', () => {
    const system = new InteractionSystem(createHandlers());
    system.setTargets([
      {
        definition: {
          id: 'far_node',
          interactionType: 'resource_node',
          promptText: 'Press E: Gather',
          interactionRangeTiles: 1,
          priority: 90,
        },
        tiles: [{ x: 20, y: 20 }],
        anchor: {
          id: 'far_node',
          interactionType: 'resource_node',
          tileX: 20,
          tileY: 20,
          resourceNodeType: 'driftwood',
        },
      },
    ]);

    expect(system.updateActiveInteraction(10, 10)).toBeNull();
  });

  it('routes map transition interaction to the correct target map and spawn', () => {
    const system = new InteractionSystem(createHandlers());
    system.setTargets([
      createTransitionTarget({
        targetMapId: 'test_home_island',
        targetSpawnId: 'dock',
      }),
    ]);
    system.updateActiveInteraction(10, 10);

    const result = system.triggerActiveInteraction();

    expect(result?.transitionRequest).toEqual({
      targetMapId: 'test_home_island',
      targetSpawnId: 'dock',
    });
  });

  it('finds a clicked interaction tile only when the player is in range', () => {
    const system = new InteractionSystem(createHandlers());
    system.setTargets([
      {
        definition: {
          id: 'driftwood_01',
          interactionType: 'resource_node',
          promptText: 'Press E: Gather Driftwood',
          interactionRangeTiles: 1,
          priority: 90,
        },
        tiles: [{ x: 11, y: 10 }],
        anchor: {
          id: 'driftwood_01',
          interactionType: 'resource_node',
          tileX: 11,
          tileY: 10,
          resourceNodeType: 'driftwood',
        },
      },
    ]);

    expect(system.findInteractionAtTile(10, 10, 11, 10)?.target.definition.id).toBe('driftwood_01');
    expect(system.findInteractionAtTile(30, 30, 11, 10)).toBeNull();
  });

  it('can find a clicked target even when the player is out of range', () => {
    const system = new InteractionSystem(createHandlers());
    system.setTargets([
      {
        definition: {
          id: 'driftwood_02',
          interactionType: 'resource_node',
          promptText: 'Press E: Gather Driftwood',
          interactionRangeTiles: 1,
          priority: 90,
        },
        tiles: [{ x: 21, y: 14 }],
        anchor: {
          id: 'driftwood_02',
          interactionType: 'resource_node',
          tileX: 21,
          tileY: 14,
          resourceNodeType: 'driftwood',
        },
      },
    ]);

    expect(system.findTargetAtTile(21, 14)?.definition.id).toBe('driftwood_02');
    expect(system.findTargetByRef('resource_node', 'driftwood_02')?.definition.id).toBe('driftwood_02');
  });
});

describe('ResourceNodeSystem', () => {
  it('gathering a node increments inventory and depletes the node', () => {
    const playerSessionState = new PlayerSessionState();
    const sessionState = new WorldSessionState();
    const system = new ResourceNodeSystem(sessionState);
    const getInstance = vi.fn((instanceId: string) => (
      instanceId === 'wild_driftwood_node_01'
        ? {
            id: 'wild_driftwood_node_01',
            definitionId: 'driftwood_node',
            tileX: 4,
            tileY: 7,
            createdAt: Date.now(),
          }
        : undefined
    ));
    const removeObject = vi.fn(() => true);
    const placeObject = vi.fn(() => ({
      id: 'wild_driftwood_node_01',
      definitionId: 'driftwood_node',
      tileX: 4,
      tileY: 7,
      createdAt: Date.now(),
    }));
    const node: MapResourceNodeAnchor = {
      id: 'driftwood_01',
      interactionType: 'resource_node',
      tileX: 4,
      tileY: 7,
      linkedObjectId: 'wild_driftwood_node_01',
      resourceNodeType: 'driftwood',
    };
    const mapObjects: MapPlacedObject[] = [
      { id: 'wild_driftwood_node_01', definitionId: 'driftwood_node', tileX: 4, tileY: 7 },
    ];

    system.setMapNodes('test_wild_island', [node], mapObjects, 0, { getInstance, placeObject, removeObject });
    const result = system.gatherNode('driftwood_01', playerSessionState, 0, { removeObject });

    expect(result.ok).toBe(true);
    expect(playerSessionState.getInventoryState().getCount('wood')).toBe(1);
    expect(removeObject).toHaveBeenCalledWith('wild_driftwood_node_01');
    expect(system.createInteractionTargets()).toHaveLength(0);
  });

  it('respawns a depleted node after its timer even when re-entering later', () => {
    const playerSessionState = new PlayerSessionState();
    const sessionState = new WorldSessionState();
    const system = new ResourceNodeSystem(sessionState);
    let nodePresent = true;
    const getInstance = vi.fn((instanceId: string) => (
      instanceId === 'wild_stone_node_01' && nodePresent
        ? {
            id: 'wild_stone_node_01',
            definitionId: 'stone_pile_node',
            tileX: 7,
            tileY: 8,
            createdAt: Date.now(),
          }
        : undefined
    ));
    const removeObject = vi.fn(() => true);
    const placeObject = vi.fn(() => ({
      id: 'wild_stone_node_01',
      definitionId: 'stone_pile_node',
      tileX: 7,
      tileY: 8,
      createdAt: Date.now(),
    }));
    const node: MapResourceNodeAnchor = {
      id: 'stone_01',
      interactionType: 'resource_node',
      tileX: 7,
      tileY: 8,
      linkedObjectId: 'wild_stone_node_01',
      resourceNodeType: 'stone_pile',
    };
    const mapObjects: MapPlacedObject[] = [
      { id: 'wild_stone_node_01', definitionId: 'stone_pile_node', tileX: 7, tileY: 8 },
    ];

    system.setMapNodes('test_wild_island', [node], mapObjects, 0, { getInstance, placeObject, removeObject });
    system.gatherNode('stone_01', playerSessionState, 0, { removeObject });
    nodePresent = false;

    expect(system.createInteractionTargets()).toHaveLength(0);

    system.setMapNodes(
      'test_wild_island',
      [node],
      mapObjects,
      60_001,
      { getInstance, placeObject, removeObject },
    );

    expect(system.createInteractionTargets()).toHaveLength(1);
    expect(placeObject).toHaveBeenCalledWith('stone_pile_node', 7, 8, 'wild_stone_node_01');
  });

  it('keeps respawn state separate from static map data', () => {
    const playerSessionState = new PlayerSessionState();
    const sessionState = new WorldSessionState();
    const system = new ResourceNodeSystem(sessionState);
    const getInstance = vi.fn(() => undefined);
    const removeObject = vi.fn(() => true);
    const placeObject = vi.fn(() => ({
      id: 'wild_herb_node_01',
      definitionId: 'herb_patch_node',
      tileX: 3,
      tileY: 3,
      createdAt: Date.now(),
    }));
    const node: MapResourceNodeAnchor = {
      id: 'herb_01',
      interactionType: 'resource_node',
      tileX: 3,
      tileY: 3,
      linkedObjectId: 'wild_herb_node_01',
      resourceNodeType: 'herb_patch',
    };
    const mapObjects: MapPlacedObject[] = [
      { id: 'wild_herb_node_01', definitionId: 'herb_patch_node', tileX: 3, tileY: 3 },
    ];

    system.setMapNodes('test_wild_island', [node], mapObjects, 0, { getInstance, placeObject, removeObject });
    system.gatherNode('herb_01', playerSessionState, 0, { removeObject });

    expect(mapObjects).toEqual([
      { id: 'wild_herb_node_01', definitionId: 'herb_patch_node', tileX: 3, tileY: 3 },
    ]);
    expect(sessionState.getResourceRespawnAt('test_wild_island', 'herb_01')).toBeGreaterThan(0);
  });
});

describe('WorkbenchSystem', () => {
  const recipeRegistry = new RecipeRegistry(RECIPE_DEFINITIONS);

  it('consumes wood and crafts a firestarter set item', () => {
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().add('wood', 1);

    const system = new WorkbenchSystem(recipeRegistry);
    const workbench: MapWorkbenchAnchor = {
      id: 'home_bench',
      interactionType: 'workbench',
      tileX: 14,
      tileY: 17,
      requiredWood: 1,
      craftedItemId: 'firestarter_set',
    };

    system.setMapWorkbenches('test_home_island', [workbench]);
    const result = system.craftRecipe(
      'home_bench',
      'workbench_firestarter_set',
      playerSessionState,
    );

    expect(result.ok).toBe(true);
    expect(playerSessionState.getInventoryState().getCount('wood')).toBe(0);
    expect(playerSessionState.getInventoryState().getItemCount('firestarter_set')).toBe(1);
    expect(result.placementItemId).toBe('firestarter_set');
  });

  it('fails cleanly when the player is missing wood', () => {
    const playerSessionState = new PlayerSessionState();
    const system = new WorkbenchSystem(recipeRegistry);
    const workbench: MapWorkbenchAnchor = {
      id: 'home_bench',
      interactionType: 'workbench',
      tileX: 14,
      tileY: 17,
      requiredWood: 1,
    };

    system.setMapWorkbenches('test_home_island', [workbench]);
    const result = system.craftRecipe(
      'home_bench',
      'workbench_firestarter_set',
      playerSessionState,
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('wood');
    expect(playerSessionState.getInventoryState().getItemCount('firestarter_set')).toBe(0);
  });
});

describe('PlacedStructureSystem', () => {
  const itemRegistry = new ItemRegistry(ITEM_DEFINITIONS);
  const recipeRegistry = new RecipeRegistry(RECIPE_DEFINITIONS);

  it('placement consumes one firestarter_set item', () => {
    const playerSessionState = new PlayerSessionState();
    const inventory = playerSessionState.getInventoryState();
    inventory.addItem('firestarter_set', 1);

    const system = new PlacedStructureSystem(new WorldSessionState(), recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => ({
      id: 'test_home_island:placed_firestarter_set:1',
      definitionId: 'placed_firestarter_set',
      tileX: 16,
      tileY: 17,
      createdAt: Date.now(),
    }));
    const removeObject = vi.fn(() => true);

    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });
    const result = system.placeItem(
      'firestarter_set',
      16,
      17,
      0,
      inventory,
      itemRegistry,
      { getInstance, placeObject, removeObject },
    );

    expect(result.ok).toBe(true);
    expect(inventory.getItemCount('firestarter_set')).toBe(0);
    expect(system.getObjectsForCurrentMap()).toHaveLength(1);
    expect(system.getObjectsForCurrentMap()[0]?.kind).toBe('placed_firestarter_set');
  });

  it('invalid placement does not consume the item', () => {
    const playerSessionState = new PlayerSessionState();
    const inventory = playerSessionState.getInventoryState();
    inventory.addItem('firestarter_set', 1);

    const system = new PlacedStructureSystem(new WorldSessionState(), recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => null);
    const removeObject = vi.fn(() => true);

    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });
    const result = system.placeItem(
      'firestarter_set',
      16,
      17,
      0,
      inventory,
      itemRegistry,
      { getInstance, placeObject, removeObject },
    );

    expect(result.ok).toBe(false);
    expect(inventory.getItemCount('firestarter_set')).toBe(1);
    expect(system.getObjectsForCurrentMap()).toHaveLength(0);
  });

  it('placed firestarter transforms into campfire when stone is available', () => {
    const playerSessionState = new PlayerSessionState();
    const inventory = playerSessionState.getInventoryState();
    inventory.addItem('firestarter_set', 1);
    inventory.add('stone', 1);

    const system = new PlacedStructureSystem(new WorldSessionState(), recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi
      .fn()
      .mockReturnValueOnce({
        id: 'test_home_island:placed_firestarter_set:1',
        definitionId: 'placed_firestarter_set',
        tileX: 16,
        tileY: 17,
        createdAt: Date.now(),
      })
      .mockReturnValueOnce({
        id: 'test_home_island:placed_firestarter_set:1',
        definitionId: 'campfire',
        tileX: 16,
        tileY: 17,
        createdAt: Date.now(),
      });
    const removeObject = vi.fn(() => true);

    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });
    system.placeItem(
      'firestarter_set',
      16,
      17,
      0,
      inventory,
      itemRegistry,
      { getInstance, placeObject, removeObject },
    );

    const result = system.interactWithPlacedObject(
      'test_home_island:placed_firestarter_set:1',
      10_000,
      playerSessionState,
      { getInstance, placeObject, removeObject },
    );

    expect(result.ok).toBe(true);
    expect(inventory.getCount('stone')).toBe(0);
    expect(system.getObjectsForCurrentMap()[0]?.kind).toBe('campfire');
  });

  it('firestarter activation fails without stone', () => {
    const playerSessionState = new PlayerSessionState();
    const inventory = playerSessionState.getInventoryState();
    inventory.addItem('firestarter_set', 1);

    const system = new PlacedStructureSystem(new WorldSessionState(), recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => ({
      id: 'test_home_island:placed_firestarter_set:1',
      definitionId: 'placed_firestarter_set',
      tileX: 16,
      tileY: 17,
      createdAt: Date.now(),
    }));
    const removeObject = vi.fn(() => true);

    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });
    system.placeItem(
      'firestarter_set',
      16,
      17,
      0,
      inventory,
      itemRegistry,
      { getInstance, placeObject, removeObject },
    );

    const result = system.interactWithPlacedObject(
      'test_home_island:placed_firestarter_set:1',
      10_000,
      playerSessionState,
      { getInstance, placeObject, removeObject },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('stone');
  });

  it('interacting with campfire without herb returns neutral feedback', () => {
    const playerSessionState = new PlayerSessionState();
    const sessionState = new WorldSessionState();
    const system = new PlacedStructureSystem(sessionState, recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => ({
      id: 'test_home_island:placed_firestarter_set:1',
      definitionId: 'campfire',
      tileX: 16,
      tileY: 17,
      createdAt: Date.now(),
    }));
    const removeObject = vi.fn(() => true);

    sessionState.addPlacedObject({
      id: 'test_home_island:placed_firestarter_set:1',
      mapId: 'test_home_island',
      tileX: 16,
      tileY: 17,
      objectDefinitionId: 'campfire',
      kind: 'campfire',
      despawnAtMs: 90_000,
    });
    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });

    const result = system.interactWithPlacedObject(
      'test_home_island:placed_firestarter_set:1',
      10_000,
      playerSessionState,
      { getInstance, placeObject, removeObject },
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe('The fire crackles.');
  });

  it('interacting with campfire with herb consumes herb and adds warm_tea', () => {
    const playerSessionState = new PlayerSessionState();
    const inventory = playerSessionState.getInventoryState();
    inventory.add('herb', 1);
    const sessionState = new WorldSessionState();
    const system = new PlacedStructureSystem(sessionState, recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => ({
      id: 'test_home_island:placed_firestarter_set:1',
      definitionId: 'campfire',
      tileX: 16,
      tileY: 17,
      createdAt: Date.now(),
    }));
    const removeObject = vi.fn(() => true);

    sessionState.addPlacedObject({
      id: 'test_home_island:placed_firestarter_set:1',
      mapId: 'test_home_island',
      tileX: 16,
      tileY: 17,
      objectDefinitionId: 'campfire',
      kind: 'campfire',
      despawnAtMs: 90_000,
    });
    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });

    const result = system.interactWithPlacedObject(
      'test_home_island:placed_firestarter_set:1',
      10_000,
      playerSessionState,
      { getInstance, placeObject, removeObject },
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe('You brew warm tea.');
    expect(inventory.getCount('herb')).toBe(0);
    expect(inventory.getItemCount('warm_tea')).toBe(1);
  });

  it('campfire despawns after its timer even if it was already lit', () => {
    const playerSessionState = new PlayerSessionState();
    const inventory = playerSessionState.getInventoryState();
    inventory.addItem('firestarter_set', 1);
    inventory.add('stone', 1);

    const system = new PlacedStructureSystem(new WorldSessionState(), recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi
      .fn()
      .mockReturnValueOnce({
        id: 'test_home_island:placed_firestarter_set:1',
        definitionId: 'placed_firestarter_set',
        tileX: 16,
        tileY: 17,
        createdAt: Date.now(),
      })
      .mockReturnValueOnce({
        id: 'test_home_island:placed_firestarter_set:1',
        definitionId: 'campfire',
        tileX: 16,
        tileY: 17,
        createdAt: Date.now(),
      });
    const removeObject = vi.fn(() => true);

    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });
    system.placeItem(
      'firestarter_set',
      16,
      17,
      0,
      inventory,
      itemRegistry,
      { getInstance, placeObject, removeObject },
    );
    system.interactWithPlacedObject(
      'test_home_island:placed_firestarter_set:1',
      10_000,
      playerSessionState,
      { getInstance, placeObject, removeObject },
    );

    const didChange = system.updateRuntimeState(100_001, { getInstance, placeObject, removeObject });

    expect(didChange).toBe(true);
    expect(system.getObjectsForCurrentMap()).toHaveLength(0);
    expect(removeObject).toHaveBeenCalledWith('test_home_island:placed_firestarter_set:1');
  });

  it('expired campfire cannot be interacted with', () => {
    const playerSessionState = new PlayerSessionState();
    const sessionState = new WorldSessionState();
    const system = new PlacedStructureSystem(sessionState, recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => null);
    const removeObject = vi.fn(() => true);

    sessionState.addPlacedObject({
      id: 'test_home_island:campfire:1',
      mapId: 'test_home_island',
      tileX: 16,
      tileY: 17,
      objectDefinitionId: 'campfire',
      kind: 'campfire',
      despawnAtMs: 5_000,
    });
    system.setCurrentMap('test_home_island', 10_000, { getInstance, placeObject, removeObject });

    const result = system.interactWithPlacedObject(
      'test_home_island:campfire:1',
      10_000,
      playerSessionState,
      { getInstance, placeObject, removeObject },
    );

    expect(system.getObjectsForCurrentMap()).toHaveLength(0);
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Nothing happens.');
  });
});
