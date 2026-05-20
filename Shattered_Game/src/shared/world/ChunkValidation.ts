import { isTerrainFamily } from '../map/TerrainTypes';
import type { WorldChunkDefinition } from './ChunkTypes';
import { validateTerrainPalette } from './TerrainPalette';

export type ChunkValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateWorldChunkDefinition(chunk: WorldChunkDefinition): ChunkValidationResult {
  const errors: string[] = [];

  if (!chunk.worldId.trim()) errors.push('Chunk worldId is required.');
  if (!chunk.regionId.trim()) errors.push('Chunk regionId is required.');
  if (!Number.isInteger(chunk.chunkX)) errors.push('Chunk chunkX must be an integer.');
  if (!Number.isInteger(chunk.chunkY)) errors.push('Chunk chunkY must be an integer.');
  if (!isPositiveInteger(chunk.width)) errors.push('Chunk width must be a positive integer.');
  if (!isPositiveInteger(chunk.height)) errors.push('Chunk height must be a positive integer.');

  if (chunk.terrain.encoding === 'palette') {
    errors.push(...validateTerrainPalette(chunk.terrainPalette));
    errors.push(...validateLayerDimensions(chunk.terrain.tiles, chunk.width, chunk.height, 'terrain'));
    const palette = chunk.terrainPalette ?? {};
    chunk.terrain.tiles.forEach((row, y) => {
      row.forEach((tileId, x) => {
        if (palette[tileId] === undefined) {
          errors.push(`Terrain tile ${x},${y} uses missing palette id ${tileId}.`);
        }
      });
    });
  } else {
    errors.push(...validateLayerDimensions(chunk.terrain.tiles, chunk.width, chunk.height, 'terrain'));
    chunk.terrain.tiles.forEach((row, y) => {
      row.forEach((family, x) => {
        if (!isTerrainFamily(family)) {
          errors.push(`Terrain tile ${x},${y} uses invalid family "${String(family)}".`);
        }
      });
    });
  }

  for (const object of chunk.objectLayer.objects) {
    if (!isTileInBounds(object.tileX, object.tileY, chunk.width, chunk.height)) {
      errors.push(`Object "${object.id}" is out of chunk bounds at ${object.tileX},${object.tileY}.`);
    }
  }

  for (const resource of chunk.resourceLayer.nodes) {
    if (!isTileInBounds(resource.tileX, resource.tileY, chunk.width, chunk.height)) {
      errors.push(`Resource "${resource.id}" is out of chunk bounds at ${resource.tileX},${resource.tileY}.`);
    }
  }

  for (const habitat of chunk.habitatLayer.habitats) {
    if (!isRectInBounds(habitat.tileX, habitat.tileY, habitat.width, habitat.height, chunk.width, chunk.height)) {
      errors.push(`Habitat "${habitat.id}" is out of chunk bounds.`);
    }
  }

  for (const zone of chunk.zoneLayer.zones) {
    if (!isRectInBounds(zone.tileX, zone.tileY, zone.width, zone.height, chunk.width, chunk.height)) {
      errors.push(`Zone "${zone.id}" is out of chunk bounds.`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validateChunkNeighborBorders(
  _chunk: WorldChunkDefinition,
  _neighbour: WorldChunkDefinition,
): ChunkValidationResult {
  // Future hook: validate transition continuity, cliff/elevation seams, and
  // authoring rules that need both sides of a chunk border.
  return { ok: true };
}

function validateLayerDimensions(
  rows: unknown[][],
  width: number,
  height: number,
  label: string,
): string[] {
  const errors: string[] = [];

  if (rows.length !== height) {
    errors.push(`${label} row count ${rows.length} does not match height ${height}.`);
  }

  rows.forEach((row, y) => {
    if (row.length !== width) {
      errors.push(`${label} row ${y} width ${row.length} does not match width ${width}.`);
    }
  });

  return errors;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isTileInBounds(tileX: number, tileY: number, width: number, height: number): boolean {
  return (
    Number.isInteger(tileX) &&
    Number.isInteger(tileY) &&
    tileX >= 0 &&
    tileY >= 0 &&
    tileX < width &&
    tileY < height
  );
}

function isRectInBounds(
  tileX: number,
  tileY: number,
  width: number,
  height: number,
  chunkWidth: number,
  chunkHeight: number,
): boolean {
  return (
    isTileInBounds(tileX, tileY, chunkWidth, chunkHeight) &&
    isPositiveInteger(width) &&
    isPositiveInteger(height) &&
    tileX + width <= chunkWidth &&
    tileY + height <= chunkHeight
  );
}
