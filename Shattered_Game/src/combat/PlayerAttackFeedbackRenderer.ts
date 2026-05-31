import Phaser from 'phaser';
import type { PlayerController } from '../player/PlayerController';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { TelegraphSystem } from './TelegraphSystem';
import {
  LIGHT_ATTACK_ACTIVE_MS,
  LIGHT_ATTACK_WINDUP_MS,
} from './PlayerCombatState';

const FEEDBACK = {
  windupReachStrokeAlpha:    0.15,
  windupReachFillMultiplier: 0.06,
  windupDotFillMultiplier:   0.38,
  activeDotFillMultiplier:   0.60,
  slashOuterAlpha:           0.95,
  slashInnerAlpha:           0.85,
  slashOuterRadius:          14,
  slashInnerRadius:          8,
  slashFadeDurationMs:       160,
};

const PLAYER_ATTACK_WINDUP_TELEGRAPH_ID    = 'player_light_attack_windup';
const PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID    = 'player_light_attack_active';
const PLAYER_ATTACK_SLASH_TELEGRAPH_ID     = 'player_light_attack_slash';
const PLAYER_ATTACK_RECOVERY_TELEGRAPH_ID  = 'player_light_attack_recovery';

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
      strokeAlpha: FEEDBACK.windupReachStrokeAlpha,
      fillAlphaMultiplier: FEEDBACK.windupReachFillMultiplier,
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
      fillAlphaMultiplier: FEEDBACK.windupDotFillMultiplier,
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
      fillAlphaMultiplier: FEEDBACK.activeDotFillMultiplier,
    });
  }

  showRecovery({
    nowMs,
    tilemap,
    playerController,
    recoveryMs,
  }: {
    nowMs: number;
    tilemap: IsoTilemap | null;
    playerController: PlayerController;
    recoveryMs: number;
  }): void {
    this.clear();
    if (!tilemap) return;
    const feet = playerController.getFeetPoint();
    const radius = tilemap.tileWidth * 0.45;
    this.telegraphSystem.showTelegraph({
      id: PLAYER_ATTACK_RECOVERY_TELEGRAPH_ID,
      worldX: feet.x,
      worldY: feet.y,
      shape: { kind: 'circle', radius },
      durationMs: recoveryMs,
      startedAtMs: nowMs,
      warningColor: 0xf97316,
      fadeOutMs: recoveryMs,
      strokeAlpha: 0.75,
      fillAlphaMultiplier: 0.12,
    });
  }

  drawSlashVfx(targetWorld: { x: number; y: number } | null): void {
    if (!targetWorld) {
      return;
    }

    const g = this.scene.add.graphics();
    g.setDepth(9_400);
    g.fillStyle(0xffffff, FEEDBACK.slashOuterAlpha);
    g.fillCircle(targetWorld.x, targetWorld.y, FEEDBACK.slashOuterRadius);
    g.fillStyle(0xfde68a, FEEDBACK.slashInnerAlpha);
    g.fillCircle(targetWorld.x, targetWorld.y, FEEDBACK.slashInnerRadius);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: FEEDBACK.slashFadeDurationMs,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  clear(): void {
    this.telegraphSystem.removeTelegraph(PLAYER_ATTACK_WINDUP_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(PLAYER_ATTACK_SLASH_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(PLAYER_ATTACK_RECOVERY_TELEGRAPH_ID);
  }
}
