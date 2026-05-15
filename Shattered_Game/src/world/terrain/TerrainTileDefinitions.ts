import {
  createUniformTerrainEdges,
  type RenderTerrainFamily,
  type TerrainEdgeTag,
  type TerrainRole,
  type TerrainTileDefinition,
} from './TerrainTypes';

type TerrainDefinitionInput = {
  id: string;
  family: RenderTerrainFamily;
  role: TerrainRole;
  weight: number;
  walkable: boolean;
  edgeTag: TerrainEdgeTag;
  allowFlipX?: boolean;
  allowFlipY?: boolean;
};

export const TERRAIN_TILE_DEFINITIONS: TerrainTileDefinition[] = [
  defineTile({ id: 'dirt1', family: 'dirt', role: 'full', weight: 4, walkable: true, edgeTag: 'dirt' }),
  defineTile({ id: 'dirt2', family: 'dirt', role: 'transition', weight: 1, walkable: true, edgeTag: 'dirt' }),
  defineTile({ id: 'dirt3', family: 'dirt', role: 'transition', weight: 1, walkable: true, edgeTag: 'dirt' }),
  defineTile({ id: 'dirt4', family: 'dirt', role: 'full', weight: 3, walkable: true, edgeTag: 'dirt' }),

  defineTile({ id: 'grass1', family: 'grass', role: 'full', weight: 5, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass2', family: 'grass', role: 'decorated', weight: 2, walkable: true, edgeTag: 'grass', allowFlipX: true }),
  defineTile({ id: 'grass3', family: 'grass', role: 'full', weight: 4, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass4', family: 'grass', role: 'transition', weight: 1, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass5', family: 'grass', role: 'transition', weight: 1, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass6', family: 'grass', role: 'transition', weight: 1, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass7', family: 'grass', role: 'transition', weight: 1, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass8', family: 'grass', role: 'transition', weight: 1, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass9', family: 'grass', role: 'transition', weight: 1, walkable: true, edgeTag: 'grass' }),
  defineTile({ id: 'grass10', family: 'grass', role: 'transition', weight: 1, walkable: true, edgeTag: 'grass' }),

  defineTile({ id: 'stone1', family: 'stone', role: 'decorated', weight: 2, walkable: true, edgeTag: 'stone' }),
  defineTile({ id: 'stone2', family: 'stone', role: 'full', weight: 4, walkable: true, edgeTag: 'stone' }),
  defineTile({ id: 'stone3', family: 'stone', role: 'decorated', weight: 2, walkable: true, edgeTag: 'stone' }),
  defineTile({ id: 'stone4', family: 'stone', role: 'decorated', weight: 2, walkable: true, edgeTag: 'stone' }),

  defineTile({ id: 'water1', family: 'water', role: 'full', weight: 5, walkable: false, edgeTag: 'water' }),
  defineTile({ id: 'water2', family: 'water', role: 'decorated', weight: 2, walkable: false, edgeTag: 'water', allowFlipX: true }),
];

function defineTile({
  id,
  family,
  role,
  weight,
  walkable,
  edgeTag,
  allowFlipX = false,
  allowFlipY = false,
}: TerrainDefinitionInput): TerrainTileDefinition {
  return {
    id,
    family,
    role,
    spriteFrame: `terrain-${id}`,
    weight,
    walkable,
    edges: createUniformTerrainEdges(edgeTag),
    allowFlipX,
    allowFlipY,
    allowRotation: false,
  };
}
