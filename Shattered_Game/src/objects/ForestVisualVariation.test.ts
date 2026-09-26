import { describe, expect, it } from 'vitest';
import { FOREST_OBJECT_DEFINITIONS, FOREST_OBJECT_ASSETS } from './ForestObjectDefinitions';
import { getForestVisualVariation } from './ForestVisualVariation';
import { FOREST_GROUND_DETAILS } from './ForestGroundDetails';

const oak=FOREST_OBJECT_DEFINITIONS.find(d=>d.id==='forest_tall_oak')!;
describe('forest placement variation',()=>{
  it('is deterministic, spans the requested tree height range, and keeps collision data unchanged',()=>{
    const before=JSON.stringify(oak);
    const variants=Array.from({length:300},(_,i)=>getForestVisualVariation(`placement_${i}`,oak));
    for(let i=0;i<variants.length;i++) {
      expect(variants[i]).toEqual(getForestVisualVariation(`placement_${i}`,oak));
      expect(variants[i].height).toBeGreaterThanOrEqual(.5);
      expect(variants[i].height).toBeLessThanOrEqual(1.5);
    }
    expect(Math.min(...variants.map(v=>v.height))).toBeLessThan(.6);
    expect(Math.max(...variants.map(v=>v.height))).toBeGreaterThan(1.4);
    expect(new Set(variants.map(v=>v.flipX)).size).toBe(2);
    expect(JSON.stringify(oak)).toBe(before);
  });
  it('does not flip directional walls, cliffs, or unrelated art',()=>{
    for(const id of ['forest_wall_x','forest_wall_y','forest_ramp','forest_fence_x','forest_fence_y','forest_wooden_gate','forest_gate_y','forest_shack']) {
      const definition=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===id)!;
      expect(getForestVisualVariation('test',definition)).toEqual({width:1,height:1,flipX:false});
    }
    expect(getForestVisualVariation('test',{...oak,id:'legacy_tree'})).toEqual({width:1,height:1,flipX:false});
  });
  it('registers six nonblocking ground clusters using available sprite textures',()=>{
    const textures=new Set(FOREST_OBJECT_ASSETS.map(a=>a.key));
    expect(FOREST_GROUND_DETAILS).toHaveLength(6);
    for(const detail of FOREST_GROUND_DETAILS) {
      expect(detail.blocksMovement).toBe(false);
      expect(FOREST_OBJECT_DEFINITIONS).toContain(detail);
      for(const part of detail.visual.parts) {
        expect(part.shape).toBe('sprite');
        if(part.shape==='sprite')expect(textures.has(part.textureKey)).toBe(true);
      }
    }
  });
});
