import Phaser from 'phaser';
import type { IsoTilemap } from '../../world/IsoTilemap';
import { getDynamicDepth } from '../../render/RenderLayers';

/** Small, bounded ambient life. Anchors stay in world space as the camera moves. */
export class ForestAtmosphere {
  constructor(scene: Phaser.Scene, getMap: () => IsoTilemap | null | undefined) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const motes = Array.from({length: 12}, () => scene.add.graphics());
    let elapsed = 0;
    const update = (time: number, delta: number) => {
      elapsed += delta;
      if (elapsed < 1000 / 30) return;
      elapsed = 0;
      const map = getMap(), view = scene.cameras.main.worldView;
      const cell = 180, startX = Math.floor(view.centerX / cell) - 2, startY = Math.floor(view.centerY / cell) - 1;
      motes.forEach((g, i) => {
        g.clear();
        if (!map) return;
        const cx = startX + i % 4, cy = startY + Math.floor(i / 4);
        const phase = cx * 13.7 + cy * 5.3, t = time * .001;
        const x = (cx + .5) * cell + Math.sin(t * .35 + phase) * 35;
        const y = (cy + .5) * cell + Math.cos(t * .43 + phase) * 18;
        const tile = map.transform.worldToTile(x,y);
        if (!map.isTileInBounds(tile.x,tile.y) || !map.isTileWalkable(tile.x,tile.y) || map.getSurfaceLift(x,y) < 3) return;
        g.setPosition(x, y - map.getSurfaceLift(x,y) - 12).setDepth(getDynamicDepth(y, 6));
        if (i % 3 === 0) {
          // Two wings flap independently of the slow drifting flight path.
          const wing = 1 + Math.abs(Math.sin(t * 11 + phase)) * 2;
          g.fillStyle(i % 2 ? 0xe4c77f : 0xc6dac0, .85);
          g.fillEllipse(-wing / 2, 0, wing, 3);
          g.fillEllipse(wing / 2, 0, wing, 3);
          g.lineStyle(.7,0x555442,.9).lineBetween(0,-1.5,0,1.5);
        } else {
          g.fillStyle(0xc9bd7a, .2 + .3 * Math.abs(Math.sin(t + phase)));
          g.fillEllipse(0, Math.sin(t * .8 + phase) * 5, 1.6, 1);
        }
      });
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, update);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, update);
      motes.forEach(g => g.destroy());
    });
  }
}
