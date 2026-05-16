import { PROTOTYPE_SCALE } from '../../config/prototypeScale';
import { generateOrganicIsland } from '../IslandGenerator';
import type { MapDefinition, MapPlacedObject, MapTransition } from './MapTypes';
import { createSpawnPoints, paintRect } from './MapBuilderUtils';

export function createWildIslandMap(): MapDefinition {
  const width = PROTOTYPE_SCALE.mapWidth;
  const height = PROTOTYPE_SCALE.mapHeight;
  const terrain = generateOrganicIsland(width, height);

  paintRect(terrain, 36, 133, 4, 3, 'sand');
  paintRect(terrain, 86, 88, 8, 6, 'dirt');
  paintRect(terrain, 90, 90, 4, 4, 'stone');

  const spawnPoints = createSpawnPoints([
    { id: 'default', tileX: 37, tileY: 134 },
    { id: 'dock', tileX: 37, tileY: 134 },
    { id: 'interior', tileX: 90, tileY: 90 },
  ]);

  const objects: MapPlacedObject[] = [
    { id: 'wild_tree_00', definitionId: 'tree_01_2x', tileX: 42, tileY: 130 },
    { id: 'wild_tree_00b', definitionId: 'tree_02_2x', tileX: 46, tileY: 127 },
    { id: 'wild_tree_00c', definitionId: 'tree_tall', tileX: 48, tileY: 133 },
    { id: 'wild_rock_00', definitionId: 'medium_rock', tileX: 44, tileY: 136 },
    { id: 'wild_rock_00b', definitionId: 'small_rock', tileX: 41, tileY: 138 },
    { id: 'wild_pebbles_00', definitionId: 'pebble_patch', tileX: 39, tileY: 132 },
    { id: 'wild_flowers_00', definitionId: 'flower_patch', tileX: 47, tileY: 136 },
    { id: 'wild_tree_01', definitionId: 'tree_01_4x', tileX: 66, tileY: 58 },
    { id: 'wild_tree_02', definitionId: 'tree_02_4x', tileX: 118, tileY: 52 },
    { id: 'wild_tree_03', definitionId: 'tree_01_2x', tileX: 72, tileY: 104 },
    { id: 'wild_tree_04', definitionId: 'tree_02_2x', tileX: 126, tileY: 111 },
    { id: 'wild_tree_05', definitionId: 'tree_dark', tileX: 40, tileY: 128 },
    { id: 'wild_tree_06', definitionId: 'tree_test', tileX: 101, tileY: 134 },
    { id: 'wild_tree_07', definitionId: 'tree_dark', tileX: 80, tileY: 86 },
    { id: 'wild_tree_08', definitionId: 'tree_test', tileX: 96, tileY: 84 },
    { id: 'wild_tree_09', definitionId: 'tree_01_2x', tileX: 103, tileY: 92 },
    { id: 'wild_tree_10', definitionId: 'tree_02_2x', tileX: 78, tileY: 96 },
    { id: 'wild_rock_01', definitionId: 'large_rock', tileX: 90, tileY: 91 },
    { id: 'wild_rock_02', definitionId: 'medium_rock', tileX: 116, tileY: 140 },
    { id: 'wild_rock_03', definitionId: 'small_rock', tileX: 60, tileY: 94 },
    { id: 'wild_rock_04', definitionId: 'medium_rock', tileX: 85, tileY: 95 },
    { id: 'wild_rock_05', definitionId: 'small_rock', tileX: 98, tileY: 97 },
    { id: 'wild_barrel_01', definitionId: 'barrel', tileX: 95, tileY: 88 },
    { id: 'wild_barrel_02', definitionId: 'barrel', tileX: 88, tileY: 96 },
    { id: 'wild_log_01', definitionId: 'log', tileX: 42, tileY: 135 },
    { id: 'wild_log_02', definitionId: 'log', tileX: 93, tileY: 100 },
    { id: 'wild_pebbles_01', definitionId: 'pebble_patch', tileX: 84, tileY: 98 },
    { id: 'wild_pebbles_02', definitionId: 'pebble_patch', tileX: 92, tileY: 84 },
    { id: 'wild_pebbles_03', definitionId: 'pebble_patch', tileX: 109, tileY: 96 },
    { id: 'wild_flowers_01', definitionId: 'flower_patch', tileX: 104, tileY: 96 },
    { id: 'wild_flowers_02', definitionId: 'flower_patch', tileX: 82, tileY: 92 },
    { id: 'wild_flowers_03', definitionId: 'flower_patch', tileX: 98, tileY: 102 },
  ];

  const transitions: MapTransition[] = [
    {
      id: 'wild_to_harbor_dock',
      fromTile: { tileX: 37, tileY: 134 },
      triggerFootprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      visualAnchor: {
        tileX: 37,
        tileY: 134,
        label: 'Harbor',
      },
      targetMapId: 'test_harbor',
      targetSpawnId: 'wild_gate',
      transitionType: 'dock',
    },
    {
      id: 'wild_to_home_debug',
      fromTile: { tileX: 90, tileY: 90 },
      triggerFootprint: [{ x: 0, y: 0 }],
      visualAnchor: {
        tileX: 90,
        tileY: 90,
        label: 'Home',
      },
      targetMapId: 'test_home_island',
      targetSpawnId: 'default',
      transitionType: 'debug',
    },
  ];

  return {
    id: 'test_wild_island',
    displayName: 'Test Wild Island',
    width,
    height,
    terrain,
    spawnPoints,
    objects,
    transitions,
    metadata: {
      handcrafted: true,
      biome: 'wild_island',
    },
  };
}
