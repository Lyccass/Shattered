import { isTerrainFamily, type TerrainFamily } from '../map/TerrainTypes';

export type TerrainTileId = number;

export type TerrainPalette = Record<TerrainTileId, TerrainFamily>;

export function createTerrainPalette(
  families: readonly TerrainFamily[],
): TerrainPalette {
  return Object.fromEntries(families.map((family, index) => [index, family]));
}

export function decodeTerrainPaletteTile(
  palette: TerrainPalette,
  tileId: TerrainTileId,
): TerrainFamily | null {
  return palette[tileId] ?? null;
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
    Object.entries(palette).map(([id, family]) => [family, Number(id)]),
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

export function validateTerrainPalette(palette: unknown): string[] {
  if (!isRecord(palette)) {
    return ['Terrain palette must be an object.'];
  }

  return Object.entries(palette).flatMap(([id, family]) => {
    const errors: string[] = [];

    if (!Number.isInteger(Number(id))) {
      errors.push(`Terrain palette id "${id}" must be an integer.`);
    }

    if (!isTerrainFamily(family)) {
      errors.push(`Terrain palette id "${id}" uses invalid family "${String(family)}".`);
    }

    return errors;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
