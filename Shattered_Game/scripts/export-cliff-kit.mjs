import {createCanvas,loadImage} from '@napi-rs/canvas';
import {mkdir,writeFile} from 'node:fs/promises';
const out='public/assets/forest-painterly/cliff-kit';await mkdir(out,{recursive:true});
const rock=createCanvas(512,512),rc=rock.getContext('2d');const rockSource=await loadImage('art/forest-painterly/source/cliff-kit-v3/rock-master.png');rc.drawImage(rockSource,rockSource.width*.2,0,rockSource.width*.25,rockSource.height,0,0,512,512);
// Weld the material's opposing edge texels; projection preserves this shared border.
const pixels=rc.getImageData(0,0,512,512);
for(let axis=0;axis<2;axis++)for(let n=0;n<512;n++)for(let k=0;k<32;k++)for(let c=0;c<3;c++){
 const a=(axis?n*512+k:k*512+n)*4+c,b=(axis?n*512+511-k:(511-k)*512+n)*4+c,t=.5*(1-k/32)**2;
 const x=pixels.data[a],y=pixels.data[b];pixels.data[a]=x*(1-t)+y*t;pixels.data[b]=y*(1-t)+x*t;
}
for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=255;
for(let n=0;n<512;n++)for(let ch=0;ch<4;ch++)pixels.data[(n*512+511)*4+ch]=pixels.data[n*512*4+ch];
for(let n=0;n<512;n++)for(let ch=0;ch<4;ch++)pixels.data[(511*512+n)*4+ch]=pixels.data[n*4+ch];
rc.putImageData(pixels,0,0);await writeFile(`${out}/rock-material.png`,await rock.encode('png'));
const grass=createCanvas(128,128),gc=grass.getContext('2d');
const hd=await loadImage('public/assets/forest-painterly/grass-world-hd.png');gc.drawImage(hd,256,256,128,128,0,0,128,128);
gc.fillStyle='rgba(111,132,61,.2)';gc.fillRect(0,0,128,128);
const gp=gc.getImageData(0,0,128,128);
for(let axis=0;axis<2;axis++)for(let n=0;n<128;n++)for(let k=0;k<12;k++)for(let c=0;c<3;c++){
 const a=(axis?n*128+k:k*128+n)*4+c,b=(axis?n*128+127-k:(127-k)*128+n)*4+c,t=.5*(1-k/12)**2;
 const x=gp.data[a],y=gp.data[b];gp.data[a]=x*(1-t)+y*t;gp.data[b]=y*(1-t)+x*t;
}gc.putImageData(gp,0,0);
const bankGrass=createCanvas(512,512),bg=bankGrass.getContext('2d');bg.drawImage(hd,256,256,512,512,0,0,512,512);bg.fillStyle='rgba(111,132,61,.2)';bg.fillRect(0,0,512,512);
const entries=[];
const rot=([u,v],r)=>{for(let i=0;i<r;i++)[u,v]=[1-v,u];return [u,v];};
function triangle(ctx,img,src,dst){
 const [a,b,c]=src,[p,q,r]=dst,det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(det)<1e-9)return;
 const A=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det,B=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det;
 const C=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det,D=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
 const center=[dst.reduce((s,p)=>s+p[0],0)/3,dst.reduce((s,p)=>s+p[1],0)/3];
 const clip=dst.map(p=>{const dx=p[0]-center[0],dy=p[1]-center[1],len=Math.hypot(dx,dy);return [p[0]+dx/len*.12,p[1]+dy/len*.12];});
 ctx.save();ctx.beginPath();clip.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p[0]-A*a[0]-C*a[1],p[1]-B*a[0]-D*a[1]);ctx.drawImage(img,0,0);ctx.restore();
}
for(const height of [32,64,96,128,160])for(const kind of ['edge','outer','inner','fill','summit','ramp','stairs','bank'])for(let r=0;r<((kind==='fill'||kind==='summit')?1:4);r++){
 const size=kind==='bank'?4:kind==='ramp'||kind==='stairs'?2:1,scale=4,pad=8,W=64*size+pad*2,H=height+32*size+pad*2;
 const canvas=createCanvas(W*scale,H*scale),ctx=canvas.getContext('2d');ctx.scale(scale,scale);
 const project=([u,v],z)=>[W/2+(u-v)*32*size,pad+(u+v)*16*size+height-z];
 let polygon=[],contour=[];
 if(kind==='edge'){
  contour=Array.from({length:25},(_,i)=>[1-i/24,.5+Math.sin(i/24*Math.PI)**2*(.035*Math.sin(i/24*Math.PI*3)+.025*Math.sin(i/24*Math.PI*7))]);polygon=[[0,0],[1,0],...contour];
 }else if(kind==='outer'||kind==='inner'){
  const arc=Array.from({length:25},(_,i)=>[.5*Math.cos(i/24*Math.PI/2),.5*Math.sin(i/24*Math.PI/2)]);
  if(kind==='outer'){contour=arc;polygon=[[0,0],...arc];}
  else {contour=[...arc].reverse();polygon=[[.5,0],[1,0],[1,1],[0,1],...contour];}
 }else polygon=[[0,0],[1,0],[1,1],[0,1]];
 polygon=polygon.map(p=>rot(p,r));contour=contour.map(p=>rot(p,r));
 // Continuous contours are the only exposed faces; tile joins never draw a wall.
 const segments=[];let distance=0;const total=contour.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-contour[i][0],p[1]-contour[i][1]),0);
 for(let i=0;i<contour.length-1;i++){
  const a=contour[i],b=contour[i+1],du=b[0]-a[0],dv=b[1]-a[1];
  // Polygon winding is positive; outward normal=(dv,-du).
  const start=distance;distance+=Math.hypot(du,dv);
  if(dv-du<=0)continue;
  segments.push({a,b,start,end:distance,depth:a[0]+a[1]+b[0]+b[1],light:.86+.12*(dv+du)/Math.max(.001,Math.hypot(du,dv))});
 }
 segments.sort((a,b)=>a.depth-b.depth);
 for(const {a,b,light,start,end} of segments){
  // Shared periodic world coordinates, without stretching tall faces.
  for(let z=0;z<height;z+=8){
   const points=[project(a,z),project(b,z),project(b,z+8),project(a,z+8)];
   const u0=start/total*512,u1=end/total*512;
   const v0=512-((z%128)+8)/128*512,v1=512-(z%128)/128*512;
   triangle(ctx,rock,[[u0,v1],[u1,v1],[u1,v0]],[points[0],points[1],points[2]]);
   triangle(ctx,rock,[[u0,v1],[u1,v0],[u0,v0]],[points[0],points[2],points[3]]);
   ctx.fillStyle=`rgba(23,33,29,${1-light})`;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();
  }
 }
 if(kind==='bank'){
  // Smooth zero-slope landings; shared grass material, feathered only at the foot.
  const n=48,smooth=t=>t*t*(3-2*t);
  const elevation=p=>height*smooth(p[1]);
  for(let v=0;v<n;v++)for(let u=0;u<n;u++){
   const a=[u/n,v/n],b=[(u+1)/n,v/n],c=[(u+1)/n,(v+1)/n],d=[u/n,(v+1)/n];
   const pts=[a,b,c,d],dst=pts.map(p=>project(rot(p,r),elevation(p)));
   const src=pts.map(p=>[p[0]*bankGrass.width,p[1]*bankGrass.height]);
   ctx.globalAlpha=1;
   triangle(ctx,bankGrass,[src[0],src[1],src[2]],[dst[0],dst[1],dst[2]]);
   triangle(ctx,bankGrass,[src[0],src[2],src[3]],[dst[0],dst[2],dst[3]]);
  }
  // Wide shoulders settle into ground; the centre has level landings at both ends.
  ctx.globalCompositeOperation='destination-in';
  const mask=createCanvas(W*scale,H*scale),mc=mask.getContext('2d');mc.scale(scale,scale);
  for(let v=0;v<n;v++)for(let u=0;u<n;u++){
   const alpha=smooth(Math.min(1,(v+.5)/n/.15));
   mc.fillStyle=`rgba(255,255,255,${alpha})`;mc.beginPath();
   [[u/n,v/n],[(u+1)/n,v/n],[(u+1)/n,(v+1)/n],[u/n,(v+1)/n]].map(p=>project(rot(p,r),elevation(p))).forEach((p,i)=>i?mc.lineTo(...p):mc.moveTo(...p));mc.closePath();mc.fill();mc.strokeStyle=mc.fillStyle;mc.lineWidth=.3;mc.stroke();
  }
  ctx.drawImage(mask,0,0,W,H);ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  // A bank is a solid terrain volume. Exposed flanks taper from the
  // plateau height to zero, rather than leaving a floating grass sheet.
  ctx.globalCompositeOperation='destination-over';
  for(const side of [0,1])for(let i=0;i<n;i++){
   const t0=i/n,t1=(i+1)/n;
   const a=rot([side,side?t0:t1],r),b=rot([side,side?t1:t0],r);
   if((b[1]-a[1])-(b[0]-a[0])<=0)continue;
   const z0=height*smooth(side?t0:t1),z1=height*smooth(side?t1:t0);
   const dst=[project(a,0),project(b,0),project(b,z1),project(a,z0)];
   const f=(i%12)/12,g=(i%12+1)/12;
   const u0=(side?f:1-g)*512,u1=(side?g:1-f)*512;
   for(let z=0;z<Math.max(z0,z1);z+=8){
    const face=[project(a,Math.min(z,z0)),project(b,Math.min(z,z1)),project(b,Math.min(z+8,z1)),project(a,Math.min(z+8,z0))];
    const v0=512-(z%128)/128*512,v1=512-((z%128)+8)/128*512;
    triangle(ctx,rock,[[u0,v0],[u1,v0],[u1,v1]],[face[0],face[1],face[2]]);
    triangle(ctx,rock,[[u0,v0],[u1,v1],[u0,v1]],[face[0],face[2],face[3]]);
   }
  }
  ctx.globalCompositeOperation='source-over';
 }else if(kind==='ramp'||kind==='stairs'){
  // Two-tile approach, lower landing at zero and upper landing at the selected tier.
  const count=kind==='stairs'?height/8:24;
  for(let i=0;i<count;i++){
   const a=i/count,b=(i+1)/count,z0=i/count*height,z1=(i+1)/count*height;
   const pts=[[0,a],[1,a],[1,b],[0,b]].map(p=>rot(p,r));
   const zs=kind==='stairs'?[z1,z1,z1,z1]:[z0,z0,z1,z1];
   const dst=pts.map((p,j)=>project(p,zs[j]));
   triangle(ctx,rock,[[0,a*512],[512,a*512],[512,b*512]],[dst[0],dst[1],dst[2]]);
   triangle(ctx,rock,[[0,a*512],[512,b*512],[0,b*512]],[dst[0],dst[2],dst[3]]);
   if(kind==='stairs'){
    const face=[project(pts[0],z0),project(pts[1],z0),project(pts[1],z1),project(pts[0],z1)];
    triangle(ctx,rock,[[0,32],[512,32],[512,0]],[face[0],face[1],face[2]]);
    triangle(ctx,rock,[[0,32],[512,0],[0,0]],[face[0],face[2],face[3]]);
    ctx.strokeStyle='#626b51';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...dst[0]);ctx.lineTo(...dst[1]);ctx.stroke();
   }
  }
 }else{
  ctx.save();ctx.beginPath();polygon.map(p=>project(p,height)).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip();
  ctx.transform(32*size/grass.width,16*size/grass.width,-32*size/grass.height,16*size/grass.height,W/2,pad);ctx.drawImage(kind==='summit'?rock:grass,0,0,grass.width,grass.height);ctx.restore();
  // A painted moss lip follows the same contour, including rounded corners.
  ctx.strokeStyle=ctx.createPattern(grass,'repeat');ctx.lineWidth=2.3;ctx.lineCap='round';ctx.beginPath();contour.map(p=>project(p,height)).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();
 }
 // Small, irregular painted skirts ground the visible rock faces.
 for(const {a,b,start} of segments){
  const p=project(a,0),q=project(b,0);
  ctx.strokeStyle='rgba(35,49,27,.18)';ctx.lineWidth=5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();

 }
 const id=`cliffkit_${kind}_${height}_${r}`;await writeFile(`${out}/${id}.png`,await canvas.encode('png'));
 entries.push({id,kind,height,rotation:r,size,width:W*scale,imageHeight:H*scale,originX:.5,originY:(height+16*size+pad)/H});
}
await writeFile(`${out}/manifest.json`,JSON.stringify({tileWidth:64,tileHeight:32,scale:.25,levels:[32,64,96,128,160],modules:entries},null,2));
await writeFile('src/objects/CliffKitManifest.ts',`// Generated by scripts/export-cliff-kit.mjs\nexport const CLIFF_KIT_MODULES=${JSON.stringify(entries)} as const;\n`);
console.log(`Exported ${entries.length} modular cliff sprites.`);
