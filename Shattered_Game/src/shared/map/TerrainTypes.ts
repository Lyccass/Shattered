export const TERRAIN_FAMILIES = ['grass', 'dirt', 'stone', 'water', 'sand'] as const;

export type TerrainFamily = (typeof TERRAIN_FAMILIES)[number];

export function isTerrainFamily(value: unknown): value is TerrainFamily {
  return typeof value === 'string' && TERRAIN_FAMILIES.includes(value as TerrainFamily);
}
