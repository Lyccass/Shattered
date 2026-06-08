import Phaser from 'phaser';
import type { TurnCombatUiSnapshot } from '../combat/CombatUiTypes';
import { formatCombatPanelText } from './UiFormatters';
import { createUiText } from './UiTextFactory';

export class CombatPanel {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'panel');
    this.text.setVisible(false);
  }

  update(snapshot: TurnCombatUiSnapshot | null): void {
    const content = formatCombatPanelText(snapshot);
    this.text.setText(content);
    this.text.setVisible(content.length > 0);
  }

  layout(_width: number, _height: number): void {
    this.text.setPosition(16, 16);
    this.text.setOrigin(0, 0);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
