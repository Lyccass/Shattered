import {describe,expect,it} from 'vitest';
import {createCliffKitSample} from './CliffKitSample';
import {CLIFF_KIT_DEFINITIONS} from '../../objects/CliffKitDefinitions';
describe('modular cliff kit',()=>{
 it('has every sample part registered with an invariant shared datum',()=>{
  const defs=new Map(CLIFF_KIT_DEFINITIONS.map(d=>[d.id,d]));
  expect(defs.size).toBe(CLIFF_KIT_DEFINITIONS.length);
  for(const obj of createCliffKitSample().objects){
   const def=defs.get(obj.definitionId);expect(def).toBeDefined();expect(def?.fixedElevation).toBe(0);
  }
 });
 it('provides a broad grass climb at every height and direction',()=>{
  for(const height of [32,64,96,128,160])for(let rotation=0;rotation<4;rotation++){
   const bank=CLIFF_KIT_DEFINITIONS.find(d=>d.id===`cliffkit_bank_${height}_${rotation}`);
   expect(bank?.collisionFootprint).toHaveLength(16);
   expect(bank?.blocksMovement).toBe(true);
  }
  const sample=createCliffKitSample();
  const banks=sample.objects.filter(o=>o.definitionId.startsWith('cliffkit_bank_'));
  expect(banks).toHaveLength(3);
  for(const bank of banks){
   expect(bank.definitionId.endsWith('_2')).toBe(true);
   // Rotation 2 puts the high landing at the rear, facing the plateau.
   for(let x=bank.tileX;x<bank.tileX+4;x++)expect(sample.objects.some(o=>o.tileX===x&&o.tileY===bank.tileY-1&&o.definitionId.startsWith('cliffkit_edge_'))).toBe(true);
  }
 });
 it('matches high/low sockets on adjacent plateau tiles in both directions',()=>{
  const masks:Record<string,number[]>={outer:[1,2,4,8],inner:[14,13,11,7],edge:[3,6,12,9],fill:[15]};
  const cells=new Map<string,number>();
  for(const o of createCliffKitSample().objects){
   const [,kind,,r]=o.definitionId.split('_');if(!masks[kind])continue;
   cells.set(`${o.tileX},${o.tileY}`,masks[kind][Number(r)]);
  }
  for(const [key,m] of cells){const [x,y]=key.split(',').map(Number);
   const right=cells.get(`${x+1},${y}`)??0,down=cells.get(`${x},${y+1}`)??0;
   expect(!!(m&2)).toBe(!!(right&1));expect(!!(m&4)).toBe(!!(right&8));
   expect(!!(m&8)).toBe(!!(down&1));expect(!!(m&4)).toBe(!!(down&2));
  }
 });
});
