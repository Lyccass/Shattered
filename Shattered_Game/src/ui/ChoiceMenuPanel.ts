import Phaser from 'phaser';
import type { ChoiceMenuStateSnapshot } from '../interactions/ChoiceMenuTypes';
import { formatChoiceMenuText } from './UiFormatters';
import { createUiText } from './UiTextFactory';

export class ChoiceMenuPanel {
  private readonly text: Phaser.GameObjects.Text;
  private state: ChoiceMenuStateSnapshot | null = null;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'menu');
  }

  update(state: ChoiceMenuStateSnapshot | null): void {
    this.state = state;
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

  getOptionIndexAt(screenX: number, screenY: number): number | null {
    if (!this.state || !this.text.visible) {
      return null;
    }

    const bounds = this.text.getBounds();

    if (!bounds.contains(screenX, screenY)) {
      return null;
    }

    const lines = this.text.text.split('\n');

    if (lines.length === 0 || bounds.height <= 0) {
      return null;
    }

    const lineHeight = bounds.height / lines.length;
    const clickedLineIndex = Math.floor((screenY - bounds.y) / lineHeight);
    const optionStartLineIndex = 2;
    const optionEndLineIndex = optionStartLineIndex + this.state.options.length - 1;

    if (
      clickedLineIndex < optionStartLineIndex
      || clickedLineIndex > optionEndLineIndex
    ) {
      return null;
    }

    return clickedLineIndex - optionStartLineIndex;
  }
}
