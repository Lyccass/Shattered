import Phaser from 'phaser';

const SWAY = new Map([
  ['object-forest_coast_reeds',{angle:1.4,duration:3200}],
  ['object-forest_coast_flowers',{angle:.5,duration:3100}],
  ['object-forest_large_bush', {angle:.5, duration:3500}],
  ['object-forest_tall_golden_birch', {angle:1.15, duration:3800}],
  ['object-forest_tall_copper_beech', {angle:.85, duration:4200}],
  ['object-forest_tall_burgundy_oak', {angle:.75, duration:4500}],
  ['object-forest_flowers_cream',{angle:.8,duration:2800}],
  ['object-forest_flowers_lavender',{angle:1,duration:3000}],
  ['object-forest_tall_oak', {angle:.8, duration:4300}],
  ['object-forest_tall_birch', {angle:1.15, duration:3800}],
  ['object-forest_tall_beech', {angle:.85, duration:4100}],
  ['object-forest_ancient_oak', {angle:.55, duration:5000}],
  ['object-forest_oak', {angle:1, duration:3400}],
  ['object-forest_young_oak', {angle:1.3, duration:2900}],
  ['object-forest_ferns', {angle:1.2, duration:2300}],
]);

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Animate the art around its ground contact only; collision and depth stay fixed.
// Bind cleanup to destruction so chunk eviction and editor redraw cannot leak tweens.
export function animateForestProp(scene: Phaser.Scene, image: Phaser.GameObjects.Image): void {
  const motion = SWAY.get(image.texture.key);
  if (!motion || reducedMotion()) return;
  const phase = Math.abs(Math.sin(image.parentContainer?.x ?? image.x));
  const tween = scene.tweens.add({targets:image, angle:{from:-motion.angle,to:motion.angle},
    duration:motion.duration + phase*650, delay:phase*700, yoyo:true, repeat:-1, ease:'Sine.easeInOut'});
  image.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
}

export function createForestWaterGlints(scene: Phaser.Scene, x: number, y: number, depth: number): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists('terrain-forest_water_glints')) return undefined;
  const image = scene.add.image(x,y,'terrain-forest_water_glints').setScale(.25).setDepth(depth).setAlpha(.35);
  if (!reducedMotion()) {
    // Shared timing avoids a checkerboard of individually pulsing water tiles.
    const phase = 0;
    const tween = scene.tweens.add({targets:image,alpha:{from:.15,to:.7},duration:2100+phase*1300,
      delay:phase*1500,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    image.once(Phaser.GameObjects.Events.DESTROY,()=>tween.remove());
  }
  return image;
}
