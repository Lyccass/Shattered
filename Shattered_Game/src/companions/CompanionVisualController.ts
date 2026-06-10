import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';
import {
  ENEMY_WOLF_IDLE_SHEET_KEY,
  ENEMY_WOLF_IDLE_ANIMATION_KEY,
} from '../combat/EnemyAssets';

const BAR = { width: 40, height: 4, offsetY: -52 };
const HIT_FLASH_MS = 120;
const MOVE_TWEEN_MS = 200;

/**
 * Minimal companion sprite. Wolf reuses the wolf sheet with a green tint to
 * distinguish it from enemy wolves. Other companion types show a placeholder.
 * HP bar is redrawn each frame so it tracks the sprite during movement tweens.
 */
export class CompanionVisualController {
  private visual: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle | null = null;
  private hpBarGfx: Phaser.GameObjects.Graphics | null = null;
  private hitFlashUntilMs = 0;
  private currentHp = 1;
  private currentMaxHp = 1;

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
      sprite.setTint(0x66ffcc);
      sprite.play(ENEMY_WOLF_IDLE_ANIMATION_KEY);
      this.visual = sprite;
    } else {
      const rect = this.scene.add.rectangle(worldX, worldY, 28, 40, 0x3a9e6e);
      rect.setOrigin(0.5, 0.8);
      this.visual = rect;
    }

    this.hpBarGfx = this.scene.add.graphics();
    this.scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.tick, this);
  }

  flashHit(nowMs: number): void {
    this.hitFlashUntilMs = nowMs + HIT_FLASH_MS;
  }

  update(worldX: number, worldY: number, hp: number, maxHp: number, nowMs: number): void {
    if (!this.visual) return;

    this.currentHp = hp;
    this.currentMaxHp = maxHp;

    this.visual.setDepth(getDynamicDepth(worldY, 8));

    if (this.visual instanceof Phaser.GameObjects.Sprite) {
      this.visual.setTint(nowMs < this.hitFlashUntilMs ? 0xffffff : 0x66ffcc);
    }

    const dx = worldX - this.visual.x;
    const dy = worldY - this.visual.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      this.scene.tweens.killTweensOf(this.visual);
      this.scene.tweens.add({
        targets: this.visual,
        x: worldX,
        y: worldY,
        duration: MOVE_TWEEN_MS,
        ease: 'Linear',
      });
    } else {
      this.visual.setPosition(worldX, worldY);
    }
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.tick, this);
    this.visual?.destroy();
    this.visual = null;
    this.hpBarGfx?.destroy();
    this.hpBarGfx = null;
  }

  private readonly tick = (): void => {
    if (!this.visual || !this.hpBarGfx) return;
    this.drawHpBar(this.visual.x, this.visual.y, this.currentHp, this.currentMaxHp);
    this.hpBarGfx.setDepth(getDynamicDepth(this.visual.y, 16));
  };

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
