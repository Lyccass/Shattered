import Phaser from 'phaser';
import type { PlayerController } from '../player/PlayerController';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { TelegraphSystem } from './TelegraphSystem';
import {
  LIGHT_ATTACK_ACTIVE_MS,
  LIGHT_ATTACK_WINDUP_MS,
} from './PlayerCombatState';

const PLAYER_ATTACK_WINDUP_TELEGRAPH_ID = 'player_light_attack_windup';
const PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID = 'player_light_attack_active';
const PLAYER_ATTACK_SLASH_TELEGRAPH_ID = 'player_light_attack_slash';

export class PlayerAttackFeedbackRenderer {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly telegraphSystem: TelegraphSystem,
  ) {}

  showWindup({
    nowMs,
    tilemap,
    playerController,
    targetWorld,
    maxTileReach,
  }: {
    nowMs: number;
    tilemap: IsoTilemap | null;
    playerController: PlayerController;
    targetWorld: { x: number; y: number } | null;
    maxTileReach: number;
  }): void {
    this.clear();

    if (!tilemap || !targetWorld) {
      return;
    }

    const feet = playerController.getFeetPoint();
    const reachRadius = maxTileReach * tilemap.tileWidth;
    const dotRadius = tilemap.tileWidth * 0.5;

    this.telegraphSystem.showTelegraph({
      id: PLAYER_ATTACK_WINDUP_TELEGRAPH_ID,
      worldX: feet.x,
      worldY: feet.y,
      shape: { kind: 'circle', radius: reachRadius },
      durationMs: LIGHT_ATTACK_WINDUP_MS,
      startedAtMs: nowMs,
      warningColor: 0x38bdf8,
      fadeOutMs: LIGHT_ATTACK_WINDUP_MS,
      strokeAlpha: 0.15,
      fillAlphaMultiplier: 0.06,
    });

    this.telegraphSystem.showTelegraph({
      id: PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID,
      worldX: targetWorld.x,
      worldY: targetWorld.y,
      shape: { kind: 'circle', radius: dotRadius },
      durationMs: LIGHT_ATTACK_WINDUP_MS,
      startedAtMs: nowMs,
      warningColor: 0xeab308,
      fadeOutMs: LIGHT_ATTACK_WINDUP_MS,
      strokeAlpha: 0.9,
      fillAlphaMultiplier: 0.38,
    });
  }

  showActive({
    nowMs,
    tilemap,
    targetWorld,
  }: {
    nowMs: number;
    tilemap: IsoTilemap | null;
    targetWorld: { x: number; y: number } | null;
  }): void {
    this.clear();

    if (!tilemap || !targetWorld) {
      return;
    }

    const dotRadius = tilemap.tileWidth * 0.5;

    this.telegraphSystem.showTelegraph({
      id: PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID,
      worldX: targetWorld.x,
      worldY: targetWorld.y,
      shape: { kind: 'circle', radius: dotRadius },
      durationMs: LIGHT_ATTACK_ACTIVE_MS,
      startedAtMs: nowMs,
      warningColor: 0xfacc15,
      fadeOutMs: LIGHT_ATTACK_ACTIVE_MS,
      strokeAlpha: 0,
      fillAlphaMultiplier: 0.60,
    });
  }

  drawSlashVfx(targetWorld: { x: number; y: number } | null): void {
    if (!targetWorld) {
      return;
    }

    const g = this.scene.add.graphics();
    g.setDepth(9_400);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(targetWorld.x, targetWorld.y, 14);
    g.fillStyle(0xfde68a, 0.85);
    g.fillCircle(targetWorld.x, targetWorld.y, 8);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  clear(): void {
    this.telegraphSystem.removeTelegraph(PLAYER_ATTACK_WINDUP_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(PLAYER_ATTACK_SLASH_TELEGRAPH_ID);
  }
}
