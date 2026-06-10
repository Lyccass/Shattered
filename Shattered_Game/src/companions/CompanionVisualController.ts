import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';
import {
  ENEMY_WOLF_IDLE_SHEET_KEY,
  ENEMY_WOLF_IDLE_ANIMATION_KEY,
} from '../combat/EnemyAssets';

const BAR = { width: 40, height: 4, offsetY: -52 };
const HIT_FLASH_MS = 120;

/**
 * Minimal companion sprite. Wolf reuses the wolf sheet with a green tint to
 * distinguish it from enemy wolves. Other companion types show a placeholder.
 */
export class CompanionVisualController {
  private visual: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle | null = null;
  private hpBarGfx: Phaser.GameObjects.Graphics | null = null;
  private hitFlashUntilMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly definitionId: string,
  ) {}

  spawn(worldX: number, worldY: number): void {
    this.destroy();

    if (this.definitionId === 'wolf') {
      const sprite = this.scene.add.sprite(worldX, worldY, ENEMY_WOLF_IDLE_SHEET_KEY, 0);
      sprite.setOrigin(0.5, 0.68);
      sprite.setScale(2);
      sprite.setTint(0x66ffcc); // green tint → friendly wolf
      sprite.play(ENEMY_WOLF_IDLE_ANIMATION_KEY);
      this.visual = sprite;
    } else {
      const rect = this.scene.add.rectangle(worldX, worldY, 28, 40, 0x3a9e6e);
      rect.setOrigin(0.5, 0.8);
      this.visual = rect;
    }

    this.hpBarGfx = this.scene.add.graphics();
  }

  flashHit(nowMs: number): void {
    this.hitFlashUntilMs = nowMs + HIT_FLASH_MS;
  }

  update(worldX: number, worldY: number, hp: number, maxHp: number, nowMs: number): void {
    if (!this.visual) return;

    this.visual.setPosition(worldX, worldY);
    this.visual.setDepth(getDynamicDepth(worldY, 8));

    if (this.visual instanceof Phaser.GameObjects.Sprite) {
      if (nowMs < this.hitFlashUntilMs) {
        this.visual.setTint(0xffffff);
      } else {
        this.visual.setTint(0x66ffcc);
      }
    }

    this.drawHpBar(worldX, worldY, hp, maxHp);
    this.hpBarGfx?.setDepth(getDynamicDepth(worldY, 16));
  }

  destroy(): void {
    this.visual?.destroy();
    this.visual = null;
    this.hpBarGfx?.destroy();
    this.hpBarGfx = null;
  }

  private drawHpBar(worldX: number, worldY: number, hp: number, maxHp: number): void {
    const gfx = this.hpBarGfx;
    if (!gfx) return;
    gfx.clear();
    if (maxHp <= 0) return;

    const bx = worldX - BAR.width / 2;
    const by = worldY + BAR.offsetY;
    const fill = Math.max(0, hp / maxHp);

    gfx.fillStyle(0x111111, 0.7);
    gfx.fillRect(bx, by, BAR.width, BAR.height);

    const barColor = fill > 0.5 ? 0x22c55e : fill > 0.25 ? 0xf59e0b : 0xef4444;
    gfx.fillStyle(barColor, 1);
    gfx.fillRect(bx, by, BAR.width * fill, BAR.height);
  }
}
