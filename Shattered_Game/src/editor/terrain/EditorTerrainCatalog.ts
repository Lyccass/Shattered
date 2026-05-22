import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import { TERRAIN_TILE_DEFINITIONS } from '../../world/terrain/TerrainTileDefinitions';
import { TERRAIN_TRANSITION_DEFINITIONS } from '../../world/terrain/TerrainTransitionDefinitions';

export type EditorTerrainBrush = {
  id: string;
  category?: string;
  label: string;
  family: TerrainFamily;
  textureKey: string;
  textureDataUrl?: string;
  textureOffsetX?: number;
  textureOffsetY?: number;
  textureScale?: number;
  source: 'base' | 'transition' | 'custom';
  walkable: boolean;
  flipX: boolean;
  flipY: boolean;
};

export type EditorTerrainCatalog = {
  all: EditorTerrainBrush[];
  byFamily: Record<TerrainFamily, EditorTerrainBrush[]>;
  byId: Map<string, EditorTerrainBrush>;
};

const TERRAIN_FAMILY_ORDER: TerrainFamily[] = ['grass', 'dirt', 'stone', 'water', 'sand'];

export function createEditorTerrainCatalog(): EditorTerrainCatalog {
  const baseBrushes = TERRAIN_TILE_DEFINITIONS.map((definition): EditorTerrainBrush => ({
    id: definition.id,
    label: definition.id,
    family: definition.family,
    textureKey: definition.spriteFrame,
    source: 'base',
    walkable: definition.walkable,
    flipX: false,
    flipY: false,
  }));
  const sandBrushes = baseBrushes
    .filter((brush) => brush.family === 'dirt')
    .map((brush): EditorTerrainBrush => ({
      ...brush,
      id: `sand_${brush.id}`,
      label: `sand ${brush.label}`,
      family: 'sand',
      walkable: true,
    }));
  const transitionBrushes = TERRAIN_TRANSITION_DEFINITIONS
    .filter((definition) => definition.enabled)
    .map((definition): EditorTerrainBrush => ({
      id: definition.id,
      label: definition.id,
      family: definition.fromFamily,
      textureKey: definition.spriteFrame,
      source: 'transition',
      walkable: definition.fromFamily !== 'water',
      flipX: false,
      flipY: false,
    }));
  const all = [...baseBrushes, ...sandBrushes, ...transitionBrushes];
  const byFamily = Object.fromEntries(
    TERRAIN_FAMILY_ORDER.map((family) => [
      family,
      all.filter((brush) => brush.family === family),
    ]),
  ) as Record<TerrainFamily, EditorTerrainBrush[]>;

  return {
    all,
    byFamily,
    byId: new Map(all.map((brush) => [brush.id, brush])),
  };
}

export function addCustomTerrainBrushes(
  catalog: EditorTerrainCatalog,
  brushes: EditorTerrainBrush[],
): void {
  for (const brush of brushes) {
    const existing = catalog.byId.get(brush.id);

    if (existing) {
      Object.assign(existing, brush);
      continue;
    }

    catalog.all.push(brush);
    catalog.byId.set(brush.id, brush);
    catalog.byFamily[brush.family].push(brush);
  }
}

export function removeCustomTerrainBrush(catalog: EditorTerrainCatalog, brushId: string): boolean {
  const brush = catalog.byId.get(brushId);

  if (!brush || brush.source !== 'custom') {
    return false;
  }

  catalog.byId.delete(brushId);
  catalog.all = catalog.all.filter((candidate) => candidate.id !== brushId);
  catalog.byFamily[brush.family] = catalog.byFamily[brush.family].filter((candidate) => candidate.id !== brushId);
  return true;
}

export function getDefaultBrushForFamily(
  catalog: EditorTerrainCatalog,
  family: TerrainFamily,
): EditorTerrainBrush {
  const brush = catalog.byFamily[family][0];

  if (!brush) {
    throw new Error(`No editor terrain brush registered for ${family}.`);
  }

  return brush;
}

export function getBrushAtOffset(
  catalog: EditorTerrainCatalog,
  brush: EditorTerrainBrush,
  offset: number,
): EditorTerrainBrush {
  const familyBrushes = catalog.byFamily[brush.family];
  const index = familyBrushes.findIndex((candidate) => candidate.id === brush.id);
  const currentIndex = index >= 0 ? index : 0;
  const nextIndex = wrapIndex(currentIndex + offset, familyBrushes.length);
  return familyBrushes[nextIndex];
}

export function withBrushFlip(
  brush: EditorTerrainBrush,
  axis: 'x' | 'y',
): EditorTerrainBrush {
  return {
    ...brush,
    [axis === 'x' ? 'flipX' : 'flipY']: !brush[axis === 'x' ? 'flipX' : 'flipY'],
  };
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
