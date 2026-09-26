import {describe,it,expect} from 'vitest';
import {createNaturalCliffSample} from './NaturalCliffSample';
import {FOREST_OBJECT_DEFINITIONS} from '../../objects/ForestObjectDefinitions';
import {NATURAL_CLIFF_DEFINITIONS} from '../../objects/NaturalCliffDefinitions';
describe('natural cliff assembly',()=>{
 it('uses registered modules inside the sample bounds, without old extruded ramps',()=>{
  const sample=createNaturalCliffSample();
  const defs=new Map(FOREST_OBJECT_DEFINITIONS.map(d=>[d.id,d]));
  expect(new Set(sample.objects.map(o=>o.id)).size).toBe(sample.objects.length);
  for(const o of sample.objects){
   expect(o.definitionId.startsWith('cliffkit_')).toBe(false);
   const d=defs.get(o.definitionId);expect(d).toBeDefined();
   for(const p of d!.collisionFootprint){expect(o.tileX+p.x).toBeLessThan(sample.width);expect(o.tileY+p.y).toBeLessThan(sample.height);}
  }
 });
 it('offers independent formations, shoulders and ascents in three sizes and two facings',()=>{
  expect(NATURAL_CLIFF_DEFINITIONS).toHaveLength(18);
  expect(new Set(NATURAL_CLIFF_DEFINITIONS.map(d=>d.id)).size).toBe(18);
  for(const d of NATURAL_CLIFF_DEFINITIONS){expect(d.visual.parts).toHaveLength(1);expect(d.blocksMovement).toBe(true);}
 });
});
