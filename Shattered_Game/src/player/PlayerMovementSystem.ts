import Phaser from 'phaser';
import { PLAYER_CONFIG } from './PlayerConfig';
import { PlayerCollisionSystem } from './PlayerCollisionSystem';
import { PlayerPositionSystem } from './PlayerPositionSystem';

type SlideCandidate = {
  vector: Phaser.Math.Vector2;
  alignment: number;
};

export class PlayerMovementSystem {
  constructor(
    private readonly collision: PlayerCollisionSystem,
    private readonly position: PlayerPositionSystem,
  ) {}

  move(
    sprite: Phaser.GameObjects.Sprite,
    intent: Phaser.Math.Vector2,
    deltaMs: number,
    speedMultiplier = 1,
  ): void {
    if (intent.lengthSq() === 0) {
      return;
    }

    const distance = PLAYER_CONFIG.movementSpeed * speedMultiplier * (deltaMs / 1000);
    const movement = intent.clone().normalize().scale(distance);

    if (this.tryMove(sprite, movement.x, movement.y)) {
      return;
    }

    for (const slide of this.getSlideCandidates(movement)) {
      if (this.tryMove(sprite, slide.x, slide.y)) {
        return;
      }
    }
  }

  moveBy(
    sprite: Phaser.GameObjects.Sprite,
    deltaX: number,
    deltaY: number,
  ): boolean {
    return this.tryMove(sprite, deltaX, deltaY);
  }

  moveDistance(
    sprite: Phaser.GameObjects.Sprite,
    intent: Phaser.Math.Vector2,
    distance: number,
    allowSlide = true,
  ): boolean {
    if (intent.lengthSq() === 0 || distance <= 0) {
      return false;
    }

    const movement = intent.clone().normalize().scale(distance);

    if (this.tryMove(sprite, movement.x, movement.y)) {
      return true;
    }

    if (!allowSlide) {
      return false;
    }

    for (const slide of this.getSlideCandidates(movement)) {
      if (this.tryMove(sprite, slide.x, slide.y)) {
        return true;
      }
    }

    return false;
  }

  private getSlideCandidates(movement: Phaser.Math.Vector2): Phaser.Math.Vector2[] {
    const isoEdgeSlides = this.collision
      .getIsoSlideAxes()
      .map((axis) => this.projectMovementOntoSlideAxis(movement, axis))
      .filter((slide): slide is SlideCandidate => slide !== undefined)
      .sort((a, b) => b.alignment - a.alignment)
      .map((slide) => slide.vector);

    return [
      ...isoEdgeSlides,
      new Phaser.Math.Vector2(movement.x, 0),
      new Phaser.Math.Vector2(0, movement.y),
    ];
  }

  private projectMovementOntoSlideAxis(
    movement: Phaser.Math.Vector2,
    axis: Phaser.Math.Vector2,
  ): SlideCandidate | undefined {
    const direction = axis.clone();
    const dot = movement.dot(direction);
    const alignment = Math.abs(dot);

    if (alignment < 0.0001) {
      return undefined;
    }

    const vector = direction
      .scale(Math.sign(dot))
      .scale(alignment * PLAYER_CONFIG.slideSpeedRatio);

    return {
      vector,
      alignment,
    };
  }

  private tryMove(
    sprite: Phaser.GameObjects.Sprite,
    deltaX: number,
    deltaY: number,
  ): boolean {
    if (deltaX === 0 && deltaY === 0) {
      return false;
    }

    const nextX = sprite.x + deltaX;
    const nextY = sprite.y + deltaY;

    if (!this.canMoveAlongPath(sprite, deltaX, deltaY)) {
      return false;
    }

    sprite.setPosition(nextX, nextY);
    return true;
  }

  private canMoveAlongPath(sprite: Phaser.GameObjects.Sprite, deltaX: number, deltaY: number): boolean {
    const stepCount = Math.max(
      1,
      Math.ceil(Math.hypot(deltaX, deltaY) / PLAYER_CONFIG.maxCollisionStepDistance),
    );
    const startX = sprite.x;
    const startY = sprite.y;

    for (let step = 1; step <= stepCount; step += 1) {
      const progress = step / stepCount;
      const nextX = startX + deltaX * progress;
      const nextY = startY + deltaY * progress;
      const nextFeetY = this.position.getFeetYForSpriteY(sprite, nextY);

      if (!this.collision.canOccupyAtFeet(nextX, nextFeetY)) {
        return false;
      }
    }

    return true;
  }
}
