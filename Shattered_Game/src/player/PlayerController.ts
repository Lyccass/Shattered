import Phaser from 'phaser';
import { PLAYER_CONFIG } from './PlayerConfig';
import type { PlayerAnimationStateId } from './PlayerAnimationState';
import type { PlayerAnimationDirection } from './PlayerAssets';
import { IsoTilemap } from '../world/IsoTilemap';
import { PlayerClickMovementController } from './PlayerClickMovementController';
import { PlayerCollisionSystem } from './PlayerCollisionSystem';
import { PlayerDodgeMotionController } from './PlayerDodgeMotionController';
import { resolveFacingFromIntent, worldIntentToAnimationDirection, type PlayerFacingDirection } from './PlayerFacing';
import { PlayerMovementSystem } from './PlayerMovementSystem';
import { PlayerPositionSystem } from './PlayerPositionSystem';
import { PlayerVisualSystem } from './PlayerVisualSystem';

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;

  private readonly movementIntent = new Phaser.Math.Vector2();
  private readonly clickMovement: PlayerClickMovementController;
  private readonly collision: PlayerCollisionSystem;
  private readonly dodgeMotion: PlayerDodgeMotionController;
  private readonly movement: PlayerMovementSystem;
  private readonly position: PlayerPositionSystem;
  private readonly visuals: PlayerVisualSystem;
  private tilemap: IsoTilemap;
  private facingDirection: PlayerFacingDirection = 'down';
  private animationDirection: PlayerAnimationDirection = 'down';
  private movementSpeedMultiplier = 1;
  private readonly lastMovementDirection = new Phaser.Math.Vector2(0, 1);
  private lastSafeSpriteX: number;
  private lastSafeSpriteY: number;

  constructor(_scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, tilemap: IsoTilemap) {
    this.sprite = sprite;
    this.tilemap = tilemap;
    this.clickMovement = new PlayerClickMovementController(tilemap);
    this.collision = new PlayerCollisionSystem(tilemap);
    this.dodgeMotion = new PlayerDodgeMotionController();
    this.position = new PlayerPositionSystem();
    this.movement = new PlayerMovementSystem(this.collision, this.position);
    this.visuals = new PlayerVisualSystem(sprite);
    this.lastSafeSpriteX = sprite.x;
    this.lastSafeSpriteY = sprite.y;
  }

  update(delta: number, nowMs: number, movementSpeedMultiplier = this.movementSpeedMultiplier): void {
    this.recoverIfBlocked();

    if (this.dodgeMotion.isDodging()) {
      this.dodgeMotion.update(delta, this.sprite, this.movement);
      this.recoverIfBlocked();
      this.captureSafePosition();
      this.visuals.update(
        this.getFeetPoint().y,
        nowMs,
        true,
        false,
        this.animationDirection,
      );
      this.alignWithSurface();
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
      this.clickMovement.clear();
    }
    this.recoverIfBlocked();
    this.captureSafePosition();
    this.visuals.update(
      this.getFeetPoint().y,
      nowMs,
      this.movementIntent.lengthSq() > 0,
      this.movementIntent.lengthSq() > 0 && movementSpeedMultiplier > 1.01,
      this.animationDirection,
    );
    this.alignWithSurface();
  }

  private alignWithSurface(): void {
    const feet=this.getFeetPoint();
    const lift=this.tilemap.getSurfaceLift(feet.x,feet.y);
    // Change only the drawing origin. Movement, saves and depth use ground feet.
    this.sprite.setOrigin(PLAYER_CONFIG.originX,PLAYER_CONFIG.originY+lift/Math.max(1,this.sprite.displayHeight));
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
    return this.dodgeMotion.getDirection();
  }

  getFacingDirection(): PlayerFacingDirection {
    return this.facingDirection;
  }

  setHorizontalFacingFromTarget(targetWorldX: number | null): void {
    if (targetWorldX === null) {
      return;
    }

    if (targetWorldX < this.sprite.x - 2) {
      this.animationDirection = 'left_down';
    } else if (targetWorldX > this.sprite.x + 2) {
      this.animationDirection = 'right_down';
    }
  }

  getMovementIntent(): Phaser.Math.Vector2 {
    return this.movementIntent.clone();
  }

  isMoving(): boolean {
    return this.dodgeMotion.isDodging() || this.movementIntent.lengthSq() > 0;
  }

  hasClickMoveTarget(): boolean {
    return this.clickMovement.hasTarget();
  }

  clearClickMoveTarget(): void {
    this.clickMovement.clear();
  }

  getCurrentMoveDirection(): Phaser.Math.Vector2 | null {
    const clickMoveDirection = this.clickMovement.getCurrentMoveDirection(this.getFeetPoint());

    if (clickMoveDirection) {
      return clickMoveDirection;
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

    this.animationDirection = worldIntentToAnimationDirection(
      new Phaser.Math.Vector2(deltaX, deltaY),
      this.tilemap.tileWidth,
      this.tilemap.tileHeight,
    );
  }

  isDodging(): boolean {
    return this.dodgeMotion.isDodging();
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
    this.clickMovement.setTilemap(tilemap);
    this.collision.setTilemap(tilemap);
  }

  setExternalOccupancyValidator(
    validator: ((feetWorldX: number, feetWorldY: number) => boolean) | null,
  ): void {
    this.collision.setOccupancyValidator(validator);
  }

  setExternalTileOccupancyValidator(
    validator: ((tileX: number, tileY: number) => boolean) | null,
  ): void {
    this.clickMovement.setTileOccupancyValidator(validator);
  }

  setWorldPosition(worldX: number, worldY: number): void {
    this.dodgeMotion.clear();
    this.clickMovement.clear();
    this.sprite.setPosition(worldX, worldY);
    this.captureSafePosition();
  }

  setFeetWorldPosition(feetWorldX: number, feetWorldY: number): void {
    const currentFeet = this.getFeetPoint();
    this.setWorldPosition(
      this.sprite.x + (feetWorldX - currentFeet.x),
      this.sprite.y + (feetWorldY - currentFeet.y),
    );
  }

  setMovementSpeedMultiplier(multiplier: number): void {
    this.movementSpeedMultiplier = multiplier;
  }

  setClickMoveTarget(worldX: number, worldY: number, maxPathTiles?: number): void {
    this.clickMovement.setTarget(this.getFeetTile(), worldX, worldY, maxPathTiles);
  }

  setClickMoveTilePath(path: Array<{ x: number; y: number }>): void {
    this.clickMovement.setTilePath(this.getFeetTile(), path);
  }

  resolveDodgeTarget(
    direction: { x: number; y: number },
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

  startDodgeMotion(direction: { x: number; y: number }, distance: number, durationMs: number): void {
    this.clearClickMoveTarget();
    this.dodgeMotion.start(direction, distance, durationMs);
  }

  requestCombatVisualState(
    state: PlayerAnimationStateId,
    nowMs: number,
    durationMs = 0,
  ): void {
    this.visuals.requestCombatState(state, nowMs, durationMs);
  }

  resetCombatVisual(): void {
    this.visuals.resetCombatState();
  }

  getCombatVisualState(nowMs: number): PlayerAnimationStateId {
    return this.visuals.getCombatState(nowMs);
  }

  private readMovementIntent(nowMs: number): boolean {
    // Block all movement during windup and active — attack interrupts movement
    if (this.isAttackMovementBlocked(nowMs)) {
      this.clickMovement.clear();
      this.movementIntent.set(0, 0);
      return false;
    }

    const attackFacingLocked = this.isAttackFacingLocked(nowMs);
    const clickMoveIntent = this.clickMovement.readMovementIntent(this.getFeetPoint());
    const usingClickMove = clickMoveIntent.lengthSq() > 0;
    this.movementIntent.copy(clickMoveIntent);

    if (this.movementIntent.lengthSq() > 0) {
      this.lastMovementDirection.copy(this.movementIntent).normalize();

      if (!attackFacingLocked) {
        this.facingDirection = resolveFacingFromIntent(this.movementIntent, this.facingDirection);
        this.animationDirection = worldIntentToAnimationDirection(
          this.movementIntent,
          this.tilemap.tileWidth,
          this.tilemap.tileHeight,
        );
      }
    }

    return usingClickMove;
  }

  private isAttackFacingLocked(_nowMs: number): boolean {
    return false;
  }

  private isAttackMovementBlocked(_nowMs: number): boolean {
    return false;
  }

  private recoverIfBlocked(): void {
    const feetPoint = this.getFeetPoint();

    if (this.collision.isTerrainWalkableAtFeet(feetPoint.x, feetPoint.y)) {
      return;
    }

    this.dodgeMotion.clear();
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
