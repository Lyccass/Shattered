import { PROTOTYPE_SCALE } from '../../config/prototypeScale';
import { OBJECT_DEFINITIONS } from '../../objects/ObjectDefinitions';
import {
  evaluateStaticObjectPlacement,
  formatMapObjectPlacementError,
} from '../../objects/ObjectPlacementPolicy';
import { ObjectRegistry } from '../../objects/ObjectRegistry';
import { generateOrganicIsland } from '../IslandGenerator';
import type { MapDefinition, MapPlacedObject, MapTransition } from './MapTypes';
import { createSpawnPoints, paintRect } from './MapBuilderUtils';

export function createWildIslandMap(): MapDefinition {
  const mapId = 'test_wild_island';
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

  const registry = new ObjectRegistry(OBJECT_DEFINITIONS);
  const occupiedTiles = new Map<string, string>();
  const objects: MapPlacedObject[] = [];

  const addObject = (id: string, definitionId: string, tileX: number, tileY: number): void => {
    const definition = registry.get(definitionId);
    const evaluation = evaluateStaticObjectPlacement(
      {
        isTileInBounds: (targetX, targetY) =>
          targetX >= 0 && targetY >= 0 && targetX < width && targetY < height,
        isTerrainBlocked: (targetX, targetY) => terrain[targetY][targetX] === 'water',
        getOccupyingObjectId: (targetX, targetY) =>
          occupiedTiles.get(`${targetX},${targetY}`) ?? null,
      },
      definition,
      tileX,
      tileY,
    );

    if (!evaluation.ok) {
      throw new Error(
        formatMapObjectPlacementError({
          mapId,
          objectId: id,
          definitionId,
          tileX,
          tileY,
          failure: evaluation.failure,
        }),
      );
    }

    objects.push({ id, definitionId, tileX, tileY });

    evaluation.footprintTiles.forEach((tile) => {
      occupiedTiles.set(`${tile.x},${tile.y}`, id);
    });
  };

  const objectPlacements: Array<[string, string, number, number]> = [
    // Arrival coast
    ['wild_tree_00', 'tree_01_2x', 42, 130],
    ['wild_tree_00b', 'tree_02_2x', 46, 127],
    ['wild_tree_00c', 'tree_tall', 48, 133],
    ['wild_tree_00d', 'tree_dark', 40, 128],
    ['wild_tree_00e', 'tree_test', 49, 131],
    ['wild_tree_00f', 'tree_01_2x', 50, 136],
    ['wild_rock_00', 'medium_rock', 44, 136],
    ['wild_rock_00b', 'small_rock', 41, 138],
    ['wild_pebbles_00', 'pebble_patch', 39, 132],
    ['wild_pebbles_00b', 'pebble_patch', 45, 132],
    ['wild_flowers_00', 'flower_patch', 47, 136],
    ['wild_flowers_00b', 'flower_patch', 39, 134],
    ['wild_log_01', 'log', 42, 135],

    // North-west approach
    ['wild_tree_01', 'tree_01_4x', 66, 58],
    ['wild_tree_01b', 'tree_02_2x', 58, 56],
    ['wild_tree_01c', 'tree_01_2x', 62, 60],
    ['wild_tree_01d', 'tree_tall', 70, 64],
    ['wild_tree_01e', 'tree_dark', 74, 68],
    ['wild_tree_01f', 'tree_test', 60, 70],
    ['wild_tree_01g', 'tree_01_2x', 68, 72],
    ['wild_rock_01a', 'medium_rock', 56, 62],
    ['wild_rock_01b', 'small_rock', 64, 66],
    ['wild_pebbles_01a', 'pebble_patch', 72, 60],
    ['wild_flowers_01a', 'flower_patch', 58, 68],

    // Central wild interior
    ['wild_tree_02', 'tree_02_4x', 118, 52],
    ['wild_tree_03', 'tree_01_2x', 72, 104],
    ['wild_tree_04', 'tree_02_2x', 126, 111],
    ['wild_tree_06', 'tree_test', 101, 134],
    ['wild_tree_07', 'tree_dark', 80, 86],
    ['wild_tree_08', 'tree_test', 96, 84],
    ['wild_tree_09', 'tree_01_2x', 103, 92],
    ['wild_tree_10', 'tree_02_2x', 78, 96],
    ['wild_tree_11', 'tree_01_2x', 86, 84],
    ['wild_tree_12', 'tree_dark', 100, 86],
    ['wild_tree_13', 'tree_tall', 84, 90],
    ['wild_tree_14', 'tree_test', 106, 88],
    ['wild_tree_15', 'tree_02_2x', 104, 100],
    ['wild_tree_16', 'tree_01_2x', 88, 102],
    ['wild_tree_17', 'tree_dark', 100, 104],
    ['wild_tree_18', 'tree_test', 82, 100],
    ['wild_rock_01', 'large_rock', 90, 91],
    ['wild_rock_03', 'small_rock', 60, 94],
    ['wild_rock_04', 'medium_rock', 85, 95],
    ['wild_rock_05', 'small_rock', 98, 97],
    ['wild_rock_06', 'medium_rock', 78, 90],
    ['wild_rock_07', 'small_rock', 104, 94],
    ['wild_rock_08', 'medium_rock', 94, 104],
    ['wild_barrel_01', 'barrel', 95, 88],
    ['wild_barrel_02', 'barrel', 88, 96],
    ['wild_log_02', 'log', 93, 100],
    ['wild_pebbles_01', 'pebble_patch', 84, 98],
    ['wild_pebbles_02', 'pebble_patch', 92, 84],
    ['wild_pebbles_03', 'pebble_patch', 109, 96],
    ['wild_pebbles_04', 'pebble_patch', 80, 102],
    ['wild_pebbles_05', 'pebble_patch', 102, 102],
    ['wild_flowers_01', 'flower_patch', 104, 96],
    ['wild_flowers_02', 'flower_patch', 82, 92],
    ['wild_flowers_03', 'flower_patch', 98, 102],
    ['wild_flowers_04', 'flower_patch', 88, 84],
    ['wild_flowers_05', 'flower_patch', 106, 102],

    // East woods
    ['wild_tree_20', 'tree_01_2x', 114, 104],
    ['wild_tree_21', 'tree_02_2x', 118, 108],
    ['wild_tree_22', 'tree_dark', 122, 114],
    ['wild_tree_23', 'tree_tall', 128, 118],
    ['wild_tree_24', 'tree_test', 116, 120],
    ['wild_tree_25', 'tree_01_2x', 130, 106],
    ['wild_tree_26', 'tree_02_2x', 124, 122],
    ['wild_rock_20', 'medium_rock', 120, 110],
    ['wild_rock_21', 'small_rock', 126, 120],
    ['wild_pebbles_20', 'pebble_patch', 112, 118],
    ['wild_flowers_20', 'flower_patch', 130, 114],

    // South-mid brush and stones
    ['wild_rock_02', 'medium_rock', 116, 140],
    ['wild_tree_30', 'tree_01_2x', 96, 128],
    ['wild_tree_31', 'tree_02_2x', 108, 130],
    ['wild_tree_32', 'tree_dark', 104, 138],
    ['wild_tree_33', 'tree_test', 94, 144],
    ['wild_tree_34', 'tree_tall', 110, 146],
    ['wild_tree_35', 'tree_01_2x', 98, 148],
    ['wild_rock_30', 'small_rock', 100, 132],
    ['wild_rock_31', 'medium_rock', 108, 142],
    ['wild_pebbles_30', 'pebble_patch', 92, 136],
    ['wild_pebbles_31', 'pebble_patch', 112, 134],
    ['wild_flowers_30', 'flower_patch', 96, 142],
    ['wild_flowers_31', 'flower_patch', 104, 130],
  ];

  objectPlacements.forEach(([id, definitionId, tileX, tileY]) => {
    addObject(id, definitionId, tileX, tileY);
  });

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
    id: mapId,
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
