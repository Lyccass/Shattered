import type { ObjectDefinition } from './ObjectTypes';
const props=[
 ['coast_cliff_x','Coastal Cliff — X','cliff',2,1],
 ['coast_cliff_y','Coastal Cliff — Y','cliff',1,2],
 ['coast_cliff_corner','Coastal Cliff — Corner','cliff',2,2],
 ['coast_stairs_x','Moss Stone Stairs X (Scenery)','cliff',3,2],
 ['coast_stairs_y','Moss Stone Stairs Y (Scenery)','cliff',2,3],
 ['coast_reeds','Coastal Cattails','foliage',1,1],
 ['coast_flowers','Flowering Stone Detail','foliage',1,1],
] as const;
export const FOREST_COASTAL_ASSETS=props.map(([id])=>({key:`object-forest_${id}`,path:`/assets/forest-painterly/forest_${id}.png`}));
export const FOREST_COASTAL_DEFINITIONS:ObjectDefinition[]=props.map(([id,displayName,category,w,h])=>({
 id:`forest_${id}`,displayName,category,blocksMovement:category==='cliff',
 collisionFootprint:Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w)})),
 visual:{parts:[{shape:'sprite',textureKey:`object-forest_${id}`,scale:.5,originX:.5,originY:1,
 localOffsetX:(w-h)*16,localOffsetY:id.startsWith('coast_cliff_')?(w+h-1)*16:(w+h-2)*8+10}]},
 shadow:{enabled:false,localOffsetX:0,localOffsetY:0,width:0,height:0,alpha:0},
 depth:{anchorMode:'frontTileCenter',localOffsetX:0,localOffsetY:0,depthOffset:.1},debug:{color:0x789758},
}));

// A single painted silhouette avoids repeated stone stamps and cut turf edges.
FOREST_COASTAL_ASSETS.push({key:'object-forest_coast_ledge_painted',path:'/assets/forest-painterly/forest_coast_ledge_painted.png'});
FOREST_COASTAL_DEFINITIONS.push({
 id:'forest_coast_ledge',displayName:'Coastal Cliff — Painted Ledge',category:'cliff',blocksMovement:true,
 collisionFootprint:Array.from({length:16},(_,i)=>({x:i%8,y:Math.floor(i/8)})),
 visual:{parts:[{shape:'sprite',textureKey:'object-forest_coast_ledge_painted',scale:.5,originX:.5,originY:1,localOffsetX:96,localOffsetY:144}]},
 shadow:{enabled:false,localOffsetX:0,localOffsetY:0,width:0,height:0,alpha:0},
 depth:{anchorMode:'frontTileCenter',localOffsetX:0,localOffsetY:0,depthOffset:.1},debug:{color:0x789758},
});

const ledge=FOREST_COASTAL_DEFINITIONS.find(d=>d.id==='forest_coast_ledge')!;
const stairs=FOREST_COASTAL_DEFINITIONS.find(d=>d.id==='forest_coast_stairs_x')!.visual.parts[0];
if(stairs.shape!=='sprite')throw new Error('Coastal stairs must use sprite artwork');
FOREST_COASTAL_DEFINITIONS.push({
 ...ledge,id:'forest_coast_ledge_stairs',displayName:'Coastal Cliff — Ledge with Stairs (Scenery)',
 collisionFootprint:[...ledge.collisionFootprint,...Array.from({length:12},(_,i)=>({x:2+i%3,y:2+Math.floor(i/3)}))],
 visual:{parts:[...ledge.visual.parts,{...stairs,scale:.65,localOffsetX:stairs.localOffsetX-32,localOffsetY:stairs.localOffsetY+112}]},
});
