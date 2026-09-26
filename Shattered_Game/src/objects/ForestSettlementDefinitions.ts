import type { ObjectDefinition } from './ObjectTypes';

const props = [
 ['shack','Moss-roof Woodland Shack','building',4,3],
 ['lantern_post','Woodland Lantern Post','decoration',1,1],
 ['direction_sign','Wooden Direction Sign','decoration',1,1],
 ['large_bush','Broad Woodland Bush','foliage',2,2],
 ['fence_x','Timber Fence X','fence',2,1],
 ['fence_y','Timber Fence Y','fence',1,2],
 ['wooden_gate','Closed Timber Gate X (Scenery)','fence',2,1],
 ['gate_y','Closed Timber Gate Y (Scenery)','fence',1,2],
 ['bench','Woodland Bench','crafted',2,1],
 ['supplies','Barrels and Crates','crafted',1,1],
] as const;

export const FOREST_SETTLEMENT_ASSETS = props.map(([id]) => ({
 key:`object-forest_${id}`,path:`/assets/forest-painterly/forest_${id}.png`,
}));
export const FOREST_SETTLEMENT_DEFINITIONS: ObjectDefinition[] = props.map(([id,displayName,category,width,height]) => ({
 id:`forest_${id}`,displayName,category,
 collisionFootprint:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width)})),
 blocksMovement:category!=='foliage',
 visual:{parts:[{shape:'sprite',textureKey:`object-forest_${id}`,scale:.5,originX:.5,originY:1,
  localOffsetX:(width-height)*16,localOffsetY:(width+height-2)*8+10}]},
 shadow:{enabled:true,localOffsetX:(width-height)*16+8,localOffsetY:(width+height-2)*8+8,
  width:id==='shack'?170:id==='large_bush'?80:width+height>2?58:30,height:id==='shack'?42:16,alpha:.18},
 depth:{anchorMode:'frontTileCenter',localOffsetX:0,localOffsetY:0,depthOffset:.1},
 debug:{color:0x89935a},
}));
