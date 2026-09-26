import {describe,it,expect} from 'vitest';
import {createRiverWoodlandMap} from './RiverWoodlandMap';
import {SOURCE_FALLS_ROUTE} from './SourceFallsSection';
import {FOREST_OBJECT_DEFINITIONS} from '../../objects/ForestObjectDefinitions';
import {blendedForestSurfaceHeight} from '../iso/ForestRelief';

describe('Source Falls on the main woodland map',()=>{
  it('has a clear dirt ascent from the eastward trail to the upper clearing',()=>{
    const map=createRiverWoodlandMap();
    const blocked=new Set<string>();
    for(const o of map.objects){
      const d=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId)!;
      if(d.blocksMovement)for(const p of d.collisionFootprint)blocked.add(`${o.tileX+p.x},${o.tileY+p.y}`);
    }
    const seen=new Set<string>(),queue=[[62,18]];
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i],k=`${x},${y}`;
      if(seen.has(k)||blocked.has(k)||map.terrain[y]?.[x]!=='dirt')continue;
      seen.add(k);
      queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
    }
    for(const [x,y] of SOURCE_FALLS_ROUTE)expect(seen.has(`${x},${y}`),`route ${x},${y}`).toBe(true);
    const sample=(x:number,y:number)=>map.terrainTiles[`${x},${y}`]?.id??null;
    const height=(x:number,y:number)=>blendedForestSurfaceHeight(x+.5,y+.5,sample);
    expect(height(54,5)-height(62,18)).toBeGreaterThan(50);
    // Check the rendered spline across tile joins, rather than comparing tile tiers.
    for(let y=5;y<18;y++){
      expect(Math.abs(height(60,y-.001)-height(60,y+.001))).toBeLessThan(.1);
    }
  });
  it('connects the plunge pool to the river, with collision on the rock face',()=>{
    const map=createRiverWoodlandMap();
    expect(map.objects.some(o=>o.definitionId==='source_falls_waterfall')).toBe(true);
    expect(map.objects.filter(o=>o.definitionId.startsWith('natural_cliff_'))).toHaveLength(3);
    const seen=new Set<string>(),queue=[[44,10]];
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i],k=`${x},${y}`;
      if(seen.has(k)||map.terrain[y]?.[x]!=='water')continue;
      seen.add(k);expect(map.terrainWalkability[k]).toBe(false);
      queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
    }
    expect(seen.has('42,15')).toBe(true);
    expect(FOREST_OBJECT_DEFINITIONS.find(d=>d.id==='source_falls_waterfall')?.blocksMovement).toBe(true);
  });
  it('keeps protected gameplay anchors clear even inside the new section',()=>{
    const anchors=[{tileX:46,tileY:7},{tileX:44,tileY:10},{tileX:60,tileY:12}];
    const map=createRiverWoodlandMap(anchors);
    for(const a of anchors){
      expect(map.terrainWalkability[`${a.tileX},${a.tileY}`]).toBe(true);
      for(const o of map.objects){
        const d=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId)!;
        for(const p of d.collisionFootprint)expect(Math.hypot(o.tileX+p.x-a.tileX,o.tileY+p.y-a.tileY)).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
