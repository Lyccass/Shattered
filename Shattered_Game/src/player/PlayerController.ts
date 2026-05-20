import Phaser from 'phaser';
import {
  type CombatDodgeDirection,
} from '../combat/CombatDodge';
import type { CombatAnimationStateId } from '../combat/CombatAnimationTypes';
import { PlayerCollisionSystem } from './PlayerCollisionSystem';
import { PLAYER_CONFIG } from './PlayerConfig';
import { resolveFacingFromIntent, type PlayerFacingDirection } from './PlayerFacing';
import { PlayerMovementSystem } from './PlayerMovementSystem';
import { PlayerPositionSystem } from './PlayerPositionSystem';
import { PlayerVisualSystem } from './PlayerVisualSystem';
import { IsoTilemap } from '../world/IsoTilemap';
import { findGridPath } from '../world/GridPathfinder';

type ActiveDodgeMotion = {
  direction: Phaser.Math.Vector2;
  elapsedMs: number;
  durationMs: number;
  distancePerMs: number;
};

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;

  private readonly movementIntent = new Phaser.Math.Vector2();
  private readonly collision: PlayerCollisionSystem;
  private readonly movement: PlayerMovementSystem;
  private readonly position: PlayerPositionSystem;
  private readonly visuals: PlayerVisualSystem;
  private tilemap: IsoTilemap;
  private facingDirection: PlayerFacingDirection = 'down';
  private horizontalFacing: 'left' | 'right' = 'right';
  private movementSpeedMultiplier = 1;
  private dodgeMotion: ActiveDodgeMotion | null = null;
  private clickMoveTarget: Phaser.Math.Vector2 | null = null;
  private clickMoveWaypoints: Phaser.Math.Vector2[] = [];
  private readonly lastMovementDirection = new Phaser.Math.Vector2(0, 1);
  private lastSafeSpriteX: number;
  private lastSafeSpriteY: number;

  constructor(_scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, tilemap: IsoTilemap) {
    this.sprite = sprite;
    this.tilemap = tilemap;
    this.collision = new PlayerCollisionSystem(tilemap);
    this.position = new PlayerPositionSystem();
    this.movement = new PlayerMovementSystem(this.collision, this.position);
    this.visuals = new PlayerVisualSystem(sprite);
    this.lastSafeSpriteX = sprite.x;
    this.lastSafeSpriteY = sprite.y;
  }

  update(delta: number, nowMs: number, movementSpeedMultiplier = this.movementSpeedMultiplier): void {
    this.recoverIfBlocked();

    if (this.dodgeMotion) {
      const dodgeLateralIntentX = this.dodgeMotion.direction.x;
      const remainingMs = Math.max(0, this.dodgeMotion.durationMs - this.dodgeMotion.elapsedMs);
      const frameMs = Math.min(delta, remainingMs);
      const distance = this.dodgeMotion.distancePerMs * frameMs;
      const moved = this.movement.moveDistance(
        this.sprite,
        this.dodgeMotion.direction,
        distance,
        false,
      );

      this.dodgeMotion = {
        ...this.dodgeMotion,
        elapsedMs: this.dodgeMotion.elapsedMs + frameMs,
      };

      if (!moved || this.dodgeMotion.elapsedMs >= this.dodgeMotion.durationMs) {
        this.dodgeMotion = null;
      }

      this.recoverIfBlocked();
      this.captureSafePosition();
      this.visuals.update(
        this.getFeetPoint().y,
        nowMs,
        true,
        false,
        this.facingDirection,
        this.horizontalFacing,
        dodgeLateralIntentX,
      );
      return;
    }

    const usedClickMove = this.readMovementIntent(nowMs);
    const beforeX = this.sprite.x;
    const beforeY = this.sprite.y;
    this.movement.move(this.sprite, this.movementIntent, delta, movementSpeedMultiplier);

    if (
      usedClickMove
      && this.movementIntent.lengthSq() > 0
      && Math.abs(this.sprite.x - beforeX) < 0.001
      && Math.abs(this.sprite.y - beforeY) < 0.001
    ) {
      this.clickMoveTarget = null;
    }
    this.recoverIfBlocked();
    this.captureSafePosition();
    this.visuals.update(
      this.getFeetPoint().y,
      nowMs,
      this.movementIntent.lengthSq() > 0,
      this.movementIntent.lengthSq() > 0 && movementSpeedMultiplier > 1.01,
      this.facingDirection,
      this.horizontalFacing,
      this.movementIntent.x,
    );
  }

  getFeetPoint(): Phaser.Math.Vector2 {
    return this.position.getFeetPoint(this.sprite);
  }

  getGridPosition(): Phaser.Math.Vector2 {
    const feetPoint = this.getFeetPoint();

    return this.collision.getPlayerGridPosition(feetPoint.x, feetPoint.y);
  }

  getFeetTile(): Phaser.Math.Vector2 {
    const feetPoint = this.getFeetPoint();

    return this.collision.getPlayerFeetTile(feetPoint.x, feetPoint.y);
  }

  getFootprintTiles(): Array<{ x: number; y: number }> {
    const feet = this.getFeetPoint();
    const tile = this.tilemap.transform.worldToTile(feet.x, feet.y);

    if (!this.tilemap.isTileInBounds(tile.x, tile.y)) {
      return [];
    }

    return [{ x: tile.x, y: tile.y }];
  }

  getDodgeDirection(): Phaser.Math.Vector2 | null {
    return this.dodgeMotion ? this.dodgeMotion.direction.clone() : null;
  }

  getFacingDirection(): PlayerFacingDirection {
    return this.facingDirection;
  }

  setHorizontalFacingFromTarget(targetWorldX: number | null): void {
    if (targetWorldX === null) {
      return;
    }

    if (targetWorldX < this.sprite.x - 2) {
      this.horizontalFacing = 'left';
    } else if (targetWorldX > this.sprite.x + 2) {
      this.horizontalFacing = 'right';
    }
  }

  getMovementIntent(): Phaser.Math.Vector2 {
    return this.movementIntent.clone();
  }

  isMoving(): boolean {
    return this.dodgeMotion !== null || this.movementIntent.lengthSq() > 0;
  }

  hasClickMoveTarget(): boolean {
    return this.clickMoveTarget !== null || this.clickMoveWaypoints.length > 0;
  }

  clearClickMoveTarget(): void {
    this.clickMoveTarget = null;
    this.clickMoveWaypoints = [];
  }

  getCurrentMoveDirection(): Phaser.Math.Vector2 | null {
    const currentWaypoint = this.clickMoveWaypoints[0] ?? this.clickMoveTarget;

    if (currentWaypoint) {
      const feet = this.getFeetPoint();
      const deltaX = currentWaypoint.x - feet.x;
      const deltaY = currentWaypoint.y - feet.y;

      if (Math.hypot(deltaX, deltaY) > 0.001) {
        return new Phaser.Math.Vector2(deltaX, deltaY);
      }
    }

    if (this.movementIntent.lengthSq() > 0) {
      return this.movementIntent.clone();
    }

    return null;
  }

  getLastMovementDirection(): Phaser.Math.Vector2 {
    return this.lastMovementDirection.clone();
  }

  setFacingFromTarget(targetWorldX: number | null, targetWorldY: number | null): void {
    if (targetWorldX === null || targetWorldY === null) {
      return;
    }

    const feet = this.getFeetPoint();
    const deltaX = targetWorldX - feet.x;
    const deltaY = targetWorldY - feet.y;

    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
      return;
    }

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      this.facingDirection = deltaY < 0 ? 'up' : 'down';
    } else {
      this.facingDirection = deltaX < 0 ? 'left' : 'right';
    }

    this.setHorizontalFacingFromTarget(targetWorldX);
  }

  isDodging(): boolean {
    return this.dodgeMotion !== null;
  }

  isFeetTileBlocked(): boolean {
    const feetPoint = this.getFeetPoint();

    return !this.collision.canOccupyAtFeet(feetPoint.x, feetPoint.y);
  }

  canOccupyFeetPosition(feetWorldX: number, feetWorldY: number): boolean {
    return this.collision.canOccupyAtFeet(feetWorldX, feetWorldY);
  }

  setTilemap(tilemap: IsoTilemap): void {
    this.tilemap = tilemap;
    this.collision.setTilemap(tilemap);
    this.clearClickMoveTarget();
  }

  setExternalOccupancyValidator(
    validator: ((feetWorldX: number, feetWorldY: number) => boolean) | null,
  ): void {
    this.collision.setOccupancyValidator(validator);
  }

  setWorldPosition(worldX: number, worldY: number): void {
    this.dodgeMotion = null;
    this.clickMoveTarget = null;
    this.sprite.setPosition(worldX, worldY);
    this.captureSafePosition();
  }

  setFeetWorldPosition(feetWorldX: number, feetWorldY: number): void {
    const currentFeet = this.getFeetPoint();
    this.setWorldPosition(this.sprite.x + (feetWorldX - currentFeet.x), this.sprite.y + (feetWorldY - currentFeet.y));
  }

  setMovementSpeedMultiplier(multiplier: number): void {
    this.movementSpeedMultiplier = multiplier;
  }

  setClickMoveTarget(worldX: number, worldY: number, maxPathTiles?: number): void {
    const startTile = this.getFeetTile();
    const goalTile = this.tilemap.transform.worldToTile(worldX, worldY);
    const path = findGridPath({
      width: this.tilemap.width,
      height: this.tilemap.height,
      start: { x: startTile.x, y: startTile.y },
      goal: { x: goalTile.x, y: goalTile.y },
      isWalkable: (tileX, tileY) => this.tilemap.isTileWalkable(tileX, tileY),
    });

    if (!path || path.length === 0) {
      this.clearClickMoveTarget();
      return;
    }

    const rawTiles = path.slice(1);
    const isClamped = maxPathTiles !== undefined && rawTiles.length > maxPathTiles;
    const tiles = isClamped ? rawTiles.slice(0, maxPathTiles) : rawTiles;

    if (tiles.length === 0) {
      this.clearClickMoveTarget();
      return;
    }

    if (isClamped) {
      const lastTile = tiles[tiles.length - 1];
      const lastCenter = this.tilemap.getTileCenterWorld(lastTile.x, lastTile.y);
      this.clickMoveTarget = new Phaser.Math.Vector2(lastCenter.x, lastCenter.y);
    } else {
      this.clickMoveTarget = new Phaser.Math.Vector2(worldX, worldY);
    }

    this.clickMoveWaypoints = tiles
      .map((tile) => this.tilemap.getTileCenterWorld(tile.x, tile.y))
      .map((point) => new Phaser.Math.Vector2(point.x, point.y));
  }

  resolveDodgeTarget(
    direction: CombatDodgeDirection,
    distance: number,
    stepDistance = 4,
  ): Phaser.Math.Vector2 | null {
    const length = Math.hypot(direction.x, direction.y);

    if (length <= 0.0001 || distance <= 0) {
      return null;
    }

    const normalizedX = direction.x / length;
    const normalizedY = direction.y / length;
    let furthestDistance = 0;
    const stepCount = Math.max(1, Math.ceil(distance / stepDistance));

    for (let step = 1; step <= stepCount; step += 1) {
      const sampleDistance = Math.min(distance, step * stepDistance);
      const sampleX = this.sprite.x + normalizedX * sampleDistance;
      const sampleY = this.sprite.y + normalizedY * sampleDistance;
      const sampleFeetY = this.position.getFeetYForSpriteY(this.sprite, sampleY);

      if (!this.collision.canOccupyAtFeet(sampleX, sampleFeetY)) {
        break;
      }

      furthestDistance = sampleDistance;
    }

    if (furthestDistance <= 0) {
      return null;
    }

    return new Phaser.Math.Vector2(normalizedX * furthestDistance, normalizedY * furthestDistance);
  }

  startDodgeMotion(direction: CombatDodgeDirection, distance: number, durationMs: number): void {
    const length = Math.hypot(direction.x, direction.y);

    if (length <= 0.0001 || distance <= 0 || durationMs <= 0) {
      this.dodgeMotion = null;
      return;
    }

    this.clearClickMoveTarget();
    this.dodgeMotion = {
      direction: new Phaser.Math.Vector2(direction.x / length, direction.y / length),
      elapsedMs: 0,
      durationMs,
      distancePerMs: distance / durationMs,
    };
  }

  requestCombatVisualState(
    state: CombatAnimationStateId,
    nowMs: number,
    durationMs = 0,
  ): void {
    this.visuals.requestCombatState(state, nowMs, durationMs);
  }

  getCombatVisualState(nowMs: number): CombatAnimationStateId {
    return this.visuals.getCombatState(nowMs);
  }

  private readMovementIntent(nowMs: number): boolean {
    // Block all movement during windup and active — attack interrupts movement
    if (this.isAttackMovementBlocked(nowMs)) {
      this.clickMoveTarget = null;
      this.clickMoveWaypoints = [];
      this.movementIntent.set(0, 0);
      return false;
    }

    const attackFacingLocked = this.isAttackFacingLocked(nowMs);
    const clickMoveIntent = this.computeClickMoveIntent();
    const usingClickMove = clickMoveIntent.lengthSq() > 0;
    this.movementIntent.copy(clickMoveIntent);

    if (this.movementIntent.lengthSq() > 0) {
      this.lastMovementDirection.copy(this.movementIntent).normalize();

      if (!attackFacingLocked) {
        this.facingDirection = resolveFacingFromIntent(this.movementIntent, this.facingDirection);

        if (this.movementIntent.x < 0) {
          this.horizontalFacing = 'left';
        } else if (this.movementIntent.x > 0) {
          this.horizontalFacing = 'right';
        }
      }
    }

    return usingClickMove;
  }

  private computeClickMoveIntent(): Phaser.Math.Vector2 {
    const currentWaypoint = this.clickMoveWaypoints[0] ?? this.clickMoveTarget;

    if (!currentWaypoint) {
      return new Phaser.Math.Vector2();
    }

    const feet = this.getFeetPoint();
    const deltaX = currentWaypoint.x - feet.x;
    const deltaY = currentWaypoint.y - feet.y;

    if (Math.hypot(deltaX, deltaY) <= PLAYER_CONFIG.movementSpeed * 0.08) {
      if (this.clickMoveWaypoints.length > 0) {
        this.clickMoveWaypoints.shift();

        if (this.clickMoveWaypoints.length > 0) {
          return this.computeClickMoveIntent();
        }
      }

      this.clickMoveTarget = null;
      this.clickMoveWaypoints = [];
      return new Phaser.Math.Vector2();
    }

    return new Phaser.Math.Vector2(deltaX, deltaY);
  }

  private isAttackFacingLocked(nowMs: number): boolean {
    const state = this.visuals.getCombatState(nowMs);
    return state === 'attack_windup' || state === 'attack_active' || state === 'attack_recovery';
  }

  private isAttackMovementBlocked(nowMs: number): boolean {
    const state = this.visuals.getCombatState(nowMs);
    return state === 'attack_active';
  }

  private recoverIfBlocked(): void {
    const feetPoint = this.getFeetPoint();

    if (this.collision.isTerrainWalkableAtFeet(feetPoint.x, feetPoint.y)) {
      return;
    }

    this.dodgeMotion = null;
    this.sprite.setPosition(this.lastSafeSpriteX, this.lastSafeSpriteY);
  }

  private captureSafePosition(): void {
    const feetPoint = this.getFeetPoint();

    if (!this.collision.isTerrainWalkableAtFeet(feetPoint.x, feetPoint.y)) {
      return;
    }

    this.lastSafeSpriteX = this.sprite.x;
    this.lastSafeSpriteY = this.sprite.y;
  }
}
