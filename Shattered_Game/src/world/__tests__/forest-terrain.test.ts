import { blendedForestSurfaceHeight, forestSurfaceHeight } from '../../shared/iso/ForestRelief';
import { describe, expect, it } from 'vitest';
import { resolveForestTransitions, FOREST_TERRAIN_DEFINITIONS } from '../terrain/ForestTerrainDefinitions';
import { WorldGrid } from '../WorldGrid';
import { TerrainResolutionCache } from '../terrain/TerrainResolutionCache';
import { TerrainResolver } from '../terrain/TerrainResolver';
import { createForestPackSample } from '../../shared/editor/ForestPackSample';
import { serializeEditorMap, parseEditorMapJson, createEditorMapFromMapDefinition, exportEditorMapToMapDefinition } from '../../shared/editor/EditorMapSerializer';
import { validateMapDefinition } from '../maps/MapDefinitionValidator';
import { FOREST_OBJECT_DEFINITIONS } from '../../objects/ForestObjectDefinitions';

describe('painted forest terrain', () => {
  it('renders authored beach sand with shoreline and grass transitions', () => {
    const grid=new WorldGrid(2,1,[['sand','water']]);
    const cache=new TerrainResolutionCache(grid,undefined,{'0,0':{
      id:'forest_sand_1',family:'sand',textureKey:'terrain-forest_sand_1',flipX:false,flipY:false,
    }});
    expect(cache.resolveTile(0,0)?.baseTileDefinition.family).toBe('sand');
    expect(resolveForestTransitions('water',0,0,(x,y)=>x===1&&y===0?'sand':'water')
      .map(o=>o.definition.spriteFrame)).toEqual(['terrain-forest_blend_sand_xPlus']);
    expect(resolveForestTransitions('sand',0,0,(x,y)=>x===1&&y===0?'grass':'sand')
      .map(o=>o.definition.spriteFrame)).toEqual(['terrain-forest_blend_grass_xPlus']);
    expect(FOREST_TERRAIN_DEFINITIONS.filter(d=>d.family==='sand')).toHaveLength(4);
  });
  it('keeps legacy procedural terrain choices unchanged', () => {
    const resolver=new TerrainResolver();
    for(const family of ['grass','dirt','stone','water'] as const) {
      expect(resolver.resolve({family,gridX:3,gridY:4}).baseTileDefinition.id).not.toMatch(/^forest_/);
    }
    expect(FOREST_TERRAIN_DEFINITIONS.every(def=>!def.allowFlipX && !def.allowFlipY)).toBe(true);
  });
  it('does not add a seam on uniform terrain or map boundaries', () => {
    expect(resolveForestTransitions('grass',0,0,()=> 'grass')).toEqual([]);
    expect(resolveForestTransitions('grass',0,0,()=> null)).toEqual([]);
  });
  it('places land over water only on the water side of a shoreline', () => {
    const overlays=resolveForestTransitions('water',0,0,(x,y)=>x===1&&y===0?'grass':'water');
    expect(overlays.map(o=>o.definition.spriteFrame)).toEqual(['terrain-forest_blend_grass_xPlus']);
    expect(resolveForestTransitions('grass',0,0,()=> 'water')).toEqual([]);
  });
  it('adds diagonal corners but avoids duplicating adjacent edge coverage', () => {
    const corner=resolveForestTransitions('grass',0,0,(x,y)=>x===1&&y===1?'dirt':'grass');
    expect(corner.map(o=>o.definition.direction)).toEqual(['xPlusYPlus']);
    const edges=resolveForestTransitions('grass',0,0,(x,y)=>x===1&&y>=0?'dirt':'grass');
    expect(edges.map(o=>o.definition.direction)).toEqual(['xPlus']);
  });
  it('resolves transitions for exact forest paint and refreshes after invalidation', () => {
    const grid=new WorldGrid(2,1,[['grass','dirt']]);
    const cache=new TerrainResolutionCache(grid,undefined,{'0,0':{
      id:'forest_grass_1',family:'grass',textureKey:'terrain-forest_grass_1',flipX:false,flipY:false,
    }});
    expect(cache.resolveTile(0,0)?.transitionOverlays).toHaveLength(1);
    grid.setTile(1,0,'grass');cache.invalidateTile(0,0);
    expect(cache.resolveTile(0,0)?.transitionOverlays).toHaveLength(0);
  });
  it('round-trips the sample through the real editor serializer and validates for the game', () => {
    const sample=createForestPackSample();
    const parsed=createEditorMapFromMapDefinition(parseEditorMapJson(serializeEditorMap(sample)));
    expect(parsed.terrainTiles).toEqual(sample.terrainTiles);
    expect(parsed.objects).toEqual(sample.objects);
    expect(()=>validateMapDefinition(exportEditorMapToMapDefinition(sample),FOREST_OBJECT_DEFINITIONS)).not.toThrow();
  });
});

describe('continuous painted relief', () => {
  it('supports higher plateaus without changing the existing low hill profiles',()=>{
    const at=(id:string)=>blendedForestSurfaceHeight(9.5,36.5,()=>id);
    expect(at('forest_grass_18')-at('forest_grass_1')).toBeCloseTo(72);
    expect(at('forest_grass_12')-at('forest_grass_1')).toBeCloseTo(22);
    expect(FOREST_TERRAIN_DEFINITIONS.find(d=>d.id==='forest_grass_18')).toBeDefined();
  });
  it('keeps a broad slope through tile centers instead of flattening into bumps', () => {
    const sample=(x:number)=>x<2?'forest_grass_1':'forest_grass_12';
    const offset=(x:number)=>blendedForestSurfaceHeight(x,3.5,sample)-forestSurfaceHeight(x,3.5,'grass');
    const e=1e-4;
    expect((offset(2.5+e)-offset(2.5-e))/(2*e)).toBeGreaterThan(5);
    let previous=0;
    for(let x=0;x<=4;x+=.05) {
      const value=offset(x);
      expect(value).toBeGreaterThanOrEqual(previous-1e-8);
      expect(value).toBeLessThanOrEqual(22+1e-8);
      previous=value;
    }
  });
  it('joins slopes smoothly at tile centers across hill and material changes', () => {
    const sample=(x:number,y:number)=>x<2?'forest_grass_12':y<2?'forest_grass_13':'forest_dirt_1';
    const e=1e-5;
    for(const axis of ['x','y'] as const)for(let along=.5;along<=3.5;along+=.25) {
      const at=(t:number)=>blendedForestSurfaceHeight(axis==='x'?t:along,axis==='y'?t:along,sample);
      const left=(at(2.5)-at(2.5-e))/e;
      const right=(at(2.5+e)-at(2.5))/e;
      expect(Math.abs(left-right)).toBeLessThan(.004);
    }
  });
  it('joins both sides of every material boundary without height jumps', () => {
    const sample=(x:number,y:number)=>x<0||y<0?null:x<2?'grass':'dirt';
    for(let y=.5;y<4;y+=.2) {
      expect(Math.abs(blendedForestSurfaceHeight(2-1e-7,y,sample)
        -blendedForestSurfaceHeight(2+1e-7,y,sample))).toBeLessThan(.0001);
    }
  });
  it('keeps water level and places ground contacts on the same surface', () => {
    expect(blendedForestSurfaceHeight(3.2,4.8,()=> 'water')).toBe(0);
    expect(blendedForestSurfaceHeight(3.5,4.5,()=> 'grass'))
      .toBeCloseTo(forestSurfaceHeight(3.5,4.5,'grass'));
    expect(forestSurfaceHeight(3,4,'grass')).toBeGreaterThan(forestSurfaceHeight(3,4,'dirt'));
  });
});


it('welds mixed hill brush heights at shared vertices, including diagonal crests',()=>{
  const ids=['forest_grass_1','forest_grass_5','forest_grass_9','forest_grass_12','forest_grass_13'];
  for(const left of ids)for(const right of ids) {
    const sample=(x:number,y:number)=>x<2?left:y<2?right:'forest_grass_11';
    for(let y=1;y<=3;y+=.125) {
      expect(Math.abs(blendedForestSurfaceHeight(2-1e-8,y,sample)-blendedForestSurfaceHeight(2+1e-8,y,sample))).toBeLessThan(.00001);
    }
  }
  expect(forestSurfaceHeight(3,3,'forest_grass_12')-forestSurfaceHeight(3,3,'forest_grass_1')).toBeCloseTo(22);
});
