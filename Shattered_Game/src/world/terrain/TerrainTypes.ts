import type { TerrainFamily as SharedTerrainFamily } from '../../shared/map/TerrainTypes';

export type TerrainFamily = SharedTerrainFamily;

export type RenderTerrainFamily = Exclude<TerrainFamily, 'sand'>;

export type TerrainRole =
  | 'full'
  | 'decorated'
  | 'transition'
  | 'edge'
  | 'corner'
  | 'slope'
  | 'cliff';

// These are isometric grid axes, not screen directions.
// xPlus/xMinus move along the grid X axis, and yPlus/yMinus move along the grid Y axis.
// Future transition matching should stay grid-native instead of using screen left/right/top/bottom.
export type IsoEdgeKey = 'xPlus' | 'xMinus' | 'yPlus' | 'yMinus';

export const ISO_EDGE_KEYS: IsoEdgeKey[] = ['xPlus', 'xMinus', 'yPlus', 'yMinus'];

export type IsoCornerKey =
  | 'xPlusYPlus'
  | 'xPlusYMinus'
  | 'xMinusYPlus'
  | 'xMinusYMinus';

export const ISO_CORNER_KEYS: IsoCornerKey[] = [
  'xPlusYPlus',
  'xPlusYMinus',
  'xMinusYPlus',
  'xMinusYMinus',
];

export type TerrainTransitionDirection = IsoEdgeKey | IsoCornerKey | 'xAxis' | 'yAxis';

export type TerrainTransitionKind =
  | 'edge'
  | 'outerCorner'
  | 'innerCorner'
  | 'shorelineEdge'
  | 'shorelineCorner'
  | 'slopeUpX'
  | 'slopeUpY';

export type TerrainTransitionRenderMode = 'replaceBase' | 'overlay' | 'debugOnly';

export type TerrainEdgeTag =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'water'
  | 'grass_dirt'
  | 'grass_stone'
  | 'dirt_stone'
  | 'blocked';

export type TerrainEdges = Record<IsoEdgeKey, TerrainEdgeTag>;

export type TerrainTransform = {
  flipX: boolean;
  flipY: boolean;
  offsetX?: number;
  offsetY?: number;
  rotation: 0;
  scale?: number;
};

export type TerrainNeighbourFamilies = {
  edges: Record<IsoEdgeKey, TerrainFamily>;
  corners: Record<IsoCornerKey, TerrainFamily>;
};

export type TerrainTransitionDebugStyle = {
  color: number;
  alpha: number;
};

export type TerrainTileDefinition = {
  id: string;
  family: RenderTerrainFamily;
  role: TerrainRole;
  spriteFrame: string;
  weight: number;
  walkable: boolean;
  edges: TerrainEdges;
  allowFlipX: boolean;
  allowFlipY: boolean;
  allowRotation: false;
};

export type TerrainTransitionDefinition = {
  id: string;
  fromFamily: RenderTerrainFamily;
  toFamily: RenderTerrainFamily;
  kind: TerrainTransitionKind;
  direction: TerrainTransitionDirection;
  spriteFrame: string;
  renderMode: TerrainTransitionRenderMode;
  fallbackColor: number;
  debugStyle: TerrainTransitionDebugStyle;
  allowFlipX: boolean;
  allowFlipY: boolean;
  // Future transition art may reuse a sprite with flipX/flipY. When that happens,
  // logical edge metadata must be transformed with the visual direction.
  transformEdges: boolean;
  priority: number;
  enabled: boolean;
  canReverse: boolean;
};

export type ResolvedTerrainTransition = {
  definition: TerrainTransitionDefinition;
  transform: TerrainTransform;
};

export type ResolvedTerrainTile = {
  baseTileDefinition: TerrainTileDefinition;
  baseTransform: TerrainTransform;
  transitionOverlays: ResolvedTerrainTransition[];
  debugInfo: {
    neighbourFamilies: TerrainNeighbourFamilies;
    edgeCandidates: ResolvedTerrainTransition[];
    outerCornerCandidates: ResolvedTerrainTransition[];
    innerCornerCandidates: ResolvedTerrainTransition[];
    shorelineCandidates: ResolvedTerrainTransition[];
  };
};

export function createUniformTerrainEdges(edgeTag: TerrainEdgeTag): TerrainEdges {
  return {
    xPlus: edgeTag,
    xMinus: edgeTag,
    yPlus: edgeTag,
    yMinus: edgeTag,
  };
}

export function getRenderTerrainFamily(family: TerrainFamily): RenderTerrainFamily {
  // Sand is still useful map data for beach/coast generation, but this sprite
  // pass maps it to dirt visuals until we add a dedicated sand tile family.
  return family === 'sand' ? 'dirt' : family;
}
