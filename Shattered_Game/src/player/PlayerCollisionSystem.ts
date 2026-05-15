import Phaser from 'phaser';
import { IsoTilemap } from '../world/IsoTilemap';

export class PlayerCollisionSystem {
  constructor(private readonly tilemap: IsoTilemap) {}

  getFeetSamplePoints(feetWorldX: number, feetWorldY: number): Phaser.Math.Vector2[] {
    return [new Phaser.Math.Vector2(feetWorldX, feetWorldY)];
  }

  isWorldPointWalkable(worldX: number, worldY: number): boolean {
    const tile = this.getPlayerFeetTile(worldX, worldY);

    return this.tilemap.isTileWalkable(tile.x, tile.y);
  }

  canOccupyAtFeet(feetWorldX: number, feetWorldY: number): boolean {
    return this.getFeetSamplePoints(feetWorldX, feetWorldY).every((point) =>
      this.isWorldPointWalkable(point.x, point.y),
    );
  }

  getPlayerGridPosition(feetWorldX: number, feetWorldY: number): Phaser.Math.Vector2 {
    return this.tilemap.transform.worldToGrid(feetWorldX, feetWorldY);
  }

  getPlayerFeetTile(feetWorldX: number, feetWorldY: number): Phaser.Math.Vector2 {
    return this.tilemap.transform.worldToTile(feetWorldX, feetWorldY);
  }

  getIsoSlideAxes(): Phaser.Math.Vector2[] {
    return [
      new Phaser.Math.Vector2(this.tilemap.tileWidth / 2, this.tilemap.tileHeight / 2).normalize(),
      new Phaser.Math.Vector2(-this.tilemap.tileWidth / 2, this.tilemap.tileHeight / 2).normalize(),
    ];
  }
}
