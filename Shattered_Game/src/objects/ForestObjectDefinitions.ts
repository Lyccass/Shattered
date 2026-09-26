import {NATURAL_CLIFF_ASSETS,NATURAL_CLIFF_DEFINITIONS} from './NaturalCliffDefinitions';
import { SOURCE_FALLS_ASSETS, SOURCE_FALLS_DEFINITIONS } from './SourceFallsDefinitions';
import { CLIFF_KIT_ASSETS, CLIFF_KIT_DEFINITIONS } from './CliffKitDefinitions';
import { FOREST_COASTAL_ASSETS, FOREST_COASTAL_DEFINITIONS } from './ForestCoastalDefinitions';
import { FOREST_SETTLEMENT_ASSETS, FOREST_SETTLEMENT_DEFINITIONS } from './ForestSettlementDefinitions';
import { FOREST_GROUND_DETAILS } from './ForestGroundDetails';
import { FOREST_WALL_FEET } from './ForestWallGrounding';
import type { ObjectDefinition, VisualPart } from './ObjectTypes';

const props = [
  ['tall_golden_birch','Golden Birch','tree',1,1],
  ['tall_copper_beech','Copper Beech','tree',1,1],
  ['tall_burgundy_oak','Burgundy Oak','tree',1,1],
  ['mushrooms_red','Redcap Mushrooms','foliage',1,1],
  ['mushrooms_gold','Golden Chanterelles','foliage',1,1],
  ['mushrooms_lavender','Lavender Mushrooms','foliage',1,1],
  ['fallen_branch','Fallen Branch','foliage',1,1],
  ['twigs','Twig Scatter','foliage',1,1],
  ['pebble_scatter','Small Stone Scatter','foliage',1,1],
  ['leaf_litter','Oak Leaf Litter','foliage',1,1],
  ['flowers_cream','Cream Woodland Flowers','foliage',1,1],
  ['flowers_lavender','Lavender Woodland Flowers','foliage',1,1],
  ['oak', 'Painted Oak', 'tree', 1, 1],
  ['tall_oak', 'Tall Woodland Oak', 'tree', 1, 1],
  ['tall_birch', 'Tall Silver Birch', 'tree', 1, 1],
  ['tall_beech', 'Tall Beech', 'tree', 1, 1],
  ['ancient_oak', 'Ancient High Oak', 'tree', 2, 2],
  ['young_oak', 'Painted Young Oak', 'tree', 1, 1],
  ['boulder', 'Moss Boulder', 'rock', 1, 1],
  ['ferns', 'Forest Ferns', 'foliage', 1, 1],
  ['stump', 'Old Oak Stump', 'rock', 1, 1],
  ['rocks', 'Moss Stones', 'rock', 1, 1],
  ['cliff_low', 'Low Cliff', 'cliff', 2, 2],
  ['cliff_high', 'High Cliff', 'cliff', 2, 2],
  ['ramp', 'Cliff Ramp (Scenery)', 'cliff', 2, 2],
  ['wall_x', 'Moss Wall X', 'wall', 2, 1],
  ['wall_y', 'Moss Wall Y', 'wall', 1, 2],
  ['wall_corner', 'Moss Wall Corner', 'wall', 2, 2],
  ['hill_low', 'Legacy Rounded Hill (Scenery)', 'hill', 2, 2],
  ['hill_rolling', 'Legacy Rolling Knoll (Scenery)', 'hill', 3, 3],
  ['slope_x', 'Legacy Soft Slope X (Scenery)', 'hill', 2, 2],
  ['slope_y', 'Legacy Soft Slope Y (Scenery)', 'hill', 2, 2],
] as const;

export const FOREST_OBJECT_ASSETS = props.map(([id]) => ({
  key: `object-forest_${id}`, path: `/assets/forest-painterly/forest_${id}.png`,
}));

export const FOREST_OBJECT_DEFINITIONS: ObjectDefinition[] = props.map(([id, displayName, category, width, height]) => ({
  id: `forest_${id}`, displayName, category,
  collisionFootprint: Array.from({length: width * height}, (_, i) => ({x: i % width, y: Math.floor(i / width)})),
  blocksMovement: category !== 'foliage',
  visual: { parts: [{
    shape: 'sprite', textureKey: `object-forest_${id}`, scale: .5,
    originX: .5, originY: 1,
    localOffsetX: (width-height)*16,
    localOffsetY: (width+height-2)*8 + (category === 'tree' ? 5 : 14),
  }, ...(FOREST_WALL_FEET[`forest_${id}`] ?? []).map(([x,y],i): VisualPart => ({
    shape:'sprite', textureKey:i%3===1?'object-forest_rocks':'object-forest_ferns',
    scale:i%3===1?.1:.14, originX:.5, originY:1,
    localOffsetX:x,localOffsetY:y+3,flipX:i%2===1,
  }))] },
  shadow: {enabled:category==='tree'||category==='rock'||category==='wall',localOffsetX:category==='tree'?24:8,
    localOffsetY:category==='tree'?10:10,width:id==='ancient_oak'?156:id.startsWith('tall_')?128:id==='oak'?122:category==='tree'?88:42,
    height:category==='tree'?42:14,alpha:category==='tree'?.28:.2},
  depth: {anchorMode:'frontTileCenter',localOffsetX:0,localOffsetY:0,depthOffset:.1},
  debug: {color:0x94bd55},
}));

FOREST_OBJECT_ASSETS.push(...FOREST_SETTLEMENT_ASSETS, ...CLIFF_KIT_ASSETS, ...FOREST_COASTAL_ASSETS);
FOREST_OBJECT_DEFINITIONS.push(...FOREST_GROUND_DETAILS, ...FOREST_SETTLEMENT_DEFINITIONS, ...CLIFF_KIT_DEFINITIONS, ...FOREST_COASTAL_DEFINITIONS);

FOREST_OBJECT_ASSETS.push(...NATURAL_CLIFF_ASSETS);
FOREST_OBJECT_DEFINITIONS.push(...NATURAL_CLIFF_DEFINITIONS);
FOREST_OBJECT_ASSETS.push(...SOURCE_FALLS_ASSETS);
FOREST_OBJECT_DEFINITIONS.push(...SOURCE_FALLS_DEFINITIONS);
