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
  grass_to_dirt_edge_xPlus: 'terrain-grassA03',
  grass_to_dirt_edge_xMinus: 'terrain-grassA12',
  grass_to_dirt_edge_yPlus: 'terrain-grassA24',
  grass_to_dirt_edge_yMinus: 'terrain-grassA35',
  grass_to_dirt_outer_corner_xPlusYPlus: 'terrain-grassA04',
  grass_to_dirt_outer_corner_xPlusYMinus: 'terrain-grassA15',
  grass_to_dirt_outer_corner_xMinusYPlus: 'terrain-grassA26',
  grass_to_dirt_outer_corner_xMinusYMinus: 'terrain-grassA37',
  grass_to_dirt_inner_corner_xPlusYPlus: 'terrain-grassA08',
  grass_to_dirt_inner_corner_xPlusYMinus: 'terrain-grassA19',
  grass_to_dirt_inner_corner_xMinusYPlus: 'terrain-grassA30',
  grass_to_dirt_inner_corner_xMinusYMinus: 'terrain-grassA41',

  grass_to_stone_edge_xPlus: 'terrain-grassA06',
  grass_to_stone_edge_xMinus: 'terrain-grassA17',
  grass_to_stone_edge_yPlus: 'terrain-grassA28',
  grass_to_stone_edge_yMinus: 'terrain-grassA39',
  grass_to_stone_outer_corner_xPlusYPlus: 'terrain-grassA10',
  grass_to_stone_outer_corner_xPlusYMinus: 'terrain-grassA21',
  grass_to_stone_outer_corner_xMinusYPlus: 'terrain-grassA32',
  grass_to_stone_outer_corner_xMinusYMinus: 'terrain-grassA43',
  grass_to_stone_inner_corner_xPlusYPlus: 'terrain-grassA11',
  grass_to_stone_inner_corner_xPlusYMinus: 'terrain-grassA22',
  grass_to_stone_inner_corner_xMinusYPlus: 'terrain-grassA33',
  grass_to_stone_inner_corner_xMinusYMinus: 'terrain-grassA44',

  ...createWaterShorelineFrameMap('grass'),
  ...createWaterShorelineFrameMap('dirt'),
  ...createWaterShorelineFrameMap('stone'),
};

export const TERRAIN_TRANSITION_DEFINITIONS: TerrainTransitionDefinition[] = [
  ...createFamilyTransitionSet('grass', 'dirt'),
  ...createFamilyTransitionSet('grass', 'stone'),
  ...createFamilyTransitionSet('stone', 'dirt'),
  ...createFamilyTransitionSet('dirt', 'stone'),
  ...createShorelineSet('grass'),
  ...createShorelineSet('dirt'),
  ...createShorelineSet('stone'),
  ...createWaterShorelineSet('grass'),
  ...createWaterShorelineSet('dirt'),
  ...createWaterShorelineSet('stone'),
  createSlopePlaceholder('slope_up_x', 'slopeUpX', 'xAxis'),
  createSlopePlaceholder('slope_up_y', 'slopeUpY', 'yAxis'),
];

function createWaterShorelineFrameMap(
  toFamily: Exclude<RenderTerrainFamily, 'water'>,
): Record<string, string> {
  const waterFrame = 'terrain-waterA';

  return {
    [`water_to_${toFamily}_shoreline_edge_xMinus`]: waterFrame,
    [`water_to_${toFamily}_shoreline_edge_yMinus`]: waterFrame,
    [`water_to_${toFamily}_shoreline_edge_xPlus`]: waterFrame,
    [`water_to_${toFamily}_shoreline_edge_yPlus`]: waterFrame,

    [`water_to_${toFamily}_shoreline_corner_xMinusYMinus`]: waterFrame,
    [`water_to_${toFamily}_shoreline_corner_xPlusYMinus`]: waterFrame,
    [`water_to_${toFamily}_shoreline_corner_xMinusYPlus`]: waterFrame,
    [`water_to_${toFamily}_shoreline_corner_xPlusYPlus`]: waterFrame,
  };
}

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

function createWaterShorelineSet(toFamily: Exclude<RenderTerrainFamily, 'water'>): TerrainTransitionDefinition[] {
  return [
    ...ISO_EDGE_KEYS.map((direction) =>
      createTransitionDefinition({
        id: `water_to_${toFamily}_shoreline_edge_${direction}`,
        fromFamily: 'water',
        toFamily,
        kind: 'shorelineEdge',
        direction,
      }),
    ),
    ...ISO_CORNER_KEYS.map((direction) =>
      createTransitionDefinition({
        id: `water_to_${toFamily}_shoreline_corner_${direction}`,
        fromFamily: 'water',
        toFamily,
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
