import {describe,it,expect} from 'vitest';
import {forestSurfaceHeight,blendedForestSurfaceHeight} from './ForestRelief';
import {createNaturalCliffSample} from '../editor/NaturalCliffSample';
describe('continuous elevated forest path',()=>{
 it('keeps dirt and grass at identical heights at each relief tier',()=>{
  for(let tier=9;tier<=18;tier++)for(const [x,y] of [[3.4,5.2],[10,12],[17.6,4.1]]){
   expect(forestSurfaceHeight(x,y,`forest_dirt_${tier}`)).toBe(forestSurfaceHeight(x,y,`forest_grass_${tier}`));
  }
 });
 it('has a connected terrain path rising to an upper landing without a path sprite',()=>{
  const map=createNaturalCliffSample();
  expect(map.objects.some(o=>o.definitionId.includes('_ascent_'))).toBe(false);
  const sample=(x:number,y:number)=>map.terrainTiles[`${x},${y}`]?.id??null;
  expect(blendedForestSurfaceHeight(12,5,sample)-blendedForestSurfaceHeight(10,17,sample)).toBeGreaterThan(45);
  const seen=new Set<string>(),queue=[[11,0]];
  while(queue.length){const [x,y]=queue.pop()!,key=`${x},${y}`;
   if(seen.has(key)||map.terrain[y]?.[x]!=='dirt')continue;seen.add(key);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);
  }
  expect([...seen].some(k=>k.endsWith(',21'))).toBe(true);
 });
});
