import {
  ISO_CORNER_KEYS,
  ISO_EDGE_KEYS,
  type IsoCornerKey,
  type IsoEdgeKey,
  type RenderTerrainFamily,
  type TerrainTransitionDefinition,
  type TerrainTransitionDirection,
  type TerrainTransitionKind,
  type TerrainTransitionRenderMode,
} from './TerrainTypes';

const TRANSITION_COLOURS: Record<RenderTerrainFamily, number> = {
  grass: 0x8bd450,
  dirt: 0xb76b35,
  stone: 0xa8a29e,
  water: 0x60d8f6,
};

const TRANSITION_PRIORITIES: Record<TerrainTransitionKind, number> = {
  shorelineCorner: 110,
  shorelineEdge: 100,
  outerCorner: 70,
  innerCorner: 65,
  edge: 60,
  slopeUpX: 20,
  slopeUpY: 20,
};

const AVAILABLE_TRANSITION_FRAMES: Partial<Record<string, string>> = {
  grass_to_dirt_edge_xPlus: 'terrain-dirt3',
  grass_to_dirt_edge_xMinus: 'terrain-dirt3',
  grass_to_dirt_edge_yPlus: 'terrain-dirt2',
  grass_to_dirt_edge_yMinus: 'terrain-dirt2',
  grass_to_dirt_outer_corner_xPlusYPlus: 'terrain-dirt2',
  grass_to_dirt_outer_corner_xPlusYMinus: 'terrain-dirt3',
  grass_to_dirt_outer_corner_xMinusYPlus: 'terrain-dirt3',
  grass_to_dirt_outer_corner_xMinusYMinus: 'terrain-dirt2',
  grass_to_dirt_inner_corner_xPlusYPlus: 'terrain-dirt3',
  grass_to_dirt_inner_corner_xPlusYMinus: 'terrain-dirt2',
  grass_to_dirt_inner_corner_xMinusYPlus: 'terrain-dirt2',
  grass_to_dirt_inner_corner_xMinusYMinus: 'terrain-dirt3',

  grass_to_stone_edge_xPlus: 'terrain-grass5',
  grass_to_stone_edge_xMinus: 'terrain-grass5',
  grass_to_stone_edge_yPlus: 'terrain-grass4',
  grass_to_stone_edge_yMinus: 'terrain-grass4',
  grass_to_stone_outer_corner_xPlusYPlus: 'terrain-grass4',
  grass_to_stone_outer_corner_xPlusYMinus: 'terrain-grass5',
  grass_to_stone_outer_corner_xMinusYPlus: 'terrain-grass5',
  grass_to_stone_outer_corner_xMinusYMinus: 'terrain-grass4',
  grass_to_stone_inner_corner_xPlusYPlus: 'terrain-grass7',
  grass_to_stone_inner_corner_xPlusYMinus: 'terrain-grass4',
  grass_to_stone_inner_corner_xMinusYPlus: 'terrain-grass4',
  grass_to_stone_inner_corner_xMinusYMinus: 'terrain-grass7',
};

export const TERRAIN_TRANSITION_DEFINITIONS: TerrainTransitionDefinition[] = [
  ...createFamilyTransitionSet('grass', 'dirt'),
  ...createFamilyTransitionSet('grass', 'stone'),
  ...createFamilyTransitionSet('stone', 'dirt'),
  ...createFamilyTransitionSet('dirt', 'stone'),
  ...createShorelineSet('grass'),
  ...createShorelineSet('dirt'),
  ...createShorelineSet('stone'),
  createSlopePlaceholder('slope_up_x', 'slopeUpX', 'xAxis'),
  createSlopePlaceholder('slope_up_y', 'slopeUpY', 'yAxis'),
];

function createFamilyTransitionSet(
  fromFamily: RenderTerrainFamily,
  toFamily: RenderTerrainFamily,
): TerrainTransitionDefinition[] {
  return [
    ...ISO_EDGE_KEYS.map((direction) =>
      createTransitionDefinition({
        id: `${fromFamily}_to_${toFamily}_edge_${direction}`,
        fromFamily,
        toFamily,
        kind: 'edge',
        direction,
      }),
    ),
    ...ISO_CORNER_KEYS.map((direction) =>
      createTransitionDefinition({
        id: `${fromFamily}_to_${toFamily}_outer_corner_${direction}`,
        fromFamily,
        toFamily,
        kind: 'outerCorner',
        direction,
      }),
    ),
    ...ISO_CORNER_KEYS.map((direction) =>
      createTransitionDefinition({
        id: `${fromFamily}_to_${toFamily}_inner_corner_${direction}`,
        fromFamily,
        toFamily,
        kind: 'innerCorner',
        direction,
      }),
    ),
  ];
}

function createShorelineSet(fromFamily: Exclude<RenderTerrainFamily, 'water'>): TerrainTransitionDefinition[] {
  return [
    ...ISO_EDGE_KEYS.map((direction) =>
      createTransitionDefinition({
        id: `${fromFamily}_to_water_shoreline_edge_${direction}`,
        fromFamily,
        toFamily: 'water',
        kind: 'shorelineEdge',
        direction,
      }),
    ),
    ...ISO_CORNER_KEYS.map((direction) =>
      createTransitionDefinition({
        id: `${fromFamily}_to_water_shoreline_corner_${direction}`,
        fromFamily,
        toFamily: 'water',
        kind: 'shorelineCorner',
        direction,
      }),
    ),
  ];
}

function createSlopePlaceholder(
  id: string,
  kind: Extract<TerrainTransitionKind, 'slopeUpX' | 'slopeUpY'>,
  direction: Extract<TerrainTransitionDirection, 'xAxis' | 'yAxis'>,
): TerrainTransitionDefinition {
  return createTransitionDefinition({
    id,
    fromFamily: 'grass',
    toFamily: 'stone',
    kind,
    direction,
  });
}

function createTransitionDefinition({
  id,
  fromFamily,
  toFamily,
  kind,
  direction,
  spriteFrame = `terrain-transition-${id}`,
  renderMode = 'debugOnly',
  enabled = false,
}: {
  id: string;
  fromFamily: RenderTerrainFamily;
  toFamily: RenderTerrainFamily;
  kind: TerrainTransitionKind;
  direction: IsoEdgeKey | IsoCornerKey | 'xAxis' | 'yAxis';
  spriteFrame?: string;
  renderMode?: TerrainTransitionRenderMode;
  enabled?: boolean;
}): TerrainTransitionDefinition {
  const priority = TRANSITION_PRIORITIES[kind];
  const color = toFamily === 'water' ? TRANSITION_COLOURS.water : TRANSITION_COLOURS[toFamily];
  const availableSpriteFrame = AVAILABLE_TRANSITION_FRAMES[id];
  const resolvedSpriteFrame = availableSpriteFrame ?? spriteFrame;
  const resolvedRenderMode = availableSpriteFrame ? 'replaceBase' : renderMode;
  const resolvedEnabled = availableSpriteFrame ? true : enabled;

  return {
    id,
    fromFamily,
    toFamily,
    kind,
    direction,
    spriteFrame: resolvedSpriteFrame,
    renderMode: resolvedRenderMode,
    fallbackColor: color,
    debugStyle: {
      color,
      alpha: kind === 'edge' || kind === 'shorelineEdge' ? 0.8 : 0.65,
    },
    allowFlipX: false,
    allowFlipY: false,
    transformEdges: false,
    priority,
    enabled: resolvedEnabled,
    canReverse: false,
  };
}
