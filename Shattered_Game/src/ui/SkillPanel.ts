import Phaser from 'phaser';
import type { SkillSnapshot } from '../skills/SkillTypes';
import { formatSkillPanelText } from './UiFormatters';
import { createUiText } from './UiTextFactory';

export class SkillPanel {
  private readonly text: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'panel');
  }

  update(skills: SkillSnapshot[]): void {
    this.text.setText(formatSkillPanelText(skills));
    this.text.setVisible(this.visible);
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
    return this.visible;
  }

  layout(width: number, _height: number): void {
    this.text.setPosition(width - 16, 16);
    this.text.setOrigin(1, 0);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
