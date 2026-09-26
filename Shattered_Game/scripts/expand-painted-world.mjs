// Author through the editor model and chunk serializer; preserve gameplay layers.
import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {createEditorMapFromWorldChunkDefinition,exportEditorMapToWorldChunkDefinition}=await server.ssrLoadModule('/src/shared/editor/EditorChunkAdapter.ts');
 const {validateWorldChunkDefinition}=await server.ssrLoadModule('/src/shared/world/ChunkValidation.ts');
 const manifest=JSON.parse(await readFile('data/worlds/the_wake/world.manifest.json','utf8'));
 let added=0;
 for(const ref of manifest.authoredChunks) {
  const chunk=JSON.parse(await readFile(ref.path,'utf8'));
  if(chunk.metadata?.composition==='river_woodland_v1')continue;
  const map=createEditorMapFromWorldChunkDefinition(chunk);
  const protectedPoints=[...chunk.resourceLayer.nodes,...(chunk.npcLayer?.anchors??[]),...chunk.objectLayer.objects.filter(o=>!o.id.startsWith('painted_world_')),{tileX:4,tileY:4}];
  const nearAnchor=(x,y)=>protectedPoints.some(p=>Math.hypot(p.tileX-x,p.tileY-y)<3);
  const route=(x,y)=>Math.abs(y-(16+Math.sin(x*.065)*5))<2||Math.abs(x-(18+Math.sin(y*.06)*5))<2;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
   const gx=x+ref.chunkX*32,gy=y+ref.chunkY*32,key=`${x},${y}`;
   let family=map.terrain[y][x];
   if((ref.chunkX||ref.chunkY)&&!nearAnchor(x,y)) {
    const shore=73+Math.sin(gx*.075)*5;
    family=gy>shore?'water':gy>shore-4?'sand':route(gx,gy)?'dirt':'grass';
    if(gx>=43&&gx<=51&&gy>=34&&gy<=42)family='stone';
   }
   let variant=1+(gx*3+gy*7)%4;
   if(family==='grass') {
    const d=Math.min(Math.hypot((gx-35)/1.4,gy-38),Math.hypot(gx-65,(gy-51)/1.3));
    if(d<2)variant=12;else if(d<4)variant=11;else if(d<6)variant=10;else if(d<8)variant=9;
    else if((Math.floor(gx/9)+Math.floor(gy/11))%4===0)variant=5+(gx+gy)%4;
   }
   const walkable=family==='water'?false:family===map.terrain[y][x]?(map.terrainWalkability[key]??true):true;
   map.terrain[y][x]=family;map.terrainWalkability[key]=walkable;
   const id=`forest_${family}_${variant}`;
   map.terrainTiles[key]={id,family,textureKey:`terrain-${id}`,textureScale:.25,walkable,flipX:false,flipY:false};
  }
  map.objects=map.objects.filter(o=>!o.id.startsWith('painted_world_')).map(o=>({...o,
   definitionId:/^tree_/.test(o.definitionId)?'forest_tall_oak':o.definitionId==='small_rock'?'forest_rocks':o.definitionId==='large_rock'?'forest_boulder':o.definitionId}));
  const trees=['tall_oak','tall_birch','tall_beech','tall_golden_birch','tall_copper_beech','tall_burgundy_oak'];
  const scatter=['ferns','mushrooms_red','flowers_cream','twigs','leaf_litter','pebble_scatter','mushrooms_gold','flowers_lavender'];
  const place=(name,x,y)=>{map.objects.push({id:`painted_world_${ref.chunkX}_${ref.chunkY}_${x}_${y}`,definitionId:`forest_${name}`,tileX:x,tileY:y});added++;};
  for(let y=3;y<29;y+=4)for(let x=3;x<29;x+=4) {
   const gx=x+ref.chunkX*32,gy=y+ref.chunkY*32;
   if(nearAnchor(x,y)||map.terrain[y][x]!=='grass'||!map.terrainWalkability[`${x},${y}`]||route(gx,gy))continue;
   const seed=(gx*31+gy*17)%19;
   place(seed<7?trees[seed%trees.length]:scatter[seed%scatter.length],x,y);
  }
  // Small irregular understory clusters, leaving paths and interaction anchors clear.
  const beds=['fern_bed','woodland_litter','flower_patch','mushroom_bed','rock_garden','branch_bed'];
  for(let y=2;y<30;y+=2)for(let x=2;x<30;x+=2) {
   const gx=x+ref.chunkX*32,gy=y+ref.chunkY*32;
   const seed=((gx*73856093)^(gy*19349663))>>>0;
   if(seed%5>1||nearAnchor(x,y)||map.terrain[y][x]!=='grass'||route(gx,gy))continue;
   if(map.objects.some(o=>o.tileX===x&&o.tileY===y))continue;
   place(beds[(seed>>>8)%beds.length],x,y);
  }
  if(ref.chunkX===1&&ref.chunkY===1) {
   for(const [name,x,y] of [['wall_x',12,3],['wall_x',14,3],['wall_y',12,4],['wall_corner',17,8],['stump',18,11]]) {
    if(!nearAnchor(x,y))place(name,x,y);
   }
  }
  const exported=exportEditorMapToWorldChunkDefinition(map,{worldId:chunk.worldId,regionId:chunk.regionId,chunkX:ref.chunkX,chunkY:ref.chunkY});
  const result={...chunk,terrain:exported.terrain,terrainPalette:exported.terrainPalette,objectLayer:exported.objectLayer,metadata:{...chunk.metadata,...exported.metadata,paintedForestVersion:1}};
  const validation=validateWorldChunkDefinition(result);if(!validation.ok)throw new Error(validation.errors.join('\n'));
  await writeFile(ref.path,JSON.stringify(result,null,2)+'\n');
 }
 console.log(`Expanded ${manifest.authoredChunks.length} chunks; placed ${added} scenery objects. Gameplay layers preserved.`);
} finally {await server.close();}
