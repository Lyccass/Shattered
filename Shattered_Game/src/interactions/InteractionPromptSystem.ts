import Phaser from 'phaser';
import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import type { SkillSnapshot } from '../skills/SkillTypes';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import type { ActiveInteraction } from './InteractionTypes';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';
import type { PlacementPreviewState } from './PlacementModeSystem';

const FEEDBACK_DURATION_MS = 2400;

export class InteractionPromptSystem {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly feedbackText: Phaser.GameObjects.Text;
  private readonly inventoryText: Phaser.GameObjects.Text;
  private readonly journalText: Phaser.GameObjects.Text;
  private feedbackExpiresAt = 0;
  private journalVisible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.promptText = this.createText(0, 0, 20);
    this.feedbackText = this.createText(0, 0, 16);
    this.inventoryText = this.createText(0, 0, 16);
    this.journalText = this.createText(0, 0, 16);
    this.scene.cameras.main.ignore([
      this.promptText,
      this.feedbackText,
      this.inventoryText,
      this.journalText,
    ]);
    this.ignoreWorldForUiCamera();
    this.registerResizeHandler();
    this.layout();
  }

  update(
    activeInteraction: ActiveInteraction | null,
    inventory: PlayerInventorySnapshot,
    currency: CurrencySnapshot,
    reputation: ReputationSnapshot,
    skills: SkillSnapshot[],
    activeTaskCount: number,
    journalEntries: TaskJournalEntry[],
    activeEffects: ActiveEffectSnapshot[],
    placementState: PlacementPreviewState | null,
  ): void {
    const promptText = placementState?.promptText ?? activeInteraction?.promptText ?? '';

    this.promptText.setText(promptText);
    this.promptText.setVisible(!!promptText);
    this.inventoryText.setText(
      (() => {
        const inventoryParts = [
          `Wood ${inventory.stacks['wood'] ?? 0}`,
          `Stone ${inventory.stacks['stone'] ?? 0}`,
          `Herb ${inventory.stacks['herb'] ?? 0}`,
          `Firestarter ${inventory.stacks['firestarter_set'] ?? 0}`,
          `Marker ${inventory.stacks['wooden_marker'] ?? 0}`,
          `Supplies ${inventory.stacks['camp_supplies'] ?? 0}`,
          `Tea ${inventory.stacks['warm_tea'] ?? 0}`,
        ];
        const hintParts: string[] = [];

        hintParts.push('[J: journal]');

        if (!placementState?.active && (inventory.stacks['firestarter_set'] ?? 0) > 0) {
          hintParts.push('[B: place]');
        }

        if ((inventory.stacks['warm_tea'] ?? 0) > 0) {
          hintParts.push('[T: drink]');
        }

        const effectLine = activeEffects.length > 0
          ? `Effects: ${activeEffects
            .map((effect) => `${effect.displayName} ${Math.ceil(effect.remainingMs / 1000)}s`)
            .join('   ')}`
          : 'Effects: none';
        const xpLine = `XP ${skills
          .map((skill) => `${skill.displayName.slice(0, 1)}:${skill.xp}`)
          .join('   ')}`;

        const lines = [
          inventoryParts.join('   '),
          `Coins C${currency.copper} S${currency.silver} G${currency.gold} P${currency.platinum}   Harbor Rep ${reputation.harborReputation}   Tasks ${activeTaskCount}`,
          xpLine,
          effectLine,
        ];

        if (hintParts.length > 0) {
          lines.push(hintParts.join('   '));
        }

        return lines.join('\n');
      })(),
    );
    this.journalText.setText(this.buildJournalText(journalEntries));
    this.journalText.setVisible(this.journalVisible);

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

  toggleJournal(): boolean {
    this.journalVisible = !this.journalVisible;
    this.journalText.setVisible(this.journalVisible);
    return this.journalVisible;
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
      child === this.promptText
      || child === this.feedbackText
      || child === this.inventoryText
      || child === this.journalText;

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

    this.journalText.setPosition(16, height - 16);
    this.journalText.setOrigin(0, 1);
    this.journalText.setVisible(this.journalVisible);
  }

  private buildJournalText(entries: TaskJournalEntry[]): string {
    const lines = ['[Journal]'];

    if (entries.length === 0) {
      lines.push('No active tasks.');
      return lines.join('\n');
    }

    entries.forEach((entry) => {
      lines.push(`- ${entry.displayName}`);
      lines.push(`  Need: ${entry.requirementSummary}`);
      lines.push(`  Reward: ${entry.rewardSummary}`);
      lines.push(`  Status: ${entry.requirementsMet ? 'Ready' : 'In progress'}`);
    });

    return lines.join('\n');
  }
}
