import Phaser from 'phaser';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import { formatHudPanelText } from './UiFormatters';
import { createUiText } from './UiTextFactory';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';

export class HudPanel {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'panel');
    this.text.setVisible(true);
  }

  update(
    inventory: PlayerInventorySnapshot,
    activeEffects: ActiveEffectSnapshot[],
  ): void {
    this.text.setText(formatHudPanelText(inventory, activeEffects));
  }

  layout(width: number, height: number): void {
    this.text.setPosition(width - 16, height - 16);
    this.text.setOrigin(1, 1);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
