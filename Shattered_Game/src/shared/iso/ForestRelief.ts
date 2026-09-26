export const FOREST_HEIGHT_OFFSETS: Record<number,number> = {9:4,10:8,11:14,12:22,13:-5,14:11,15:30,16:42,17:56,18:72};

// Visual terrain relief in world pixels. This does not change movement elevation.
// Continuous coordinates keep adjacent surfaces of the same material welded.
export function forestSurfaceHeight(x: number, y: number, family: string): number {
  const match=/^forest_(grass|dirt|stone|water|sand)_(\d+)$/.exec(family);
  const relief=!!match && (match[1]==='grass'||match[1]==='dirt') && Number(match[2])>=9 && Number(match[2])<=18;
  const offset=relief?(FOREST_HEIGHT_OFFSETS[Number(match![2])]??0):0;
  if(match)family=relief?'grass':match[1];
  if (family === 'water') return 0;
  const rolling = (Math.sin(x * .24 + y * .11) + Math.cos(y * .22 - x * .10) + 2) / 4;
  const base = family === 'grass' ? 7 : family === 'stone' ? 4 : family === 'sand' ? 2 : 1.5;
  const amplitude = family === 'grass' ? 24 : family === 'stone' ? 3 : family === 'sand' ? 4 : 2;
  return base + rolling * amplitude + offset;
}

// Cubic B-spline weights blend the surrounding heights without forcing a flat
// tangent at every tile center. Nonnegative weights avoid overshooting crests.
export function blendedForestSurfaceHeight(x: number, y: number,
  sample: (x: number, y: number) => string | null): number {
  const ix=Math.floor(x-.5), iy=Math.floor(y-.5);
  const weights=(t:number)=>[
    (1-t)**3/6,
    (3*t**3-6*t*t+4)/6,
    (-3*t**3+3*t*t+3*t+1)/6,
    t**3/6,
  ];
  const wx=weights(x-.5-ix), wy=weights(y-.5-iy);
  let height=0;
  for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++) {
    const family=sample(ix+dx-1,iy+dy-1);
    if(family)height+=forestSurfaceHeight(x,y,family)*wx[dx]*wy[dy];
  }
  return height;
}
