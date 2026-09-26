const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'../public/assets/forest-painterly');
const read=name=>PNG.sync.read(fs.readFileSync(path.join(root,name+'.png')));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
for(const family of ['grass','dirt','stone','water','sand']) {
  const base=read(`${family}-1-square`);
  for(let n=1;n<=(family==='grass'?19:4);n++) {
    const square=read(`${family}-${n}-square`);
    for(let k=0;k<256;k++)for(let c=0;c<4;c++) {
      assert.equal(square.data[k*256*4+c],square.data[(k*256+255)*4+c],`${family} horizontal seam`);
      assert.equal(square.data[k*4+c],square.data[(255*256+k)*4+c],`${family} vertical seam`);
      for(const p of [k*256,k*256+255,k,255*256+k])assert.equal(square.data[p*4+c],base.data[p*4+c],`${family} variant border`);
    }
    const tile=read(`forest_${family}_${n}`);
    assert.equal(tile.width,256);assert.equal(tile.height,128);
    assert.equal(tile.data[3],0);assert.equal(tile.data[(64*256+128)*4+3],255);
  }
}
for(const object of manifest.objects) {
  const sprite=read(object.id);
  let transparent=0,opaque=0;
  for(let i=3;i<sprite.data.length;i+=4){if(sprite.data[i]===0)transparent++;if(sprite.data[i]>240)opaque++;}
  assert.ok(transparent>sprite.width*sprite.height*.08,`${object.id} missing alpha`);
  assert.ok(opaque>sprite.width*sprite.height*.1,`${object.id} empty sprite`);
}
assert.equal(manifest.terrain.length,35);assert.equal(manifest.objects.length,50);
console.log('Verified 35 isometric tiles, exact matching material/variant borders, and 50 transparent props.');

for(const [id,height] of Object.entries({tall_oak:260,tall_birch:320,tall_beech:300,ancient_oak:360}))assert.equal(read('forest_'+id).height/2,height,'Tall tree world height');

const face=read('coastal-cliff-face');
for(let y=0;y<256;y++)for(let c=0;c<4;c++)assert.equal(face.data[y*256*4+c],face.data[(y*256+255)*4+c],'cliff face repeat seam');
for(const [name,w,h] of [['x',2,1],['y',1,2],['corner',2,2]]){
 const cliff=read('forest_coast_cliff_'+name);
 assert.equal(cliff.width,(w+h)*64);assert.equal(cliff.height,((w+h)*16+72)*2);
}
console.log('Verified aligned 72px cliff module dimensions and repeating rock face.');

const hd=read('grass-world-hd');assert.equal(hd.width,1024);assert.equal(hd.height,1024);
for(let k=0;k<1024;k++)for(let c=0;c<4;c++){assert.equal(hd.data[(k*1024)*4+c],hd.data[(k*1024+1023)*4+c]);assert.equal(hd.data[k*4+c],hd.data[(1023*1024+k)*4+c]);}
console.log('Verified continuous 1024px world grass material.');
