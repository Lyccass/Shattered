import Phaser from 'phaser';

export type GridPosition = {
  gridX: number;
  gridY: number;
};

export type WorldPosition = {
  worldX: number;
  worldY: number;
};

export type IsoTransformConfig = {
  originX: number;
  originY: number;
  tileWidth: number;
  tileHeight: number;
};

// Coordinate convention:
// - gridX/gridY are gameplay coordinates.
// - worldX/worldY are Phaser world coordinates after isometric projection.
// - screenX/screenY are pointer/canvas coordinates. Convert them through the active camera before using worldToGrid().
// - gridToWorld() returns the tile centre/base anchor used by the player, debug, and mouse picking.
// - getTileTopWorld() returns the top vertex of the rendered diamond.
export class IsoTransform {
  readonly originX: number;
  readonly originY: number;
  readonly tileWidth: number;
  readonly tileHeight: number;

  constructor({ originX, originY, tileWidth, tileHeight }: IsoTransformConfig) {
    this.originX = originX;
    this.originY = originY;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
  }

  static getLocalTileVertex(gridX: number, gridY: number, tileWidth: number, tileHeight: number): Phaser.Geom.Point {
    return new Phaser.Geom.Point(((gridX - gridY) * tileWidth) / 2, ((gridX + gridY) * tileHeight) / 2);
  }

  static getLocalTileCenter(gridX: number, gridY: number, tileWidth: number, tileHeight: number): Phaser.Geom.Point {
    const vertex = IsoTransform.getLocalTileVertex(gridX, gridY, tileWidth, tileHeight);

    return new Phaser.Geom.Point(vertex.x, vertex.y + tileHeight / 2);
  }

  gridToWorld(gridX: number, gridY: number): Phaser.Math.Vector2 {
    return this.getTileCenterWorld(gridX, gridY);
  }

  getTileTopWorld(gridX: number, gridY: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.originX + ((gridX - gridY) * this.tileWidth) / 2,
      this.originY + ((gridX + gridY) * this.tileHeight) / 2,
    );
  }

  getTileCenterWorld(gridX: number, gridY: number): Phaser.Math.Vector2 {
    const top = this.getTileTopWorld(gridX, gridY);

    return new Phaser.Math.Vector2(top.x, top.y + this.tileHeight / 2);
  }

  worldToGrid(worldX: number, worldY: number): Phaser.Math.Vector2 {
    const localX = worldX - this.originX;
    const localY = worldY - this.originY - this.tileHeight / 2;

    return new Phaser.Math.Vector2(
      localY / this.tileHeight + localX / this.tileWidth,
      localY / this.tileHeight - localX / this.tileWidth,
    );
  }

  worldToTile(worldX: number, worldY: number): Phaser.Math.Vector2 {
    return this.gridToTile(this.worldToGrid(worldX, worldY));
  }

  gridToTile(grid: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    // gridToWorld() places tile centres on integer grid coordinates. That means
    // the visible tile under a world point is the nearest integer grid centre,
    // not Math.floor(grid). Flooring lets the top half of a diamond report as
    // the tile above it.
    return new Phaser.Math.Vector2(
      Math.floor(grid.x + 0.5),
      Math.floor(grid.y + 0.5),
    );
  }

  getTileDiamondPoints(gridX: number, gridY: number): Phaser.Geom.Point[] {
    const center = this.getTileCenterWorld(gridX, gridY);

    return [
      new Phaser.Geom.Point(center.x, center.y - this.tileHeight / 2),
      new Phaser.Geom.Point(center.x + this.tileWidth / 2, center.y),
      new Phaser.Geom.Point(center.x, center.y + this.tileHeight / 2),
      new Phaser.Geom.Point(center.x - this.tileWidth / 2, center.y),
    ];
  }

  getMouseGridPosition(pointer: Phaser.Input.Pointer, camera: Phaser.Cameras.Scene2D.Camera): Phaser.Math.Vector2 {
    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);

    return this.worldToGrid(worldPoint.x, worldPoint.y);
  }
}
