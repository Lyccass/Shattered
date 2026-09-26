// Export generated painted sprites, remove neutral preview matte, and scale to game units.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),source=path.join(root,'art/forest-painterly/source'),out=path.join(root,'public/assets/forest-painterly');
const entries=[['shack',240],['lantern_post',48],['direction_sign',56],['large_bush',110],['fence_x',80],['wooden_gate',80],['bench',64],['supplies',54]];
module.exports=(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 for(const [name,width] of entries){
  const input=path.join(source,name+'.png'),metadata=await sharp(input).metadata();
  const p=PNG.sync.read(fs.readFileSync(input));let minX=p.width,minY=p.height,maxX=0,maxY=0;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
   const at=(y*p.width+x)*4,r=p.data[at],g=p.data[at+1],b=p.data[at+2];
   // The neutral checker matte is not artwork; do not key colored wood or moss.
   if(!metadata.hasAlpha && Math.min(r,g,b)>170 && Math.max(r,g,b)-Math.min(r,g,b)<20)p.data[at+3]=0;
   // The supplied bush has a soft alpha halo; keep only its painted leaf silhouette.
   if(name==='large_bush')p.data[at+3]=Math.max(0,Math.min(255,(p.data[at+3]-150)*255/70));
   if(p.data[at+3]>10){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  fs.writeFileSync(path.join(source,name+'-export-cutout.png'),PNG.sync.write(p));
  const exported=await sharp(PNG.sync.write(p)).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).resize({width:width*2}).png().toBuffer({resolveWithObject:true});
  const id='forest_'+name;fs.writeFileSync(path.join(out,id+'.png'),exported.data);
  manifest.objects=manifest.objects.filter(o=>o.id!==id);manifest.objects.push({id,path:'/assets/forest-painterly/'+id+'.png',width:exported.info.width,height:exported.info.height,scale:.5});
 }
 for(const [name,base] of [['fence_y','fence_x'],['gate_y','wooden_gate']]){
  await sharp(path.join(out,'forest_'+base+'.png')).flop().toFile(path.join(out,'forest_'+name+'.png'));
  const original=manifest.objects.find(o=>o.id==='forest_'+base),id='forest_'+name;
  manifest.objects=manifest.objects.filter(o=>o.id!==id);manifest.objects.push({...original,id,path:'/assets/forest-painterly/'+id+'.png'});
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Exported 10 settlement and shrub sprites.');
})().catch(e=>{console.error(e);process.exitCode=1});
