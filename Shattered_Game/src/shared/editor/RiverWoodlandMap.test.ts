import {describe,it,expect} from 'vitest';
import {createRiverWoodlandMap,RIVER_WOODLAND_PLACES} from './RiverWoodlandMap';
import {FOREST_OBJECT_DEFINITIONS} from '../../objects/ForestObjectDefinitions';
import {validateMapDefinition} from '../../world/maps/MapDefinitionValidator';
import {exportEditorMapToMapDefinition} from './EditorMapSerializer';

describe('nine-chunk river woodland',()=>{
 it('is a valid 96×96 map with distinct landmarks and three walkable river crossings',()=>{
  const map=createRiverWoodlandMap();
  expect([map.width,map.height]).toEqual([96,96]);
  expect(()=>validateMapDefinition(exportEditorMapToMapDefinition(map),FOREST_OBJECT_DEFINITIONS)).not.toThrow();
  for(const id of ['shack','large_bush','lantern_post','direction_sign','bench','supplies','fence_x','fence_y','wooden_gate'])
   expect(map.objects.some(o=>o.definitionId===`forest_${id}`),id).toBe(true);
  const blocked=new Set<string>();
  for(const o of map.objects){
   const def=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId)!;
   if(def.blocksMovement)for(const p of def.collisionFootprint)blocked.add(`${o.tileX+p.x},${o.tileY+p.y}`);
  }
  const visited=new Set(['4,4']),queue=[[4,4]];
  for(let i=0;i<queue.length;i++){
   const [x,y]=queue[i];
   for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    const key=`${nx},${ny}`;
    if(nx<0||ny<0||nx>=96||ny>=96||visited.has(key)||blocked.has(key)||!map.terrainWalkability[key])continue;
    visited.add(key);queue.push([nx,ny]);
   }
  }
  // All unblocked land belongs to one connected component, not just landmark points.
  const accessible=Object.keys(map.terrainWalkability).filter(k=>map.terrainWalkability[k]&&!blocked.has(k));
  expect(visited.size).toBe(accessible.length);
  for(const place of RIVER_WOODLAND_PLACES)expect(visited.has(`${place.x},${place.y}`),place.name).toBe(true);
  expect(visited.has('40,21')).toBe(true);
  expect(visited.has('34,45')).toBe(true);
  expect(visited.has('40,73')).toBe(true);
  expect(new Set([...visited].map(k=>{const [x,y]=k.split(',').map(Number);return `${Math.floor(x/32)},${Math.floor(y/32)}`})).size).toBe(9);
  for(const o of map.objects){const d=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId)!;
   for(const p of d.collisionFootprint){expect(Math.floor((o.tileX+p.x)/32)).toBe(Math.floor(o.tileX/32));expect(Math.floor((o.tileY+p.y)/32)).toBe(Math.floor(o.tileY/32));}}
  expect(map.terrain.flat().filter(t=>t==='water').length).toBeGreaterThan(200);
 });
 it('grounds the gate in a continuous fence run and adds high ground with cliffs',()=>{
  const map=createRiverWoodlandMap();
  const at=(id:string,x:number,y:number)=>map.objects.some(o=>o.definitionId===`forest_${id}`&&o.tileX===x&&o.tileY===y);
  expect(at('fence_x',12,24)&&at('wooden_gate',14,24)&&at('fence_x',16,24)).toBe(true);
  expect(at('bench',12,23)).toBe(true);
  expect(map.objects.some(o=>o.definitionId==='forest_gate_y')).toBe(false);
  expect(map.objects.some(o=>FOREST_OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId)?.category==='cliff')).toBe(false);
  const modules=Object.entries(map.terrainTiles).filter(([,p])=>p.id==='forest_grass_19');
  expect(modules).toHaveLength(0);
  for(const [key] of modules)expect(map.terrainWalkability[key]).toBe(false);

 });
 it('keeps protected gameplay anchors clear of generated objects and water',()=>{
  const anchors=[{tileX:40,tileY:20},{tileX:17,tileY:43}];
  const map=createRiverWoodlandMap(anchors);
  for(const a of anchors){
   expect(map.terrainWalkability[`${a.tileX},${a.tileY}`]).toBe(true);
   expect(map.objects.some(o=>Math.hypot(o.tileX-a.tileX,o.tileY-a.tileY)<2)).toBe(false);
  }
 });
});
