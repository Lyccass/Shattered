import {describe,it,expect} from 'vitest';
import {plateauFaces,FOREST_PLATEAU_TILE} from './ForestPlateau';
describe('modular plateau boundaries',()=>{
 const sample=(x:number,y:number)=>x>=30&&x<=33&&y>=4&&y<=7?FOREST_PLATEAU_TILE:'forest_grass_1';
 it('does not put walls between neighbours, including across chunk seams',()=>{
  expect(plateauFaces(31,5,sample)).toEqual([]);
  expect(plateauFaces(32,5,sample)).toEqual([]);
 });
 it('closes front edges and both sides of the outer corner',()=>{
  expect(plateauFaces(33,5,sample)).toEqual(['x']);
  expect(plateauFaces(31,7,sample)).toEqual(['y']);
  expect(plateauFaces(33,7,sample)).toEqual(['x','y']);
  expect(plateauFaces(34,7,sample)).toEqual([]);
 });
});
