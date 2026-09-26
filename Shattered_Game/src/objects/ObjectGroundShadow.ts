import type { ForestVisualVariation } from './ForestVisualVariation';
import Phaser from 'phaser';
import { FOREST_WALL_FEET } from './ForestWallGrounding';
import type { ObjectDefinition } from './ObjectTypes';

// Separate ground layer: actor occlusion and foliage sway must not lift shadows.
export function createObjectGroundShadow(
  scene: Phaser.Scene, definition: ObjectDefinition, x: number, y: number, depth: number,
  variation: ForestVisualVariation = {width:1,height:1,flipX:false},
): Phaser.GameObjects.Graphics | undefined {
  const shadow=definition.shadow;
  if(!shadow.enabled) return undefined;
  const graphics=scene.add.graphics({x,y}).setDepth(depth);
  const wallFeet=FOREST_WALL_FEET[definition.id];
  if(wallFeet) {
    const points=wallFeet.map(([px,py])=>new Phaser.Geom.Point(px,py));
    graphics.lineStyle(12,0x172b20,.08);graphics.strokePoints(points,false);
    graphics.lineStyle(6,0x172b20,.18);graphics.strokePoints(points,false);
  } else if(definition.category==='tree' && definition.id.startsWith('forest_')) {
    const w=shadow.width*variation.width,h=shadow.height*(.6+.4*variation.height);
    const points=Array.from({length:40},(_,i)=>{
      const angle=i*Math.PI*2/40,radius=.48+.025*Math.sin(angle*5);
      return [Math.cos(angle)*radius,Math.sin(angle)*radius];
    });
    graphics.fillStyle(0x0b2425,shadow.alpha);
    graphics.fillPoints(points.map(([px,py])=>new Phaser.Geom.Point(
      shadow.localOffsetX*variation.height+px*w,shadow.localOffsetY+py*h+px*w*.22)),true);
    graphics.fillStyle(0x071c1c,.15);
    graphics.fillEllipse(0,-4,76*variation.width,22*variation.width);
  } else {
    graphics.fillStyle(0x0b2425,shadow.alpha);
    graphics.fillEllipse(shadow.localOffsetX,shadow.localOffsetY,shadow.width*variation.width,shadow.height*variation.width);
  }
  return graphics;
}
