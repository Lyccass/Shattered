import Phaser from 'phaser';
import { resolveClickMovementDodgeDirection } from './CombatDodge';
import {
  isAttackerInsideGuardFront,
  resolvePlayerAttackAimRad,
} from './CombatPlayerMath';
import { CombatDebugHitboxRenderer } from './CombatDebugHitboxRenderer';
import type { PlayerAttackPhase } from './PlayerCombatState';
import {
  DODGE_DURATION_MS,
  LIGHT_ATTACK_WINDUP_MS,
  LIGHT_ATTACK_ACTIVE_MS,
  LIGHT_ATTACK_RECOVERY_MS,
} from './PlayerCombatState';
import { PlayerAttackFeedbackRenderer } from './PlayerAttackFeedbackRenderer';
import { resolveSpearTargetTileCenter } from './PlayerAttackTargeting';
import { resolveTileDodgeMotion } from './PlayerDodgeTargeting';
import { separatePlayerFromEnemyTile } from './PlayerEnemySeparation';
import type { SfxEventId } from '../audio/SfxTypes';
import type { LevelUpEvent, SkillXpDelta } from '../skills/SkillTypes';
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

export type EnemyKilledEvent = {
  enemyDefinitionId: string;
  worldX: number;
  worldY: number;
};

export class CombatSandboxSystem {
  private static readonly SPRINT_SPEED_MULTIPLIER = 2;
  private static readonly PLAYER_LIGHT_ATTACK_DAMAGE = 1;

  private readonly playerCombatState = new PlayerCombatState();
  private readonly scene: Phaser.Scene;
  private readonly telegraphSystem: TelegraphSystem;
  private enemySystems: EnemySystem[] = [];
  private readonly debugHitboxRenderer: CombatDebugHitboxRenderer;
  private readonly playerAttackFeedbackRenderer: PlayerAttackFeedbackRenderer;
  private currentTilemap: IsoTilemap | null = null;
  private lastPlayerAttackPhase: PlayerAttackPhase = 'idle';
  private playerAttackTargetWorld: { x: number; y: number } | null = null;
  private playerAttackHitResolved = false;
  private static readonly HIT_STOP_MS = 70;
  private static readonly POST_HIT_RECOVERY_MS = 320;
  private currentLightAttackReachTiles = 1;

  private currentPlayerTier = 1;
  private currentDodgeTileCount = 2;
  private hitStopUntilMs = 0;
  private pendingScreenShake = false;
  private onEnemyKilled?: (event: EnemyKilledEvent) => void;
  private onPlayerDied?: (worldX: number, worldY: number) => void;
  private onCombatXp?: (delta: SkillXpDelta) => LevelUpEvent[];

  constructor(
    scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
    telegraphSystem: TelegraphSystem,
    onEnemyKilled?: (event: EnemyKilledEvent) => void,
    onPlayerDied?: (worldX: number, worldY: number) => void,
    onCombatXp?: (delta: SkillXpDelta) => LevelUpEvent[],
  ) {
    this.scene = scene;
    this.telegraphSystem = telegraphSystem;
    this.debugHitboxRenderer = new CombatDebugHitboxRenderer(scene);
    this.playerAttackFeedbackRenderer = new PlayerAttackFeedbackRenderer(scene, telegraphSystem);
    this.onEnemyKilled = onEnemyKilled;
    this.onPlayerDied = onPlayerDied;
    this.onCombatXp = onCombatXp;
  }

  setMapContext(mapId: string, tilemap: IsoTilemap): void {
    this.currentTilemap = tilemap;

    for (const es of this.enemySystems) {
      es.destroy();
    }
    this.enemySystems = [];

    const spawns = COMBAT_SANDBOX_SPAWNS.filter((s) => s.mapId === mapId);
    for (const spawn of spawns) {
      const es = new EnemySystem(this.scene, this.telegraphSystem);
      es.setMapContext(mapId, tilemap, spawn);
      this.enemySystems.push(es);
    }

    this.playerCombatState.leaveCombat();
    this.playerCombatState.setGuardHeld(false);
    this.lastPlayerAttackPhase = 'idle';

    this.playerAttackTargetWorld = null;
    this.playerAttackHitResolved = false;
    this.playerAttackFeedbackRenderer.clear();
  }

  update(nowMs: number, deltaMs: number, playerController: PlayerController): UiHandledResult[] {
    const inHitStop = nowMs < this.hitStopUntilMs;

    this.playerCombatState.update(nowMs, deltaMs, playerController.isMoving());
    this.syncPlayerAttackVisuals(nowMs, playerController);

    if (!this.currentTilemap) {
      this.playerCombatState.leaveCombat();
      this.playerCombatState.setGuardHeld(false);
      playerController.setMovementSpeedMultiplier(1);
  
      this.playerAttackHitResolved = false;
      this.playerAttackFeedbackRenderer.clear();
      return [];
    }

    const feetPoint = playerController.getFeetPoint();
    const playerOccupiedTiles = playerController.getFootprintTiles();
    const combatActive = this.enemySystems.some((es) => es.isCombatActive(feetPoint.x, feetPoint.y));

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

    const engagedEnemyId = this.getEngagedEnemyId();

    const events: EnemyUpdateEvent[] = [];
    if (!inHitStop) {
      for (const es of this.enemySystems) {
        const esEvents = es.update(
          nowMs,
          deltaMs,
          feetPoint.x,
          feetPoint.y,
          this.playerCombatState.isInvulnerable(nowMs),
          playerOccupiedTiles,
          engagedEnemyId,
          this.currentPlayerTier,
        );
        events.push(...esEvents);
      }
    }
    this.resolvePlayerEnemyOverlap(playerController);
    this.syncDebugHitboxes(nowMs, playerController);

    const results: UiHandledResult[] = [];
    this.resolveEnemyAttackEvents(nowMs, playerController, events, results);
    this.resolvePlayerLightAttackActivation();
    this.resolvePlayerLightAttackHit(nowMs, results);

    if (this.playerCombatState.consumeRecoveredFromDowned()) {
      for (const es of this.enemySystems) {
        es.forceReset();
      }
      const feet = playerController.getFeetPoint();
      this.onPlayerDied?.(feet.x, feet.y);
    }

    return results;
  }

  tryDodge(
    nowMs: number,
    playerController: PlayerController,
    targetWorldX: number | null,
    targetWorldY: number | null,
  ): UiHandledResult | null {
    if (!this.currentTilemap) {
      return null;
    }

    if (playerController.isDodging()) {
      return null;
    }

    const playerFeet = playerController.getFeetPoint();
    const enemyPosition = this.getClosestEnemyPosition(playerFeet.x, playerFeet.y);
    // Use raw mouse direction when available — gives smooth free-angle dodge toward pointer.
    // Fall back to 8-directional resolution from movement/facing when no pointer.
    const pointerDelta =
      targetWorldX !== null
      && targetWorldY !== null
      && Math.hypot(targetWorldX - playerFeet.x, targetWorldY - playerFeet.y) > 0.001
        ? {
            x: targetWorldX - playerFeet.x,
            y: targetWorldY - playerFeet.y,
          }
        : null;
    const direction = pointerDelta ?? resolveClickMovementDodgeDirection({
      currentMoveDirection: playerController.getCurrentMoveDirection(),
      awayFromEnemyDirection: enemyPosition
        ? {
            x: playerFeet.x - enemyPosition.x,
            y: playerFeet.y - enemyPosition.y,
          }
        : null,
      lastMovementDirection: playerController.getLastMovementDirection(),
      facing: playerController.getFacingDirection(),
    });
    const isSprinting = this.playerCombatState.getSnapshot(nowMs).isSprinting;
    this.currentDodgeTileCount = isSprinting ? 2 : 1;

    const dodgeMotion = resolveTileDodgeMotion({
      tilemap: this.currentTilemap,
      playerController,
      direction,
      requestedTileCount: this.currentDodgeTileCount,
    });

    if (!dodgeMotion) {
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

    // Immediately clear any in-flight attack telegraphs so the cancel is visually instant
    this.lastPlayerAttackPhase = 'idle';

    this.playerAttackTargetWorld = null;
    this.playerAttackHitResolved = false;
    this.playerAttackFeedbackRenderer.clear();

    playerController.startDodgeMotion(dodgeMotion.direction, dodgeMotion.distance, DODGE_DURATION_MS);
    playerController.requestCombatVisualState(
      'dodge',
      nowMs,
      DODGE_DURATION_MS,
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
    if (!this.currentTilemap) {
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

    playerController.clearClickMoveTarget();
    this.playerAttackTargetWorld = resolveSpearTargetTileCenter({
      tilemap: this.currentTilemap,
      playerFeet,
      targetWorldX,
      targetWorldY,
      aimRad: attackAimRad,
      maxTileReach: this.currentLightAttackReachTiles,
    });
    this.playerAttackHitResolved = false;
    return null;
  }

  setGuardHeld(guardHeld: boolean): void {
    this.playerCombatState.setGuardHeld(guardHeld);
  }

  isCombatModeActive(nowMs: number): boolean {
    return this.playerCombatState.getSnapshot(nowMs).combatModeActive;
  }

  syncMaxHp(maxHp: number): void {
    this.playerCombatState.updateMaxHp(maxHp);
  }

  syncAttackReach(tiles: number): void {
    this.currentLightAttackReachTiles = Math.max(0.5, tiles);
  }

  syncPlayerTier(tier: number): void {
    this.currentPlayerTier = tier;
  }

  getUiSnapshot(nowMs: number): CombatUiSnapshot | null {
    if (!this.currentTilemap) {
      return null;
    }

    const playerSnapshot = this.playerCombatState.getSnapshot(nowMs);
    let enemySnapshot = null;

    if (playerSnapshot.combatModeActive) {
      for (const es of this.enemySystems) {
        const snap = es.getUiSnapshot();
        if (snap && snap.state !== 'idle' && snap.state !== 'dead' && snap.state !== 'reset') {
          enemySnapshot = snap;
          break;
        }
      }
    }

    return {
      active: playerSnapshot.combatModeActive,
      player: playerSnapshot,
      enemy: enemySnapshot,
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
    return !this.enemySystems.some((es) => es.blocksFeetAt(feetWorldX, feetWorldY));
  }

  preSyncAttackVisuals(nowMs: number, playerController: PlayerController): void {
    this.syncPlayerAttackVisuals(nowMs, playerController);
  }

  consumePendingScreenShake(): boolean {
    if (!this.pendingScreenShake) {
      return false;
    }

    this.pendingScreenShake = false;
    return true;
  }

  destroy(): void {
    this.playerAttackFeedbackRenderer.clear();
    this.debugHitboxRenderer.destroy();
    for (const es of this.enemySystems) {
      es.destroy();
    }
    this.enemySystems = [];
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
    const playerFeet = playerController.getFeetPoint();
    const enemyPosition = this.getClosestEnemyPosition(playerFeet.x, playerFeet.y);
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
          // Roar pushes through the guard at reduced force
          if (event.knockbackDirX !== undefined && event.knockbackDistanceWorld) {
            playerController.startDodgeMotion(
              { x: event.knockbackDirX, y: event.knockbackDirY ?? 0 },
              event.knockbackDistanceWorld * 0.55,
              280,
            );
          }
          return;

        case 'guard_broken': {
          playerController.requestCombatVisualState('hurt', nowMs, 360);
          this.emitSfx('guard_break');
          const gbLevelUps = resolution.damageApplied > 0
            ? this.onCombatXp?.({ defence: resolution.damageApplied })
            : undefined;
          results.push({
            ok: false,
            message: resolution.wasDowned ? 'Guard broken. Downed.' : 'Guard broken!',
            toastKind: 'error',
            xpDelta: resolution.damageApplied > 0 ? { defence: resolution.damageApplied } : undefined,
            levelUps: gbLevelUps,
          });
          return;
        }

        case 'hit':
        default: {
          playerController.requestCombatVisualState(
            resolution.wasDowned ? 'dead' : 'hurt',
            nowMs,
            resolution.wasDowned ? 900 : 260,
          );
          this.emitSfx('combat_hit');
          const hitLevelUps = resolution.damageApplied > 0
            ? this.onCombatXp?.({ defence: resolution.damageApplied })
            : undefined;
          results.push({
            ok: false,
            message: resolution.wasDowned ? 'Downed.' : 'Hit!',
            toastKind: 'error',
            xpDelta: resolution.damageApplied > 0 ? { defence: resolution.damageApplied } : undefined,
            levelUps: hitLevelUps,
          });
        }
          if (event.knockbackDirX !== undefined && event.knockbackDistanceWorld) {
            playerController.startDodgeMotion(
              { x: event.knockbackDirX, y: event.knockbackDirY ?? 0 },
              event.knockbackDistanceWorld,
              300,
            );
          }
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
    results: UiHandledResult[],
  ): void {
    if (this.playerAttackHitResolved) {
      return;
    }

    const snapshot = this.playerCombatState.getSnapshot(nowMs);

    if (snapshot.lightAttackPhase !== 'active') {
      return;
    }

    if (!this.playerAttackTargetWorld || !this.currentTilemap) {
      return;
    }

    const targetTile = this.currentTilemap.transform.worldToTile(
      this.playerAttackTargetWorld.x,
      this.playerAttackTargetWorld.y,
    );

    const hitSystem = this.enemySystems.find((es) =>
      es.getOccupiedTiles().some((et) => et.x === targetTile.x && et.y === targetTile.y),
    );

    if (!hitSystem) {
      return;
    }

    const outcome = hitSystem.applyDamage(
      CombatSandboxSystem.PLAYER_LIGHT_ATTACK_DAMAGE,
      nowMs,
    );

    if (!outcome.hit) {
      return;
    }

    this.playerAttackHitResolved = true;
    this.hitStopUntilMs = nowMs + CombatSandboxSystem.HIT_STOP_MS;
    this.pendingScreenShake = true;
    this.playerCombatState.setNextRecoveryMs(CombatSandboxSystem.POST_HIT_RECOVERY_MS);
    this.playerCombatState.refundLightAttackStamina();
    this.emitSfx(outcome.killed ? 'enemy_down' : 'player_attack');

    if (outcome.killed && this.onEnemyKilled) {
      const pos = hitSystem.getWorldPosition();
      const defId = hitSystem.getDefinitionId();
      if (pos && defId) {
        this.onEnemyKilled({ enemyDefinitionId: defId, worldX: pos.x, worldY: pos.y });
      }
    }

    const meleeDamage = CombatSandboxSystem.PLAYER_LIGHT_ATTACK_DAMAGE;
    const meleeLevelUps = this.onCombatXp?.({ melee: meleeDamage });
    results.push({
      ok: true,
      message: outcome.killed ? 'Enemy down.' : 'You landed a hit.',
      toastKind: outcome.killed ? 'success' : 'info',
      xpDelta: { melee: meleeDamage },
      levelUps: meleeLevelUps,
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
          LIGHT_ATTACK_WINDUP_MS,
        );
        this.playerAttackFeedbackRenderer.showWindup({
          nowMs,
          tilemap: this.currentTilemap,
          playerController,
          targetWorld: this.playerAttackTargetWorld,
          maxTileReach: this.currentLightAttackReachTiles,
        });
        break;
      case 'active':
        playerController.requestCombatVisualState(
          'attack_active',
          nowMs,
          LIGHT_ATTACK_ACTIVE_MS,
        );
        this.playerAttackFeedbackRenderer.showActive({
          nowMs,
          tilemap: this.currentTilemap,
          targetWorld: this.playerAttackTargetWorld,
        });
        this.playerAttackFeedbackRenderer.drawSlashVfx(this.playerAttackTargetWorld);
        break;
      case 'recovery':
        playerController.requestCombatVisualState(
          'attack_recovery',
          nowMs,
          LIGHT_ATTACK_RECOVERY_MS,
        );
        this.playerAttackHitResolved = false;
        this.playerAttackFeedbackRenderer.clear();
        break;
      default:
    
        this.playerAttackTargetWorld = null;
        this.playerAttackHitResolved = false;
        this.playerAttackFeedbackRenderer.clear();
        break;
    }
  }

  private resolvePlayerEnemyOverlap(playerController: PlayerController): void {
    if (!this.currentTilemap) {
      return;
    }

    for (const es of this.enemySystems) {
      separatePlayerFromEnemyTile({
        tilemap: this.currentTilemap,
        playerController,
        enemyTile: es.getOccupiedTile(),
      });
    }
  }

  private syncDebugHitboxes(nowMs: number, playerController: PlayerController): void {
    const snapshot = this.playerCombatState.getSnapshot(nowMs);
    const allEnemyTiles = this.enemySystems.flatMap((es) => es.getOccupiedTiles());
    this.debugHitboxRenderer.render({
      tilemap: this.currentTilemap,
      playerTiles: playerController.getFootprintTiles(),
      enemyTiles: allEnemyTiles,
      dodgeDirection: playerController.getDodgeDirection(),
      dodgeTileCount: this.currentDodgeTileCount,
      playerAttackTargetWorld: this.playerAttackTargetWorld,
      playerAttackPhase: snapshot.lightAttackPhase,
    });
  }

  private getEngagedEnemyId(): string | null {
    for (const es of this.enemySystems) {
      if (es.isEngaged()) {
        return es.getRuntimeId();
      }
    }
    return null;
  }

  private getClosestEnemyPosition(fromX: number, fromY: number): { x: number; y: number } | null {
    let closest: { x: number; y: number } | null = null;
    let closestDist = Infinity;
    for (const es of this.enemySystems) {
      const pos = es.getWorldPosition();
      if (pos) {
        const d = Math.hypot(pos.x - fromX, pos.y - fromY);
        if (d < closestDist) {
          closestDist = d;
          closest = pos;
        }
      }
    }
    return closest;
  }
}
