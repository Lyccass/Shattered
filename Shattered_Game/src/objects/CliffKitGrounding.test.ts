import {describe,it,expect} from 'vitest';
import {cliffGrounding} from './CliffKitGrounding';
import {FOREST_OBJECT_ASSETS} from './ForestObjectDefinitions';
describe('cliff ground transitions',()=>{
 it('keeps climbs and plateau interiors clear',()=>{
  for(const kind of ['bank','ramp','stairs','fill','summit'])expect(cliffGrounding(kind,0,64)).toEqual([]);
 });
 it('uses loaded forest artwork at ground level on exposed faces',()=>{
  const keys=new Set(FOREST_OBJECT_ASSETS.map(a=>a.key));
  const parts=cliffGrounding('outer',0,96);
  expect(parts.some(p=>p.shape==='sprite'&&p.textureKey==='object-forest_large_bush')).toBe(true);
  for(const p of parts){expect(p.shape).toBe('sprite');if(p.shape==='sprite')expect(keys.has(p.textureKey)).toBe(true);expect(p.localOffsetY).toBeGreaterThan(-16);}
  expect(cliffGrounding('outer',2,96)).toEqual([]);
 });
});
