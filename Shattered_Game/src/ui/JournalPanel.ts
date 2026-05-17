import Phaser from 'phaser';
import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';
import { formatJournalPanelText } from './UiFormatters';
import { createUiText } from './UiTextFactory';

export class JournalPanel {
  private readonly text: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.text = createUiText(scene, 'panel');
  }

  update(
    entries: TaskJournalEntry[],
    reputation: ReputationSnapshot,
    activeTaskCount: number,
  ): void {
    this.text.setText(formatJournalPanelText(entries, reputation, activeTaskCount));
    this.text.setVisible(this.visible);
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
    return this.visible;
  }

  layout(_width: number, height: number): void {
    this.text.setPosition(16, height - 16);
    this.text.setOrigin(0, 1);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
