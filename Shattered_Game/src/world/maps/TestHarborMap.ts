import type {
  MapDefinition,
  MapInteractionAnchor,
  MapPlacedObject,
  MapTransition,
  MapZone,
} from './MapTypes';
import { createSpawnPoints, fillTerrain, paintRect } from './MapBuilderUtils';

export function createHarborMap(): MapDefinition {
  const width = 38;
  const height = 28;
  const terrain = fillTerrain(width, height, 'water');

  paintRect(terrain, 5, 5, 27, 16, 'sand');
  paintRect(terrain, 8, 7, 22, 11, 'dirt');
  paintRect(terrain, 13, 10, 10, 4, 'stone');
  paintRect(terrain, 24, 15, 5, 3, 'grass');
  paintRect(terrain, 6, 16, 4, 3, 'grass');

  const spawnPoints = createSpawnPoints([
    { id: 'default', tileX: 16, tileY: 15 },
    { id: 'harbor', tileX: 16, tileY: 15 },
    { id: 'dock', tileX: 8, tileY: 17 },
    { id: 'wild_gate', tileX: 29, tileY: 10 },
  ]);

  const objects: MapPlacedObject[] = [
    { id: 'harbor_barrel_01', definitionId: 'barrel', tileX: 14, tileY: 14 },
    { id: 'harbor_barrel_02', definitionId: 'barrel', tileX: 15, tileY: 14 },
    { id: 'harbor_fence_01', definitionId: 'fence_segment', tileX: 12, tileY: 12 },
    { id: 'harbor_fence_02', definitionId: 'fence_segment', tileX: 13, tileY: 12 },
    { id: 'harbor_log_01', definitionId: 'log', tileX: 11, tileY: 19 },
    { id: 'harbor_rock_01', definitionId: 'small_rock', tileX: 24, tileY: 14 },
    { id: 'harbor_tree_01', definitionId: 'tree_test', tileX: 27, tileY: 17 },
    { id: 'harbor_tree_02', definitionId: 'tree_dark', tileX: 8, tileY: 18 },
    { id: 'harbor_flowers_01', definitionId: 'flower_patch', tileX: 26, tileY: 16 },
    { id: 'harbor_notice_board_01', definitionId: 'notice_board', tileX: 18, tileY: 14 },
    { id: 'harbor_driftwood_node_01', definitionId: 'driftwood_node', tileX: 10, tileY: 15 },
    { id: 'harbor_stone_node_01', definitionId: 'stone_pile_node', tileX: 23, tileY: 13 },
    { id: 'harbor_herb_node_01', definitionId: 'herb_patch_node', tileX: 25, tileY: 17 },
  ];

  const transitions: MapTransition[] = [
    {
      id: 'harbor_to_home_dock',
      fromTile: { tileX: 8, tileY: 17 },
      triggerFootprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      visualAnchor: {
        tileX: 8,
        tileY: 17,
        label: 'Home',
      },
      targetMapId: 'test_home_island',
      targetSpawnId: 'dock',
      transitionType: 'ferry',
    },
    {
      id: 'harbor_to_wild_ferry',
      fromTile: { tileX: 29, tileY: 10 },
      triggerFootprint: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      visualAnchor: {
        tileX: 29,
        tileY: 10,
        label: 'Wild',
      },
      targetMapId: 'test_wild_island',
      targetSpawnId: 'dock',
      transitionType: 'ferry',
    },
  ];

  const zones: MapZone[] = [
    {
      id: 'harbor_town_zone',
      tileX: 5,
      tileY: 5,
      width: 27,
      height: 16,
      tags: ['town', 'harbor'],
    },
    {
      id: 'harbor_home_transition_zone',
      tileX: 8,
      tileY: 16,
      width: 3,
      height: 3,
      tags: ['transition'],
    },
    {
      id: 'harbor_wild_transition_zone',
      tileX: 28,
      tileY: 9,
      width: 3,
      height: 3,
      tags: ['transition'],
    },
  ];

  const interactionAnchors: MapInteractionAnchor[] = [
    {
      id: 'harbor_notice_board_talk',
      interactionType: 'npc',
      tileX: 18,
      tileY: 14,
      interactionRangeTiles: 1,
      linkedObjectId: 'harbor_notice_board_01',
      promptLabel: 'Talk',
      text: 'The wild coast has driftwood and loose stone. Bring both home. Your workbench can turn that into a proper firestarter.',
    },
    {
      id: 'harbor_driftwood_gather_01',
      interactionType: 'resource_node',
      tileX: 10,
      tileY: 15,
      interactionRangeTiles: 1,
      linkedObjectId: 'harbor_driftwood_node_01',
      resourceNodeType: 'driftwood',
    },
    {
      id: 'harbor_stone_gather_01',
      interactionType: 'resource_node',
      tileX: 23,
      tileY: 13,
      interactionRangeTiles: 1,
      linkedObjectId: 'harbor_stone_node_01',
      resourceNodeType: 'stone_pile',
    },
    {
      id: 'harbor_herb_gather_01',
      interactionType: 'resource_node',
      tileX: 25,
      tileY: 17,
      interactionRangeTiles: 1,
      linkedObjectId: 'harbor_herb_node_01',
      resourceNodeType: 'herb_patch',
    },
  ];

  return {
    id: 'test_harbor',
    displayName: 'Test Harbor',
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
      biome: 'harbor',
    },
  };
}
