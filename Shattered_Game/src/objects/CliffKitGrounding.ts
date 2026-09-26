import type {VisualPart} from './ObjectTypes';

/** Ground-level undergrowth attached to exposed faces, never to top/fill tiles. */
export function cliffGrounding(kind:string,rotation:number,height:number):VisualPart[]{
 if(!['edge','outer','inner'].includes(kind))return [];
 const rotate=([u,v]:number[])=>{
  for(let i=0;i<rotation;i++)[u,v]=[1-v,u];
  return [u,v];
 };
 const point=(t:number)=>kind==='edge'?[1-t,.5]:kind==='outer'
  ?[.5*Math.cos(t*Math.PI/2),.5*Math.sin(t*Math.PI/2)]
  :[.5*Math.cos((1-t)*Math.PI/2),.5*Math.sin((1-t)*Math.PI/2)];
 const parts:VisualPart[]=[];
 for(const [i,t] of [.18,.57,.86].entries()){
  const a=rotate(point(t)),b=rotate(point(t+.001));
  const du=b[0]-a[0],dv=b[1]-a[1];
  if(dv-du<=0)continue; // Rear-facing foliage would bleed across the plateau.
  const bush=i===1,rock=i===2&&rotation%2===0;
  parts.push({shape:'sprite',textureKey:`object-forest_${bush?'large_bush':rock?'rocks':'ferns'}`,
   scale:bush?.16+(height/32%3)*.012:rock?.075:.12,
   originX:.5,originY:1,localOffsetX:(a[0]-a[1])*32,
   localOffsetY:(a[0]+a[1]-1)*16+4+(i%2)*2,flipX:(rotation+i)%2===1});
 }
 return parts;
}
