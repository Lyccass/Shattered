// Deterministic atlas slicing and isometric export. Artwork lives in art/forest-painterly/source.
// Requires sharp and pngjs; NODE_PATH may point at the bundled Codex Node packages.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'art/forest-painterly/source');
const output = path.join(root, 'public/assets/forest-painterly');
const N = 256;
const families = ['grass', 'dirt', 'stone', 'water', 'sand'];
const manifest = { version: 1, tileWidth: 64, tileHeight: 32, terrain: [], objects: [] };
const directions = [
  ['xPlus',1,0],['yPlus',0,1],['xMinus',-1,0],['yMinus',0,-1],
  ['xPlusYPlus',1,1],['xPlusYMinus',1,-1],['xMinusYPlus',-1,1],['xMinusYMinus',-1,-1],
];

function save(name, png) {
  fs.writeFileSync(path.join(output, name + '.png'), PNG.sync.write(png));
}

// Periodic material sampling. Opposite edge texels are welded below; variants
// change only the interior, retaining compatible boundaries without mirrored motifs.
function sample(data, u, v, channel) {
  const wrap = t => ((t % 1) + 1) % 1;
  const x = Math.min(N - 1, Math.floor(wrap(u) * N));
  const y = Math.min(N - 1, Math.floor(wrap(v) * N));
  return data[(y * N + x) * 4 + channel];
}

function weldEdges(data) {
  for(const axis of [0,1])for(let k=0;k<32;k++)for(let along=0;along<N;along++) {
    const a=(axis? k*N+along:along*N+k)*4;
    const b=(axis? (N-1-k)*N+along:along*N+N-1-k)*4;
    const t=k/32, blend=.5*(1-t*t*(3-2*t));
    for(let c=0;c<3;c++) {
      const left=data[a+c],right=data[b+c];
      data[a+c]=Math.round(left*(1-blend)+right*blend);
      data[b+c]=Math.round(right*(1-blend)+left*blend);
    }
  }
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const meta = await sharp(path.join(source, 'terrain-atlas.png')).metadata();
  const cell = Math.floor(Math.min(meta.width, meta.height) / 2);
  for (let i = 0; i < families.length; i++) {
    const family = families[i];
    const swatch = Math.min(240,cell);
    const inset = Math.floor((cell-swatch)/2);
    const detailIndex={dirt:0,sand:1,stone:2}[family];
    const coastal=path.join(source,'coastal-v2',family+'.png');
    const input=family==='grass'?'grass-detailed.png':detailIndex!==undefined?'ground-detail.png':'terrain-atlas.png';
    const size=detailIndex!==undefined?724:family==='grass'?627:swatch;
    const pipeline=fs.existsSync(coastal)?sharp(coastal):sharp(path.join(source,input))
      .extract({left:detailIndex!==undefined?detailIndex*724:family==='grass'?0:(i%2)*cell+inset,
        top:detailIndex!==undefined||family==='grass'?0:Math.floor(i/2)*cell+inset,width:size,height:size});
    const data=await pipeline.resize(N,N).ensureAlpha().raw().toBuffer();
    weldEdges(data);
    for (let variant = 0; variant < 4; variant++) {
      const square = new PNG({ width: N, height: N });
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const u = (x + .5) / N, v = (y + .5) / N;
        const edge = Math.min(u, v, 1-u, 1-v);
        const mix = variant ? Math.min(1, Math.max(0, (edge - .13) / .2)) : 0;
        const at = (y * N + x) * 4;
        for (let c = 0; c < 3; c++) square.data[at+c] = Math.round(
          sample(data,u,v,c) * (1-mix) + sample(data,u+variant*.173,v+variant*.117,c)*mix);
        square.data[at+3] = 255;
      }
      save(`${family}-${variant+1}-square`, square);
      // 2:1 orthographic diamond. Each pixel samples the square material;
      // transparent outside, no bevel or baked shadow to create tile seams.
      const diamond = new PNG({ width: 256, height: 128 });
      for (let y=0;y<128;y++) for(let x=0;x<256;x++) {
        const u = (y+.5)/128 + (x+.5-128)/256;
        const v = (y+.5)/128 - (x+.5-128)/256;
        if(u<0 || u>=1 || v<0 || v>=1) continue;
        const a=(y*256+x)*4, b=(Math.floor(v*N)*N+Math.floor(u*N))*4;
        square.data.copy(diamond.data,a,b,b+4);
      }
      const id=`forest_${family}_${variant+1}`;
      save(id,diamond);
      manifest.terrain.push({id, family, path:`/assets/forest-painterly/${id}.png`});
      if (variant === 0) {
        for (const [direction, dx, dy] of directions) {
          const overlay = new PNG({width:256,height:128});
          for(let y=0;y<128;y++)for(let x=0;x<256;x++) {
            const at=(y*256+x)*4;
            if (!diamond.data[at+3]) continue;
            const u=(y+.5)/128+(x+.5-128)/256, v=(y+.5)/128-(x+.5-128)/256;
            const a=dx>0?1-u:u, b=dy>0?1-v:v;
            const distance=dx&&dy?Math.hypot(a,b):dx?a:b;
            const noise=.022*Math.sin(u*63+v*29)+.014*Math.sin(u*107-v*79);
            const fade=Math.min(1,Math.max(0,(.32+noise-distance)/.13));
            diamond.data.copy(overlay.data,at,at,at+4);
            overlay.data[at+3]=Math.round(fade*255);
          }
          save(`forest_blend_${family}_${direction}`,overlay);
        }
        if(family==='water') {
          const glints=new PNG({width:256,height:128});
          for(let i=0;i<diamond.data.length;i+=4){
            glints.data[i]=163;glints.data[i+1]=223;glints.data[i+2]=215;
            glints.data[i+3]=diamond.data[i+3]?Math.max(0,(diamond.data[i+1]-160)*.7):0;
          }
          save('forest_water_glints',glints);
        }
      }
    }
  }
  // Additional floor materials retain the approved grass border, so they can
  // touch the existing grass variants without introducing tile seams.
  const floorPath=path.join(source,'floor-expansion.png');
  if(fs.existsSync(floorPath)) {
    const m=await sharp(floorPath).metadata(), cell=Math.floor(Math.min(m.width,m.height)/2);
    const border=PNG.sync.read(fs.readFileSync(path.join(output,'grass-1-square.png')));
    const labels=['Moss Carpet','Fallen Leaves','Woodland Twigs','Pebbled Grass'];
    for(let i=0;i<4;i++) {
      const material=await sharp(floorPath).extract({left:(i%2)*cell,top:Math.floor(i/2)*cell,width:cell,height:cell})
        .resize(N,N).ensureAlpha().raw().toBuffer();
      const square=new PNG({width:N,height:N});
      for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
        const at=(y*N+x)*4, distance=Math.min(x,y,N-1-x,N-1-y);
        const t=Math.max(0,Math.min(1,(distance-24)/40)), blend=t*t*(3-2*t)*.18;
        for(let c=0;c<3;c++)square.data[at+c]=Math.round(border.data[at+c]*(1-blend)+material[at+c]*blend);
        square.data[at+3]=255;
      }
      save(`grass-${i+5}-square`,square);
      const diamond=new PNG({width:256,height:128});
      for(let y=0;y<128;y++)for(let x=0;x<256;x++) {
        const u=(y+.5)/128+(x+.5-128)/256,v=(y+.5)/128-(x+.5-128)/256;
        if(u<0||u>=1||v<0||v>=1)continue;
        const from=(Math.floor(v*N)*N+Math.floor(u*N))*4;
        square.data.copy(diamond.data,(y*256+x)*4,from,from+4);
      }
      const id=`forest_grass_${i+5}`;save(id,diamond);
      manifest.terrain.push({id,family:'grass',label:labels[i],path:`/assets/forest-painterly/${id}.png`});
    }
  }
  for(let variant=9;variant<=19;variant++) {
    const id=`forest_grass_${variant}`;
    fs.copyFileSync(path.join(output,'forest_grass_1.png'),path.join(output,id+'.png'));
    fs.copyFileSync(path.join(output,'grass-1-square.png'),path.join(output,`grass-${variant}-square.png`));
    const labels=['Hill Foot','Lower Slope','Hill Shoulder','Hill Crest','Shallow Hollow','Gentle Rise','Highland Foot','Highland Slope','Highland Shoulder','High Plateau','Cliff Plateau Module'];
    const offsets=[4,8,14,22,-5,11,30,42,56,72,96];
    manifest.terrain.push({id,family:'grass',label:labels[variant-9],heightOffset:offsets[variant-9],requiresReliefRenderer:true,path:`/assets/forest-painterly/${id}.png`});
  }
  for (const [file, names, widths, columns] of [
    ['props-calm-cutout.png', ['oak','young_oak','boulder','ferns','stump','rocks'], [170,125,76,62,58,64], 3],
    ['cliffs-calm-cutout.png', ['cliff_low','cliff_high','ramp'], [128,128,128], 3],
    ['walls-calm.png', ['wall_x','wall_y','wall_corner'], [96,96,96], 3],
    ['trees-tall-cutout.png', ['tall_oak','tall_birch','tall_beech','ancient_oak'], [140,140,140,140], 2],
    ['debris-expansion-cutout.png', ['fallen_branch','twigs','pebble_scatter','leaf_litter','flowers_cream','flowers_lavender'], [58,36,38,44,32,34], 3],
    ['autumn-mushrooms-cutout.png', ['tall_golden_birch','tall_copper_beech','tall_burgundy_oak','mushrooms_red','mushrooms_gold','mushrooms_lavender'], [140,140,140,22,24,22], 3],
    ['hills-flat.png', ['hill_low','hill_rolling','slope_x','slope_y'], [128,192,128,128], 2],
  ]) {
    if (!fs.existsSync(path.join(source,file))) continue;
    const m=await sharp(path.join(source,file)).metadata();
    if(!m.hasAlpha)throw new Error(`${file} needs real transparency before export.`);
    for (let i=0;i<names.length;i++) {
      const regions = file.startsWith('props') ? [[0,0,610,630],[610,0,425,630],[1035,0,501,630],[0,630,565,394],[565,630,490,394],[1055,630,481,394]] : null;
      const left=regions?.[i][0] ?? Math.floor((i%columns)*m.width/columns);
      const cellHeight=Math.floor(m.height/Math.ceil(names.length/columns));
      const top=regions?.[i][1] ?? (file==='autumn-mushrooms-cutout.png' ? (i<3?0:670) : Math.floor(i/columns)*cellHeight);
      const width=regions?.[i][2] ?? Math.floor(((i%columns)+1)*m.width/columns)-left;
      const height=regions?.[i][3] ?? (file==='autumn-mushrooms-cutout.png' ? (i<3?670:m.height-670) : cellHeight);
      const img=await sharp(path.join(source,file)).extract({left,top,width,height}).ensureAlpha().raw().toBuffer();
      let minX=width,minY=height,maxX=0,maxY=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(img[(y*width+x)*4+3]>12){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      if(minX>maxX)throw new Error(`Empty sprite ${names[i]}`);
      const id=`forest_${names[i]}`;
      const tallHeights={tall_oak:260,tall_birch:320,tall_beech:300,ancient_oak:360,tall_golden_birch:320,tall_copper_beech:300,tall_burgundy_oak:280};
      const size=tallHeights[names[i]]?{height:tallHeights[names[i]]*2}:{width:widths[i]*2};
      const result=await sharp(img,{raw:{width,height,channels:4}}).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).resize(size).flop(names[i]==='wall_y' && file!=='walls-calm.png').png().toBuffer({resolveWithObject:true});
      fs.writeFileSync(path.join(output,id+'.png'),result.data);
      manifest.objects.push({id,path:`/assets/forest-painterly/${id}.png`,width:result.info.width,height:result.info.height,scale:.5});
    }
  }
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Exported ${manifest.terrain.length} terrain tiles and ${manifest.objects.length} props.`);
}
main().then(async()=>{await require('./export-settlement-props.cjs');await require('./export-coastal-props.cjs');await require('./export-forest-ground-hd.cjs');}).catch(error=>{ console.error(error); process.exitCode=1; });
