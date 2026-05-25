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
    { id: 'harbor_rock_01', definitionId: 'small_rock', tileX: 24, tileY: 14 },
    { id: 'harbor_tree_01', definitionId: 'tree_test', tileX: 27, tileY: 17 },
    { id: 'harbor_tree_02', definitionId: 'tree_dark', tileX: 8, tileY: 18 },
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
    {
      id: 'harbor_combat_sandbox_zone',
      tileX: 18,
      tileY: 18,
      width: 8,
      height: 5,
      tags: ['combat_sandbox'],
    },
  ];

  const interactionAnchors: MapInteractionAnchor[] = [
    {
      id: 'harbor_contract_board_01',
      interactionType: 'contract_board',
      tileX: 18,
      tileY: 14,
      interactionRangeTiles: 1,
      linkedObjectId: 'harbor_notice_board_01',
      promptLabel: 'Turn In Contract',
      contractIds: ['warmth_for_the_dockhands', 'camp_supplies'],
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
    {
      id: 'harbor_trader_maren',
      interactionType: 'npc',
      tileX: 16,
      tileY: 11,
      interactionRangeTiles: 2,
      text: 'Welcome. I deal in supplies and curiosities.',
      promptLabel: 'Talk',
      npcDefinitionId: 'trader_maren',
      patrolTiles: [
        { x: 16, y: 11 },
        { x: 20, y: 11 },
        { x: 20, y: 13 },
        { x: 16, y: 13 },
      ],
    },
  ];

  return {
    id: 'test_harbor',
    displayName: 'Test Harbor',
    spaceType: 'open_world',
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
