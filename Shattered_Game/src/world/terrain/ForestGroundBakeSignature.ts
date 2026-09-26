/** Includes the relief/transition neighbour halo, so edited terrain never uses stale art. */
export function forestGroundBakeSignature(
  bounds: {drawStartX:number;drawStartY:number;drawEndX:number;drawEndY:number},
  sample:(x:number,y:number)=>string|null,
): string {
  let hash=2166136261;
  const add=(s:string)=>{for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619);};
  add(`${bounds.drawStartX},${bounds.drawStartY},${bounds.drawEndX},${bounds.drawEndY}|`);
  for(let y=bounds.drawStartY-2;y<bounds.drawEndY+2;y++)
    for(let x=bounds.drawStartX-2;x<bounds.drawEndX+2;x++)add(`${sample(x,y)??'-'}|`);
  return (hash>>>0).toString(16);
}
