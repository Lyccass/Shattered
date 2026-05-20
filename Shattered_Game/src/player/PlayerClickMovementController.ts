import Phaser from 'phaser';
import { findGridPath } from '../world/GridPathfinder';
import type { IsoTilemap } from '../world/IsoTilemap';
import { PLAYER_CONFIG } from './PlayerConfig';

export class PlayerClickMovementController {
  private clickMoveTarget: Phaser.Math.Vector2 | null = null;
  private clickMoveWaypoints: Phaser.Math.Vector2[] = [];

  constructor(private tilemap: IsoTilemap) {}

  setTilemap(tilemap: IsoTilemap): void {
    this.tilemap = tilemap;
    this.clear();
  }

  hasTarget(): boolean {
    return this.clickMoveTarget !== null || this.clickMoveWaypoints.length > 0;
  }

  clear(): void {
    this.clickMoveTarget = null;
    this.clickMoveWaypoints = [];
  }

  setTarget(
    startTile: { x: number; y: number },
    worldX: number,
    worldY: number,
    maxPathTiles?: number,
  ): void {
    const goalTile = this.tilemap.transform.worldToTile(worldX, worldY);
    const path = findGridPath({
      width: this.tilemap.width,
      height: this.tilemap.height,
      start: { x: startTile.x, y: startTile.y },
      goal: { x: goalTile.x, y: goalTile.y },
      isWalkable: (tileX, tileY) => this.tilemap.isTileWalkable(tileX, tileY),
    });

    if (!path || path.length === 0) {
      this.clear();
      return;
    }

    const rawTiles = path.slice(1);
    const isClamped = maxPathTiles !== undefined && rawTiles.length > maxPathTiles;
    const tiles = isClamped ? rawTiles.slice(0, maxPathTiles) : rawTiles;

    if (tiles.length === 0) {
      this.clear();
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

  getCurrentMoveDirection(feet: { x: number; y: number }): Phaser.Math.Vector2 | null {
    const currentWaypoint = this.clickMoveWaypoints[0] ?? this.clickMoveTarget;

    if (!currentWaypoint) {
      return null;
    }

    const deltaX = currentWaypoint.x - feet.x;
    const deltaY = currentWaypoint.y - feet.y;

    if (Math.hypot(deltaX, deltaY) <= 0.001) {
      return null;
    }

    return new Phaser.Math.Vector2(deltaX, deltaY);
  }

  readMovementIntent(feet: { x: number; y: number }): Phaser.Math.Vector2 {
    const currentWaypoint = this.clickMoveWaypoints[0] ?? this.clickMoveTarget;

    if (!currentWaypoint) {
      return new Phaser.Math.Vector2();
    }

    const deltaX = currentWaypoint.x - feet.x;
    const deltaY = currentWaypoint.y - feet.y;

    if (Math.hypot(deltaX, deltaY) <= PLAYER_CONFIG.movementSpeed * 0.08) {
      if (this.clickMoveWaypoints.length > 0) {
        this.clickMoveWaypoints.shift();

        if (this.clickMoveWaypoints.length > 0) {
          return this.readMovementIntent(feet);
        }
      }

      this.clear();
      return new Phaser.Math.Vector2();
    }

    return new Phaser.Math.Vector2(deltaX, deltaY);
  }
}
