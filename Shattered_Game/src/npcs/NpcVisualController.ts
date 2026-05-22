import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';
import type { NpcRuntimeState } from './NpcTypes';

const BODY_RADIUS_X = 10;
const BODY_RADIUS_Y = 6;
const SHADOW_RADIUS_X = 12;
const SHADOW_RADIUS_Y = 5;
const BUBBLE_PADDING_X = 8;
const BUBBLE_PADDING_Y = 5;
const BUBBLE_FONT_SIZE = '10px';
const BUBBLE_MAX_WIDTH = 120;
const NAME_OFFSET_Y = -34;
const BUBBLE_OFFSET_Y = -54;

type NpcVisual = {
  id: string;
  shadow: Phaser.GameObjects.Ellipse;
  body: Phaser.GameObjects.Ellipse;
  nameText: Phaser.GameObjects.Text;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  lastBubbleText: string | null;
};

export class NpcVisualController {
  private visuals = new Map<string, NpcVisual>();

  constructor(private readonly scene: Phaser.Scene) {}

  syncAll(states: readonly NpcRuntimeState[], displayNames: Map<string, string>): void {
    const activeIds = new Set(states.map((s) => s.id));

    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        this.destroyVisual(visual);
        this.visuals.delete(id);
      }
    }

    for (const state of states) {
      if (!this.visuals.has(state.id)) {
        this.createVisual(state, displayNames.get(state.definitionId) ?? state.definitionId);
      }
      this.updateVisual(state);
    }
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      this.destroyVisual(visual);
    }
    this.visuals.clear();
  }

  private createVisual(state: NpcRuntimeState, displayName: string): void {
    const { worldX, worldY } = state;

    const shadow = this.scene.add.ellipse(
      worldX,
      worldY + 2,
      SHADOW_RADIUS_X * 2,
      SHADOW_RADIUS_Y * 2,
      0x020617,
      0.18,
    );

    const body = this.scene.add.ellipse(
      worldX,
      worldY - 8,
      BODY_RADIUS_X * 2,
      BODY_RADIUS_Y * 2 + 14,
      0xd4a96a,
    );

    const nameText = this.scene.add.text(worldX, worldY + NAME_OFFSET_Y, displayName, {
      fontSize: '9px',
      color: '#e8d5b0',
      stroke: '#1a1209',
      strokeThickness: 2,
    });
    nameText.setOrigin(0.5, 1);

    const bubbleText = this.scene.add.text(0, 0, '', {
      fontSize: BUBBLE_FONT_SIZE,
      color: '#1a1209',
      wordWrap: { width: BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2 },
    });
    bubbleText.setOrigin(0, 0);

    const bubbleBg = this.scene.add.graphics();
    bubbleBg.setVisible(false);
    bubbleText.setVisible(false);

    const visual: NpcVisual = {
      id: state.id,
      shadow,
      body,
      nameText,
      bubbleBg,
      bubbleText,
      lastBubbleText: null,
    };

    this.visuals.set(state.id, visual);
  }

  private updateVisual(state: NpcRuntimeState): void {
    const visual = this.visuals.get(state.id);
    if (!visual) return;

    const { worldX, worldY } = state;
    const depth = getDynamicDepth(worldY, 4);

    visual.shadow.setPosition(worldX, worldY + 2);
    visual.shadow.setDepth(depth - 1);

    visual.body.setPosition(worldX, worldY - 8);
    visual.body.setDepth(depth);

    visual.nameText.setPosition(worldX, worldY + NAME_OFFSET_Y);
    visual.nameText.setDepth(depth + 2);

    const bubbleY = worldY + BUBBLE_OFFSET_Y;

    if (state.bubbleText !== visual.lastBubbleText) {
      visual.lastBubbleText = state.bubbleText;

      if (!state.bubbleText) {
        visual.bubbleBg.setVisible(false);
        visual.bubbleText.setVisible(false);
      } else {
        visual.bubbleText.setText(state.bubbleText);

        const textW = visual.bubbleText.width;
        const textH = visual.bubbleText.height;
        const bgW = textW + BUBBLE_PADDING_X * 2;
        const bgH = textH + BUBBLE_PADDING_Y * 2;
        const bgX = worldX - bgW / 2;
        const bgY = bubbleY - bgH;

        visual.bubbleBg.clear();
        visual.bubbleBg.fillStyle(0xf5ead7, 1);
        visual.bubbleBg.lineStyle(1, 0x8b6914, 1);
        visual.bubbleBg.fillRoundedRect(bgX, bgY, bgW, bgH, 4);
        visual.bubbleBg.strokeRoundedRect(bgX, bgY, bgW, bgH, 4);

        visual.bubbleText.setPosition(bgX + BUBBLE_PADDING_X, bgY + BUBBLE_PADDING_Y);

        visual.bubbleBg.setVisible(true);
        visual.bubbleText.setVisible(true);
      }
    }

    if (state.bubbleText) {
      const textW = visual.bubbleText.width;
      const textH = visual.bubbleText.height;
      const bgW = textW + BUBBLE_PADDING_X * 2;
      const bgH = textH + BUBBLE_PADDING_Y * 2;
      const bgX = worldX - bgW / 2;
      const bgY = bubbleY - bgH;

      visual.bubbleBg.setPosition(0, 0);
      visual.bubbleBg.clear();
      visual.bubbleBg.fillStyle(0xf5ead7, 1);
      visual.bubbleBg.lineStyle(1, 0x8b6914, 1);
      visual.bubbleBg.fillRoundedRect(bgX, bgY, bgW, bgH, 4);
      visual.bubbleBg.strokeRoundedRect(bgX, bgY, bgW, bgH, 4);
      visual.bubbleText.setPosition(bgX + BUBBLE_PADDING_X, bgY + BUBBLE_PADDING_Y);
      visual.bubbleBg.setDepth(depth + 3);
      visual.bubbleText.setDepth(depth + 4);
    }
  }

  private destroyVisual(visual: NpcVisual): void {
    visual.shadow.destroy();
    visual.body.destroy();
    visual.nameText.destroy();
    visual.bubbleBg.destroy();
    visual.bubbleText.destroy();
  }
}
