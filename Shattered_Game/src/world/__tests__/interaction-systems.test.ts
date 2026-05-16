import { describe, expect, it, vi } from 'vitest';
import { InteractionSystem } from '../../interactions/InteractionSystem';
import { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import type { InteractionHandlers, InteractionTarget } from '../../interactions/InteractionTypes';
import { PlayerInventoryState } from '../../player/PlayerInventoryState';
import type { MapTransition, MapResourceNodeAnchor, MapWorkbenchAnchor } from '../maps/MapTypes';

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
    onGenericDebug: (target) => ({
      ok: true,
      interactionType: 'generic_debug',
      targetId: target.definition.id,
      message: target.anchor.message,
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
});

describe('ResourceNodeSystem', () => {
  it('gathering a node increments inventory and depletes the node', () => {
    const inventory = new PlayerInventoryState();
    const system = new ResourceNodeSystem();
    const removeObject = vi.fn();
    const node: MapResourceNodeAnchor = {
      id: 'driftwood_01',
      interactionType: 'resource_node',
      tileX: 4,
      tileY: 7,
      linkedObjectId: 'wild_driftwood_node_01',
      resourceNodeType: 'driftwood',
    };

    system.setMapNodes('test_wild_island', [node], { removeObject });
    const result = system.gatherNode('driftwood_01', inventory, { removeObject });

    expect(result.ok).toBe(true);
    expect(inventory.getCount('wood')).toBe(1);
    expect(removeObject).toHaveBeenCalledWith('wild_driftwood_node_01');
    expect(system.createInteractionTargets()).toHaveLength(0);
  });
});

describe('WorkbenchSystem', () => {
  it('consumes wood and creates the expected built object', () => {
    const inventory = new PlayerInventoryState();
    inventory.add('wood', 1);

    const system = new WorkbenchSystem();
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => ({
      id: 'test_home_island:home_bench:built',
      definitionId: 'campfire_built',
      tileX: 16,
      tileY: 17,
      createdAt: Date.now(),
    }));
    const workbench: MapWorkbenchAnchor = {
      id: 'home_bench',
      interactionType: 'workbench',
      tileX: 14,
      tileY: 17,
      buildObjectDefinitionId: 'campfire_built',
      buildTileX: 16,
      buildTileY: 17,
      requiredWood: 1,
    };

    system.setMapWorkbenches('test_home_island', [workbench], { getInstance, placeObject });
    const result = system.useWorkbench('home_bench', inventory, { getInstance, placeObject });

    expect(result.ok).toBe(true);
    expect(inventory.getCount('wood')).toBe(0);
    expect(placeObject).toHaveBeenCalledWith(
      'campfire_built',
      16,
      17,
      'test_home_island:home_bench:built',
    );
  });

  it('fails cleanly when the player is missing wood', () => {
    const inventory = new PlayerInventoryState();
    const system = new WorkbenchSystem();
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => null);
    const workbench: MapWorkbenchAnchor = {
      id: 'home_bench',
      interactionType: 'workbench',
      tileX: 14,
      tileY: 17,
      buildObjectDefinitionId: 'campfire_built',
      buildTileX: 16,
      buildTileY: 17,
      requiredWood: 1,
    };

    system.setMapWorkbenches('test_home_island', [workbench], { getInstance, placeObject });
    const result = system.useWorkbench('home_bench', inventory, { getInstance, placeObject });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('wood');
    expect(placeObject).not.toHaveBeenCalled();
  });
});
