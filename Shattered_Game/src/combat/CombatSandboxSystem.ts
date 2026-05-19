import Phaser from 'phaser';
import { resolveClickMovementDodgeDirection } from './CombatDodge';
import {
  getPlayerLightAttackHitbox,
  getPlayerLightAttackHitboxByRotation,
  getPlayerLightAttackSlash,
  getPlayerLightAttackSlashByRotation,
  isAttackerInsideGuardFront,
  PLAYER_LIGHT_ATTACK_LENGTH_WORLD,
  PLAYER_LIGHT_ATTACK_WIDTH_WORLD,
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
  private static readonly PLAYER_ATTACK_WINDUP_MS = 220;
  private static readonly PLAYER_ATTACK_ACTIVE_MS = 160;
  private static readonly PLAYER_ATTACK_RECOVERY_MS = 420;
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
    const playerHitPoints = playerController.getCombatHitboxPoints();
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
      playerHitPoints,
      playerOccupiedTiles,
    );
    this.resolvePlayerEnemyOverlap(playerController);
    this.syncDebugHitboxes(playerController);

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
    const pointerDirection =
      targetWorldX !== null
      && targetWorldY !== null
      && Math.hypot(targetWorldX - playerFeet.x, targetWorldY - playerFeet.y) > 0.001
        ? {
            x: targetWorldX - playerFeet.x,
            y: targetWorldY - playerFeet.y,
          }
        : null;
    const direction = resolveClickMovementDodgeDirection({
      currentMoveDirection: pointerDirection ?? playerController.getCurrentMoveDirection(),
      awayFromEnemyDirection: enemyPosition
        ? {
            x: playerFeet.x - enemyPosition.x,
            y: playerFeet.y - enemyPosition.y,
          }
        : null,
      lastMovementDirection: playerController.getLastMovementDirection(),
      facing: playerController.getFacingDirection(),
    });
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

    const enemyTile = this.enemySystem.getOccupiedTile();
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
      !enemyTile
      || !attackTiles.some((tile) => tile.x === enemyTile.x && tile.y === enemyTile.y)
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

  private syncDebugHitboxes(playerController: PlayerController): void {
    this.debugHitboxGraphics.clear();

    drawEllipseHitbox(
      this.debugHitboxGraphics,
      playerController.getCombatHitEllipse(),
      0x38bdf8,
      0.16,
      0.9,
    );

    const enemyEllipse = this.enemySystem.getCombatHitEllipse();

    if (enemyEllipse) {
      drawEllipseHitbox(
        this.debugHitboxGraphics,
        enemyEllipse,
        0xef4444,
        0.14,
        0.9,
      );
    }
  }
}

function drawEllipseHitbox(
  graphics: Phaser.GameObjects.Graphics,
  ellipse: { centerX: number; centerY: number; radiusX: number; radiusY: number },
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
): void {
  graphics.lineStyle(2, color, strokeAlpha);
  graphics.fillStyle(color, fillAlpha);
  graphics.fillEllipse(
    ellipse.centerX,
    ellipse.centerY,
    ellipse.radiusX * 2,
    ellipse.radiusY * 2,
  );
  graphics.strokeEllipse(
    ellipse.centerX,
    ellipse.centerY,
    ellipse.radiusX * 2,
    ellipse.radiusY * 2,
  );
}

function collectTilesCoveredByPlayerAttack(
  tilemap: IsoTilemap,
  playerFeetX: number,
  playerFeetY: number,
  rotationRad: number,
): Array<{ x: number; y: number }> {
  const centerOffset = 22 + PLAYER_LIGHT_ATTACK_LENGTH_WORLD / 2;
  const centerX = playerFeetX + Math.cos(rotationRad) * centerOffset;
  const centerY = playerFeetY + Math.sin(rotationRad) * centerOffset;
  const corners = getRotatedRectangleCorners(
    centerX,
    centerY,
    PLAYER_LIGHT_ATTACK_LENGTH_WORLD,
    PLAYER_LIGHT_ATTACK_WIDTH_WORLD,
    rotationRad,
  );
  const tileBounds = corners.map((corner) => tilemap.transform.worldToTile(corner.x, corner.y));
  const tileXs = tileBounds.map((tile) => tile.x);
  const tileYs = tileBounds.map((tile) => tile.y);
  const tiles: Array<{ x: number; y: number }> = [];

  for (let tileY = Math.min(...tileYs); tileY <= Math.max(...tileYs); tileY += 1) {
    for (let tileX = Math.min(...tileXs); tileX <= Math.max(...tileXs); tileX += 1) {
      if (!tilemap.isTileInBounds(tileX, tileY)) {
        continue;
      }

      const samples = getTileSamplePoints(tilemap, tileX, tileY);

      if (samples.some((point) => pointInsideRotatedRectangle(
        point.x,
        point.y,
        centerX,
        centerY,
        PLAYER_LIGHT_ATTACK_LENGTH_WORLD,
        PLAYER_LIGHT_ATTACK_WIDTH_WORLD,
        rotationRad,
      ))) {
        tiles.push({ x: tileX, y: tileY });
      }
    }
  }

  return tiles;
}

function getTileSamplePoints(
  tilemap: IsoTilemap,
  tileX: number,
  tileY: number,
): Array<{ x: number; y: number }> {
  const center = tilemap.getTileCenterWorld(tileX, tileY);
  const corners = tilemap.transform.getTileDiamondPoints(tileX, tileY);
  const edgeMidpoints = corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    return {
      x: (corner.x + next.x) / 2,
      y: (corner.y + next.y) / 2,
    };
  });

  return [
    { x: center.x, y: center.y },
    ...corners.map((point) => ({ x: point.x, y: point.y })),
    ...edgeMidpoints,
  ];
}

function pointInsideRotatedRectangle(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): boolean {
  const cos = Math.cos(-rotationRad);
  const sin = Math.sin(-rotationRad);
  const localX = (pointX - centerX) * cos - (pointY - centerY) * sin;
  const localY = (pointX - centerX) * sin + (pointY - centerY) * cos;
  return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2;
}

function getRotatedRectangleCorners(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): Array<{ x: number; y: number }> {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const localCorners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  return localCorners.map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));
}
