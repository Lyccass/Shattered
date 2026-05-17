import Phaser from 'phaser';
import { createUiText } from './UiTextFactory';

export class PromptPanel {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'panel');
  }

  update(content: string): void {
    this.text.setText(content);
    this.text.setVisible(content.length > 0);
  }

  layout(width: number, height: number): void {
    this.text.setPosition(width / 2, height - 18);
    this.text.setOrigin(0.5, 1);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
