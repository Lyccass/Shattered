import { plateauFaces, FOREST_PLATEAU_HEIGHT } from '../../shared/iso/ForestPlateau';
import { coastalWaterFinish } from './ForestCoastalWater';
import type Phaser from 'phaser';
import { blendedForestSurfaceHeight } from '../../shared/iso/ForestRelief';

type Point={x:number;y:number};
const FAMILIES=['grass','dirt','stone','water','sand'];
const COLORS=[[111,132,61],[186,144,80],[120,123,106],[51,123,119],[219,188,127]];
let nextRenderer=0;
const materialFamily=(id:string|null)=>id?.match(/^forest_(grass|dirt|stone|water|sand)_/)?.[1]??id;
const weights=(t:number)=>[(1-t)**3/6,(3*t**3-6*t*t+4)/6,(-3*t**3+3*t*t+3*t+1)/6,t**3/6];
const lerpGrid=(values:number[],u:number,v:number)=>{
 const gx=Math.max(0,Math.min(8,u*8)),gy=Math.max(0,Math.min(8,v*8));
 const ix=Math.min(7,Math.floor(gx)),iy=Math.min(7,Math.floor(gy)),a=gx-ix,b=gy-iy;
 return values[iy*9+ix]*(1-a)*(1-b)+values[iy*9+ix+1]*a*(1-b)+values[(iy+1)*9+ix]*(1-a)*b+values[(iy+1)*9+ix+1]*a*b;
};

// Cache material pixels once. Bake only a small mesh and light its source image,
// avoiding the old per-output-pixel inverse projection and repeated world lookups.
export class ForestReliefRenderer {
 private prefix=`forest-relief-${nextRenderer++}-`;
 private keys=new Map<string,string>();
 private references=new Map<string,number>();
 private materials=new Map<string,Uint8ClampedArray>();
 private nextTexture=0;
 private grassHD?:Uint8ClampedArray;
 constructor(private readonly scene:Phaser.Scene){}
 private material(key:string):Uint8ClampedArray {
  const cached=this.materials.get(key);if(cached)return cached;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  ctx.drawImage(this.scene.textures.get(key).getSourceImage() as CanvasImageSource,0,0,256,128);
  const data=ctx.getImageData(0,0,256,128).data;this.materials.set(key,data);return data;
 }
 texture(x:number,y:number,family:string,base:string,overlays:string[],neighbour:(x:number,y:number)=>string|null):string {
  if(!this.grassHD){
   const c=document.createElement('canvas');c.width=c.height=1024;
   const ctx=c.getContext('2d')!;ctx.drawImage(this.scene.textures.get('forest-grass-world-hd').getSourceImage() as CanvasImageSource,0,0);
   this.grassHD=ctx.getImageData(0,0,1024,1024).data;
  }
  const around=Array.from({length:25},(_,i)=>neighbour(x+i%5-2,y+Math.floor(i/5)-2));
  const sample=(sx:number,sy:number)=>around[(sy-y+2)*5+sx-x+2]??null;
  const signature=[x,y,family,base,...overlays,...around].join('|');
  const found=this.keys.get(signature);if(found){this.references.set(found,(this.references.get(found)??0)+1);return found;}
  const plateau=base==='terrain-forest_grass_19';
  const uniformGrass=family==='grass' && !/^terrain-forest_grass_[5-8]$/.test(base)
   && around.every(id=>materialFamily(id)==='grass');
  const height=(u:number,v:number)=>plateau?FOREST_PLATEAU_HEIGHT:blendedForestSurfaceHeight(x+u,y+v,sample);
  const heights:number[]=[],lights:number[]=[],fields=FAMILIES.map(()=>[] as number[]);
  for(let row=0;row<=8;row++)for(let col=0;col<=8;col++) {
   const u=col/8,v=row/8;heights.push(height(u,v));
   const slope=(height(u+.02,v)-height(u-.02,v)+height(u,v+.02)-height(u,v-.02))/.04;
   lights.push(1-.10*Math.tanh(slope*.07));
   const ix=Math.floor(u-.5),iy=Math.floor(v-.5),wx=weights(u-.5-ix),wy=weights(v-.5-iy);
   const totals=FAMILIES.map(()=>0);
   for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++) {
    const f=materialFamily(sample(x+ix+dx-1,y+iy+dy-1))??family;
    const at=FAMILIES.indexOf(f);if(at>=0)totals[at]+=wx[dx]*wy[dy];
   }
   totals.forEach((value,i)=>fields[i].push(value));
  }
  const material=document.createElement('canvas');material.width=256;material.height=128;
  const mctx=material.getContext('2d')!,pixels=mctx.createImageData(256,128);
  const used=FAMILIES.map((f,i)=>({i,data:this.material(f===family&&f!=='water'?base:`terrain-forest_${f}_1`)})).filter(({i})=>fields[i].some(v=>v>0));
  for(let py=0;py<128;py++)for(let px=0;px<256;px++) {
   const u=Math.max(.016,Math.min(.984,(py+.5)/128+(px+.5-128)/256));
   const v=Math.max(.016,Math.min(.984,(py+.5)/128-(px+.5-128)/256));
   const sx=Math.max(0,Math.min(255,Math.floor(128+(u-v)*128))),sy=Math.max(0,Math.min(127,Math.floor((u+v)*64)));
   const at=(py*256+px)*4,src=(sy*256+sx)*4,light=lerpGrid(lights,u,v);
   // Interior grass has no material boundary: bypass five weight fields,
   // per-pixel arrays, regex matching and the general blending pipeline.
   if(uniformGrass){
    const gu=((x%8+8)%8+u)*128,gv=((y%8+8)%8+v)*128;
    const source=(Math.floor(gv)*1024+Math.floor(gu))*4;
    pixels.data[at]=(COLORS[0][0]*.2+this.grassHD[source]*.8)*light;
    pixels.data[at+1]=(COLORS[0][1]*.2+this.grassHD[source+1]*.8)*light;
    pixels.data[at+2]=(COLORS[0][2]*.2+this.grassHD[source+2]*.8)*light;
    pixels.data[at+3]=255;
    continue;
   }
   let sum=0;const color=[0,0,0];
   for(const {i,data} of used) {
    // A continuous field gives rounded inner/outer corners across tile borders.
    const weight=lerpGrid(fields[i],u,v)**4;sum+=weight;
    let sampleAt=src,materialData=data;
    if(i===0&&!/^terrain-forest_grass_[5-8]$/.test(base)){
     const gu=((x+u)%8+8)%8/8,gv=((y+v)%8+8)%8/8;
     sampleAt=(Math.min(1023,Math.floor(gv*1024))*1024+Math.min(1023,Math.floor(gu*1024)))*4;
     materialData=this.grassHD;
    }
    if(i===3){
     const wu=((x+u)/4%1+1)%1,wv=((y+v)/4%1+1)%1;
     const wx=Math.max(0,Math.min(255,Math.floor(128+(wu-wv)*128))),wy=Math.max(0,Math.min(127,Math.floor((wu+wv)*64)));
     sampleAt=(wy*256+wx)*4;
    }
    const quiet=i===0?.2:.15;
    for(let c=0;c<3;c++)color[c]+=(COLORS[i][c]*quiet+materialData[sampleAt+c]*(1-quiet))*weight;
   }
   const water=lerpGrid(fields[3],u,v);
   const finish=water>0&&water<1?coastalWaterFinish(x+u,y+v,water):{foam:0,shallow:0};
   for(let c=0;c<3;c++){
    let value=color[c]/Math.max(.0001,sum)*light;
    value=value*(1-finish.shallow)+[112,180,161][c]*finish.shallow;
    pixels.data[at+c]=value*(1-finish.foam)+[246,240,200][c]*finish.foam;
   }
   pixels.data[at+3]=255;
  }
  mctx.putImageData(pixels,0,0);
  const padding=Math.max(128,Math.ceil(Math.max(...heights)*4/32)*32+8);
  const key=this.prefix+this.nextTexture++,texture=this.scene.textures.createCanvas(key,256,128+padding*2)!;
  const ctx=texture.context;
  const vertex=(u:number,v:number):Point=>({x:128+(u-v)*128,y:padding+(u+v)*64-lerpGrid(heights,u,v)*4});
  // Each raised tile owns its exposed front faces. Internal edges have no wall.
  if(plateau){
   const face=this.scene.textures.get('forest-cliff-material').getSourceImage() as HTMLCanvasElement;
   for(const direction of plateauFaces(x,y,sample)){
    const east=direction==='x',tx=((east?y:x)%4+4)%4*64;
    const a=vertex(east?1:0,east?0:1),b=vertex(1,1);
    const lower=(u:number,v:number):Point=>({x:128+(u-v)*128,y:padding+(u+v)*64-blendedForestSurfaceHeight(x+u,y+v,sample)*4});
    const c=lower(1,1),d=lower(east?1:0,east?0:1);
    drawTriangle(ctx,face,[{x:tx,y:0},{x:tx+64,y:0},{x:tx+64,y:256}],[a,b,c]);
    drawTriangle(ctx,face,[{x:tx,y:0},{x:tx+64,y:256},{x:tx,y:256}],[a,c,d]);
    if(east){ctx.fillStyle='rgba(15,25,26,.18)';ctx.beginPath();ctx.moveTo(a.x,a.y);for(const p of [b,c,d])ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fill();}
   }
  }
  for(const east of [true,false]) {
   if(sample(x+(east?1:0),y+(east?0:1)))continue;
   ctx.fillStyle=east?'#4d593b':'#556140';ctx.beginPath();
   for(let i=0;i<=8;i++){const p=vertex(east?1:i/8,east?i/8:1);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
   ctx.lineTo(128,padding+128);ctx.lineTo(east?256:0,padding+64);ctx.closePath();ctx.fill();
  }
  const uv=(u:number,v:number):Point=>({x:128+(u-v)*128,y:(u+v)*64});
  for(let v=0;v<8;v++)for(let u=0;u<8;u++) {
   const a=[u/8,v/8],b=[(u+1)/8,v/8],c=[(u+1)/8,(v+1)/8],d=[u/8,(v+1)/8];
   for(const tri of [[a,b,c],[a,c,d]])drawTriangle(ctx,material,tri.map(([s,t])=>uv(s,t)),tri.map(([s,t])=>vertex(s,t)));
  }
  texture.refresh();this.keys.set(signature,key);this.references.set(key,1);return key;
 }
 release(key:string):void {
  const left=(this.references.get(key)??0)-1;if(left>0){this.references.set(key,left);return;}
  this.references.delete(key);for(const [s,k] of this.keys)if(k===key)this.keys.delete(s);this.scene.textures.remove(key);
 }
 destroy():void {for(const key of this.keys.values())this.scene.textures.remove(key);this.keys.clear();this.references.clear();this.materials.clear();}
}

function drawTriangle(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, src: Point[], dst: Point[]): void {
  const [a,b,c]=src,[p,q,r]=dst;
  const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
  const m11=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det;
  const m21=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det;
  const m12=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det;
  const m22=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
  ctx.save();ctx.beginPath();
  // Slight overlap prevents antialiased cracks between triangles of one tile.
  const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
  for(const [i,point] of dst.entries()) {
    const vx=point.x-center.x,vy=point.y-center.y,len=Math.hypot(vx,vy);
    const px=point.x+vx/len*2.5,py=point.y+vy/len*2.5;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.clip();
  ctx.transform(m11,m12,m21,m22,p.x-m11*a.x-m21*a.y,p.y-m12*a.x-m22*a.y);
  ctx.drawImage(image,0,0);
  ctx.restore();
}
