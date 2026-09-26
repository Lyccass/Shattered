import {describe,expect,it} from 'vitest';
import {forestGroundBakeSignature} from './ForestGroundBakeSignature';
const bounds={drawStartX:8,drawStartY:8,drawEndX:18,drawEndY:18};
describe('ground bake invalidation',()=>{
 it('invalidates on a neighbour edit that affects rounded transitions',()=>{
  const original=forestGroundBakeSignature(bounds,()=> 'forest_grass_1');
  const changed=forestGroundBakeSignature(bounds,(x,y)=>x===6&&y===8?'forest_sand_1':'forest_grass_1');
  expect(changed).not.toBe(original);
 });
 it('does not invalidate for edits beyond the sampling halo',()=>{
  expect(forestGroundBakeSignature(bounds,(x,y)=>x===5&&y===8?'forest_sand_1':'forest_grass_1'))
   .toBe(forestGroundBakeSignature(bounds,()=> 'forest_grass_1'));
 });
 it('distinguishes map boundaries from ordinary grass',()=>{
  expect(forestGroundBakeSignature(bounds,(x)=>x===6?null:'forest_grass_1'))
   .not.toBe(forestGroundBakeSignature(bounds,()=> 'forest_grass_1'));
 });
});
