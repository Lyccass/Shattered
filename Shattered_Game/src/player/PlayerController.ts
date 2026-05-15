import Phaser from 'phaser';
import { PlayerCollisionSystem } from './PlayerCollisionSystem';
import { PlayerMovementSystem } from './PlayerMovementSystem';
import { PlayerPositionSystem } from './PlayerPositionSystem';
import { PlayerVisualSystem } from './PlayerVisualSystem';
import { IsoTilemap } from '../world/IsoTilemap';

type MovementKeys = Record<'up' | 'left' | 'down' | 'right', Phaser.Input.Keyboard.Key>;

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;

  private readonly keys: MovementKeys;
  private readonly movementIntent = new Phaser.Math.Vector2();
  private readonly collision: PlayerCollisionSystem;
  private readonly movement: PlayerMovementSystem;
  private readonly position: PlayerPositionSystem;
  private readonly visuals: PlayerVisualSystem;

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, tilemap: IsoTilemap) {
    this.sprite = sprite;
    this.collision = new PlayerCollisionSystem(tilemap);
    this.position = new PlayerPositionSystem();
    this.movement = new PlayerMovementSystem(this.collision, this.position);
    this.visuals = new PlayerVisualSystem(sprite);
    this.keys = scene.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as MovementKeys;
  }

  update(delta: number): void {
    this.readMovementIntent();
    this.movement.move(this.sprite, this.movementIntent, delta);
    this.visuals.update(this.getFeetPoint().y);
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

  isFeetTileBlocked(): boolean {
    const feetPoint = this.getFeetPoint();

    return !this.collision.canOccupyAtFeet(feetPoint.x, feetPoint.y);
  }

  private readMovementIntent(): void {
    this.movementIntent.set(0, 0);

    if (this.keys.left.isDown) this.movementIntent.x -= 1;
    if (this.keys.right.isDown) this.movementIntent.x += 1;
    if (this.keys.up.isDown) this.movementIntent.y -= 1;
    if (this.keys.down.isDown) this.movementIntent.y += 1;
  }
}
