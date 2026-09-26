import { createNaturalCliffSample } from '../shared/editor/NaturalCliffSample';
import { createCoastalForestSample } from '../shared/editor/CoastalForestSample';
import { preloadPlayerAssets, createPlayerAnimations, PLAYER_TEXTURE_KEY, PLAYER_IDLE_ANIMATION_KEY } from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { getDynamicDepth } from '../render/RenderLayers';
import Phaser from 'phaser';
import { blendedForestSurfaceHeight } from '../shared/iso/ForestRelief';
import { IsoTilemap } from '../world/IsoTilemap';
import { preloadTerrainAssets, createTerrainRenderTextures } from '../world/terrain/TerrainAssets';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { FOREST_OBJECT_DEFINITIONS } from '../objects/ForestObjectDefinitions';
import { ObjectRenderer } from '../objects/ObjectRenderer';
import { createRiverWoodlandMap, RIVER_WOODLAND_PLACES } from '../shared/editor/RiverWoodlandMap';
import { serializeEditorMap } from '../shared/editor/EditorMapSerializer';

export class ForestPackPreviewScene extends Phaser.Scene {
  private map?: IsoTilemap;
  private objects?: ObjectRenderer;
  constructor() { super('ForestPackPreview'); }
  preload(): void { preloadTerrainAssets(this); preloadObjectAssets(this); preloadPlayerAssets(this); }
  create(): void {
    createTerrainRenderTextures(this);
    const cliffKit=new URLSearchParams(location.search).get('sample')==='cliffs';
    const coastal=new URLSearchParams(location.search).get('sample')==='coast';
    if(coastal){document.querySelector('h1')!.textContent='Painted Coast';document.querySelector('header p')!.textContent='Soft hills · Mossy cliffs · Turquoise shores';document.getElementById('download-map')!.textContent='Export coast map';}
    const sample=cliffKit?createNaturalCliffSample():coastal?createCoastalForestSample():createRiverWoodlandMap();
    if(cliffKit){document.querySelector('h1')!.textContent='Natural Woodland Cliffs';document.querySelector('header p')!.textContent='Lower trail · Continuous ascent · Upper clearing';document.getElementById('download-map')!.textContent='Export cliff assembly';}
    this.map=new IsoTilemap(this,{terrain:sample.terrain,exactTerrainPaints:sample.terrainTiles});
    this.map.render();
    this.objects=new ObjectRenderer(this,this.map.transform,(x,y)=>blendedForestSurfaceHeight(x+.5,y+.5,(sx,sy)=>sample.terrainTiles[`${sx},${sy}`]?.id??null));
    for(const instance of sample.objects) {
      const definition=FOREST_OBJECT_DEFINITIONS.find(def=>def.id===instance.definitionId)!;
      this.objects.render({...instance,createdAt:0},definition);
    }
    createPlayerAnimations(this);
    for(const [x,y] of (cliffKit?[[10,10]]:coastal?[[10,12],[12,20]]:[[20,17],[48,20],[17,43]])) {
      const feet=this.map.getTileCenterWorld(x,y);
      feet.y-=blendedForestSurfaceHeight(x+.5,y+.5,(sx,sy)=>sample.terrainTiles[`${sx},${sy}`]?.id??null);
      this.add.ellipse(feet.x,feet.y,20,7,0x11271e,.2).setDepth(100);
      this.add.sprite(feet.x,feet.y-PLAYER_CONFIG.feetAnchorFromCenterY*PLAYER_CONFIG.visualScale,PLAYER_TEXTURE_KEY)
        .setOrigin(PLAYER_CONFIG.originX,PLAYER_CONFIG.originY).setScale(PLAYER_CONFIG.visualScale)
        .setDepth(getDynamicDepth(feet.y)).play(`${PLAYER_IDLE_ANIMATION_KEY}-down`);
    }
    const camera=this.cameras.main;
    const center=this.map.getTileCenterWorld((sample.width-1)/2,(sample.height-1)/2);
    camera.setZoom(Math.min((this.scale.width-60)/(sample.width*64),(this.scale.height-160)/(sample.height*32+300)));
    camera.centerOn(center.x,center.y-110);
    this.input.on('wheel', (_pointer:unknown,_objects:unknown,_dx:number,dy:number)=>camera.setZoom(Phaser.Math.Clamp(camera.zoom-dy*.001,.15,3)));
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>{
      if(pointer.isDown){camera.scrollX-=(pointer.x-pointer.prevPosition.x)/camera.zoom;camera.scrollY-=(pointer.y-pointer.prevPosition.y)/camera.zoom;}
    });
    const places=document.getElementById('places');
    const overview=()=>{camera.setZoom(Math.min((this.scale.width-60)/(sample.width*64),(this.scale.height-210)/(sample.height*32+300)));camera.centerOn(center.x,center.y-110);};
    const addPlace=(name:string,action:()=>void)=>{const button=document.createElement('button');button.textContent=name;button.onclick=action;places?.append(button);};
    addPlace('Overview',overview);
    for(const place of (cliffKit?[{name:"Lower trail",x:10,y:17},{name:"Continuous ascent",x:12,y:10},{name:"Upper clearing",x:13,y:5}]:coastal?[{name:"Coastal Cliffs",x:15,y:8},{name:"Beach & Water",x:18,y:17},{name:"Soft Hills",x:5,y:6}]:[...RIVER_WOODLAND_PLACES.slice(1),{name:"Woodland Shack",x:16,y:22}]))addPlace(place.name,()=>{
      const at=this.map!.getTileCenterWorld(place.x,place.y);camera.setZoom(.9);camera.centerOn(at.x,at.y-65);
    });
    const download=()=>{
      const url=URL.createObjectURL(new Blob([serializeEditorMap(sample)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=cliffKit?'cliff-kit-assembly.json':coastal?'coastal-forest-sample.json':'river-woodland-map.json';a.click();URL.revokeObjectURL(url);
    };
    document.getElementById('download-map')?.addEventListener('click',download);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      document.getElementById('download-map')?.removeEventListener('click',download);
      places?.replaceChildren();
      this.objects?.destroyAll();this.map?.destroy();
    });
  }
}
