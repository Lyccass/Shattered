import type {
  MapDefinition,
  MapInteractionAnchor,
  MapPlacedObject,
  MapTransition,
  MapZone,
} from './MapTypes';
import { createOvalIslandTerrain, createSpawnPoints, paintRect } from './MapBuilderUtils';

export function createHomeIslandMap(): MapDefinition {
  const width = 34;
  const height = 34;
  const terrain = createOvalIslandTerrain(width, height, {
    landRadiusX: 0.58,
    landRadiusY: 0.56,
    beachRadiusX: 0.74,
    beachRadiusY: 0.72,
  });

  paintRect(terrain, 12, 13, 8, 6, 'dirt');
  paintRect(terrain, 23, 18, 4, 3, 'sand');
  paintRect(terrain, 24, 19, 2, 2, 'dirt');

  const spawnPoints = createSpawnPoints([
    { id: 'default', tileX: 16, tileY: 16 },
    { id: 'home', tileX: 16, tileY: 16 },
    { id: 'dock', tileX: 24, tileY: 19 },
  ]);

  const objects: MapPlacedObject[] = [
    { id: 'home_tree_01', definitionId: 'tree_01_2x', tileX: 9, tileY: 10 },
    { id: 'home_tree_02', definitionId: 'tree_02_2x', tileX: 21, tileY: 9 },
    { id: 'home_tree_03', definitionId: 'tree_dark', tileX: 10, tileY: 21 },
    { id: 'home_tree_04', definitionId: 'tree_test', tileX: 23, tileY: 23 },
    { id: 'home_rock_01', definitionId: 'small_rock', tileX: 12, tileY: 18 },
    { id: 'home_rock_02', definitionId: 'medium_rock', tileX: 19, tileY: 20 },
    { id: 'home_barrel_01', definitionId: 'barrel', tileX: 18, tileY: 17 },
    { id: 'home_log_01', definitionId: 'log', tileX: 27, tileY: 21 },
    { id: 'home_pebbles_01', definitionId: 'pebble_patch', tileX: 14, tileY: 15 },
    { id: 'home_flowers_01', definitionId: 'flower_patch', tileX: 17, tileY: 15 },
    { id: 'home_workbench_01', definitionId: 'workbench_basic', tileX: 14, tileY: 17 },
  ];

  const transitions: MapTransition[] = [
    {
      id: 'home_to_harbor_dock',
      fromTile: { tileX: 24, tileY: 19 },
      triggerFootprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      visualAnchor: {
        tileX: 24,
        tileY: 19,
        label: 'Harbor',
      },
      targetMapId: 'test_harbor',
      targetSpawnId: 'dock',
      transitionType: 'dock',
    },
  ];

  const zones: MapZone[] = [
    {
      id: 'home_build_zone',
      tileX: 11,
      tileY: 14,
      width: 10,
      height: 8,
      tags: ['personal_build'],
    },
    {
      id: 'home_dock_transition_zone',
      tileX: 23,
      tileY: 18,
      width: 3,
      height: 3,
      tags: ['transition'],
    },
  ];

  const interactionAnchors: MapInteractionAnchor[] = [
    {
      id: 'home_workbench_use',
      interactionType: 'workbench',
      tileX: 14,
      tileY: 17,
      interactionRangeTiles: 1,
      linkedObjectId: 'home_workbench_01',
      requiredWood: 1,
      craftedItemId: 'firestarter_set',
      successMessage: 'You tie together a rough firestarter set. Press B to place it.',
      missingResourceMessage: 'You need at least 1 wood for that.',
    },
  ];

  return {
    id: 'test_home_island',
    displayName: 'Test Home Island',
    spaceType: 'personal_island',
    width,
    height,
    terrain,
    spawnPoints,
    objects,
    transitions,
    zones,
    interactionAnchors,
    metadata: {
      handcrafted: true,
      biome: 'home_island',
    },
  };
}
