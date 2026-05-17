import Phaser from 'phaser';
import type { ChoiceMenuStateSnapshot } from '../interactions/ChoiceMenuTypes';
import { formatChoiceMenuText } from './UiFormatters';
import { createUiText } from './UiTextFactory';

export class ChoiceMenuPanel {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'menu');
  }

  update(state: ChoiceMenuStateSnapshot | null): void {
    const content = formatChoiceMenuText(state);
    this.text.setText(content);
    this.text.setVisible(content.length > 0);
  }

  layout(width: number, height: number): void {
    this.text.setPosition(width / 2, height / 2);
    this.text.setOrigin(0.5, 0.5);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
