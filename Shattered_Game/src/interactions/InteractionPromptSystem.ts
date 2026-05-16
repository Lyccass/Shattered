import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import type { ActiveInteraction } from './InteractionTypes';
import type { PlayerInventoryCounts } from '../player/PlayerInventoryState';

const FEEDBACK_DURATION_MS = 2400;

export class InteractionPromptSystem {
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly feedbackText: Phaser.GameObjects.Text;
  private readonly inventoryText: Phaser.GameObjects.Text;
  private feedbackExpiresAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.promptText = this.createText(0, 0, 20);
    this.feedbackText = this.createText(0, 0, 16);
    this.inventoryText = this.createText(0, 0, 16);
    this.registerResizeHandler();
    this.layout();
  }

  update(activeInteraction: ActiveInteraction | null, inventory: PlayerInventoryCounts): void {
    this.promptText.setText(activeInteraction?.promptText ?? '');
    this.promptText.setVisible(!!activeInteraction);
    this.inventoryText.setText(
      `Wood ${inventory.wood}   Stone ${inventory.stone}   Herb ${inventory.herb}`,
    );

    if (this.feedbackExpiresAt > 0 && this.scene.time.now >= this.feedbackExpiresAt) {
      this.feedbackText.setVisible(false);
      this.feedbackText.setText('');
      this.feedbackExpiresAt = 0;
    }
  }

  showFeedback(message: string): void {
    if (!message) {
      return;
    }

    this.feedbackText.setText(message);
    this.feedbackText.setVisible(true);
    this.feedbackExpiresAt = this.scene.time.now + FEEDBACK_DURATION_MS;
    this.layout();
  }

  private createText(x: number, y: number, fontSize: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, '', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      backgroundColor: '#07111fcc',
      padding: {
        x: 10,
        y: 6,
      },
    });

    text.setScrollFactor(0);
    text.setDepth(RENDER_DEPTHS.UI + 1);
    text.setVisible(false);

    return text;
  }

  private registerResizeHandler(): void {
    this.scene.scale.on('resize', () => {
      this.layout();
    });
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.promptText.setPosition(width / 2, height - 56);
    this.promptText.setOrigin(0.5, 1);

    this.feedbackText.setPosition(width / 2, height - 92);
    this.feedbackText.setOrigin(0.5, 1);

    this.inventoryText.setPosition(width - 16, 16);
    this.inventoryText.setOrigin(1, 0);
    this.inventoryText.setVisible(true);
  }
}
