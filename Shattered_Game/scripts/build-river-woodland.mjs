import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {createRiverWoodlandMap,RIVER_WOODLAND_PLACES}=await server.ssrLoadModule('/src/shared/editor/RiverWoodlandMap.ts');
 const {createEditorMapFromWorldChunkDefinition,exportEditorMapToWorldChunkDefinition}=await server.ssrLoadModule('/src/shared/editor/EditorChunkAdapter.ts');
 const {serializeEditorMap}=await server.ssrLoadModule('/src/shared/editor/EditorMapSerializer.ts');
 const {validateWorldChunkDefinition}=await server.ssrLoadModule('/src/shared/world/ChunkValidation.ts');
 const {OBJECT_DEFINITIONS}=await server.ssrLoadModule('/src/objects/ObjectDefinitions.ts');
 const {validateWorldManifest}=await server.ssrLoadModule('/src/shared/world/WorldManifestValidation.ts');
 const manifest=JSON.parse(await readFile('data/worlds/the_wake/world.manifest.json','utf8'));
 const refs=manifest.authoredChunks.filter(r=>r.chunkX>=0&&r.chunkX<3&&r.chunkY>=0&&r.chunkY<3);
 if(refs.length!==9)throw new Error('Expected all nine authored chunks before rebuilding.');
 const chunks=await Promise.all(refs.map(r=>readFile(r.path,'utf8').then(JSON.parse)));
 const keep=o=>!o.id.startsWith('painted_world_')&&!o.id.startsWith('river_woodland_');
 const protectedPoints=chunks.flatMap((c,i)=>[...c.resourceLayer.nodes,...(c.npcLayer?.anchors??[]),...c.objectLayer.objects.filter(keep)].map(p=>({tileX:p.tileX+refs[i].chunkX*32,tileY:p.tileY+refs[i].chunkY*32})));
 const world=createRiverWoodlandMap(protectedPoints);
 // Check the playable composition including preserved authored objects and resources.
 const blocked=new Set(),goals=[];
 const allObjects=[...world.objects,...chunks.flatMap((c,i)=>c.objectLayer.objects.filter(keep).map(o=>({...o,tileX:o.tileX+refs[i].chunkX*32,tileY:o.tileY+refs[i].chunkY*32})))];
 for(const o of allObjects){const d=OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId);if(!d)throw new Error('Unknown object '+o.definitionId);
  if(d.blocksMovement)for(const p of d.collisionFootprint)blocked.add(`${o.tileX+p.x},${o.tileY+p.y}`);
 }
 for(const [i,c] of chunks.entries())for(const p of [...c.resourceLayer.nodes,...(c.npcLayer?.anchors??[])]){
  const x=p.tileX+refs[i].chunkX*32,y=p.tileY+refs[i].chunkY*32;goals.push([x,y,p.id]);blocked.add(`${x},${y}`);
 }
 const seen=new Set(['4,4']),queue=[[4,4]];
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
  const k=`${nx},${ny}`;if(nx<0||ny<0||nx>=96||ny>=96||seen.has(k)||blocked.has(k)||!world.terrainWalkability[k])continue;seen.add(k);queue.push([nx,ny]);
 }}
 for(const p of RIVER_WOODLAND_PLACES)goals.push([p.x,p.y,p.name]);
 for(const [x,y,id] of goals)if(![[x,y],[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>seen.has(`${a},${b}`)))throw new Error('Unreachable destination: '+id);
 const pending=[];

 for(let i=0;i<refs.length;i++) {
  const r=refs[i],c=chunks[i],map=createEditorMapFromWorldChunkDefinition(c),ox=r.chunkX*32,oy=r.chunkY*32;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
   map.terrain[y][x]=world.terrain[y+oy][x+ox];
   map.terrainTiles[`${x},${y}`]=world.terrainTiles[`${x+ox},${y+oy}`];
   map.terrainWalkability[`${x},${y}`]=world.terrainWalkability[`${x+ox},${y+oy}`];
  }
  map.objects=[...map.objects.filter(keep),...world.objects.filter(o=>o.tileX>=ox&&o.tileX<ox+32&&o.tileY>=oy&&o.tileY<oy+32).map(o=>({...o,tileX:o.tileX-ox,tileY:o.tileY-oy}))];
  const out=exportEditorMapToWorldChunkDefinition(map,{worldId:c.worldId,regionId:c.regionId,chunkX:r.chunkX,chunkY:r.chunkY});
  const result={...c,terrain:out.terrain,terrainPalette:out.terrainPalette,objectLayer:out.objectLayer,metadata:{...c.metadata,...out.metadata,composition:'river_woodland_v1'}};
  const validation=validateWorldChunkDefinition(result);if(!validation.ok)throw new Error(validation.errors.join('\n'));
  pending.push([r.path,JSON.stringify(result,null,2)+'\n']);
 }
 manifest.bounds={minChunkX:0,minChunkY:0,maxChunkX:2,maxChunkY:2};
 const mv=validateWorldManifest(manifest);if(!mv.ok)throw new Error(mv.errors.join('\n'));
 for(const [path,body] of pending)await writeFile(path,body);
 await writeFile('data/worlds/the_wake/world.manifest.json',JSON.stringify(manifest,null,2)+'\n');
 await writeFile('art/forest-painterly/river-woodland-map.json',serializeEditorMap(createRiverWoodlandMap()));
 console.log(`Built nine chunks (96×96) with ${world.objects.length} scenery placements; preserved gameplay layers.`);
}finally{await server.close();}

// Ground art is a build artifact, never generated while exploring the shipped world.
await import('./bake-forest-ground.mjs');
