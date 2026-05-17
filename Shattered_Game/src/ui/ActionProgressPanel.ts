import Phaser from 'phaser';
import type { ActionProgressSnapshot } from '../actions/ActionProgressTypes';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { createUiText } from './UiTextFactory';

export class ActionProgressPanel {
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.labelText = createUiText(scene, 'panel');
    this.background = scene.add.rectangle(0, 0, 360, 54, 0x07111f, 0.88);
    this.track = scene.add.rectangle(0, 0, 300, 10, 0x111827, 0.95);
    this.fill = scene.add.rectangle(0, 0, 300, 10, 0x38bdf8, 0.95);
    this.track.setOrigin(0.5, 0.5);
    this.fill.setOrigin(0, 0.5);

    this.background.setDepth(RENDER_DEPTHS.UI + 1);
    this.track.setDepth(RENDER_DEPTHS.UI + 2);
    this.fill.setDepth(RENDER_DEPTHS.UI + 3);

    this.background.setVisible(false);
    this.track.setVisible(false);
    this.fill.setVisible(false);
  }

  update(state: ActionProgressSnapshot | null): void {
    if (!state) {
      this.setVisible(false);
      return;
    }

    const percent = Math.round(state.progress01 * 100);
    this.labelText.setText(`${state.label}... ${percent}%`);
    this.labelText.setVisible(true);
    this.background.setVisible(true);
    this.track.setVisible(true);
    this.fill.setVisible(true);
    this.fill.setDisplaySize(300 * state.progress01, 10);
  }

  layout(width: number, height: number): void {
    const centerX = width / 2;
    const panelY = height - 112;
    this.background.setPosition(centerX, panelY);
    this.labelText.setPosition(centerX, panelY - 10);
    this.labelText.setOrigin(0.5, 1);
    this.track.setPosition(centerX, panelY + 8);
    this.fill.setPosition(centerX - 150, panelY + 8);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.background, this.track, this.fill, this.labelText];
  }

  private setVisible(isVisible: boolean): void {
    this.labelText.setVisible(isVisible);
    this.background.setVisible(isVisible);
    this.track.setVisible(isVisible);
    this.fill.setVisible(isVisible);
  }
}
