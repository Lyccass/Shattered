import {cliffGrounding} from './CliffKitGrounding';
import {CLIFF_KIT_MODULES} from './CliffKitManifest';
import type {ObjectDefinition} from './ObjectTypes';
const directions=['NW','NE','SE','SW'];
export const CLIFF_KIT_ASSETS=CLIFF_KIT_MODULES.map(m=>({key:`object-${m.id}`,path:`/assets/forest-painterly/cliff-kit/${m.id}.png`}));
export const CLIFF_KIT_DEFINITIONS:ObjectDefinition[]=CLIFF_KIT_MODULES.map(m=>({
 id:m.id,displayName:`Cliff Kit · ${m.kind} · ${m.height}px · ${directions[m.rotation]}`,
 category:'cliff-kit',blocksMovement:true,fixedElevation:0,
 collisionFootprint:Array.from({length:m.size*m.size},(_,i)=>({x:i%m.size,y:Math.floor(i/m.size)})),
 visual:{parts:[{shape:'sprite',textureKey:`object-${m.id}`,scale:.25,originX:m.originX,originY:m.originY,localOffsetX:m.kind==='bank'?[-16,-16,16,16][m.rotation]:0,localOffsetY:(m.size-1)*16+(m.kind==='bank'?[8,-8,-8,8][m.rotation]:0)},...cliffGrounding(m.kind,m.rotation,m.height)]},
 shadow:{enabled:false,localOffsetX:0,localOffsetY:0,width:0,height:0,alpha:0},
 depth:{anchorMode:'frontTileCenter',localOffsetX:0,localOffsetY:0,depthOffset:.1},debug:{color:0x89954f},
}));

// Raised approaches connect existing tiers without rescaling the painted steps.
for(const [base,rise] of [[32,32],[32,64],[64,32],[64,64],[96,32],[96,64],[128,32]]){
 for(const definition of CLIFF_KIT_DEFINITIONS.filter(d=>d.id.match(new RegExp(`^cliffkit_(ramp|stairs)_${rise}_[0-3]$`)))){
  CLIFF_KIT_DEFINITIONS.push({...definition,id:`${definition.id}_base${base}`,
   displayName:`${definition.displayName} · ${base}→${base+rise}px`,
   visual:{parts:definition.visual.parts.map(p=>({...p,localOffsetY:p.localOffsetY-base}))}});
 }
}
