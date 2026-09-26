import type Phaser from 'phaser';

/** Only the grassy back edge blends into terrain; rock faces stay opaque. */
export function ledgeGrassOpacity(distance: number, r: number, g: number, b: number): number {
  if(g<r*.94 || g<b*1.35)return 1;
  const t=Math.max(0,Math.min(1,distance/32));
  return t*t*(3-2*t);
}

// Render-time compositing, cached once per texture manager. Source artwork is
// retained intact and the collision/depth anchor never depends on the mask.
export function forestLedgeTexture(scene: Phaser.Scene, key: string): string {
  if(key!=='object-forest_coast_ledge_painted'||!scene.textures.exists(key))return key;
  const blended=key+'-terrain-edge';
  if(scene.textures.exists(blended))return blended;
  const source=scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const texture=scene.textures.createCanvas(blended,source.width,source.height)!;
  const ctx=texture.context;ctx.drawImage(source,0,0);
  const pixels=ctx.getImageData(0,0,source.width,source.height),{data}=pixels;
  const top=Array<number>(source.width).fill(source.height);
  for(let x=0;x<source.width;x++)for(let y=0;y<source.height;y++){
    if(data[(y*source.width+x)*4+3]>220){top[x]=y;break;}
  }
  for(let x=0;x<source.width;x++){
    // Ignore isolated grass blades when locating the continuous turf boundary.
    const near=top.slice(Math.max(0,x-4),Math.min(source.width,x+5)).sort((a,b)=>a-b);
    const edge=near[Math.floor(near.length/2)];
    for(let y=Math.max(0,edge-10);y<Math.min(source.height,edge+32);y++){
      const i=(y*source.width+x)*4;
      data[i+3]*=ledgeGrassOpacity(y-edge,data[i],data[i+1],data[i+2]);
    }
  }
  ctx.putImageData(pixels,0,0);texture.refresh();return blended;
}
