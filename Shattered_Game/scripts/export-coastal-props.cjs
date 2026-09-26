// Technical cutout/scale export of the reference-derived artwork. Originals remain intact.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),src=path.join(root,'art/forest-painterly/source/coastal-v2'),out=path.join(root,'public/assets/forest-painterly');
module.exports=(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 const record=(id,width,height)=>{
  manifest.objects=manifest.objects.filter(o=>o.id!==id);
  manifest.objects.push({id,path:`/assets/forest-painterly/${id}.png`,width,height,scale:.5});
 };
 const entries=[
  ['oak','tall_oak',null,260],['oak','oak',170],['oak','young_oak',110],['oak','ancient_oak',null,360],
  ['oak','tall_beech',null,300],['birch','tall_golden_birch',null,320],['burgundy','tall_burgundy_oak',null,280],
  ['flowers','flowers_cream',38],['flowers','coast_flowers',62],['rocks','rocks',64],['rocks','boulder',76],
  ['cliff_corner','cliff_high',128],['cliff_corner','cliff_low',128,85],
  ['stairs','coast_stairs_x',144],['reeds','coast_reeds',34],
 ];
 for(const [source,name,width,height] of entries){
  const p=PNG.sync.read(fs.readFileSync(path.join(src,source+'.png')));
  let x0=p.width,y0=p.height,x1=0,y1=0;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
   const a=(y*p.width+x)*4+3;
   // Remove only the generated translucent backdrop halo on these two masters.
   if(source==='birch'||source==='stairs')p.data[a]=Math.max(0,Math.min(255,(p.data[a]-180)*255/60));
   if(p.data[a]>12){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  }
  const result=await sharp(PNG.sync.write(p)).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1})
   .resize({width:width?width*2:undefined,height:height?height*2:undefined,fit:width&&height?'fill':'inside'}).png().toBuffer({resolveWithObject:true});
  const id='forest_'+name;fs.writeFileSync(path.join(out,id+'.png'),result.data);record(id,result.info.width,result.info.height);
 }
 await sharp(path.join(out,'forest_coast_stairs_x.png')).flop().toFile(path.join(out,'forest_coast_stairs_y.png'));
 const stairs=manifest.objects.find(o=>o.id==='forest_coast_stairs_x');record('forest_coast_stairs_y',stairs.width,stairs.height);
 // Rectify a painted interior section of the generated wall into a repeatable face.
 const wall=PNG.sync.read(fs.readFileSync(path.join(src,'cliff_x.png'))),face=new PNG({width:256,height:256});
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const sx=Math.round(300+x/255*300),sy=Math.round(.5*sx+100+y/255*430),a=(y*256+x)*4,b=(sy*wall.width+sx)*4;
  for(let c=0;c<3;c++)face.data[a+c]=wall.data[b+c];face.data[a+3]=255;
 }
 for(let y=0;y<256;y++)for(let k=0;k<24;k++)for(let c=0;c<3;c++){
  const a=(y*256+k)*4+c,b=(y*256+255-k)*4+c,t=.5*(1-k/24)**2,left=face.data[a],right=face.data[b];
  face.data[a]=Math.round(left*(1-t)+right*t);face.data[b]=Math.round(right*(1-t)+left*t);
 }
 fs.writeFileSync(path.join(out,'coastal-cliff-face.png'),PNG.sync.write(face));
 const grass=PNG.sync.read(fs.readFileSync(path.join(out,'grass-1-square.png')));
 // Exact 2:1 footprint geometry, 72px height, and shared edge texels permit butt joins.
 for(const [name,w,h] of [['x',2,1],['y',1,2],['corner',2,2]]){
  const H=72,W=(w+h)*32,TH=(w+h)*16,p=new PNG({width:W*2,height:(TH+H)*2});
  for(let yy=0;yy<p.height;yy++)for(let xx=0;xx<p.width;xx++){
   const px=(xx+.5)/2,py=(yy+.5)/2,dx=px-h*32;
   const u=(py/16+dx/32)/2,v=(py/16-dx/32)/2;
   let tex,tx,ty,light=1;
   if(u>=0&&u<=w&&v>=0&&v<=h){tex=grass;tx=Math.floor((u%1)*255);ty=Math.floor((v%1)*255);}
   else if(px<=w*32){
    const edge=TH-(w*32-px)/2;
    if(px<0||py<edge||py>edge+H)continue;
    tex=face;tx=Math.round(px/(w*32)*255);ty=Math.min(255,Math.floor((py-edge)/H*255));
   }else{
    const edge=TH-(px-w*32)/2;
    if(py<edge||py>edge+H)continue;
    tex=face;tx=Math.round((W-px)/(h*32)*255);ty=Math.min(255,Math.floor((py-edge)/H*255));light=.78;
   }
   const a=(yy*p.width+xx)*4,b=(ty*256+tx)*4;
   for(let c=0;c<3;c++)p.data[a+c]=Math.round((tex===grass?tex.data[b+c]*.55+[111,132,61][c]*.45:tex.data[b+c])*light);p.data[a+3]=255;
  }
  const id='forest_coast_cliff_'+name;fs.writeFileSync(path.join(out,id+'.png'),PNG.sync.write(p));record(id,p.width,p.height);
 }
 // Export the full painted ledge as one sprite; retain the unmodified master.
 const ledge=PNG.sync.read(fs.readFileSync(path.join(root,'art/forest-painterly/source/cliff-clean/ledge.png')));
 let lx=ledge.width,ly=ledge.height,rx=0,by=0;
 for(let y=0;y<ledge.height;y++)for(let x=0;x<ledge.width;x++){
  const i=(y*ledge.width+x)*4+3;
  ledge.data[i]=Math.max(0,Math.min(255,(ledge.data[i]-160)*255/80));
  if(ledge.data[i]>0){lx=Math.min(lx,x);ly=Math.min(ly,y);rx=Math.max(rx,x);by=Math.max(by,y);}
 }
 const clean=await sharp(PNG.sync.write(ledge)).extract({left:lx,top:ly,width:rx-lx+1,height:by-ly+1}).resize(640,464,{fit:'fill'}).png().toBuffer();
 fs.writeFileSync(path.join(out,'forest_coast_ledge_painted.png'),clean);record('forest_coast_ledge_painted',640,464);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Exported reference-style trees, details, stairs, and aligned cliff modules.');
})().catch(e=>{console.error(e);process.exitCode=1});
