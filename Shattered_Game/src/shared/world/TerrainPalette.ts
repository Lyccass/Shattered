import { isTerrainFamily, type TerrainFamily } from '../map/TerrainTypes';

export type TerrainTileId = number;

export type ExactTerrainPaletteEntry = {
  family: TerrainFamily;
  tileId: string;
  textureKey: string;
  category?: string;
  textureOffsetX?: number;
  textureOffsetY?: number;
  textureScale?: number;
  walkable?: boolean;
  flipX?: boolean;
  flipY?: boolean;
};

export type TerrainPaletteEntry = TerrainFamily | ExactTerrainPaletteEntry;

export type TerrainPalette = Record<TerrainTileId, TerrainPaletteEntry>;

export function createTerrainPalette(
  families: readonly TerrainFamily[],
): TerrainPalette {
  return Object.fromEntries(families.map((family, index) => [index, family]));
}

export function decodeTerrainPaletteTile(
  palette: TerrainPalette,
  tileId: TerrainTileId,
): TerrainFamily | null {
  const entry = palette[tileId] ?? null;
  return entry ? getTerrainPaletteEntryFamily(entry) : null;
}

export function decodeTerrainPaletteLayer(
  palette: TerrainPalette,
  tiles: TerrainTileId[][],
): TerrainFamily[][] {
  return tiles.map((row) =>
    row.map((tileId) => {
      const family = decodeTerrainPaletteTile(palette, tileId);

      if (!family) {
        throw new Error(`Terrain palette id ${tileId} is not defined.`);
      }

      return family;
    }),
  );
}

export function encodeTerrainPaletteLayer(
  terrain: TerrainFamily[][],
  palette: TerrainPalette,
): TerrainTileId[][] {
  const familyToId = new Map<TerrainFamily, TerrainTileId>(
    Object.entries(palette).map(([id, entry]) => [getTerrainPaletteEntryFamily(entry), Number(id)]),
  );

  return terrain.map((row) =>
    row.map((family) => {
      const id = familyToId.get(family);

      if (id === undefined) {
        throw new Error(`Terrain family "${family}" is not present in the palette.`);
      }

      return id;
    }),
  );
}

export function getTerrainPaletteEntryFamily(entry: TerrainPaletteEntry): TerrainFamily {
  return typeof entry === 'string' ? entry : entry.family;
}

export function getExactTerrainPaletteEntry(entry: TerrainPaletteEntry | undefined): ExactTerrainPaletteEntry | null {
  return isExactTerrainPaletteEntry(entry) ? entry : null;
}

export function validateTerrainPalette(palette: unknown): string[] {
  if (!isRecord(palette)) {
    return ['Terrain palette must be an object.'];
  }

  return Object.entries(palette).flatMap(([id, entry]) => {
    const errors: string[] = [];

    if (!Number.isInteger(Number(id))) {
      errors.push(`Terrain palette id "${id}" must be an integer.`);
    }

    if (typeof entry === 'string') {
      if (!isTerrainFamily(entry)) {
        errors.push(`Terrain palette id "${id}" uses invalid family "${String(entry)}".`);
      }
      return errors;
    }

    if (!isExactTerrainPaletteEntry(entry)) {
      errors.push(`Terrain palette id "${id}" must be a terrain family or exact terrain palette entry.`);
      return errors;
    }

    return errors;
  });
}

function isExactTerrainPaletteEntry(value: unknown): value is ExactTerrainPaletteEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isTerrainFamily(value.family) &&
    typeof value.tileId === 'string' &&
    typeof value.textureKey === 'string' &&
    (value.category === undefined || typeof value.category === 'string') &&
    (value.textureOffsetX === undefined || typeof value.textureOffsetX === 'number') &&
    (value.textureOffsetY === undefined || typeof value.textureOffsetY === 'number') &&
    (value.textureScale === undefined || typeof value.textureScale === 'number') &&
    (value.walkable === undefined || typeof value.walkable === 'boolean') &&
    (value.flipX === undefined || typeof value.flipX === 'boolean') &&
    (value.flipY === undefined || typeof value.flipY === 'boolean')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
