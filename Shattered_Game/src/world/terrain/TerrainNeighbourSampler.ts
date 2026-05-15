import { WorldGrid } from '../WorldGrid';
import type { TerrainFamily, TerrainNeighbourFamilies } from './TerrainTypes';

// Out-of-bounds counts as water. That keeps island edges and future shoreline
// resolution consistent instead of treating the void as grass or dirt.
export function sampleTerrainNeighbours(
  worldGrid: WorldGrid,
  tileX: number,
  tileY: number,
): TerrainNeighbourFamilies {
  return {
    edges: {
      xPlus: getTerrainOrWater(worldGrid, tileX + 1, tileY),
      xMinus: getTerrainOrWater(worldGrid, tileX - 1, tileY),
      yPlus: getTerrainOrWater(worldGrid, tileX, tileY + 1),
      yMinus: getTerrainOrWater(worldGrid, tileX, tileY - 1),
    },
    corners: {
      xPlusYPlus: getTerrainOrWater(worldGrid, tileX + 1, tileY + 1),
      xPlusYMinus: getTerrainOrWater(worldGrid, tileX + 1, tileY - 1),
      xMinusYPlus: getTerrainOrWater(worldGrid, tileX - 1, tileY + 1),
      xMinusYMinus: getTerrainOrWater(worldGrid, tileX - 1, tileY - 1),
    },
  };
}

function getTerrainOrWater(worldGrid: WorldGrid, tileX: number, tileY: number): TerrainFamily {
  return worldGrid.getTile(tileX, tileY) ?? 'water';
}
