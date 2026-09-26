import type { ObjectDefinition, SpriteVisualPart } from './ObjectTypes';

// Placeable arrangements reuse the approved artwork without new texture loads.
// Each is a single nonblocking placement with three small, layered details.
const arrangements: Array<[string,string,Array<[string,number,number,number]>]> = [
  ['fern_bed','Low Fern Bed',[['ferns',-13,0,.21],['ferns',13,6,.17],['leaf_litter',0,10,.23]]],
  ['woodland_litter','Woodland Litter',[['leaf_litter',-12,2,.32],['twigs',10,7,.32],['pebble_scatter',-2,12,.21]]],
  ['flower_patch','Wildflower Patch',[['flowers_cream',-12,0,.35],['flowers_lavender',11,7,.3],['ferns',0,10,.13]]],
  ['mushroom_bed','Mushroom Bed',[['leaf_litter',0,10,.32],['mushrooms_red',-9,3,.35],['mushrooms_gold',11,7,.3]]],
  ['rock_garden','Mossy Pebble Bed',[['pebble_scatter',-10,4,.35],['rocks',11,5,.15],['ferns',2,11,.15]]],
  ['branch_bed','Fallen Branch Bed',[['leaf_litter',-10,10,.3],['fallen_branch',0,3,.32],['mushrooms_lavender',15,10,.25]]],
];
export const FOREST_GROUND_DETAILS: ObjectDefinition[] = arrangements.map(([id,name,parts])=>({
  id:`forest_${id}`,displayName:name,category:'foliage',
  collisionFootprint:[{x:0,y:0}],blocksMovement:false,
  visual:{parts:parts.map(([texture,x,y,scale],i):SpriteVisualPart=>({
    shape:'sprite',textureKey:`object-forest_${texture}`,scale,originX:.5,originY:1,
    localOffsetX:x,localOffsetY:y,flipX:i%2===1,
  }))},
  shadow:{enabled:false,localOffsetX:0,localOffsetY:0,width:0,height:0,alpha:0},
  depth:{anchorMode:'frontTileCenter',localOffsetX:0,localOffsetY:0,depthOffset:.1},
  debug:{color:0x94bd55},
}));
