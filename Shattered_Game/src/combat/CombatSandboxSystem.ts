import Phaser from 'phaser';
import { resolveCombatDodgeDirection } from './CombatDodge';
import {
  doesEnemyHitCircleIntersectPlayerLightAttackByRotation,
  getPlayerLightAttackHitbox,
  getPlayerLightAttackHitboxByRotation,
  getPlayerLightAttackSlash,
  getPlayerLightAttackSlashByRotation,
  isAttackerInsideGuardFront,
  isEnemyInsidePlayerLightAttackByRotation,
  resolvePlayerAttackAimRad,
} from './CombatPlayerMath';
import type { PlayerAttackPhase } from './PlayerCombatState';
import type { SfxEventId } from '../audio/SfxTypes';
import type { UiHandledResult } from '../ui/UiTypes';
import { COMBAT_SANDBOX_SPAWNS } from './CombatSandboxDefinitions';
import type { CombatUiSnapshot } from './CombatUiTypes';
import { EnemySystem } from './EnemySystem';
import type { EnemyUpdateEvent } from './EnemyStateMachine';
import { PlayerCombatState } from './PlayerCombatState';
import type { PlayerController } from '../player/PlayerController';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { TelegraphSystem } from './TelegraphSystem';
import type { GameEventBus } from '../events/GameEventBus';

export class CombatSandboxSystem {
  private static readonly DODGE_DURATION_MS = 250;
  private static readonly DODGE_DISTANCE_WORLD = 58;
  private static readonly SPRINT_DODGE_DISTANCE_MULTIPLIER = 1.45;
  private static readonly SPRINT_SPEED_MULTIPLIER = 2;
  private static readonly PLAYER_LIGHT_ATTACK_DAMAGE = 1;
  private static readonly PLAYER_ATTACK_WINDUP_MS = 140;
  private static readonly PLAYER_ATTACK_ACTIVE_MS = 120;
  private static readonly PLAYER_ATTACK_RECOVERY_MS = 280;
  private static readonly PLAYER_ATTACK_WINDUP_TELEGRAPH_ID = 'player_light_attack_windup';
  private static readonly PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID = 'player_light_attack_active';
  private static readonly PLAYER_ATTACK_SLASH_TELEGRAPH_ID = 'player_light_attack_slash';

  private readonly playerCombatState = new PlayerCombatState();
  private readonly enemySystem: EnemySystem;
  private readonly telegraphSystem: TelegraphSystem;
  private currentTilemap: IsoTilemap | null = null;
  private lastPlayerAttackPhase: PlayerAttackPhase = 'idle';
  private playerAttackAimRad: number | null = null;
  private playerAttackHitResolved = false;

  constructor(
    scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
    telegraphSystem: TelegraphSystem,
  ) {
    this.telegraphSystem = telegraphSystem;
    this.enemySystem = new EnemySystem(scene, telegraphSystem);
  }

  setMapContext(mapId: string, tilemap: IsoTilemap): void {
    this.currentTilemap = tilemap;
    const spawn = COMBAT_SANDBOX_SPAWNS.find((candidate) => candidate.mapId === mapId) ?? null;
    this.enemySystem.setMapContext(mapId, tilemap, spawn);
    this.playerCombatState.leaveCombat();
    this.playerCombatState.setGuardHeld(false);
    this.lastPlayerAttackPhase = 'idle';
    this.playerAttackAimRad = null;
    this.playerAttackHitResolved = false;
    this.clearPlayerAttackTelegraphs();
  }

  update(nowMs: number, deltaMs: number, playerController: PlayerController): UiHandledResult[] {
    this.playerCombatState.update(
      nowMs,
      deltaMs,
      playerController.getMovementIntent().lengthSq() > 0,
    );
    this.syncPlayerAttackVisuals(nowMs, playerController);

    if (!this.currentTilemap) {
      this.playerCombatState.leaveCombat();
      this.playerCombatState.setGuardHeld(false);
      playerController.setMovementSpeedMultiplier(1);
      this.playerAttackAimRad = null;
      this.playerAttackHitResolved = false;
      this.clearPlayerAttackTelegraphs();
      return [];
    }

    const feetPoint = playerController.getFeetPoint();
    const combatActive = this.enemySystem.isCombatActive(feetPoint.x, feetPoint.y);

    if (combatActive) {
      this.playerCombatState.enterCombat();
    } else {
      this.playerCombatState.leaveCombat();
      this.playerCombatState.setGuardHeld(false);
    }

    playerController.setMovementSpeedMultiplier(
      this.playerCombatState.getSnapshot(nowMs).isSprinting
        ? CombatSandboxSystem.SPRINT_SPEED_MULTIPLIER
        : 1,
    );

    const events = this.enemySystem.update(
      nowMs,
      deltaMs,
      feetPoint.x,
      feetPoint.y,
      this.playerCombatState.isInvulnerable(nowMs),
    );
    this.resolvePlayerEnemyOverlap(playerController);

    const results: UiHandledResult[] = [];
    this.resolveEnemyAttackEvents(nowMs, playerController, events, results);
    this.resolvePlayerLightAttackActivation();
    this.resolvePlayerLightAttackHit(nowMs, playerController, results);

    if (this.playerCombatState.consumeRecoveredFromDowned()) {
      this.enemySystem.forceReset();
    }

    return results;
  }

  tryDodge(nowMs: number, playerController: PlayerController): UiHandledResult | null {
    if (!this.currentTilemap) {
      return null;
    }

    if (playerController.isDodging()) {
      return null;
    }

    const direction = resolveCombatDodgeDirection(
      playerController.getMovementIntent(),
      playerController.getFacingDirection(),
    );
    const dodgeDistance = this.playerCombatState.getSnapshot(nowMs).isSprinting
      ? CombatSandboxSystem.DODGE_DISTANCE_WORLD * CombatSandboxSystem.SPRINT_DODGE_DISTANCE_MULTIPLIER
      : CombatSandboxSystem.DODGE_DISTANCE_WORLD;
    const dodgeDelta = playerController.resolveDodgeTarget(direction, dodgeDistance);

    if (!dodgeDelta) {
      return null;
    }

    const dodgeResult = this.playerCombatState.tryStartDodge(nowMs);

    if (!dodgeResult.ok) {
      this.emitSfx('invalid_action');
      return {
        ok: false,
        message: dodgeResult.reason,
        toastKind: 'error',
      };
    }

    playerController.startDodgeMotion(
      direction,
      Math.hypot(dodgeDelta.x, dodgeDelta.y),
      CombatSandboxSystem.DODGE_DURATION_MS,
    );
    playerController.requestCombatVisualState(
      'dodge',
      nowMs,
      CombatSandboxSystem.DODGE_DURATION_MS,
    );
    this.emitSfx('dodge');
    return null;
  }

  tryPlayerLightAttack(
    nowMs: number,
    playerController: PlayerController,
    targetWorldX: number | null,
    targetWorldY: number | null,
  ): UiHandledResult | null {
    if (!this.currentTilemap || !this.playerCombatState.getSnapshot(nowMs).combatModeActive) {
      return null;
    }

    const playerFeet = playerController.getFeetPoint();
    const attackAimRad = resolvePlayerAttackAimRad(
      playerFeet.x,
      playerFeet.y,
      playerController.getFacingDirection(),
      targetWorldX,
      targetWorldY,
    );
    const result = this.playerCombatState.tryStartLightAttack(nowMs);

    if (!result.ok) {
      this.emitSfx('invalid_action');
      return {
        ok: false,
        message: result.reason,
        toastKind: 'error',
      };
    }

    this.playerAttackAimRad = attackAimRad;
    this.playerAttackHitResolved = false;
    return null;
  }

  setGuardHeld(guardHeld: boolean): void {
    this.playerCombatState.setGuardHeld(guardHeld);
  }

  isCombatModeActive(nowMs: number): boolean {
    return this.playerCombatState.getSnapshot(nowMs).combatModeActive;
  }

  getUiSnapshot(nowMs: number): CombatUiSnapshot | null {
    if (!this.currentTilemap) {
      return null;
    }

    const playerSnapshot = this.playerCombatState.getSnapshot(nowMs);

    return {
      active: playerSnapshot.combatModeActive,
      player: playerSnapshot,
      enemy: playerSnapshot.combatModeActive
        ? this.enemySystem.getUiSnapshot()
        : null,
    };
  }

  toggleSprint(): UiHandledResult | null {
    const result = this.playerCombatState.toggleSprint();

    if (result.ok || !result.reason) {
      return null;
    }

    return {
      ok: false,
      message: result.reason,
      toastKind: 'error',
    };
  }

  canPlayerOccupy(feetWorldX: number, feetWorldY: number): boolean {
    return !this.enemySystem.blocksFeetAt(feetWorldX, feetWorldY);
  }

  destroy(): void {
    this.clearPlayerAttackTelegraphs();
    this.enemySystem.destroy();
  }

  private emitSfx(id: SfxEventId): void {
    this.eventBus.emitSfx(id);
  }

  private resolveEnemyAttackEvents(
    nowMs: number,
    playerController: PlayerController,
    events: EnemyUpdateEvent[],
    results: UiHandledResult[],
  ): void {
    const enemyPosition = this.enemySystem.getWorldPosition();
    const playerFeet = playerController.getFeetPoint();
    const canBlockFromFront = enemyPosition
      ? isAttackerInsideGuardFront(
          playerFeet.x,
          playerFeet.y,
          playerController.getFacingDirection(),
          enemyPosition.x,
          enemyPosition.y,
        )
      : false;

    events.forEach((event) => {
      if (event.kind !== 'attack_result') {
        return;
      }

      const damage = typeof event.damage === 'number' ? event.damage : 0;
      const hit = event.hit === true;

      if (!hit) {
        this.emitSfx('combat_miss');
        results.push({
          ok: true,
          message: event.reason === 'invulnerable' ? 'Dodged.' : 'Missed.',
          toastKind: 'info',
        });
        return;
      }

      const resolution = this.playerCombatState.resolveIncomingAttack(
        nowMs,
        damage,
        canBlockFromFront,
      );

      switch (resolution.kind) {
        case 'dodged':
          this.emitSfx('combat_miss');
          results.push({
            ok: true,
            message: 'Dodged.',
            toastKind: 'info',
          });
          return;

        case 'blocked':
          this.emitSfx('guard_block');
          results.push({
            ok: true,
            message: 'Blocked.',
            toastKind: 'info',
          });
          return;

        case 'guard_broken':
          playerController.requestCombatVisualState('hurt', nowMs, 360);
          this.emitSfx('guard_break');
          results.push({
            ok: false,
            message: resolution.wasDowned ? 'Guard broken. Downed.' : 'Guard broken!',
            toastKind: 'error',
          });
          return;

        case 'hit':
        default:
          playerController.requestCombatVisualState(
            resolution.wasDowned ? 'dead' : 'hurt',
            nowMs,
            resolution.wasDowned ? 900 : 260,
          );
          this.emitSfx('combat_hit');
          results.push({
            ok: false,
            message: resolution.wasDowned ? 'Downed.' : 'Hit!',
            toastKind: 'error',
          });
      }
    });
  }

  private resolvePlayerLightAttackActivation(): void {
    if (!this.playerCombatState.consumePendingLightAttackActivation()) {
      return;
    }
  }

  private resolvePlayerLightAttackHit(
    nowMs: number,
    playerController: PlayerController,
    results: UiHandledResult[],
  ): void {
    if (this.playerAttackHitResolved) {
      return;
    }

    const snapshot = this.playerCombatState.getSnapshot(nowMs);

    if (snapshot.lightAttackPhase !== 'active') {
      return;
    }

    const enemyPosition = this.enemySystem.getWorldPosition();
    const enemyHitCircle = this.enemySystem.getHitCircle();
    const playerFeet = playerController.getFeetPoint();
    const attackAimRad = this.playerAttackAimRad ?? resolvePlayerAttackAimRad(
      playerFeet.x,
      playerFeet.y,
      playerController.getFacingDirection(),
      null,
      null,
    );

    if (
      !enemyPosition
      || !(
        isEnemyInsidePlayerLightAttackByRotation(
          playerFeet.x,
          playerFeet.y,
          attackAimRad,
          enemyPosition.x,
          enemyPosition.y,
        )
        || (
          enemyHitCircle !== null
          && doesEnemyHitCircleIntersectPlayerLightAttackByRotation(
            playerFeet.x,
            playerFeet.y,
            attackAimRad,
            enemyHitCircle.worldX,
            enemyHitCircle.worldY,
            enemyHitCircle.radius,
          )
        )
      )
    ) {
      return;
    }

    const outcome = this.enemySystem.applyDamage(
      CombatSandboxSystem.PLAYER_LIGHT_ATTACK_DAMAGE,
      nowMs,
    );

    if (!outcome.hit) {
      return;
    }

    this.playerAttackHitResolved = true;
    this.emitSfx(outcome.killed ? 'enemy_down' : 'player_attack');
    results.push({
      ok: true,
      message: outcome.killed ? 'Enemy down.' : 'You landed a hit.',
      toastKind: outcome.killed ? 'success' : 'info',
    });
  }

  private syncPlayerAttackVisuals(nowMs: number, playerController: PlayerController): void {
    const snapshot = this.playerCombatState.getSnapshot(nowMs);

    if (snapshot.lightAttackPhase === this.lastPlayerAttackPhase) {
      return;
    }

    this.lastPlayerAttackPhase = snapshot.lightAttackPhase;

    switch (snapshot.lightAttackPhase) {
      case 'windup':
        playerController.requestCombatVisualState(
          'attack_windup',
          nowMs,
          CombatSandboxSystem.PLAYER_ATTACK_WINDUP_MS,
        );
        this.showPlayerAttackWindupTelegraph(nowMs, playerController);
        break;
      case 'active':
        playerController.requestCombatVisualState(
          'attack_active',
          nowMs,
          CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_MS,
        );
        this.showPlayerAttackActiveTelegraph(nowMs, playerController);
        break;
      case 'recovery':
        playerController.requestCombatVisualState(
          'attack_recovery',
          nowMs,
          CombatSandboxSystem.PLAYER_ATTACK_RECOVERY_MS,
        );
        this.playerAttackHitResolved = false;
        this.clearPlayerAttackTelegraphs();
        break;
      default:
        this.playerAttackAimRad = null;
        this.playerAttackHitResolved = false;
        this.clearPlayerAttackTelegraphs();
        break;
    }
  }

  private resolvePlayerEnemyOverlap(playerController: PlayerController): void {
    const enemyBody = this.enemySystem.getBlockingCircle();

    if (!enemyBody || !this.currentTilemap) {
      return;
    }

    const feet = playerController.getFeetPoint();
    const dx = feet.x - enemyBody.worldX;
    const dy = feet.y - enemyBody.worldY;
    const distance = Math.hypot(dx, dy);

    if (distance >= enemyBody.radius) {
      return;
    }

    const preferred = distance > 0.001
      ? new Phaser.Math.Vector2(dx / distance, dy / distance)
      : new Phaser.Math.Vector2(0, 1);
    const angleOffsets = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4];
    const minDistance = enemyBody.radius + 1;
    const maxDistance = enemyBody.radius + 14;

    for (let probeDistance = minDistance; probeDistance <= maxDistance; probeDistance += 2) {
      for (const angleOffset of angleOffsets) {
        const direction = preferred.clone().rotate(angleOffset);
        const candidateX = enemyBody.worldX + direction.x * probeDistance;
        const candidateY = enemyBody.worldY + direction.y * probeDistance;

        if (!playerController.canOccupyFeetPosition(candidateX, candidateY)) {
          continue;
        }

        playerController.setFeetWorldPosition(candidateX, candidateY);
        return;
      }
    }
  }

  private showPlayerAttackWindupTelegraph(nowMs: number, playerController: PlayerController): void {
    this.clearPlayerAttackTelegraphs();
    const feet = playerController.getFeetPoint();
    const hitbox = this.playerAttackAimRad !== null
      ? getPlayerLightAttackHitboxByRotation(feet.x, feet.y, this.playerAttackAimRad)
      : getPlayerLightAttackHitbox(
          feet.x,
          feet.y,
          playerController.getFacingDirection(),
        );

    this.telegraphSystem.showTelegraph({
      id: CombatSandboxSystem.PLAYER_ATTACK_WINDUP_TELEGRAPH_ID,
      worldX: hitbox.worldX,
      worldY: hitbox.worldY,
      shape: hitbox.shape,
      durationMs: CombatSandboxSystem.PLAYER_ATTACK_WINDUP_MS,
      startedAtMs: nowMs,
      warningColor: 0xeab308,
      fadeOutMs: CombatSandboxSystem.PLAYER_ATTACK_WINDUP_MS,
      strokeAlpha: 0,
      fillAlphaMultiplier: 0.32,
    });
  }

  private showPlayerAttackActiveTelegraph(nowMs: number, playerController: PlayerController): void {
    this.clearPlayerAttackTelegraphs();
    const feet = playerController.getFeetPoint();
    const hitbox = this.playerAttackAimRad !== null
      ? getPlayerLightAttackHitboxByRotation(feet.x, feet.y, this.playerAttackAimRad)
      : getPlayerLightAttackHitbox(
          feet.x,
          feet.y,
          playerController.getFacingDirection(),
        );
    const slash = this.playerAttackAimRad !== null
      ? getPlayerLightAttackSlashByRotation(hitbox.worldX, hitbox.worldY, this.playerAttackAimRad)
      : getPlayerLightAttackSlash(
          feet.x,
          feet.y,
          playerController.getFacingDirection(),
        );

    this.telegraphSystem.showTelegraph({
      id: CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID,
      worldX: hitbox.worldX,
      worldY: hitbox.worldY,
      shape: hitbox.shape,
      durationMs: CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_MS,
      startedAtMs: nowMs,
      warningColor: 0xfacc15,
      fadeOutMs: CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_MS,
      strokeAlpha: 0,
      fillAlphaMultiplier: 0.42,
    });

    this.telegraphSystem.showTelegraph({
      id: CombatSandboxSystem.PLAYER_ATTACK_SLASH_TELEGRAPH_ID,
      worldX: slash.worldX,
      worldY: slash.worldY,
      shape: slash.shape,
      durationMs: CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_MS,
      startedAtMs: nowMs,
      warningColor: 0xfacc15,
      fadeOutMs: CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_MS,
    });
  }

  private clearPlayerAttackTelegraphs(): void {
    this.telegraphSystem.removeTelegraph(CombatSandboxSystem.PLAYER_ATTACK_WINDUP_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(CombatSandboxSystem.PLAYER_ATTACK_SLASH_TELEGRAPH_ID);
  }
}
