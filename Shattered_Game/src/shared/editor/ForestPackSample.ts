import { createEditorMap, type EditorMapDefinition } from './EditorMapTypes';

// Authored demonstration data. This does not modify a working draft or world chunks.
export function createForestPackSample(): EditorMapDefinition {
  const map = createEditorMap(22,22,'grass','forest_pack_sample','Painted Forest — Art Sample');
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
    const coast = x > 16 + Math.sin(y*.5)*1.5;
    const path = Math.abs(y - (12+Math.sin(x*.35)*2)) < 1.4;
    const stone = x>10 && x<16 && y>3 && y<9;
    const beach = x > 14 + Math.sin(y*.5)*1.5;
    const family = coast ? 'water' : beach ? 'sand' : path ? 'dirt' : stone ? 'stone' : 'grass';
    const id = `forest_${family}_${1+(x*3+y*7)%4}`;
    map.terrain[y][x]=family;
    map.terrainTiles[`${x},${y}`]={id,family,textureKey:`terrain-${id}`,walkable:family!=='water',flipX:false,flipY:false};
  }
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
    if(map.terrain[y][x]!=='grass')continue;
    let variant=1+(x*3+y*7)%4;
    if(x<8&&y<8)variant=6;
    else if(x<7&&y>14)variant=7;
    else if(x>11&&y>12)variant=8;
    else if(x>7&&y<6)variant=5;
    const distance=Math.min(
      Math.hypot((x-3)/1.1,y-9),
      Math.hypot((x-10)/1.2,(y-18)/1.15),
      Math.hypot((x-9)/1.2,(y-2)/.9),
    );
    if(distance<1.2)variant=12;
    else if(distance<2)variant=11;
    else if(distance<2.8)variant=10;
    else if(distance<3.5)variant=9;
    if(x>=8&&x<=9&&y>=8&&y<=9)variant=13;
    if(x>=13&&x<=14&&y>=2&&y<=3)variant=14;
    const id=`forest_grass_${variant}`;
    map.terrainTiles[`${x},${y}`]={...map.terrainTiles[`${x},${y}`],id,textureKey:`terrain-${id}`};
  }
  const objects: Array<[string,number,number]> = [
    ['tall_oak',3,5],['tall_golden_birch',7,3],['tall_copper_beech',4,16],['ancient_oak',13,18],
    ['tall_burgundy_oak',9,1],['young_oak',9,14],
    ['ferns',4,7],['ferns',6,5],['ferns',8,18],['ferns',14,16],
    ['boulder',14,10],['rocks',16,15],['stump',8,15],
    ['wall_x',11,5],['wall_x',13,5],['wall_y',11,6],['wall_corner',13,7],
    ['cliff_low',5,8],['cliff_high',2,9],['ramp',7,8],
    ['rocks',8,2],['pebble_scatter',10,3],['ferns',10,2],
    ['mushrooms_red',3,7],['mushrooms_red',12,18],
    ['mushrooms_gold',6,3],['mushrooms_gold',5,16],
    ['mushrooms_lavender',9,3],['mushrooms_lavender',11,17],
    ['fallen_branch',5,17],['fallen_branch',6,4],['twigs',7,16],['twigs',4,6],
    ['leaf_litter',3,6],['leaf_litter',7,5],['pebble_scatter',14,14],['pebble_scatter',15,16],
    ['flowers_cream',7,13],['flowers_cream',6,14],['flowers_cream',5,12],
    ['flowers_lavender',11,15],['flowers_lavender',12,16],['flowers_lavender',13,14],
  ];
  objects.push(['tall_birch',2,13],['tall_oak',8,10],['tall_oak',10,9]);
  const beds=['fern_bed','woodland_litter','flower_patch','mushroom_bed','rock_garden','branch_bed'];
  for(let y=2;y<21;y+=2)for(let x=2;x<20;x+=2) {
    if(map.terrain[y][x]!=='grass' || (x*7+y*11)%5>1)continue;
    if(objects.some(([,ox,oy])=>Math.hypot(ox-x,oy-y)<1.5))continue;
    objects.push([beds[(x*3+y)%beds.length],x,y]);
  }
  map.objects=objects.map(([id,tileX,tileY],i)=>({id:`forest_sample_${i}`,definitionId:`forest_${id}`,tileX,tileY}));
  return map;
}
