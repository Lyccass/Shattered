import { getForestVisualVariation } from '../../objects/ForestVisualVariation';
import { createEditorMap } from './EditorMapTypes';
import { FOREST_OBJECT_DEFINITIONS } from '../../objects/ForestObjectDefinitions';

/** Compact assembly sheet: welded terrain, soft relief, cliff joins and coastal props. */
export function createCoastalForestSample(){
 const map=createEditorMap(24,24,'grass','coastal_forest_sample','Painted Coast — Reference Study');
 for(let y=0;y<24;y++)for(let x=0;x<24;x++){
  const shore=18+Math.sin(y*.3)*1.4;
  const path=Math.abs(x-(10+Math.sin(y*.25)*3))<1.1;
  const family=x>shore?'water':x>shore-2?'sand':path?'dirt':'grass';
  const hill=Math.min(Math.hypot((x-5)/1.1,y-6),Math.hypot(x-14,(y-5)/1.2));
  const n=family==='grass'&&hill<6?(hill<2?16:hill<3?15:hill<4?12:10):1+(x*3+y*7)%4;
  const id=`forest_${family}_${n}`,walkable=family!=='water';
  map.terrain[y][x]=family;map.terrainWalkability[`${x},${y}`]=walkable;
  map.terrainTiles[`${x},${y}`]={id,family,textureKey:`terrain-${id}`,textureScale:.25,walkable,flipX:false,flipY:false};
 }
 const occupied=new Set<string>();
 const add=(name:string,x:number,y:number)=>{
  const d=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===`forest_${name}`)!;
  const cells=d.collisionFootprint.map(p=>`${x+p.x},${y+p.y}`);
  if(cells.some(k=>occupied.has(k)))return;
  cells.forEach(k=>occupied.add(k));
  let id=`coast_${name}_${x}_${y}`;
  if(d.category==='tree'){
   const target=name==='tall_burgundy_oak'?.65:1;
   for(let i=0;i<100;i++){const candidate=`coast_${name}_${x}_${y}_${i}`;
    if(Math.abs(getForestVisualVariation(candidate,d).height-target)<.08){id=candidate;break;}}
  }
  map.objects.push({id,definitionId:d.id,tileX:x,tileY:y});
 };
 // A continuous X run and return, with a matching corner and separate stairs.
 for(const x of [11,13,15])add('coast_cliff_x',x,8);
 add('coast_cliff_corner',17,7);
 for(const y of [3,5])add('coast_cliff_y',18,y);
 add('coast_stairs_x',14,10);
 for(const [id,x,y] of [['tall_oak',4,5],['young_oak',7,3],['tall_golden_birch',14,3],['tall_burgundy_oak',16,2],['tall_oak',4,15],['young_oak',8,17],['tall_oak',11,20]] as const)add(id,x,y);
 add('lantern_post',10,14);add('direction_sign',11,17);add('supplies',10,6);
 for(const [x,y] of [[3,8],[6,10],[4,18],[15,14],[14,18]])add('boulder',x,y);
 for(let y=2;y<23;y+=2)for(let x=2;x<18;x+=2){
  if(map.terrain[y][x]==='grass'&&Math.abs(x-(10+Math.sin(y*.25)*3))>1.8)
   add((x+y)%6===0?'coast_flowers':(x+y)%4===0?'flowers_cream':'ferns',x,y);
 }
 for(const [x,y] of [[18,2],[18,7],[16,14],[16,18],[18,22]])add('coast_reeds',x,y);
 return map;
}
