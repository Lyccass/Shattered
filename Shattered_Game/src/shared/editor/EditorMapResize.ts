import { resizeEditorEncounterAreas } from './EditorEncounterModel';
import {
  tileKey,
  isTileInsideBounds,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from './EditorMapTypes';

export function resizeEditorMap(
  map: EditorMapDefinition,
  width: number,
  height: number,
  fillPaint: EditorTerrainTilePaint,
): EditorMapDefinition {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error('Editor map width must be a positive integer.');
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error('Editor map height must be a positive integer.');
  }

  const terrainTiles = Object.fromEntries(
    Object.entries(map.terrainTiles).filter(([key]) => {
      const [tx, ty] = parseTileKey(key);
      return tx >= 0 && ty >= 0 && tx < width && ty < height;
    }),
  );
  const terrainWalkability = filterByBounds(map.terrainWalkability, width, height);
  const terrainElevation = filterByBounds(map.terrainElevation, width, height);
  const terrainZones = filterByBounds(map.terrainZones, width, height);

  const resized: EditorMapDefinition = {
    ...map,
    width,
    height,
    terrain: Array.from({ length: height }, (_, tileY) =>
      Array.from({ length: width }, (_, tileX) => map.terrain[tileY]?.[tileX] ?? fillPaint.family),
    ),
    terrainTiles,
    terrainWalkability,
    terrainElevation,
    terrainZones,
    objects: map.objects.filter((o) => isTileInsideBounds(o.tileX, o.tileY, width, height)),
    enemySpawns: map.enemySpawns.filter((s) => isTileInsideBounds(s.tileX, s.tileY, width, height)),
    encounterAreas: resizeEditorEncounterAreas(map.encounterAreas, width, height),
    npcAnchors: (map.npcAnchors ?? []).filter((a) => isTileInsideBounds(a.tileX, a.tileY, width, height)),
    transitions: map.transitions.filter((t) =>
      isTileInsideBounds(t.fromTile.tileX, t.fromTile.tileY, width, height),
    ),
  };

  for (let tileY = 0; tileY < height; tileY += 1) {
    for (let tileX = 0; tileX < width; tileX += 1) {
      const key = tileKey(tileX, tileY);

      if (!resized.terrainTiles[key]) {
        resized.terrainTiles[key] = { ...fillPaint };
      }

      if (resized.terrainWalkability[key] === undefined) {
        resized.terrainWalkability[key] = fillPaint.walkable;
      }

      if (resized.terrainElevation[key] === undefined) {
        resized.terrainElevation[key] = 0;
      }
    }
  }

  return resized;
}

function parseTileKey(key: string): [number, number] {
  const [tileX, tileY] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [Number.isFinite(tileX) ? tileX : -1, Number.isFinite(tileY) ? tileY : -1];
}

function filterByBounds<T>(record: Record<string, T>, width: number, height: number): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => {
      const [tx, ty] = parseTileKey(key);
      return tx >= 0 && ty >= 0 && tx < width && ty < height;
    }),
  );
}
