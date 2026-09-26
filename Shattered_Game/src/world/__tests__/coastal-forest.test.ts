import {describe,it,expect} from 'vitest';
import {coastalWaterFinish} from '../terrain/ForestCoastalWater';
import {createCoastalForestSample} from '../../shared/editor/CoastalForestSample';
import {exportEditorMapToMapDefinition} from '../../shared/editor/EditorMapSerializer';
import {validateMapDefinition} from '../maps/MapDefinitionValidator';
import {FOREST_OBJECT_DEFINITIONS} from '../../objects/ForestObjectDefinitions';

describe('painted coast',()=>{
 it('keeps the painted ledge and stair assembly on the same footprint and height anchor',()=>{
  const ledge=FOREST_OBJECT_DEFINITIONS.find(d=>d.id==='forest_coast_ledge')!;
  const stairs=FOREST_OBJECT_DEFINITIONS.find(d=>d.id==='forest_coast_ledge_stairs')!;
  expect(ledge.collisionFootprint).toHaveLength(16);
  expect(stairs.visual.parts[0]).toEqual(ledge.visual.parts[0]);
  expect(ledge.visual.parts).toHaveLength(1);
 });
 it('exports a valid scene with cliffs, stairs, trees and shoreline details',()=>{
  const map=createCoastalForestSample();
  expect(()=>validateMapDefinition(exportEditorMapToMapDefinition(map),FOREST_OBJECT_DEFINITIONS)).not.toThrow();
  for(const id of ['coast_cliff_x','coast_cliff_y','coast_cliff_corner','coast_stairs_x','coast_reeds','coast_flowers'])
   expect(map.objects.some(o=>o.definitionId==='forest_'+id)).toBe(true);
 });
 it('leaves open water and inland terrain free of foam',()=>{
  expect(coastalWaterFinish(3,7,0)).toEqual({foam:0,shallow:0});
  expect(coastalWaterFinish(3,7,1)).toEqual({foam:0,shallow:0});
  expect(coastalWaterFinish(3,7,.58).foam).toBeGreaterThan(.1);
 });
 it('keeps the shore continuous across integer tile boundaries',()=>{
  const a=coastalWaterFinish(4-1e-7,7,.58),b=coastalWaterFinish(4+1e-7,7,.58);
  expect(a.foam).toBeCloseTo(b.foam,5);expect(a.shallow).toBeCloseTo(b.shallow,5);
 });
});
