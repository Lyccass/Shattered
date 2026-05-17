import Phaser from 'phaser';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import { formatInventoryPanelText } from './UiFormatters';
import { createUiText } from './UiTextFactory';

export class InventoryPanel {
  private readonly text: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'panel');
  }

  update(
    inventory: PlayerInventorySnapshot,
    currency: CurrencySnapshot,
  ): void {
    this.text.setText(formatInventoryPanelText(inventory, currency));
    this.text.setVisible(this.visible);
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
    return this.visible;
  }

  layout(_width: number, _height: number): void {
    this.text.setPosition(16, 16);
    this.text.setOrigin(0, 0);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
