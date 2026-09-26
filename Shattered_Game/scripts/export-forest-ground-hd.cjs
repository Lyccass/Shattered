// Compile the painted ground master as a continuous world material.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
module.exports=(async()=>{
 const root=path.resolve(__dirname,'..'),N=1024;
 const data=await sharp(path.join(root,'art/forest-painterly/source/coastal-v2/grass.png')).resize(N,N).ensureAlpha().raw().toBuffer();
 // Weld opposite edges without changing the detailed interior.
 for(let y=0;y<N;y++)for(let k=0;k<48;k++)for(let c=0;c<3;c++){
  const a=(y*N+k)*4+c,b=(y*N+N-1-k)*4+c,t=.5*(1-k/48)**2,l=data[a],r=data[b];
  data[a]=Math.round(l*(1-t)+r*t);data[b]=Math.round(r*(1-t)+l*t);
 }
 for(let x=0;x<N;x++)for(let k=0;k<48;k++)for(let c=0;c<3;c++){
  const a=(k*N+x)*4+c,b=((N-1-k)*N+x)*4+c,t=.5*(1-k/48)**2,l=data[a],r=data[b];
  data[a]=Math.round(l*(1-t)+r*t);data[b]=Math.round(r*(1-t)+l*t);
 }
 await sharp(data,{raw:{width:N,height:N,channels:4}}).png().toFile(path.join(root,'public/assets/forest-painterly/grass-world-hd.png'));
})().catch(e=>{console.error(e);process.exitCode=1;});
