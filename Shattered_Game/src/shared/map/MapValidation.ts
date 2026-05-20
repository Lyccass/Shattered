import { isTerrainFamily } from './TerrainTypes';
import type { MapDefinition } from './MapTypes';

export type MapValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateMapShape(map: unknown): MapValidationResult {
  const errors: string[] = [];

  if (!isRecord(map)) {
    return { ok: false, errors: ['Map must be a JSON object.'] };
  }

  const id = map.id;
  const width = map.width;
  const height = map.height;
  const terrain = map.terrain;

  if (typeof id !== 'string' || id.trim().length === 0) {
    errors.push('Map id is required.');
  }

  if (typeof map.displayName !== 'string' || map.displayName.trim().length === 0) {
    errors.push('Map displayName is required.');
  }

  if (!isPositiveInteger(width)) {
    errors.push('Map width must be a positive integer.');
  }

  if (!isPositiveInteger(height)) {
    errors.push('Map height must be a positive integer.');
  }

  if (!Array.isArray(terrain)) {
    errors.push('Map terrain must be a two-dimensional array.');
    return errors.length === 0 ? { ok: true } : { ok: false, errors };
  }

  if (isPositiveInteger(height) && terrain.length !== height) {
    errors.push(`Map terrain row count ${terrain.length} does not match height ${height}.`);
  }

  terrain.forEach((row, y) => {
    if (!Array.isArray(row)) {
      errors.push(`Map terrain row ${y} must be an array.`);
      return;
    }

    if (isPositiveInteger(width) && row.length !== width) {
      errors.push(`Map terrain row ${y} width ${row.length} does not match width ${width}.`);
    }

    row.forEach((family, x) => {
      if (!isTerrainFamily(family)) {
        errors.push(`Map terrain tile ${x},${y} uses invalid family "${String(family)}".`);
      }
    });
  });

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function assertValidMapShape(map: unknown): asserts map is MapDefinition {
  const result = validateMapShape(map);

  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
