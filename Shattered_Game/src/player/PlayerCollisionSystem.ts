import Phaser from 'phaser';
import { PLAYER_CONFIG } from './PlayerConfig';
import { IsoTilemap } from '../world/IsoTilemap';

export class PlayerCollisionSystem {
  constructor(private tilemap: IsoTilemap) {}

  setTilemap(tilemap: IsoTilemap): void {
    this.tilemap = tilemap;
  }

  getFeetSamplePoints(feetWorldX: number, feetWorldY: number): Phaser.Math.Vector2[] {
    const radiusX = PLAYER_CONFIG.groundFootprintRadiusX;
    const radiusY = PLAYER_CONFIG.groundFootprintRadiusY;

    return [
      new Phaser.Math.Vector2(feetWorldX, feetWorldY),
      new Phaser.Math.Vector2(feetWorldX - radiusX, feetWorldY),
      new Phaser.Math.Vector2(feetWorldX + radiusX, feetWorldY),
      new Phaser.Math.Vector2(feetWorldX, feetWorldY - radiusY),
      new Phaser.Math.Vector2(feetWorldX, feetWorldY + radiusY),
    ];
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
