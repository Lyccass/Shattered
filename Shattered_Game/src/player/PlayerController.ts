import Phaser from 'phaser';
import {
  type CombatDodgeDirection,
} from '../combat/CombatDodge';
import type { CombatAnimationStateId } from '../combat/CombatAnimationTypes';
import { PlayerCollisionSystem } from './PlayerCollisionSystem';
import { resolveFacingFromIntent, type PlayerFacingDirection } from './PlayerFacing';
import { PlayerMovementSystem } from './PlayerMovementSystem';
import { PlayerPositionSystem } from './PlayerPositionSystem';
import { PlayerVisualSystem } from './PlayerVisualSystem';
import { IsoTilemap } from '../world/IsoTilemap';

type MovementKeys = Record<'up' | 'left' | 'down' | 'right', Phaser.Input.Keyboard.Key>;
type ActiveDodgeMotion = {
  direction: Phaser.Math.Vector2;
  elapsedMs: number;
  durationMs: number;
  distancePerMs: number;
};

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;

  private readonly keys: MovementKeys;
  private readonly movementIntent = new Phaser.Math.Vector2();
  private readonly collision: PlayerCollisionSystem;
  private readonly movement: PlayerMovementSystem;
  private readonly position: PlayerPositionSystem;
  private readonly visuals: PlayerVisualSystem;
  private facingDirection: PlayerFacingDirection = 'down';
  private horizontalFacing: 'left' | 'right' = 'right';
  private movementSpeedMultiplier = 1;
  private dodgeMotion: ActiveDodgeMotion | null = null;
  private lastSafeSpriteX: number;
  private lastSafeSpriteY: number;

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, tilemap: IsoTilemap) {
    this.sprite = sprite;
    this.collision = new PlayerCollisionSystem(tilemap);
    this.position = new PlayerPositionSystem();
    this.movement = new PlayerMovementSystem(this.collision, this.position);
    this.visuals = new PlayerVisualSystem(sprite);
    this.lastSafeSpriteX = sprite.x;
    this.lastSafeSpriteY = sprite.y;
    this.keys = scene.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as MovementKeys;
  }

  update(delta: number, nowMs: number, movementSpeedMultiplier = this.movementSpeedMultiplier): void {
    this.recoverIfBlocked();

    if (this.dodgeMotion) {
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
      );
      return;
    }

    this.readMovementIntent();
    this.movement.move(this.sprite, this.movementIntent, delta, movementSpeedMultiplier);
    this.recoverIfBlocked();
    this.captureSafePosition();
    this.visuals.update(
      this.getFeetPoint().y,
      nowMs,
      this.movementIntent.lengthSq() > 0,
      this.movementIntent.lengthSq() > 0 && movementSpeedMultiplier > 1.01,
      this.facingDirection,
      this.horizontalFacing,
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
    return this.computeMovementIntent();
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
    this.collision.setTilemap(tilemap);
  }

  setExternalOccupancyValidator(
    validator: ((feetWorldX: number, feetWorldY: number) => boolean) | null,
  ): void {
    this.collision.setOccupancyValidator(validator);
  }

  setWorldPosition(worldX: number, worldY: number): void {
    this.dodgeMotion = null;
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

  private readMovementIntent(): void {
    this.movementIntent.copy(this.computeMovementIntent());

    if (this.movementIntent.lengthSq() > 0) {
      this.facingDirection = resolveFacingFromIntent(this.movementIntent, this.facingDirection);

      if (this.movementIntent.x < 0) {
        this.horizontalFacing = 'left';
      } else if (this.movementIntent.x > 0) {
        this.horizontalFacing = 'right';
      }
    }
  }

  private computeMovementIntent(): Phaser.Math.Vector2 {
    const intent = new Phaser.Math.Vector2();

    if (this.keys.left.isDown) intent.x -= 1;
    if (this.keys.right.isDown) intent.x += 1;
    if (this.keys.up.isDown) intent.y -= 1;
    if (this.keys.down.isDown) intent.y += 1;

    return intent;
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
