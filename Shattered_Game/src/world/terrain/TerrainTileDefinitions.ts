import {
  createUniformTerrainEdges,
  type RenderTerrainFamily,
  type TerrainEdgeTag,
  type TerrainRole,
  type TerrainTileDefinition,
} from './TerrainTypes';
import { FOREST_TERRAIN_DEFINITIONS } from './ForestTerrainDefinitions';

type TerrainDefinitionInput = {
  id: string;
  family: RenderTerrainFamily;
  role?: TerrainRole;
  weight?: number;
  walkable: boolean;
  edgeTag: TerrainEdgeTag;
  spriteFrame?: string;
  allowFlipX?: boolean;
  allowFlipY?: boolean;
};

export const TERRAIN_TILE_DEFINITIONS: TerrainTileDefinition[] = [
  ...createNumberedTiles('grassA', 44, 'grass', 'grass', true, {
    decoratedEvery: 3,
    allowFlipX: true,
    allowFlipY: true,
  }),
  ...createNumberedTiles('groundA', 48, 'dirt', 'dirt', true, {
    decoratedEvery: 4,
    allowFlipX: true,
  }),

  // The current new pack does not include dedicated stone floor diamonds, so
  // stone terrain temporarily reuses rocky ground variants while preserving the
  // gameplay family and edge tags for future replacement.
  defineTile({ id: 'stoneGroundA08', family: 'stone', walkable: true, edgeTag: 'stone', spriteFrame: 'terrain-groundA08', role: 'decorated', weight: 2 }),
  defineTile({ id: 'stoneGroundA20', family: 'stone', walkable: true, edgeTag: 'stone', spriteFrame: 'terrain-groundA20', role: 'decorated', weight: 2 }),
  defineTile({ id: 'stoneGroundA32', family: 'stone', walkable: true, edgeTag: 'stone', spriteFrame: 'terrain-groundA32', role: 'decorated', weight: 2 }),
  defineTile({ id: 'stoneGroundA44', family: 'stone', walkable: true, edgeTag: 'stone', spriteFrame: 'terrain-groundA44', role: 'full', weight: 3 }),

  // Temporary water simplification: every water tile resolves to Water_A while
  // shoreline/corner art is paused. This keeps blocked water tiles visually
  // predictable until the full water autotile set is mapped cleanly.
  defineTile({ id: 'waterA', family: 'water', walkable: false, edgeTag: 'water', spriteFrame: 'terrain-waterA', weight: 1 }),
  ...FOREST_TERRAIN_DEFINITIONS,
];

function defineTile({
  id,
  family,
  role = 'full',
  weight = 1,
  walkable,
  edgeTag,
  spriteFrame = `terrain-${id}`,
  allowFlipX = false,
  allowFlipY = false,
}: TerrainDefinitionInput): TerrainTileDefinition {
  return {
    id,
    family,
    role,
    spriteFrame,
    weight,
    walkable,
    edges: createUniformTerrainEdges(edgeTag),
    allowFlipX,
    allowFlipY,
    allowRotation: false,
  };
}

function createNumberedTiles(
  prefix: string,
  count: number,
  family: RenderTerrainFamily,
  edgeTag: TerrainEdgeTag,
  walkable: boolean,
  options: {
    decoratedEvery?: number;
    baseWeight?: number;
    decoratedWeight?: number;
    allowFlipX?: boolean;
    allowFlipY?: boolean;
  } = {},
): TerrainTileDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const number = `${index + 1}`.padStart(2, '0');
    const isDecorated = options.decoratedEvery !== undefined && (index + 1) % options.decoratedEvery === 0;

    return defineTile({
      id: `${prefix}${number}`,
      family,
      role: isDecorated ? 'decorated' : 'full',
      weight: isDecorated ? options.decoratedWeight ?? 2 : options.baseWeight ?? 4,
      walkable,
      edgeTag,
      allowFlipX: options.allowFlipX,
      allowFlipY: options.allowFlipY,
    });
  });
}
