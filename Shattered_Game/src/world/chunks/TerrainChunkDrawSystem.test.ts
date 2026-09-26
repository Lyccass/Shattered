import { beforeEach, describe, expect, it, vi } from 'vitest';

const state=vi.hoisted(()=>({baked:undefined as string|undefined}));
vi.mock('../terrain/PrebakedForestGround',()=>({findPrebakedForestGround:()=>state.baked}));
beforeEach(()=>{state.baked=undefined;});
vi.mock('phaser', () => ({ default: { GameObjects: { Image: class {
  setOrigin() { return this; } setTexture() { return this; }
  setFlip() { return this; } setScale() { return this; }
  setPosition() { return this; }
} } } }));
vi.mock('../terrain/ForestReliefRenderer', () => ({ ForestReliefRenderer: class {
  texture() { return 'baked'; } release() {} destroy() {}
} }));
import { TerrainChunkDrawSystem } from './TerrainChunkDrawSystem';

function fixture() {
  const layer = () => ({
    camera: { setOrigin: () => ({ setZoom() {} }) },
    setScale() { return this; }, setOrigin() { return this; }, setDepth() { return this; },
    setVisible: vi.fn(), draw: vi.fn(), clear: vi.fn(), destroy: vi.fn(),
  });
  const scene = { add: { image: () => layer(), renderTexture: () => layer(), graphics: () => layer() },
    textures: { getFrame: () => ({width:256,height:128}) } };
  const transform = { tileWidth:64, tileHeight:32, getTileCenterWorld: () => ({x:32,y:16}) };
  const cache = { resolveTile: () => ({baseTileDefinition: {
    id:'forest_grass_1', family:'grass', spriteFrame:'terrain-forest_grass_1',
  }, transitionOverlays:[]}) };
  const system = new TerrainChunkDrawSystem(scene as never, transform as never, cache as never);
  const chunk = system.materializeChunk({key:'0,0', chunkX:0,chunkY:0,
    startX:0,startY:0,endX:2,endY:1,drawStartX:0,drawStartY:0,drawEndX:2,drawEndY:1,
    bounds:{x:0,y:0,width:128,height:64}});
  return {system,chunk};
}

describe('prebaked ground', () => {
  it('is immediately ready without running the tile baker', () => {
    state.baked='finished-ground';
    const {system,chunk}=fixture();
    expect(chunk.isGroundReady).toBe(true);
    expect(system.buildGroundChunkStep(chunk,100)).toBe(0);
    expect((chunk.groundLayer as unknown as {draw:unknown}).draw).not.toHaveBeenCalled();
    expect((chunk.groundLayer as unknown as {clear:unknown}).clear).not.toHaveBeenCalled();
    expect(chunk.reliefKeys).toEqual([]);
  });
  it('still bakes edited or uncached terrain',()=>{
    const {system,chunk}=fixture();
    expect(chunk.isGroundReady).toBe(false);
    system.buildGroundChunkStep(chunk,1);
    expect(chunk.isGroundReady).toBe(false);
    system.buildGroundChunkStep(chunk,1);
    expect(chunk.isGroundReady).toBe(true);
  });
  it('destroys the display object on eviction',()=>{
    state.baked='finished-ground';
    const {system,chunk}=fixture();
    system.destroyChunk(chunk);
    expect(chunk.groundLayer.destroy).toHaveBeenCalledOnce();
  });
});
