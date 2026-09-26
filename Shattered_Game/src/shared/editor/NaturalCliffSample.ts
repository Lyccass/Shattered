import {createEditorMap} from './EditorMapTypes';
/** Natural formations built from independently placeable painted overlap modules. */
export function createNaturalCliffSample(){
 const map=createEditorMap(22,22,'grass','natural_cliffs_v4','Natural Cliffs — Woodland Rise');
 for(let y=0;y<22;y++)for(let x=0;x<22;x++){
  const center=11+Math.sin(y*.31)*2.3;
  const path=Math.abs(x-center)<1.1;
  const ease=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const elevation=72*ease((16-y)/10)*ease((x-1)/4)*ease((21-x)/4)*ease(y/3);
  const tiers=[[9,4],[10,8],[11,14],[12,22],[15,30],[16,42],[17,56],[18,72]];
  const relief=tiers.reduce((best,t)=>Math.abs(t[1]-elevation)<Math.abs(best[1]-elevation)?t:best)[0];
  const family=path?'dirt':'grass';
  const variant=relief;
  const id=`forest_${family}_${variant}`;
  map.terrain[y][x]=family;
  map.terrainTiles[`${x},${y}`]={id,family,textureKey:`terrain-${id}`,textureScale:.25,walkable:true,flipX:false,flipY:false};
 }
 const add=(definitionId:string,x:number,y:number)=>map.objects.push({id:`natural_${definitionId}_${x}_${y}`,definitionId,tileX:x,tileY:y});
 // Unequal modules overlap at low end rocks, stepping around the route rather
 // than forming a rectangular retaining wall. The rise occupies the bend.
 add('natural_cliff_columns_high_left',4,5);
 add('natural_cliff_shoulder_medium_left',3,8);
 add('natural_cliff_columns_medium_right',6,9);
 add('natural_cliff_shoulder_low_right',8,10);
 // The ascent is the continuous terrain/path field, not a detached sprite.
 add('natural_cliff_columns_high_right',15,6);
 add('natural_cliff_shoulder_medium_right',15,9);
 add('natural_cliff_columns_low_left',17,12);
 add('natural_cliff_shoulder_low_left',5,15);
 add('natural_cliff_columns_medium_left',7,16);
 for(const [name,x,y] of [
  ['young_oak',3,4],['tall_golden_birch',17,4],['young_oak',4,14],
  ['large_bush',3,10],['ferns',9,11],['ferns',15,13],['rocks',6,13],
  ['flowers_cream',8,12],['flowers_lavender',14,15],['mushrooms_red',4,12],
  ['pebble_scatter',12,16],['leaf_litter',10,14],['flowers_cream',16,12],
 ] as const)add(`forest_${name}`,x,y);
 return map;
}
