import Phaser from 'phaser';
import { resolveClickMovementDodgeDirection } from './CombatDodge';
import {
  isAttackerInsideGuardFront,
  resolvePlayerAttackAimRad,
} from './CombatPlayerMath';
import type { PlayerAttackPhase } from './PlayerCombatState';
import {
  DODGE_DURATION_MS,
  LIGHT_ATTACK_WINDUP_MS,
  LIGHT_ATTACK_ACTIVE_MS,
  LIGHT_ATTACK_RECOVERY_MS,
} from './PlayerCombatState';
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
  private static readonly SPRINT_SPEED_MULTIPLIER = 2;
  private static readonly PLAYER_LIGHT_ATTACK_DAMAGE = 1;
  private static readonly PLAYER_ATTACK_WINDUP_TELEGRAPH_ID = 'player_light_attack_windup';
  private static readonly PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID = 'player_light_attack_active';
  private static readonly PLAYER_ATTACK_SLASH_TELEGRAPH_ID = 'player_light_attack_slash';

  private readonly playerCombatState = new PlayerCombatState();
  private readonly enemySystem: EnemySystem;
  private readonly telegraphSystem: TelegraphSystem;
  private readonly debugHitboxGraphics: Phaser.GameObjects.Graphics;
  private currentTilemap: IsoTilemap | null = null;
  private lastPlayerAttackPhase: PlayerAttackPhase = 'idle';
  private playerAttackTargetWorld: { x: number; y: number } | null = null;
  private playerAttackHitResolved = false;
  private static readonly SPEAR_MAX_TILE_REACH = 3;
  private static readonly HIT_STOP_MS = 70;

  private currentDodgeTileCount = 2;
  private hitStopUntilMs = 0;
  private pendingScreenShake = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
    telegraphSystem: TelegraphSystem,
  ) {
    this.telegraphSystem = telegraphSystem;
    this.enemySystem = new EnemySystem(scene, telegraphSystem);
    this.debugHitboxGraphics = scene.add.graphics();
    this.debugHitboxGraphics.setDepth(9_500);
  }

  setMapContext(mapId: string, tilemap: IsoTilemap): void {
    this.currentTilemap = tilemap;
    const spawn = COMBAT_SANDBOX_SPAWNS.find((candidate) => candidate.mapId === mapId) ?? null;
    this.enemySystem.setMapContext(mapId, tilemap, spawn);
    this.playerCombatState.leaveCombat();
    this.playerCombatState.setGuardHeld(false);
    this.lastPlayerAttackPhase = 'idle';

    this.playerAttackTargetWorld = null;
    this.playerAttackHitResolved = false;
    this.clearPlayerAttackTelegraphs();
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
      this.clearPlayerAttackTelegraphs();
      return [];
    }

    const feetPoint = playerController.getFeetPoint();
    const playerOccupiedTiles = playerController.getFootprintTiles();
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

    const events = inHitStop
      ? []
      : this.enemySystem.update(
          nowMs,
          deltaMs,
          feetPoint.x,
          feetPoint.y,
          this.playerCombatState.isInvulnerable(nowMs),
          playerOccupiedTiles,
        );
    this.resolvePlayerEnemyOverlap(playerController);
    this.syncDebugHitboxes(nowMs, playerController);

    const results: UiHandledResult[] = [];
    this.resolveEnemyAttackEvents(nowMs, playerController, events, results);
    this.resolvePlayerLightAttackActivation();
    this.resolvePlayerLightAttackHit(nowMs, results);

    if (this.playerCombatState.consumeRecoveredFromDowned()) {
      this.enemySystem.forceReset();
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

    const enemyPosition = this.enemySystem.getWorldPosition();
    const playerFeet = playerController.getFeetPoint();
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

    // Snap direction to the nearest isometric grid direction and slide to the furthest
    // valid tile in that direction (up to currentDodgeTileCount steps).
    const aimAngle = Math.atan2(direction.y, direction.x);
    const [dgx, dgy] = snapToIsometricGridDirection(
      aimAngle,
      this.currentTilemap.tileWidth,
      this.currentTilemap.tileHeight,
    );
    const playerFeetForDodge = playerController.getFeetPoint();
    const playerTile = this.currentTilemap.transform.worldToTile(playerFeetForDodge.x, playerFeetForDodge.y);
    let finalTileX = playerTile.x;
    let finalTileY = playerTile.y;

    for (let step = 1; step <= this.currentDodgeTileCount; step++) {
      const tx = playerTile.x + dgx * step;
      const ty = playerTile.y + dgy * step;

      if (!this.currentTilemap.isTileInBounds(tx, ty) || !this.currentTilemap.isTileWalkable(tx, ty)) {
        break;
      }

      const center = this.currentTilemap.getTileCenterWorld(tx, ty);

      if (!playerController.canOccupyFeetPosition(center.x, center.y)) {
        break;
      }

      finalTileX = tx;
      finalTileY = ty;
    }

    if (finalTileX === playerTile.x && finalTileY === playerTile.y) {
      return null;
    }

    const targetCenter = this.currentTilemap.getTileCenterWorld(finalTileX, finalTileY);
    const dodgeDir = {
      x: targetCenter.x - playerFeetForDodge.x,
      y: targetCenter.y - playerFeetForDodge.y,
    };
    const dodgeDistance = Math.hypot(dodgeDir.x, dodgeDir.y);

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
    this.clearPlayerAttackTelegraphs();

    playerController.startDodgeMotion(dodgeDir, dodgeDistance, DODGE_DURATION_MS);
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
    this.playerAttackTargetWorld = this.resolveSpearTarget(playerFeet, targetWorldX, targetWorldY, attackAimRad);
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
    this.clearPlayerAttackTelegraphs();
    this.debugHitboxGraphics.destroy();
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
          // Roar pushes through the guard at reduced force
          if (event.knockbackDirX !== undefined && event.knockbackDistanceWorld) {
            playerController.startDodgeMotion(
              { x: event.knockbackDirX, y: event.knockbackDirY ?? 0 },
              event.knockbackDistanceWorld * 0.55,
              280,
            );
          }
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
    const enemyTiles = this.enemySystem.getOccupiedTiles();

    if (!enemyTiles.some((et) => et.x === targetTile.x && et.y === targetTile.y)) {
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
    this.hitStopUntilMs = nowMs + CombatSandboxSystem.HIT_STOP_MS;
    this.pendingScreenShake = true;
    this.playerCombatState.setNextRecoveryMs(320);
    this.playerCombatState.refundLightAttackStamina();
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
          LIGHT_ATTACK_WINDUP_MS,
        );
        this.showPlayerAttackWindupTelegraph(nowMs, playerController);
        break;
      case 'active':
        playerController.requestCombatVisualState(
          'attack_active',
          nowMs,
          LIGHT_ATTACK_ACTIVE_MS,
        );
        this.showPlayerAttackActiveTelegraph(nowMs, playerController);
        this.drawSlashVfx(playerController);
        break;
      case 'recovery':
        playerController.requestCombatVisualState(
          'attack_recovery',
          nowMs,
          LIGHT_ATTACK_RECOVERY_MS,
        );
        this.playerAttackHitResolved = false;
        this.clearPlayerAttackTelegraphs();
        break;
      default:
    
        this.playerAttackTargetWorld = null;
        this.playerAttackHitResolved = false;
        this.clearPlayerAttackTelegraphs();
        break;
    }
  }

  private drawSlashVfx(_playerController: PlayerController): void {
    if (!this.playerAttackTargetWorld) {
      return;
    }

    const { x, y } = this.playerAttackTargetWorld;
    const g = this.scene.add.graphics();
    g.setDepth(9_400);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(x, y, 14);
    g.fillStyle(0xfde68a, 0.85);
    g.fillCircle(x, y, 8);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  private resolvePlayerEnemyOverlap(playerController: PlayerController): void {
    const enemyTile = this.enemySystem.getOccupiedTile();

    if (!enemyTile || !this.currentTilemap) {
      return;
    }

    const playerTiles = playerController.getFootprintTiles();

    if (!playerTiles.some((tile) => tile.x === enemyTile.x && tile.y === enemyTile.y)) {
      return;
    }

    const enemyCenter = this.currentTilemap.getTileCenterWorld(enemyTile.x, enemyTile.y);
    const feet = playerController.getFeetPoint();
    const dx = feet.x - enemyCenter.x;
    const dy = feet.y - enemyCenter.y;
    const horizontal = dx >= 0 ? 1 : -1;
    const vertical = dy >= 0 ? 1 : -1;
    const candidateOffsets: Array<{ x: number; y: number }> = [
      { x: horizontal, y: vertical },
      { x: horizontal, y: 0 },
      { x: 0, y: vertical },
      { x: -horizontal, y: vertical },
      { x: horizontal, y: -vertical },
      { x: -horizontal, y: 0 },
      { x: 0, y: -vertical },
      { x: -horizontal, y: -vertical },
    ];

    for (const offset of candidateOffsets) {
      const tileX = enemyTile.x + offset.x;
      const tileY = enemyTile.y + offset.y;

      if (!this.currentTilemap.isTileInBounds(tileX, tileY) || !this.currentTilemap.isTileWalkable(tileX, tileY)) {
        continue;
      }

      // Only check terrain — skipping the enemy occupancy validator intentionally.
      // canOccupyFeetPosition would reject all adjacent tiles while the enemy is
      // nearby, making it impossible to escape the overlap.
      const candidate = this.currentTilemap.getTileCenterWorld(tileX, tileY);
      playerController.setFeetWorldPosition(candidate.x, candidate.y);
      return;
    }
  }

  private showPlayerAttackWindupTelegraph(nowMs: number, playerController: PlayerController): void {
    this.clearPlayerAttackTelegraphs();

    if (!this.currentTilemap || !this.playerAttackTargetWorld) {
      return;
    }

    const feet = playerController.getFeetPoint();
    const reachRadius = CombatSandboxSystem.SPEAR_MAX_TILE_REACH * this.currentTilemap.tileWidth;
    const dotRadius = this.currentTilemap.tileWidth * 0.5;

    this.telegraphSystem.showTelegraph({
      id: CombatSandboxSystem.PLAYER_ATTACK_WINDUP_TELEGRAPH_ID,
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
      id: CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID,
      worldX: this.playerAttackTargetWorld.x,
      worldY: this.playerAttackTargetWorld.y,
      shape: { kind: 'circle', radius: dotRadius },
      durationMs: LIGHT_ATTACK_WINDUP_MS,
      startedAtMs: nowMs,
      warningColor: 0xeab308,
      fadeOutMs: LIGHT_ATTACK_WINDUP_MS,
      strokeAlpha: 0.9,
      fillAlphaMultiplier: 0.38,
    });
  }

  private showPlayerAttackActiveTelegraph(nowMs: number, _playerController: PlayerController): void {
    this.clearPlayerAttackTelegraphs();

    if (!this.currentTilemap || !this.playerAttackTargetWorld) {
      return;
    }

    const dotRadius = this.currentTilemap.tileWidth * 0.5;

    this.telegraphSystem.showTelegraph({
      id: CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID,
      worldX: this.playerAttackTargetWorld.x,
      worldY: this.playerAttackTargetWorld.y,
      shape: { kind: 'circle', radius: dotRadius },
      durationMs: LIGHT_ATTACK_ACTIVE_MS,
      startedAtMs: nowMs,
      warningColor: 0xfacc15,
      fadeOutMs: LIGHT_ATTACK_ACTIVE_MS,
      strokeAlpha: 0,
      fillAlphaMultiplier: 0.60,
    });
  }

  private resolveSpearTarget(
    playerFeet: { x: number; y: number },
    targetWorldX: number | null,
    targetWorldY: number | null,
    aimRad: number,
  ): { x: number; y: number } | null {
    if (!this.currentTilemap) {
      return null;
    }

    const MAX = CombatSandboxSystem.SPEAR_MAX_TILE_REACH;
    const playerTile = this.currentTilemap.transform.worldToTile(playerFeet.x, playerFeet.y);

    let rawTile: { x: number; y: number };

    if (targetWorldX !== null && targetWorldY !== null) {
      rawTile = this.currentTilemap.transform.worldToTile(targetWorldX, targetWorldY);
    } else {
      // Keyboard fallback: project 2 tiles ahead in facing direction
      const projX = playerFeet.x + Math.cos(aimRad) * this.currentTilemap.tileWidth * 2;
      const projY = playerFeet.y + Math.sin(aimRad) * this.currentTilemap.tileWidth * 2;
      rawTile = this.currentTilemap.transform.worldToTile(projX, projY);
    }

    let dx = rawTile.x - playerTile.x;
    let dy = rawTile.y - playerTile.y;
    const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));

    if (chebyshev === 0) {
      // Aimed at own tile — project 1 tile in aim direction
      const projX = playerFeet.x + Math.cos(aimRad) * this.currentTilemap.tileWidth;
      const projY = playerFeet.y + Math.sin(aimRad) * this.currentTilemap.tileWidth;
      const projected = this.currentTilemap.transform.worldToTile(projX, projY);
      dx = projected.x - playerTile.x;
      dy = projected.y - playerTile.y;
    }

    if (Math.max(Math.abs(dx), Math.abs(dy)) > MAX) {
      const scale = MAX / Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.round(dx * scale);
      dy = Math.round(dy * scale);
    }

    const finalTile = { x: playerTile.x + dx, y: playerTile.y + dy };
    const center = this.currentTilemap.getTileCenterWorld(finalTile.x, finalTile.y);
    return { x: center.x, y: center.y };
  }

  private clearPlayerAttackTelegraphs(): void {
    this.telegraphSystem.removeTelegraph(CombatSandboxSystem.PLAYER_ATTACK_WINDUP_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(CombatSandboxSystem.PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID);
    this.telegraphSystem.removeTelegraph(CombatSandboxSystem.PLAYER_ATTACK_SLASH_TELEGRAPH_ID);
  }

  private syncDebugHitboxes(nowMs: number, playerController: PlayerController): void {
    if (!this.currentTilemap) {
      this.debugHitboxGraphics.clear();
      return;
    }

    this.debugHitboxGraphics.clear();

    // Player footprint tiles (cyan)
    drawTileSet(
      this.debugHitboxGraphics,
      this.currentTilemap,
      playerController.getFootprintTiles(),
      0x38bdf8,
      0.28,
      0.9,
    );

    // Enemy body tiles (red)
    drawTileSet(
      this.debugHitboxGraphics,
      this.currentTilemap,
      this.enemySystem.getOccupiedTiles(),
      0xef4444,
      0.28,
      0.9,
    );

    // Dodge preview tiles (green) — shown while actively dodging
    const dodgeDir = playerController.getDodgeDirection();

    if (dodgeDir) {
      const feet = playerController.getFeetPoint();
      const playerTile = this.currentTilemap.transform.worldToTile(feet.x, feet.y);
      const [dgx, dgy] = snapToIsometricGridDirection(
        Math.atan2(dodgeDir.y, dodgeDir.x),
        this.currentTilemap.tileWidth,
        this.currentTilemap.tileHeight,
      );
      const dodgeTiles: Array<{ x: number; y: number }> = [];

      for (let step = 1; step <= this.currentDodgeTileCount; step++) {
        const tx = playerTile.x + dgx * step;
        const ty = playerTile.y + dgy * step;

        if (this.currentTilemap.isTileInBounds(tx, ty)) {
          dodgeTiles.push({ x: tx, y: ty });
        }
      }

      drawTileSet(this.debugHitboxGraphics, this.currentTilemap, dodgeTiles, 0x22c55e, 0.30, 0.9);
    }

    // Spear target tile — windup preview (blue) or active (yellow)
    const snapshot = this.playerCombatState.getSnapshot(nowMs);
    const phase = snapshot.lightAttackPhase;

    if ((phase === 'windup' || phase === 'active') && this.playerAttackTargetWorld) {
      const targetTile = this.currentTilemap.transform.worldToTile(
        this.playerAttackTargetWorld.x,
        this.playerAttackTargetWorld.y,
      );
      const fillAlpha = phase === 'active' ? 0.52 : 0.22;
      const strokeAlpha = phase === 'active' ? 0.9 : 0.55;
      const color = phase === 'active' ? 0xfacc15 : 0x38bdf8;

      drawTileSet(this.debugHitboxGraphics, this.currentTilemap, [targetTile], color, fillAlpha, strokeAlpha);
    }
  }
}

function drawTileSet(
  graphics: Phaser.GameObjects.Graphics,
  tilemap: IsoTilemap,
  tiles: Array<{ x: number; y: number }>,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
): void {
  graphics.lineStyle(2, color, strokeAlpha);
  graphics.fillStyle(color, fillAlpha);

  for (const tile of tiles) {
    const points = tilemap.transform.getTileDiamondPoints(tile.x, tile.y);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => graphics.lineTo(p.x, p.y));
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }
}

// Snap a world-space angle to the nearest of the 8 isometric grid directions.
// Returns [dgx, dgy] — each component is -1, 0, or +1.
// The 8 world-space displacements per grid step (tileWidth=64, tileHeight=32):
//   N(-1,-1)=(0,-th)  NE(0,-1)=(hw,-hh)  E(1,-1)=(tw,0)   SE(1,0)=(hw,hh)
//   S(1,1)=(0,th)     SW(0,1)=(-hw,hh)   W(-1,1)=(-tw,0)  NW(-1,0)=(-hw,-hh)
function snapToIsometricGridDirection(
  rotationRad: number,
  tileWidth: number,
  tileHeight: number,
): [number, number] {
  const hw = tileWidth / 2;
  const hh = tileHeight / 2;
  const tw = tileWidth;
  const th = tileHeight;

  const dirs: Array<[number, number, number, number]> = [
    [-1, -1,   0, -th],
    [ 0, -1,  hw, -hh],
    [ 1, -1,  tw,   0],
    [ 1,  0,  hw,  hh],
    [ 1,  1,   0,  th],
    [ 0,  1, -hw,  hh],
    [-1,  1, -tw,   0],
    [-1,  0, -hw, -hh],
  ];

  const dx = Math.cos(rotationRad);
  const dy = Math.sin(rotationRad);
  let bestDot = -Infinity;
  let bestDgx = 0;
  let bestDgy = -1;

  for (const [dgx, dgy, wx, wy] of dirs) {
    const len = Math.hypot(wx, wy);
    const dot = (dx * wx + dy * wy) / len;

    if (dot > bestDot) {
      bestDot = dot;
      bestDgx = dgx;
      bestDgy = dgy;
    }
  }

  return [bestDgx, bestDgy];
}

