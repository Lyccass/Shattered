import Phaser from 'phaser';
import type { PlayerMovementSystem } from './PlayerMovementSystem';

type ActiveDodgeMotion = {
  direction: Phaser.Math.Vector2;
  elapsedMs: number;
  durationMs: number;
  distancePerMs: number;
};

export type PlayerDodgeMotionStep = {
  moving: boolean;
  lateralIntentX: number;
};

export class PlayerDodgeMotionController {
  private dodgeMotion: ActiveDodgeMotion | null = null;

  isDodging(): boolean {
    return this.dodgeMotion !== null;
  }

  getDirection(): Phaser.Math.Vector2 | null {
    return this.dodgeMotion ? this.dodgeMotion.direction.clone() : null;
  }

  clear(): void {
    this.dodgeMotion = null;
  }

  start(direction: { x: number; y: number }, distance: number, durationMs: number): void {
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

  update(
    deltaMs: number,
    sprite: Phaser.GameObjects.Sprite,
    movement: PlayerMovementSystem,
  ): PlayerDodgeMotionStep {
    if (!this.dodgeMotion) {
      return {
        moving: false,
        lateralIntentX: 0,
      };
    }

    const lateralIntentX = this.dodgeMotion.direction.x;
    const remainingMs = Math.max(0, this.dodgeMotion.durationMs - this.dodgeMotion.elapsedMs);
    const frameMs = Math.min(deltaMs, remainingMs);
    const distance = this.dodgeMotion.distancePerMs * frameMs;
    const moved = movement.moveDistance(sprite, this.dodgeMotion.direction, distance, false);

    this.dodgeMotion = {
      ...this.dodgeMotion,
      elapsedMs: this.dodgeMotion.elapsedMs + frameMs,
    };

    if (!moved || this.dodgeMotion.elapsedMs >= this.dodgeMotion.durationMs) {
      this.dodgeMotion = null;
    }

    return {
      moving: true,
      lateralIntentX,
    };
  }
}
