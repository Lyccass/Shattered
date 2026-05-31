import type { TerrainFamily } from '../map/TerrainTypes';
import {
  tileKey,
  isTileInsideBounds,
  normalizeElevation,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
  type EditorWorldZoneTag,
} from './EditorMapTypes';

export function paintTerrainTile(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  paint: EditorTerrainTilePaint,
): boolean {
  if (!inBounds(map, tileX, tileY)) {
    return false;
  }

  map.terrain[tileY][tileX] = paint.family;
  map.terrainTiles[tileKey(tileX, tileY)] = { ...paint };
  map.terrainWalkability[tileKey(tileX, tileY)] = paint.walkable;
  return true;
}

export function paintTerrain(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  family: TerrainFamily,
): boolean {
  if (!inBounds(map, tileX, tileY)) {
    return false;
  }

  map.terrain[tileY][tileX] = family;
  delete map.terrainTiles[tileKey(tileX, tileY)];
  delete map.terrainWalkability[tileKey(tileX, tileY)];
  return true;
}

export function paintTerrainWalkability(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  walkable: boolean,
): boolean {
  if (!inBounds(map, tileX, tileY)) {
    return false;
  }

  const key = tileKey(tileX, tileY);
  map.terrainWalkability[key] = walkable;

  if (map.terrainTiles[key]) {
    map.terrainTiles[key] = {
      ...map.terrainTiles[key],
      walkable,
    };
  }

  return true;
}

export function paintTerrainElevation(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  elevation: number,
): boolean {
  if (!inBounds(map, tileX, tileY)) {
    return false;
  }

  map.terrainElevation[tileKey(tileX, tileY)] = normalizeElevation(elevation);
  return true;
}

export function paintTerrainZone(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  tag: EditorWorldZoneTag | null,
): boolean {
  if (!inBounds(map, tileX, tileY)) {
    return false;
  }

  const key = tileKey(tileX, tileY);
  if (tag === null) {
    delete map.terrainZones[key];
  } else {
    map.terrainZones[key] = tag;
  }
  return true;
}

export function getEditorTerrainZoneAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): EditorWorldZoneTag | null {
  if (!inBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrainZones[tileKey(tileX, tileY)] ?? null;
}

export function getEditorTerrainAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): TerrainFamily | null {
  if (!inBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrain[tileY][tileX];
}

export function getEditorTerrainTilePaint(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): EditorTerrainTilePaint | null {
  if (!inBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrainTiles[tileKey(tileX, tileY)] ?? null;
}

export function getEditorTerrainWalkabilityAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): boolean | null {
  if (!inBounds(map, tileX, tileY)) {
    return null;
  }

  const key = tileKey(tileX, tileY);
  const override = map.terrainWalkability[key];

  if (override !== undefined) {
    return override;
  }

  return map.terrainTiles[key]?.walkable ?? map.terrain[tileY][tileX] !== 'water';
}

export function getEditorTerrainElevationAt(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
): number | null {
  if (!inBounds(map, tileX, tileY)) {
    return null;
  }

  return map.terrainElevation[tileKey(tileX, tileY)] ?? 0;
}

function inBounds(map: EditorMapDefinition, tileX: number, tileY: number): boolean {
  return isTileInsideBounds(tileX, tileY, map.width, map.height);
}
