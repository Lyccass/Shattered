import Phaser from 'phaser';
import { resolveClickMovementDodgeDirection } from './CombatDodge';
import {
  getPlayerLightAttackHitbox,
  getPlayerLightAttackHitboxByRotation,
  getPlayerLightAttackSlash,
  getPlayerLightAttackSlashByRotation,
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
  private static readonly DODGE_DISTANCE_WORLD = 58;
  private static readonly SPRINT_DODGE_DISTANCE_MULTIPLIER = 1.45;
  private static readonly SPRINT_SPEED_MULTIPLIER = 2;
  private static readonly PLAYER_LIGHT_ATTACK_DAMAGE = 1;
  private static readonly MAX_REPOSITION_RANGE_WORLD = 192; // ~3 tile-widths — beyond this the attack just misses
  private static readonly PLAYER_ATTACK_WINDUP_TELEGRAPH_ID = 'player_light_attack_windup';
  private static readonly PLAYER_ATTACK_ACTIVE_TELEGRAPH_ID = 'player_light_attack_active';
  private static readonly PLAYER_ATTACK_SLASH_TELEGRAPH_ID = 'player_light_attack_slash';

  private readonly playerCombatState = new PlayerCombatState();
  private readonly enemySystem: EnemySystem;
  private readonly telegraphSystem: TelegraphSystem;
  private readonly debugHitboxGraphics: Phaser.GameObjects.Graphics;
  private currentTilemap: IsoTilemap | null = null;
  private lastPlayerAttackPhase: PlayerAttackPhase = 'idle';
  private playerAttackAimRad: number | null = null;
  private playerAttackHitResolved = false;
  private currentDodgeTileCount = 2;

  constructor(
    scene: Phaser.Scene,
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
    this.playerAttackAimRad = null;
    this.playerAttackHitResolved = false;
    this.clearPlayerAttackTelegraphs();
  }

  update(nowMs: number, deltaMs: number, playerController: PlayerController): UiHandledResult[] {
    this.playerCombatState.update(
      nowMs,
      deltaMs,
      playerController.isMoving(),
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

    const events = this.enemySystem.update(
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
    this.resolvePlayerLightAttackHit(nowMs, playerController, results);

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
    const dodgeDistance = isSprinting
      ? CombatSandboxSystem.DODGE_DISTANCE_WORLD * CombatSandboxSystem.SPRINT_DODGE_DISTANCE_MULTIPLIER
      : CombatSandboxSystem.DODGE_DISTANCE_WORLD;
    this.currentDodgeTileCount = isSprinting ? 3 : 2;
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

    // Immediately clear any in-flight attack telegraphs so the cancel is visually instant
    this.lastPlayerAttackPhase = 'idle';
    this.playerAttackAimRad = null;
    this.playerAttackHitResolved = false;
    this.clearPlayerAttackTelegraphs();

    playerController.startDodgeMotion(
      direction,
      Math.hypot(dodgeDelta.x, dodgeDelta.y),
      DODGE_DURATION_MS,
    );
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

    this.playerAttackAimRad = this.tryRepositionForAttack(playerController, attackAimRad);
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
    this.debugHitboxGraphics.destroy();
    this.enemySystem.destroy();
  }

  // If the aimed attack wouldn't cover the enemy tile, step the player into the nearest
  // valid attacking position (1 or 2 tiles behind the enemy along the snapped direction).
  // Returns the final aim angle to store — either the original or the updated one.
  private tryRepositionForAttack(
    playerController: PlayerController,
    attackAimRad: number,
  ): number {
    if (!this.currentTilemap) {
      return attackAimRad;
    }

    const enemyTile = this.enemySystem.getOccupiedTile();

    if (!enemyTile) {
      return attackAimRad;
    }

    const feet = playerController.getFeetPoint();
    const attackTiles = collectTilesCoveredByPlayerAttack(
      this.currentTilemap,
      feet.x,
      feet.y,
      attackAimRad,
    );

    if (attackTiles.some((t) => t.x === enemyTile.x && t.y === enemyTile.y)) {
      return attackAimRad;
    }

    const enemyCenter = this.currentTilemap.getTileCenterWorld(enemyTile.x, enemyTile.y);
    const distToEnemy = Math.hypot(enemyCenter.x - feet.x, enemyCenter.y - feet.y);

    if (distToEnemy > CombatSandboxSystem.MAX_REPOSITION_RANGE_WORLD) {
      return attackAimRad;
    }

    const aimTowardEnemy = Math.atan2(enemyCenter.y - feet.y, enemyCenter.x - feet.x);
    const [dgx, dgy] = snapToIsometricGridDirection(
      aimTowardEnemy,
      this.currentTilemap.tileWidth,
      this.currentTilemap.tileHeight,
    );

    // Prefer step=1 (closer to enemy) then step=2 (further back)
    for (const step of [1, 2]) {
      const candidateTileX = enemyTile.x - dgx * step;
      const candidateTileY = enemyTile.y - dgy * step;

      if (!this.currentTilemap.isTileInBounds(candidateTileX, candidateTileY)) {
        continue;
      }

      if (!this.currentTilemap.isTileWalkable(candidateTileX, candidateTileY)) {
        continue;
      }

      const candidateCenter = this.currentTilemap.getTileCenterWorld(candidateTileX, candidateTileY);
      const repositionDist = Math.hypot(candidateCenter.x - feet.x, candidateCenter.y - feet.y);

      if (repositionDist > CombatSandboxSystem.MAX_REPOSITION_RANGE_WORLD) {
        continue;
      }

      if (!playerController.canOccupyFeetPosition(candidateCenter.x, candidateCenter.y)) {
        continue;
      }

      playerController.setFeetWorldPosition(candidateCenter.x, candidateCenter.y);
      playerController.setFacingFromTarget(enemyCenter.x, enemyCenter.y);
      return aimTowardEnemy;
    }

    return attackAimRad;
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

    const enemyTiles = this.enemySystem.getOccupiedTiles();
    const playerFeet = playerController.getFeetPoint();
    const attackAimRad = this.playerAttackAimRad ?? resolvePlayerAttackAimRad(
      playerFeet.x,
      playerFeet.y,
      playerController.getFacingDirection(),
      null,
      null,
    );
    const attackTiles = this.currentTilemap
      ? collectTilesCoveredByPlayerAttack(
          this.currentTilemap,
          playerFeet.x,
          playerFeet.y,
          attackAimRad,
        )
      : [];

    if (
      !enemyTiles.length
      || !attackTiles.some((at) => enemyTiles.some((et) => et.x === at.x && et.y === at.y))
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
        this.playerAttackAimRad = null;
        this.playerAttackHitResolved = false;
        this.clearPlayerAttackTelegraphs();
        break;
    }
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

      const candidate = this.currentTilemap.getTileCenterWorld(tileX, tileY);

      if (!playerController.canOccupyFeetPosition(candidate.x, candidate.y)) {
        continue;
      }

      playerController.setFeetWorldPosition(candidate.x, candidate.y);
      return;
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
      durationMs: LIGHT_ATTACK_WINDUP_MS,
      startedAtMs: nowMs,
      warningColor: 0xeab308,
      fadeOutMs: LIGHT_ATTACK_WINDUP_MS,
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
      durationMs: LIGHT_ATTACK_ACTIVE_MS,
      startedAtMs: nowMs,
      warningColor: 0xfacc15,
      fadeOutMs: LIGHT_ATTACK_ACTIVE_MS,
      strokeAlpha: 0,
      fillAlphaMultiplier: 0.42,
    });

    this.telegraphSystem.showTelegraph({
      id: CombatSandboxSystem.PLAYER_ATTACK_SLASH_TELEGRAPH_ID,
      worldX: slash.worldX,
      worldY: slash.worldY,
      shape: slash.shape,
      durationMs: LIGHT_ATTACK_ACTIVE_MS,
      startedAtMs: nowMs,
      warningColor: 0xfacc15,
      fadeOutMs: LIGHT_ATTACK_ACTIVE_MS,
    });
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

    // Player attack tiles — windup preview (blue) or active (yellow)
    const snapshot = this.playerCombatState.getSnapshot(nowMs);
    const phase = snapshot.lightAttackPhase;

    if ((phase === 'windup' || phase === 'active') && this.playerAttackAimRad !== null) {
      const feet = playerController.getFeetPoint();
      const tiles = collectTilesCoveredByPlayerAttack(this.currentTilemap, feet.x, feet.y, this.playerAttackAimRad);
      const fillAlpha = phase === 'active' ? 0.52 : 0.22;
      const strokeAlpha = phase === 'active' ? 0.9 : 0.55;
      const color = phase === 'active' ? 0xfacc15 : 0x38bdf8;

      drawTileSet(this.debugHitboxGraphics, this.currentTilemap, tiles, color, fillAlpha, strokeAlpha);
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

// Returns the player's tile + up to 2 tiles ahead in the snapped grid direction.
function collectTilesCoveredByPlayerAttack(
  tilemap: IsoTilemap,
  playerFeetX: number,
  playerFeetY: number,
  rotationRad: number,
): Array<{ x: number; y: number }> {
  const playerTile = tilemap.transform.worldToTile(playerFeetX, playerFeetY);
  const [dgx, dgy] = snapToIsometricGridDirection(rotationRad, tilemap.tileWidth, tilemap.tileHeight);
  const tiles: Array<{ x: number; y: number }> = [];

  for (let step = 0; step <= 2; step++) {
    const tx = playerTile.x + dgx * step;
    const ty = playerTile.y + dgy * step;

    if (tilemap.isTileInBounds(tx, ty)) {
      tiles.push({ x: tx, y: ty });
    }
  }

  return tiles;
}
