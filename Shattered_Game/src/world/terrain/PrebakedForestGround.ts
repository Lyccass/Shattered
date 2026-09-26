import type Phaser from 'phaser';
import type {TerrainChunkConfig} from '../chunks/TerrainChunkMath';
import {FOREST_GROUND_BAKES} from './generated/ForestGroundBakes';
import {forestGroundBakeSignature} from './ForestGroundBakeSignature';
const byCoordinate = new Map(FOREST_GROUND_BAKES.map(entry=>[`${entry.cx},${entry.cy}`,entry]));
const keyFor=(entry:{file:string})=>`forest-ground-${entry.file}`;
export function preloadForestGround(scene:Phaser.Scene):void {
  for(const entry of FOREST_GROUND_BAKES){
    const key=keyFor(entry);
    if(!scene.textures.exists(key))scene.load.image(key,`/assets/forest-painterly/ground/${entry.file}`);
  }
}
export function findPrebakedForestGround(
  config:TerrainChunkConfig, sample:(x:number,y:number)=>string|null,
  exists:(key:string)=>boolean,
):string|undefined {
  const entry=byCoordinate.get(config.key);
  if(!entry || config.bounds.width*2!==entry.width || config.bounds.height*2!==entry.height)return;
  const key=keyFor(entry);
  if(exists(key)&&forestGroundBakeSignature(config,sample)===entry.signature)return key;
}
