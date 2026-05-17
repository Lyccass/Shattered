import Phaser from 'phaser';
import { resolveCombatDodgeDirection } from './CombatDodge';
import type { SfxEventId } from '../audio/SfxTypes';
import type { UiHandledResult } from '../ui/UiTypes';
import { COMBAT_SANDBOX_SPAWNS } from './CombatSandboxDefinitions';
import type { CombatUiSnapshot } from './CombatUiTypes';
import { EnemySystem } from './EnemySystem';
import { PlayerCombatState } from './PlayerCombatState';
import type { PlayerController } from '../player/PlayerController';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { TelegraphSystem } from './TelegraphSystem';
import type { GameEventBus } from '../events/GameEventBus';

export class CombatSandboxSystem {
  private static readonly DODGE_DURATION_MS = 250;
  private static readonly DODGE_DISTANCE_WORLD = 58;

  private readonly playerCombatState = new PlayerCombatState();
  private readonly enemySystem: EnemySystem;
  private currentTilemap: IsoTilemap | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
    telegraphSystem: TelegraphSystem,
  ) {
    this.enemySystem = new EnemySystem(scene, telegraphSystem);
  }

  setMapContext(mapId: string, tilemap: IsoTilemap): void {
    this.currentTilemap = tilemap;
    const spawn = COMBAT_SANDBOX_SPAWNS.find((candidate) => candidate.mapId === mapId) ?? null;
    this.enemySystem.setMapContext(mapId, tilemap, spawn);
    this.playerCombatState.leaveCombat();
  }

  update(nowMs: number, deltaMs: number, playerController: PlayerController): UiHandledResult[] {
    this.playerCombatState.update(nowMs, deltaMs);

    if (!this.currentTilemap) {
      this.playerCombatState.leaveCombat();
      playerController.setMovementSpeedMultiplier(1);
      return [];
    }

    const feetPoint = playerController.getFeetPoint();
    const combatActive = this.enemySystem.isCombatActive(feetPoint.x, feetPoint.y);

    if (combatActive) {
      this.playerCombatState.enterCombat();
    } else {
      this.playerCombatState.leaveCombat();
    }
    playerController.setMovementSpeedMultiplier(1);

    const events = this.enemySystem.update(
      nowMs,
      deltaMs,
      feetPoint.x,
      feetPoint.y,
      this.playerCombatState.isInvulnerable(nowMs),
    );
    this.resolvePlayerEnemyOverlap(playerController);

    const results: UiHandledResult[] = [];

    events.forEach((event) => {
      if (event.kind !== 'attack_result') {
        return;
      }

      if (event.hit) {
        const applied = this.playerCombatState.registerHit(nowMs);

        if (applied) {
          playerController.requestCombatVisualState('hurt', nowMs, 260);
          this.emitSfx('combat_hit');
          results.push({
            ok: false,
            message: 'Hit!',
            toastKind: 'error',
          });
        }
        return;
      }

      this.emitSfx('combat_miss');
      results.push({
        ok: true,
        message: event.reason === 'invulnerable' ? 'Dodged.' : 'Missed.',
        toastKind: 'info',
      });
    });

    return results;
  }

  tryDodge(nowMs: number, playerController: PlayerController): UiHandledResult | null {
    if (!this.currentTilemap || !this.playerCombatState.getSnapshot(nowMs).combatModeActive) {
      return null;
    }

    if (playerController.isDodging()) {
      return null;
    }

    const direction = resolveCombatDodgeDirection(
      playerController.getMovementIntent(),
      playerController.getFacingDirection(),
    );
    const dodgeDistance = CombatSandboxSystem.DODGE_DISTANCE_WORLD;
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

  isCombatModeActive(nowMs: number): boolean {
    return this.playerCombatState.getSnapshot(nowMs).combatModeActive;
  }

  getUiSnapshot(nowMs: number): CombatUiSnapshot | null {
    if (!this.playerCombatState.getSnapshot(nowMs).combatModeActive) {
      return null;
    }

    return {
      active: true,
      player: this.playerCombatState.getSnapshot(nowMs),
      enemy: this.enemySystem.getUiSnapshot(),
    };
  }

  canPlayerOccupy(feetWorldX: number, feetWorldY: number): boolean {
    return !this.enemySystem.blocksFeetAt(feetWorldX, feetWorldY);
  }

  destroy(): void {
    this.enemySystem.destroy();
  }

  private emitSfx(id: SfxEventId): void {
    this.eventBus.emitSfx(id);
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
}
