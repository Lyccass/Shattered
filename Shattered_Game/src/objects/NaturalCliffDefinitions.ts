import type {ObjectDefinition} from './ObjectTypes';

/** Painted overlap modules: preserve the natural silhouette; never stretch a face. */
export const NATURAL_CLIFF_ASSETS=['columns','shoulder','ascent'].map(name=>({
 key:`natural-cliff-${name}`,path:`/assets/forest-painterly/natural-cliffs/${name}.png`,
}));
export const NATURAL_CLIFF_DEFINITIONS:ObjectDefinition[]=[];
for(const kind of ['columns','shoulder','ascent'] as const){
 for(const tier of ['low','medium','high'] as const)for(const facing of ['left','right'] as const){
  const size=tier==='low'?2:tier==='medium'?3:4;
  const width=size*64;
  NATURAL_CLIFF_DEFINITIONS.push({
   id:`natural_cliff_${kind}_${tier}_${facing}`,displayName:`Natural Cliff · ${kind} · ${tier} · ${facing}`,
   category:'natural-cliff',blocksMovement:true,
   collisionFootprint:Array.from({length:size*size},(_,i)=>({x:i%size,y:Math.floor(i/size)})),
   visual:{parts:[{shape:'sprite',textureKey:`natural-cliff-${kind}`,scale:width/(kind==='ascent'?1792:1536),
    originX:.5,originY:.87,localOffsetX:0,localOffsetY:(size-1)*16,
    flipX:facing==='right'}]},
   shadow:{enabled:false,localOffsetX:0,localOffsetY:0,width:0,height:0,alpha:0},
   depth:{anchorMode:'frontTileCenter',localOffsetX:0,localOffsetY:0,depthOffset:.1},debug:{color:0x81904e},
  });
 }
}
