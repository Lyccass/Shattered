import { createEditorMap } from './EditorMapTypes';
import { FOREST_OBJECT_DEFINITIONS } from '../../objects/ForestObjectDefinitions';
import { inSourceFallsSection, placeSourceFalls, sculptSourceFalls, SOURCE_FALLS_PLACES } from './SourceFallsSection';

export const RIVER_WOODLAND_PLACES = [
  {name:'Harbor Trail',x:4,y:4},
  {name:'Maren’s Clearing',x:20,y:17},
  {name:'Old River Gate',x:48,y:20},
  {name:'Silver Birch Hollow',x:17,y:43},
  {name:'The Elder Court',x:51,y:48},
  {name:'Western Overlook',x:8,y:39},
  {name:'Source Bluffs',x:55,y:11},
  {name:'Eastwood Camp',x:76,y:18},
  {name:'Mosswatch Ruins',x:78,y:48},
  {name:'Willow Meadows',x:18,y:72},
  {name:'River Mouth',x:49,y:73},
  {name:'Amber Cove',x:77,y:75},
  ...SOURCE_FALLS_PLACES,
] as const;
const riverX=(y:number)=>37+Math.sin(y*.12)*5;
const paths=[[[4,4],[12,10],[20,17],[28,21],[48,21],[48,20]],
 [[20,17],[14,30],[17,43],[27,45],[43,45],[51,48]],
 [[48,20],[54,30],[55,39],[51,48]],
 [[48,20],[64,18],[76,18],[78,32],[78,48],[77,64],[77,75]],
 [[17,43],[18,57],[18,72],[32,73],[49,73],[64,75],[77,75]],
 [[51,48],[64,48],[78,48]],[[51,48],[49,64],[49,73]]];
function segmentDistance(x:number,y:number,a:number[],b:number[]):number {
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
 return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
}
const pathDistance=(x:number,y:number)=>Math.min(...paths.flatMap(path=>path.slice(1).map((p,i)=>segmentDistance(x,y,path[i],p))));
function noise(x:number,y:number):number {
 let h=Math.imul(x+781,73856093)^Math.imul(y+391,19349663);
 h=Math.imul(h^(h>>>16),0x85ebca6b);return (h>>>0)/0xffffffff;
}

/** A single authored composition spanning nine 32×32 chunks, with routes crossing every chunk boundary. */
export function createRiverWoodlandMap(protectedPoints:ReadonlyArray<{tileX:number;tileY:number}>=[]) {
 const map=createEditorMap(96,96,'grass','river_woodland','The Wake — River Woodland');
 const protectedAt=(x:number,y:number)=>protectedPoints.some(p=>Math.hypot(x-p.tileX,y-p.tileY)<2);
 for(let y=0;y<96;y++)for(let x=0;x<96;x++) {
  const river=Math.abs(x-riverX(y)),source=Math.hypot((x-41)/1.2,y-7),pool=Math.hypot((x-39)/1.5,y-55);
  const coastY=84+Math.sin(x*.12)*3,coastX=91+Math.sin(y*.1)*2;
  const sea=y>coastY||x>coastX;
  const water=sea||(y>=7&&y<=88&&river<2.2)||source<3.5||pool<5;
  const bank=(y>=5&&y<=90&&river<3.6)||source<4.5||pool<6||y>coastY-3||x>coastX-3;
  const crossing=(Math.abs(y-21)<=1||Math.abs(y-45)<=1||Math.abs(y-73)<=1)&&river<5;
  const plaza=Math.hypot((x-48)/1.1,y-20)<6;
  const elder=Math.hypot(x-51,y-48)<5;
  let family: 'grass'|'water'|'sand'|'stone'|'dirt'=water?'water':bank?'sand':'grass';
  if(crossing)family=y<30?'stone':'sand';
  else if(!water&&(plaza||elder))family=plaza?'stone':'dirt';
  else if(!water&&pathDistance(x,y)<1.3)family='dirt';
  if(protectedAt(x,y)&&family==='water')family='grass';
  // Broad crests and gradual shoulders; the surrounding spline welds tile edges.
  const hill=Math.min(Math.hypot((x-9)/1.25,y-36),Math.hypot(x-55,(y-8)/1.15),Math.hypot(x-27,y-7),Math.hypot((x-84)/1.2,y-41),Math.hypot(x-65,(y-72)/1.2));
  const variant=family==='grass'&&hill<10?(hill<3?18:hill<4.5?17:hill<6?16:hill<7?15:hill<8?12:hill<9?10:9):1+Math.floor(noise(x,y)*4);
  const id=`forest_${family}_${variant}`,walkable=family!=='water';
  map.terrain[y][x]=family;map.terrainWalkability[`${x},${y}`]=walkable;
  map.terrainTiles[`${x},${y}`]={id,family,textureKey:`terrain-${id}`,textureScale:.25,walkable,flipX:false,flipY:false};
 }
 sculptSourceFalls(map,protectedPoints);
 placeSourceFalls(map,protectedPoints);
 const occupied=new Set<string>(),trees:Array<[number,number]>=[];
 for(const o of map.objects)for(const p of FOREST_OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId)!.collisionFootprint)
  occupied.add(`${o.tileX+p.x},${o.tileY+p.y}`);
 const place=(name:string,x:number,y:number)=>{
  const def=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===`forest_${name}`)!;
  const cells=def.collisionFootprint.map(p=>({x:x+p.x,y:y+p.y}));
  if(cells.some(p=>Math.floor(p.x/32)!==Math.floor(x/32)||Math.floor(p.y/32)!==Math.floor(y/32)))return; // One chunk owns each complete footprint.
  if(cells.some(p=>p.x<0||p.y<0||p.x>=96||p.y>=96||inSourceFallsSection(p.x,p.y)||protectedAt(p.x,p.y)||!map.terrainWalkability[`${p.x},${p.y}`]||occupied.has(`${p.x},${p.y}`)))return;
  cells.forEach(p=>occupied.add(`${p.x},${p.y}`));
  map.objects.push({id:`river_woodland_${name}_${x}_${y}`,definitionId:def.id,tileX:x,tileY:y});
  if(def.category==='tree')trees.push([x,y]);
 };
 // A small inhabited clearing: structures sit beside the through-route.
 place('shack',14,21);place('supplies',12,22);place('bench',12,23);
 place('fence_y',11,20);place('fence_y',11,22);place('fence_x',12,24);place('fence_x',16,24);
 place('wooden_gate',14,24); // Continuous fence–gate–fence run; keep the main path outside the yard.
 for(const [x,y] of [[18,23],[25,18],[44,23],[50,28],[29,46]])place('lantern_post',x,y);
 for(const [x,y] of [[22,15],[46,22],[19,41]])place('direction_sign',x,y);
 for(const [x,y] of [[12,17],[19,24],[24,13],[15,38],[22,46],[46,46]])place('large_bush',x,y);
 // Camp, ruined lookout, meadow rest stop and a coastal clearing.
 place('shack',71,13);place('supplies',70,17);place('bench',73,19);
 for(const y of [12,14,16])place('fence_y',69,y);
 for(const [x,y] of [[73,22],[80,45],[47,76],[74,73],[20,69],[65,49]])place('lantern_post',x,y);
 for(const [x,y] of [[65,16],[76,44],[20,70],[46,71],[73,76]])place('direction_sign',x,y);
 for(const x of [73,75,79,81])place('wall_x',x,43);
 for(const y of [45,47,51])place('wall_y',83,y);
 place('wall_corner',81,53);place('supplies',80,50);
 place('bench',16,69);place('fallen_branch',21,74);place('stump',22,71);
 place('bench',74,77);place('supplies',79,77);

 // Reeds and flowering details trace the shore without covering the walkable route.
 for(let y=8;y<85;y+=6){const x=Math.round(riverX(y))-3;place('coast_reeds',x,y);}
 for(let x=5;x<88;x+=6){
  const y=Math.floor(82+Math.sin(x*.12)*3);place('coast_reeds',x,y);place('coast_flowers',x,y-3);
 }
 // Rounded understory masses complement the smaller fern and flower clusters.
 for(let y=8;y<82;y+=7)for(let x=5;x<87;x+=9){
  if(map.terrain[y][x]==='grass'&&pathDistance(x,y)>3&&noise(x+37,y+9)>.52)place('large_bush',x,y);
 }
 // Roofless gatehouse: gaps are deliberate entrances, not missing tiles.
 for(const x of [43,45,49,51])place('wall_x',x,14);
 for(const y of [16,18,22,24]){place('wall_y',42,y);place('wall_y',54,y);}
 for(const x of [44,46,50,52])place('wall_x',x,26);
 place('wall_corner',42,14);
 // Rocky outcrops mark the front edge of the uplands, with clear approaches behind.

 for(const [x,y] of [[5,38],[10,38],[52,10],[57,10],[26,9]])place('ferns',x,y);
 place('ancient_oak',49,48);place('stump',52,51);place('boulder',46,49);
 place('fallen_branch',14,45);place('stump',12,43);
 // Riparian rocks, a golden source grove, and a sheltered birch hollow.
 for(const y of [9,14,27,32,37,51,57]) {
  const x=Math.round(riverX(y));place('rocks',x-5,y);place('fern_bed',x+5,y+1);
 }
 for(let y=2;y<94;y++)for(let x=2;x<94;x++) {
  if(map.terrain[y][x]!=='grass'||protectedAt(x,y)||pathDistance(x,y)<2.7)continue;
  // Reserve visual breathing room around cliffs: root/canopy silhouettes extend
  // well beyond a tree's one-tile collision footprint.
  if(Math.min(Math.hypot(x-9,y-38),Math.hypot(x-55,y-10),Math.hypot(x-27,y-9))<5)continue; // Reveal the ridge silhouettes.
  if(map.objects.some(o=>{
   const d=FOREST_OBJECT_DEFINITIONS.find(d=>d.id===o.definitionId)!;
   return ['wall','fence','building'].includes(d.category)&&d.collisionFootprint.some(p=>Math.hypot(x-o.tileX-p.x,y-o.tileY-p.y)<3);
  }))continue;
  if(x>=10&&x<=20&&y>=18&&y<=28)continue; // Keep the shack yard and its props readable.
  if(RIVER_WOODLAND_PLACES.some(p=>Math.hypot(x-p.x,y-p.y)<6))continue;
  if(Math.hypot(x-50,y-49)<8|| (x>41&&x<57&&y>13&&y<28))continue;
  const dense=(Math.sin(x*.21)+Math.cos(y*.18))>.2;
  if(noise(x,y)>(dense?.19:.035)||trees.some(([tx,ty])=>Math.hypot(tx-x,ty-y)<2.5))continue;
  // Local species leanings overlap smoothly; no grove is a monoculture.
  const influence=(cx:number,cy:number,r:number)=>Math.exp(-((x-cx)**2+(y-cy)**2)/(r*r));
  const palette:Array<[string,number]>=[['tall_oak',1],['tall_beech',.65],
   ['tall_birch',.2+3*influence(17,43,18)],
   ['tall_burgundy_oak',.07+1.6*influence(51,48,16)],
   ['tall_golden_birch',.09+1.8*influence(41,7,14)],
   ['tall_copper_beech',.12+.45*influence(29,29,25)]];
  let choice=noise(y+181,x+57)*palette.reduce((sum,[,weight])=>sum+weight,0);
  let name=palette[0][0];
  for(const [candidate,weight] of palette){choice-=weight;if(choice<=0){name=candidate;break;}}
  place(name,x,y);
 }
 for(let y=2;y<94;y++)for(let x=2;x<94;x++) {
  if(map.terrain[y][x]!=='grass'||pathDistance(x,y)<1.7||noise(y+71,x+13)>.085)continue;
  const shade=trees.some(([tx,ty])=>Math.hypot(tx-x,ty-y)<3.5);
  place((x>64||y>64)&&noise(x+6,y)>.6?'coast_flowers':shade?(noise(x+3,y)>.5?'fern_bed':'woodland_litter'):y>33&&x<28?'flower_patch':x>44?'mushroom_bed':'rock_garden',x,y);
 }
 return map;
}
