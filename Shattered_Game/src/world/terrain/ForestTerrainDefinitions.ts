import { createUniformTerrainEdges, type TerrainFamily, type TerrainTileDefinition, type TerrainTransitionDefinition, type ResolvedTerrainTransition } from './TerrainTypes';

export const FOREST_FAMILIES = ['grass', 'dirt', 'stone', 'water', 'sand'] as const;
export const FOREST_DIRECTIONS = [
  { id: 'xPlus', x: 1, y: 0 }, { id: 'yPlus', x: 0, y: 1 },
  { id: 'xMinus', x: -1, y: 0 }, { id: 'yMinus', x: 0, y: -1 },
  { id: 'xPlusYPlus', x: 1, y: 1 }, { id: 'xPlusYMinus', x: 1, y: -1 },
  { id: 'xMinusYPlus', x: -1, y: 1 }, { id: 'xMinusYMinus', x: -1, y: -1 },
] as const;

// Explicit editor choices: zero weight keeps the new pack out of existing worlds.
export const FOREST_TERRAIN_DEFINITIONS: TerrainTileDefinition[] = FOREST_FAMILIES.flatMap(family =>
  Array.from({ length: family==='grass'?19:4 }, (_, i) => ({
    id: `forest_${family}_${i + 1}`, family, role: 'full' as const,
    spriteFrame: `terrain-forest_${family}_${i + 1}`, weight: 0,
    walkable: family !== 'water' && !(family==='grass' && i===18), edges: createUniformTerrainEdges(family),
    allowFlipX: false, allowFlipY: false, allowRotation: false as const,
  })),
);

// Dirt follows the same relief field as grass, so elevated paths do not cut trenches.
FOREST_TERRAIN_DEFINITIONS.push(...Array.from({length:10},(_,i)=>({
 id:`forest_dirt_${i+9}`,family:'dirt' as const,role:'full' as const,
 spriteFrame:`terrain-forest_dirt_${i+9}`,weight:0,walkable:true,
 edges:createUniformTerrainEdges('dirt'),allowFlipX:false,allowFlipY:false,allowRotation:false as const,
})));

export const FOREST_OVERLAY_ASSETS = FOREST_FAMILIES.flatMap(family =>
  FOREST_DIRECTIONS.map(direction => `forest_blend_${family}_${direction.id}`),
);

export function isForestTerrain(id: string): boolean {
  return /^forest_(grass_(?:[1-9]|1[0-9])|dirt_(?:[1-4]|9|1[0-8])|(?:stone|water|sand)_[1-4])$/.test(id);
}

// Only the lower-priority material owns the seam. Land is painted over water
// on shoreline tiles so water's collision boundary stays on the authored grid.
const PRIORITY = { water: 0, sand: .5, grass: 1, dirt: 2, stone: 3 };
export function resolveForestTransitions(
  family: TerrainFamily, x: number, y: number,
  sample: (x: number, y: number) => TerrainFamily | null,
): ResolvedTerrainTransition[] {
  const from = family;
  return FOREST_DIRECTIONS.flatMap(direction => {
    const sampled = sample(x + direction.x, y + direction.y);
    if (!sampled) return [];
    const to = sampled;
    if (PRIORITY[to] <= PRIORITY[from]) return [];
    const corner = direction.x !== 0 && direction.y !== 0;
    // Diagonal patches are needed only when no adjacent edge already covers them.
    if (corner && [sample(x + direction.x, y), sample(x, y + direction.y)]
      .some(value => value && PRIORITY[value] >= PRIORITY[to])) return [];
    const definition: TerrainTransitionDefinition = {
      id: `forest_${from}_${to}_${direction.id}`, fromFamily: from, toFamily: to,
      kind: corner ? 'innerCorner' : 'edge', direction: direction.id,
      spriteFrame: `terrain-forest_blend_${to}_${direction.id}`, renderMode: 'overlay',
      fallbackColor: 0, debugStyle: { color: 0, alpha: 0 },
      allowFlipX: false, allowFlipY: false, transformEdges: false,
      priority: PRIORITY[to], enabled: true, canReverse: false,
    };
    return [{ definition, transform: { flipX: false, flipY: false, rotation: 0 as const, scale:.25 } }];
  }).sort((a,b) => a.definition.priority - b.definition.priority);
}

export const FOREST_BRUSH_LABELS: Record<string,string> = {
  forest_sand_1:'Beach Sand', forest_sand_2:'Beach Sand II',
  forest_sand_3:'Beach Sand III', forest_sand_4:'Beach Sand IV',
  forest_grass_5:'Moss Carpet', forest_grass_6:'Fallen Leaves',
  forest_grass_7:'Woodland Twigs', forest_grass_8:'Pebbled Grass',
  forest_grass_9:'Hill Foot', forest_grass_10:'Lower Slope',
  forest_grass_11:'Hill Shoulder', forest_grass_12:'Hill Crest',
  forest_grass_15:'Highland Foot', forest_grass_16:'Highland Slope',
  forest_grass_17:'Highland Shoulder', forest_grass_18:'High Plateau',
  forest_grass_19:'Cliff Plateau Module (blocked)',
  forest_grass_13:'Shallow Hollow', forest_grass_14:'Gentle Rise',
};

for(const [tier,label] of [[9,"Path foot"],[10,"Path lower slope"],[11,"Path shoulder"],[12,"Path crest"],[13,"Path hollow"],[14,"Path gentle rise"],[15,"Path highland foot"],[16,"Path highland slope"],[17,"Path highland shoulder"],[18,"Path upper landing"]] as const)FOREST_BRUSH_LABELS[`forest_dirt_${tier}`]=label;
