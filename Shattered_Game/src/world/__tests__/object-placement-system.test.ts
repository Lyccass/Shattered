import { describe, expect, it } from 'vitest';
import { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { WorldGrid } from '../WorldGrid';
import { validateMapDefinition } from '../maps/MapDefinitionValidator';
import type { MapDefinition } from '../maps/MapTypes';

const TEST_OBJECT_DEFINITIONS: ObjectDefinition[] = [
  {
    id: 'crate',
    displayName: 'Crate',
    category: 'marker',
    collisionFootprint: [{ x: 0, y: 0 }],
    blocksMovement: true,
    visual: { parts: [] },
    shadow: {
      enabled: false,
      localOffsetX: 0,
      localOffsetY: 0,
      width: 0,
      height: 0,
      alpha: 0,
    },
    depth: {
      anchorMode: 'centroid',
      localOffsetX: 0,
      localOffsetY: 0,
      depthOffset: 0,
    },
    debug: { color: 0xffffff },
  },
  {
    id: 'flowers',
    displayName: 'Flowers',
    category: 'flora',
    collisionFootprint: [{ x: 0, y: 0 }],
    blocksMovement: false,
    visual: { parts: [] },
    shadow: {
      enabled: false,
      localOffsetX: 0,
      localOffsetY: 0,
      width: 0,
      height: 0,
      alpha: 0,
    },
    depth: {
      anchorMode: 'centroid',
      localOffsetX: 0,
      localOffsetY: 0,
      depthOffset: 0,
    },
    debug: { color: 0xffffff },
  },
];

function makePlacementSystem(): ObjectPlacementSystem {
  const grid = new WorldGrid(
    4,
    4,
    Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 'grass' as const)),
  );

  return new ObjectPlacementSystem(
    grid,
    new ObjectRegistry(TEST_OBJECT_DEFINITIONS),
    {
      render: () => undefined,
      remove: () => undefined,
    } as any,
    {
      render: () => undefined,
      remove: () => undefined,
    } as any,
  );
}

function makeMapDefinition(overrides: Partial<MapDefinition> = {}): MapDefinition {
  return {
    id: 'test_map',
    displayName: 'Test Map',
    spaceType: 'open_world',
    width: 4,
    height: 4,
    terrain: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 'grass' as const)),
    spawnPoints: {
      default: { id: 'default', tileX: 0, tileY: 0 },
    },
    objects: [],
    transitions: [],
    ...overrides,
  };
}

describe('ObjectPlacementSystem shared placement policy', () => {
  it('agrees with map validation for blocking-object overlap', () => {
    const placementSystem = makePlacementSystem();
    placementSystem.placeObject('crate', 1, 1, 'crate_01');

    const runtimeEvaluation = placementSystem.getPlacementEvaluation('crate', 1, 1);
    expect(runtimeEvaluation.ok).toBe(false);
    if (runtimeEvaluation.ok) {
      throw new Error('expected crate overlap to be rejected');
    }
    expect(runtimeEvaluation.failure.code).toBe('object_overlap');
    expect(runtimeEvaluation.failure.occupyingObjectId).toBe('crate_01');

    const mapDefinition = makeMapDefinition({
      objects: [
        { id: 'crate_01', definitionId: 'crate', tileX: 1, tileY: 1 },
        { id: 'crate_02', definitionId: 'crate', tileX: 1, tileY: 1 },
      ],
    });

    expect(() => validateMapDefinition(mapDefinition, TEST_OBJECT_DEFINITIONS)).toThrow(
      /object "crate_02" using definition "crate" cannot be placed at tile 1,1 because footprint tile 1,1 is already occupied by object "crate_01"/,
    );
  });

  it('does not allow non-blocking decorations to overlap blocking objects', () => {
    const placementSystem = makePlacementSystem();
    placementSystem.placeObject('crate', 1, 1, 'crate_01');

    const decorationEvaluation = placementSystem.getPlacementEvaluation('flowers', 1, 1);
    expect(decorationEvaluation.ok).toBe(false);
    if (decorationEvaluation.ok) {
      throw new Error('expected decoration overlap to be rejected');
    }
    expect(decorationEvaluation.failure.code).toBe('object_overlap');

    const mapDefinition = makeMapDefinition({
      objects: [
        { id: 'crate_01', definitionId: 'crate', tileX: 1, tileY: 1 },
        { id: 'flowers_01', definitionId: 'flowers', tileX: 1, tileY: 1 },
      ],
    });

    expect(() => validateMapDefinition(mapDefinition, TEST_OBJECT_DEFINITIONS)).toThrow(
      /object "flowers_01" using definition "flowers" cannot be placed at tile 1,1 because footprint tile 1,1 is already occupied by object "crate_01"/,
    );
  });
});
