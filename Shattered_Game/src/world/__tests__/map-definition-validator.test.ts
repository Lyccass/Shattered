import { describe, expect, it } from 'vitest';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { validateMapDefinitions } from '../maps/MapDefinitionValidator';
import type { MapDefinition } from '../maps/MapTypes';
import type { TileType } from '../IsoTilemapTypes';

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
];

function makeMapDefinition(overrides: Partial<MapDefinition> = {}): MapDefinition {
  return {
    id: 'test_map',
    displayName: 'Test Map',
    width: 4,
    height: 4,
    terrain: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 'grass' as const)),
    spawnPoints: {
      default: { id: 'default', tileX: 1, tileY: 1 },
    },
    objects: [],
    transitions: [],
    ...overrides,
  };
}

describe('validateMapDefinitions', () => {
  it('allows transitions when their trigger tiles do not overlap objects', () => {
    const mapDefinition = makeMapDefinition({
      objects: [{ id: 'crate_01', definitionId: 'crate', tileX: 1, tileY: 1 }],
      transitions: [{
        id: 'to_other_map',
        fromTile: { tileX: 2, tileY: 2 },
        targetMapId: 'other_map',
        targetSpawnId: 'default',
      }],
    });

    expect(() => validateMapDefinitions([mapDefinition], TEST_OBJECT_DEFINITIONS)).not.toThrow();
  });

  it('throws when a transition trigger overlaps an object footprint tile', () => {
    const mapDefinition = makeMapDefinition({
      objects: [{ id: 'crate_01', definitionId: 'crate', tileX: 1, tileY: 1 }],
      transitions: [{
        id: 'to_other_map',
        fromTile: { tileX: 1, tileY: 1 },
        targetMapId: 'other_map',
        targetSpawnId: 'default',
      }],
    });

    expect(() => validateMapDefinitions([mapDefinition], TEST_OBJECT_DEFINITIONS)).toThrow(
      /overlaps object "crate_01"/,
    );
  });

  it('throws when a transition visual anchor sits on an object tile', () => {
    const mapDefinition = makeMapDefinition({
      objects: [{ id: 'crate_01', definitionId: 'crate', tileX: 2, tileY: 2 }],
      transitions: [{
        id: 'to_other_map',
        fromTile: { tileX: 1, tileY: 1 },
        triggerFootprint: [{ x: 0, y: 0 }],
        visualAnchor: { tileX: 2, tileY: 2, label: 'Other' },
        targetMapId: 'other_map',
        targetSpawnId: 'default',
      }],
    });

    expect(() => validateMapDefinitions([mapDefinition], TEST_OBJECT_DEFINITIONS)).toThrow(
      /uses visual anchor on object "crate_01"/,
    );
  });

  it('throws when a visual anchor is outside the trigger footprint', () => {
    const mapDefinition = makeMapDefinition({
      transitions: [{
        id: 'to_other_map',
        fromTile: { tileX: 1, tileY: 1 },
        triggerFootprint: [{ x: 0, y: 0 }],
        visualAnchor: { tileX: 2, tileY: 1, label: 'Other' },
        targetMapId: 'other_map',
        targetSpawnId: 'default',
      }],
    });

    expect(() => validateMapDefinitions([mapDefinition], TEST_OBJECT_DEFINITIONS)).toThrow(
      /outside its trigger footprint/,
    );
  });

  it('throws when an object blocks a water tile', () => {
    const terrain: TileType[][] = Array.from(
      { length: 4 },
      () => Array.from({ length: 4 }, () => 'grass'),
    );
    terrain[2][2] = 'water';
    const mapDefinition = makeMapDefinition({
      terrain,
      objects: [{ id: 'crate_01', definitionId: 'crate', tileX: 2, tileY: 2 }],
    });

    expect(() => validateMapDefinitions([mapDefinition], TEST_OBJECT_DEFINITIONS)).toThrow(
      /blocks water at \(2, 2\)/,
    );
  });

  it('throws when two objects overlap the same tile', () => {
    const mapDefinition = makeMapDefinition({
      objects: [
        { id: 'crate_01', definitionId: 'crate', tileX: 1, tileY: 1 },
        { id: 'crate_02', definitionId: 'crate', tileX: 1, tileY: 1 },
      ],
    });

    expect(() => validateMapDefinitions([mapDefinition], TEST_OBJECT_DEFINITIONS)).toThrow(
      /overlaps object "crate_01"/,
    );
  });
});
