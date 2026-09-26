import {describe,expect,it} from 'vitest';
import {createChunkConfig} from '../chunks/TerrainChunkMath';
import {findPrebakedForestGround} from './PrebakedForestGround';
import {FOREST_GROUND_BAKES} from './generated/ForestGroundBakes';

const chunks=import.meta.glob('/data/worlds/the_wake/chunks/*.json',{eager:true,import:'default'}) as Record<string,{terrain:{tiles:number[][]};terrainPalette:Record<number,{tileId:string}>}>;

describe('active world ground exports',()=>{
 it('matches every runtime render chunk, including map edges and neighbour halos',()=>{
  const tiles=new Map<string,string>();
  for(let cy=0;cy<3;cy++)for(let cx=0;cx<3;cx++){
   const chunk=chunks[`/data/worlds/the_wake/chunks/${cx}_${cy}.json`];
   chunk.terrain.tiles.forEach((row:number[],y:number)=>row.forEach((value,x)=>{
    tiles.set(`${cx*32+x},${cy*32+y}`,chunk.terrainPalette[value].tileId);
   }));
  }
  const transform={tileWidth:64,tileHeight:32,getTileDiamondPoints:(x:number,y:number)=>{
   const cx=(x-y)*32,cy=(x+y)*16+16;
   return [{x:cx,y:cy-16},{x:cx+32,y:cy},{x:cx,y:cy+16},{x:cx-32,y:cy}];
  }};
  for(const entry of FOREST_GROUND_BAKES){
   const config=createChunkConfig({chunkX:entry.cx,chunkY:entry.cy,mapWidth:96,mapHeight:96,
    chunkSize:8,bleedTiles:1,transform:transform as never});
   config.bounds.y-=128;config.bounds.height+=128;
   expect(findPrebakedForestGround(config,(x,y)=>tiles.get(`${x},${y}`)??null,()=>true),config.key)
    .toBe(`forest-ground-${entry.file}`);
  }
 });
});
