import {describe,it,expect} from 'vitest';
import {ledgeGrassOpacity} from './ForestLedgeBlend';
describe('cliff grass/terrain compositing',()=>{
 it('feathers only the rear turf strip, retaining the interior',()=>{
  expect(ledgeGrassOpacity(0,140,155,65)).toBe(0);
  expect(ledgeGrassOpacity(16,140,155,65)).toBeCloseTo(.5);
  expect(ledgeGrassOpacity(32,140,155,65)).toBe(1);
 });
 it('keeps stone and shadow faces solid even at the silhouette',()=>{
  expect(ledgeGrassOpacity(0,120,125,116)).toBe(1);
  expect(ledgeGrassOpacity(0,60,65,61)).toBe(1);
 });
});
