import Phaser from 'phaser';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import type { ActiveInteraction } from './InteractionTypes';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import type { PlacementPreviewState } from './PlacementModeSystem';

const FEEDBACK_DURATION_MS = 2400;

export class InteractionPromptSystem {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly feedbackText: Phaser.GameObjects.Text;
  private readonly inventoryText: Phaser.GameObjects.Text;
  private feedbackExpiresAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.promptText = this.createText(0, 0, 20);
    this.feedbackText = this.createText(0, 0, 16);
    this.inventoryText = this.createText(0, 0, 16);
    this.scene.cameras.main.ignore([this.promptText, this.feedbackText, this.inventoryText]);
    this.ignoreWorldForUiCamera();
    this.registerResizeHandler();
    this.layout();
  }

  update(
    activeInteraction: ActiveInteraction | null,
    inventory: PlayerInventorySnapshot,
    activeEffects: ActiveEffectSnapshot[],
    placementState: PlacementPreviewState | null,
  ): void {
    const promptText = placementState?.promptText ?? activeInteraction?.promptText ?? '';

    this.promptText.setText(promptText);
    this.promptText.setVisible(!!promptText);
    this.inventoryText.setText(
      (() => {
        const inventoryParts = [
          `Wood ${inventory.resources.wood}`,
          `Stone ${inventory.resources.stone}`,
          `Herb ${inventory.resources.herb}`,
          `Firestarter ${inventory.items.firestarter_set}`,
          `Tea ${inventory.items.warm_tea}`,
        ];
        const hintParts: string[] = [];

        if (!placementState?.active && inventory.items.firestarter_set > 0) {
          hintParts.push('[Space: place]');
        }

        if (inventory.items.warm_tea > 0) {
          hintParts.push('[T: drink]');
        }

        const effectLine = activeEffects.length > 0
          ? `Effects: ${activeEffects
            .map((effect) => `${effect.displayName} ${Math.ceil(effect.remainingMs / 1000)}s`)
            .join('   ')}`
          : 'Effects: none';

        const lines = [
          inventoryParts.join('   '),
          effectLine,
        ];

        if (hintParts.length > 0) {
          lines.push(hintParts.join('   '));
        }

        return lines.join('\n');
      })(),
    );

    if (placementState?.active && placementState.invalidReason) {
      this.feedbackText.setText(placementState.invalidReason);
      this.feedbackText.setVisible(true);
      this.feedbackExpiresAt = 0;
    } else if (this.feedbackExpiresAt === 0) {
      this.feedbackText.setVisible(false);
      this.feedbackText.setText('');
    }

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
    this.scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera.setViewport(0, 0, gameSize.width, gameSize.height);
      this.layout();
    });
  }

  private ignoreWorldForUiCamera(): void {
    const isUiObject = (child: Phaser.GameObjects.GameObject): boolean =>
      child === this.promptText || child === this.feedbackText || child === this.inventoryText;

    const existing = this.scene.children.getChildren().filter((child) => !isUiObject(child));
    this.uiCamera.ignore(existing);

    this.scene.events.on(
      Phaser.Scenes.Events.ADDED_TO_SCENE,
      (child: Phaser.GameObjects.GameObject) => {
        if (!isUiObject(child)) {
          this.uiCamera.ignore(child);
        }
      },
    );
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.promptText.setPosition(width / 2, height - 56);
    this.promptText.setOrigin(0.5, 1);

    this.feedbackText.setPosition(width / 2, height - 92);
    this.feedbackText.setOrigin(0.5, 1);

    this.inventoryText.setPosition(width - 16, height - 16);
    this.inventoryText.setOrigin(1, 1);
    this.inventoryText.setVisible(true);
  }
}
