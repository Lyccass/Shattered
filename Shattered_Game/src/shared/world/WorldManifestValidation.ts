import { isTerrainFamily } from '../map/TerrainTypes';
import type { WorldManifest } from './WorldManifestTypes';

export type WorldManifestValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateWorldManifest(manifest: unknown): WorldManifestValidationResult {
  const errors: string[] = [];

  if (!isRecord(manifest)) {
    return { ok: false, errors: ['World manifest must be a JSON object.'] };
  }

  if (manifest.version !== 1) errors.push('World manifest version must be 1.');
  if (!isNonEmptyString(manifest.worldId)) errors.push('World manifest worldId is required.');
  if (!isNonEmptyString(manifest.displayName)) errors.push('World manifest displayName is required.');
  if (!isPositiveInteger(manifest.chunkSize)) errors.push('World manifest chunkSize must be a positive integer.');
  if (!isNonEmptyString(manifest.defaultRegionId)) errors.push('World manifest defaultRegionId is required.');

  const bounds = validateBounds(manifest.bounds, errors);
  const regionIds = validateRegions(manifest.regions, manifest.defaultRegionId, errors);
  validateDefaultSpawn(manifest.defaultSpawn, bounds, regionIds, errors);
  validateAuthoredChunks(manifest.authoredChunks, bounds, regionIds, errors);

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function assertValidWorldManifest(manifest: unknown): asserts manifest is WorldManifest {
  const result = validateWorldManifest(manifest);

  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
}

function validateBounds(value: unknown, errors: string[]): {
  minChunkX: number;
  minChunkY: number;
  maxChunkX: number;
  maxChunkY: number;
} | null {
  if (!isRecord(value)) {
    errors.push('World manifest bounds are required.');
    return null;
  }

  const { minChunkX, minChunkY, maxChunkX, maxChunkY } = value;

  if (!isInteger(minChunkX)) errors.push('World manifest bounds.minChunkX must be an integer.');
  if (!isInteger(minChunkY)) errors.push('World manifest bounds.minChunkY must be an integer.');
  if (!isInteger(maxChunkX)) errors.push('World manifest bounds.maxChunkX must be an integer.');
  if (!isInteger(maxChunkY)) errors.push('World manifest bounds.maxChunkY must be an integer.');

  if (
    isInteger(minChunkX) &&
    isInteger(maxChunkX) &&
    maxChunkX < minChunkX
  ) {
    errors.push('World manifest bounds.maxChunkX must be greater than or equal to minChunkX.');
  }

  if (
    isInteger(minChunkY) &&
    isInteger(maxChunkY) &&
    maxChunkY < minChunkY
  ) {
    errors.push('World manifest bounds.maxChunkY must be greater than or equal to minChunkY.');
  }

  return (
    isInteger(minChunkX) &&
    isInteger(minChunkY) &&
    isInteger(maxChunkX) &&
    isInteger(maxChunkY)
  )
    ? { minChunkX, minChunkY, maxChunkX, maxChunkY }
    : null;
}

function validateRegions(
  value: unknown,
  defaultRegionId: unknown,
  errors: string[],
): Set<string> {
  const regionIds = new Set<string>();

  if (!Array.isArray(value) || value.length === 0) {
    errors.push('World manifest regions must contain at least one region.');
    return regionIds;
  }

  for (const [index, region] of value.entries()) {
    if (!isRecord(region)) {
      errors.push(`World manifest region ${index} must be an object.`);
      continue;
    }

    if (!isNonEmptyString(region.id)) {
      errors.push(`World manifest region ${index} id is required.`);
    } else if (regionIds.has(region.id)) {
      errors.push(`World manifest region "${region.id}" is duplicated.`);
    } else {
      regionIds.add(region.id);
    }

    if (!isNonEmptyString(region.displayName)) {
      errors.push(`World manifest region ${index} displayName is required.`);
    }

    if (!isTerrainFamily(region.defaultTerrain)) {
      errors.push(`World manifest region ${index} defaultTerrain is invalid.`);
    }

    if (typeof region.defaultWalkable !== 'boolean') {
      errors.push(`World manifest region ${index} defaultWalkable must be a boolean.`);
    }
  }

  if (isNonEmptyString(defaultRegionId) && !regionIds.has(defaultRegionId)) {
    errors.push(`World manifest defaultRegionId "${defaultRegionId}" does not exist in regions.`);
  }

  return regionIds;
}

function validateDefaultSpawn(
  value: unknown,
  bounds: { minChunkX: number; minChunkY: number; maxChunkX: number; maxChunkY: number } | null,
  regionIds: Set<string>,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push('World manifest defaultSpawn is required.');
    return;
  }

  if (!isNonEmptyString(value.regionId)) {
    errors.push('World manifest defaultSpawn.regionId is required.');
  } else if (!regionIds.has(value.regionId)) {
    errors.push(`World manifest defaultSpawn.regionId "${value.regionId}" does not exist in regions.`);
  }

  if (!isRecord(value.chunk)) {
    errors.push('World manifest defaultSpawn.chunk is required.');
  } else {
    validateChunkCoordinate(value.chunk.chunkX, value.chunk.chunkY, bounds, 'World manifest defaultSpawn.chunk', errors);
  }

  if (!isInteger(value.tileX) || value.tileX < 0) {
    errors.push('World manifest defaultSpawn.tileX must be a non-negative integer.');
  }

  if (!isInteger(value.tileY) || value.tileY < 0) {
    errors.push('World manifest defaultSpawn.tileY must be a non-negative integer.');
  }
}

function validateAuthoredChunks(
  value: unknown,
  bounds: { minChunkX: number; minChunkY: number; maxChunkX: number; maxChunkY: number } | null,
  regionIds: Set<string>,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push('World manifest authoredChunks must be an array.');
    return;
  }

  const seen = new Set<string>();

  for (const [index, chunk] of value.entries()) {
    if (!isRecord(chunk)) {
      errors.push(`World manifest authoredChunks ${index} must be an object.`);
      continue;
    }

    validateChunkCoordinate(chunk.chunkX, chunk.chunkY, bounds, `World manifest authoredChunks ${index}`, errors);

    if (!isNonEmptyString(chunk.regionId)) {
      errors.push(`World manifest authoredChunks ${index} regionId is required.`);
    } else if (!regionIds.has(chunk.regionId)) {
      errors.push(`World manifest authoredChunks ${index} regionId "${chunk.regionId}" does not exist in regions.`);
    }

    if (!isNonEmptyString(chunk.path)) {
      errors.push(`World manifest authoredChunks ${index} path is required.`);
    }

    if (isInteger(chunk.chunkX) && isInteger(chunk.chunkY)) {
      const key = `${chunk.chunkX},${chunk.chunkY}`;
      if (seen.has(key)) {
        errors.push(`World manifest authored chunk "${key}" is duplicated.`);
      }
      seen.add(key);
    }
  }
}

function validateChunkCoordinate(
  chunkX: unknown,
  chunkY: unknown,
  bounds: { minChunkX: number; minChunkY: number; maxChunkX: number; maxChunkY: number } | null,
  label: string,
  errors: string[],
): void {
  if (!isInteger(chunkX)) errors.push(`${label}.chunkX must be an integer.`);
  if (!isInteger(chunkY)) errors.push(`${label}.chunkY must be an integer.`);

  if (!bounds || !isInteger(chunkX) || !isInteger(chunkY)) {
    return;
  }

  if (
    chunkX < bounds.minChunkX ||
    chunkX > bounds.maxChunkX ||
    chunkY < bounds.minChunkY ||
    chunkY > bounds.maxChunkY
  ) {
    errors.push(`${label} ${chunkX},${chunkY} is outside world bounds.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
