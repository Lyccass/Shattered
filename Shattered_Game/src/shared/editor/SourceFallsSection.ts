import type { EditorMapDefinition } from './EditorMapTypes';
import { FOREST_HEIGHT_OFFSETS } from '../iso/ForestRelief';
import { FOREST_OBJECT_DEFINITIONS } from '../../objects/ForestObjectDefinitions';

type Anchor = {tileX: number; tileY: number};
export const SOURCE_FALLS_PLACES = [
  {name: 'Source Falls', x: 49, y: 12},
  {name: 'Falls Ascent', x: 60, y: 11},
  {name: 'Spring Overlook', x: 54, y: 5},
] as const;

// A generous curve joins the existing eastward trail at (62,18).
export const SOURCE_FALLS_ROUTE = [[62,18],[61,15],[60,12],[60,9],[58,6],[54,5],[51,5]] as const;
function segmentDistance(x: number, y: number, a: readonly number[], b: readonly number[]): number {
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}
export const sourceFallsPathDistance = (x: number,y: number) => Math.min(
  ...SOURCE_FALLS_ROUTE.slice(1).map((p,i)=>segmentDistance(x,y,SOURCE_FALLS_ROUTE[i],p)),
);
export const inSourceFallsSection = (x: number,y: number) =>
  (x>=43 && x<=63 && y>=2 && y<=12) || sourceFallsPathDistance(x,y)<2.7;
const smooth = (t: number) => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const tiers = [9,10,11,12,15,16,17,18];

/** Author through the normal editor model; retain the grid's existing movement rules. */
export function sculptSourceFalls(map: EditorMapDefinition, protectedPoints: ReadonlyArray<Anchor>): void {
  const protectedAt=(x:number,y:number)=>protectedPoints.some(p=>Math.hypot(x-p.tileX,y-p.tileY)<2);
  for(let y=1;y<=19;y++)for(let x=40;x<=66;x++) {
    const key=`${x},${y}`, path=sourceFallsPathDistance(x,y)<1.25;
    // Round the crest into the surrounding lowland on every side. The ascent
    // shares the grass height field, so a dirt tile never cuts a trench into it.
    const height=72*smooth((x-43)/6)*smooth((66-x)/7)*smooth((y-1)/3)*smooth((16-y)/9);
    const pool=Math.hypot((x-44)/2.8,(y-10)/2.1);
    const outlet=segmentDistance(x,y,[44,10],[42,13]);
    let family=map.terrain[y][x];
    if((pool<1 || outlet<1.2) && x<46 && !protectedAt(x,y)) family='water';
    else if(family!=='water' && path) family='dirt';
    else if(pool<1.4 && family==='grass') family='sand';
    if(family!=='grass' && family!=='dirt' && family!=='water' && family!=='sand') continue;
    if(height<1 && !path && pool>=1.4 && outlet>=1.2) continue;
    const relief=tiers.reduce((best,t)=>Math.abs(FOREST_HEIGHT_OFFSETS[t]-height)<Math.abs(FOREST_HEIGHT_OFFSETS[best]-height)?t:best);
    const variant=(family==='grass'||family==='dirt') && height>=2 ? relief : 1;
    const id=`forest_${family}_${variant}`, walkable=family!=='water';
    map.terrain[y][x]=family;
    map.terrainWalkability[key]=walkable;
    map.terrainTiles[key]={id,family,textureKey:`terrain-${id}`,textureScale:.25,walkable,flipX:false,flipY:false};
  }
}

export function placeSourceFalls(map: EditorMapDefinition, protectedPoints: ReadonlyArray<Anchor>): void {
  const occupied=new Set<string>();
  const add=(definitionId:string,x:number,y:number)=>{
    const definition=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===definitionId)!;
    if(definition.collisionFootprint.some(p=>!map.terrainWalkability[`${x+p.x},${y+p.y}`]
      || occupied.has(`${x+p.x},${y+p.y}`)
      || protectedPoints.some(a=>Math.hypot(x+p.x-a.tileX,y+p.y-a.tileY)<2)))return;
    for(const p of definition.collisionFootprint)occupied.add(`${x+p.x},${y+p.y}`);
    map.objects.push({id:`river_woodland_source_falls_${definitionId}_${x}_${y}`,definitionId,tileX:x,tileY:y});
  };
  // Overlap the low rocks of each silhouette; never expose a straight cut end.
  // All footprints belong wholly to chunk (1,0), away from the ascent corridor.
  add('source_falls_waterfall',46,7);
  add('natural_cliff_shoulder_low_left',50,8);
  add('natural_cliff_columns_medium_left',52,9);
  add('natural_cliff_shoulder_low_right',55,9);
  for(const [name,x,y] of [
    ['ferns',50,12],['ferns',56,12],['coast_reeds',40,11],
    ['coast_reeds',46,13],['flowers_cream',57,8],['flowers_lavender',62,10],
    ['rocks',51,3],['large_bush',47,4],['young_oak',48,2],
    ['young_oak',62,4],['bench',53,3],['direction_sign',63,16],
  ] as const) add(`forest_${name}`,x,y);
}
