import Phaser from 'phaser';
import type { ActionProgressSnapshot } from '../actions/ActionProgressTypes';
import { RENDER_DEPTHS } from '../render/RenderLayers';

const BAR_W = 180;
const BAR_H = 5;

export class ActionProgressPanel {
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.track = scene.add.rectangle(0, 0, BAR_W, BAR_H, 0x1a1a1a, 0.92);
    this.fill  = scene.add.rectangle(0, 0, BAR_W, BAR_H, 0x38bdf8, 0.95);
    this.track.setOrigin(0.5, 0.5);
    this.fill.setOrigin(0, 0.5);

    this.track.setDepth(RENDER_DEPTHS.UI + 2);
    this.fill.setDepth(RENDER_DEPTHS.UI + 3);

    this.track.setVisible(false);
    this.fill.setVisible(false);
  }

  update(state: ActionProgressSnapshot | null): void {
    if (!state) {
      this.track.setVisible(false);
      this.fill.setVisible(false);
      return;
    }

    this.track.setVisible(true);
    this.fill.setVisible(true);
    this.fill.setDisplaySize(BAR_W * state.progress01, BAR_H);
  }

  layout(width: number, height: number): void {
    const centerX = width / 2;
    const y = height - 110;
    this.track.setPosition(centerX, y);
    this.fill.setPosition(centerX - BAR_W / 2, y);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.track, this.fill];
  }
}
