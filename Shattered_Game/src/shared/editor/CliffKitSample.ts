import {createEditorMap} from './EditorMapTypes';
/** Separate assembly scene; never rewrites the playable woodland. */
export function createCliffKitSample(){
 const map=createEditorMap(28,28,'grass','cliff_kit_sample','Rounded Cliffs — Assembly');
 for(let y=0;y<28;y++)for(let x=0;x<28;x++){
  map.terrainTiles[`${x},${y}`]={id:'forest_grass_1',family:'grass',textureKey:'terrain-forest_grass_1',textureScale:.25,walkable:true,flipX:false,flipY:false};
 }
 const add=(kind:string,height:number,r:number,x:number,y:number)=>map.objects.push({id:`kit_${x}_${y}_${height}`,definitionId:`cliffkit_${kind}_${height}_${r}`,tileX:x,tileY:y});
 const rotations=[1,2,4,8],edges=[3,6,12,9],inner=[14,13,11,7];
 for(const [ox,oy,height] of [[2,4,32],[12,4,64],[5,15,96]]){
  const high=(x:number,y:number)=>{
   // A lobe with an inset creates both convex and concave joins.
   return x>=1&&y>=1&&x<=6&&y<=5&&!(x>=4&&y<=2);
  };
  for(let y=0;y<6;y++)for(let x=0;x<7;x++){
   const mask=(high(x,y)?1:0)+(high(x+1,y)?2:0)+(high(x+1,y+1)?4:0)+(high(x,y+1)?8:0);
   if(!mask)continue;
   if(mask===15)add('fill',height,0,ox+x,oy+y);
   else if(rotations.includes(mask))add('outer',height,rotations.indexOf(mask),ox+x,oy+y);
   else if(edges.includes(mask))add('edge',height,edges.indexOf(mask),ox+x,oy+y);
   else if(inner.includes(mask))add('inner',height,inner.indexOf(mask),ox+x,oy+y);
  }
  // Front approach: its upper landing shares the exposed edge at y + 5.5.
  add('bank',height,2,ox+1,oy+6);
 }
 add('stairs',32,2,19,12);add('stairs',64,2,19,16);add('ramp',96,1,19,20);
 return map;
}
