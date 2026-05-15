import type {
  TerrainFamily,
  TerrainTileDefinition,
  TerrainTransform,
  TerrainTransitionDefinition,
} from './TerrainTypes';

export function selectWeightedTerrainVariant(
  candidates: TerrainTileDefinition[],
  gridX: number,
  gridY: number,
  family: TerrainFamily,
): TerrainTileDefinition {
  if (candidates.length === 0) {
    throw new Error(`No terrain candidates available for ${family}`);
  }

  const totalWeight = candidates.reduce((total, candidate) => total + candidate.weight, 0);
  const roll = getSeededUnitFloat(`${gridX}:${gridY}:${family}:variant`) * totalWeight;
  let cursor = 0;

  for (const candidate of candidates) {
    cursor += candidate.weight;
    if (roll <= cursor) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

export function selectTerrainTransform(
  definition: TerrainTileDefinition,
  gridX: number,
  gridY: number,
  family: TerrainFamily,
): TerrainTransform {
  return {
    flipX: definition.allowFlipX && getSeededUnitFloat(`${gridX}:${gridY}:${family}:flipX`) > 0.5,
    flipY: definition.allowFlipY && getSeededUnitFloat(`${gridX}:${gridY}:${family}:flipY`) > 0.5,
    rotation: 0,
  };
}

export function selectTerrainTransitionTransform(
  definition: TerrainTransitionDefinition,
  gridX: number,
  gridY: number,
): TerrainTransform {
  return {
    flipX: definition.allowFlipX && getSeededUnitFloat(`${gridX}:${gridY}:${definition.id}:flipX`) > 0.5,
    flipY: definition.allowFlipY && getSeededUnitFloat(`${gridX}:${gridY}:${definition.id}:flipY`) > 0.5,
    rotation: 0,
  };
}

export function getSeededUnitFloat(seed: string): number {
  return hashString(seed) / 0xffffffff;
}

function hashString(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
