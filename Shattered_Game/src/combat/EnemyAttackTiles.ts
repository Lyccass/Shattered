import {
  isPointInsideCircle,
  isPointInsideCone,
  isPointInsideEllipse,
  isPointInsideRotatedRectangle,
} from './EnemyAttackMath';
import {
  degreesToRadians,
  getRotatedRectangleCorners,
  normalizeTileBounds,
  tilesToWorldRange,
  tilesToWorldX,
  tilesToWorldY,
} from './EnemyStateMath';
import type { EnemyUpdateContext } from './EnemyStateMachineTypes';
import type { EnemyAttackDefinition, EnemyRuntimeState } from './EnemyTypes';

export function buildAttackTargetTiles(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
): Array<{ x: number; y: number }> {
  const tiles: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  const bounds = getAttackTileBounds(attack, state, context);

  for (let tileY = bounds.minTileY; tileY <= bounds.maxTileY; tileY += 1) {
    for (let tileX = bounds.minTileX; tileX <= bounds.maxTileX; tileX += 1) {
      if (
        tileX < 0
        || tileY < 0
        || tileX >= context.mapWidth
        || tileY >= context.mapHeight
      ) {
        continue;
      }

      if (tileMatchesAttackShape(attack, state, context, tileX, tileY)) {
        const key = `${tileX},${tileY}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        tiles.push({ x: tileX, y: tileY });
      }
    }
  }

  return tiles;
}

function getAttackTileBounds(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
): { minTileX: number; minTileY: number; maxTileX: number; maxTileY: number } {
  switch (attack.telegraph.kind) {
    case 'circle': {
      const centerX = state.attackTargetWorldX ?? context.playerWorldX;
      const centerY = state.attackTargetWorldY ?? context.playerWorldY;
      const radius = tilesToWorldX(attack.telegraph.radiusTiles, context.tileWidth);
      const min = context.worldToTile(centerX - radius, centerY - radius);
      const max = context.worldToTile(centerX + radius, centerY + radius);
      return normalizeTileBounds(min.x, min.y, max.x, max.y);
    }

    case 'ellipse': {
      const centerX = state.attackTargetWorldX ?? context.playerWorldX;
      const centerY = state.attackTargetWorldY ?? context.playerWorldY;
      const radiusX = tilesToWorldX(attack.telegraph.radiusXTiles, context.tileWidth);
      const radiusY = tilesToWorldY(attack.telegraph.radiusYTiles, context.tileHeight);
      const min = context.worldToTile(centerX - radiusX, centerY - radiusY);
      const max = context.worldToTile(centerX + radiusX, centerY + radiusY);
      return normalizeTileBounds(min.x, min.y, max.x, max.y);
    }

    case 'cone': {
      const rangeWorld = tilesToWorldRange(
        attack.telegraph.rangeTiles,
        context.tileWidth,
        context.tileHeight,
      );
      const min = context.worldToTile(state.worldX - rangeWorld, state.worldY - rangeWorld);
      const max = context.worldToTile(state.worldX + rangeWorld, state.worldY + rangeWorld);
      return normalizeTileBounds(min.x, min.y, max.x, max.y);
    }

    case 'rectangle': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const rotationRad = state.attackRotationRad ?? state.facingRad;
      const centerOffset = lengthWorld / 2;
      const centerX = state.worldX + Math.cos(rotationRad) * centerOffset;
      const centerY = state.worldY + Math.sin(rotationRad) * centerOffset;
      const corners = getRotatedRectangleCorners(centerX, centerY, lengthWorld, widthWorld, rotationRad);
      const tileBounds = corners.map((corner) => context.worldToTile(corner.x, corner.y));
      const tileXs = tileBounds.map((tile) => tile.x);
      const tileYs = tileBounds.map((tile) => tile.y);
      return normalizeTileBounds(
        Math.min(...tileXs),
        Math.min(...tileYs),
        Math.max(...tileXs),
        Math.max(...tileYs),
      );
    }

    case 'line': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const rotationRad = state.attackRotationRad ?? state.facingRad;
      const centerOffset = lengthWorld / 2;
      const centerX = state.worldX + Math.cos(rotationRad) * centerOffset;
      const centerY = state.worldY + Math.sin(rotationRad) * centerOffset;
      const corners = getRotatedRectangleCorners(centerX, centerY, lengthWorld, widthWorld, rotationRad);
      const tileBounds = corners.map((corner) => context.worldToTile(corner.x, corner.y));
      const tileXs = tileBounds.map((tile) => tile.x);
      const tileYs = tileBounds.map((tile) => tile.y);
      return normalizeTileBounds(
        Math.min(...tileXs),
        Math.min(...tileYs),
        Math.max(...tileXs),
        Math.max(...tileYs),
      );
    }
  }
}

function tileMatchesAttackShape(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
  tileX: number,
  tileY: number,
): boolean {
  return getTileSamplePoints(tileX, tileY, context).some((point) =>
    isPointInsideAttackAtPoint(
      attack,
      state,
      context,
      point.x,
      point.y,
    ));
}

function getTileSamplePoints(
  tileX: number,
  tileY: number,
  context: EnemyUpdateContext,
): Array<{ x: number; y: number }> {
  const center = context.getTileCenterWorld(tileX, tileY);
  const corners = context.getTileDiamondPoints(tileX, tileY);
  const edgeMidpoints = corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    return {
      x: (corner.x + next.x) / 2,
      y: (corner.y + next.y) / 2,
    };
  });

  return [
    { x: center.x, y: center.y },
    ...corners.map((point) => ({ x: point.x, y: point.y })),
    ...edgeMidpoints,
  ];
}

function isPointInsideAttackAtPoint(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
  pointX: number,
  pointY: number,
): boolean {
  switch (attack.telegraph.kind) {
    case 'circle': {
      const radius = tilesToWorldX(attack.telegraph.radiusTiles, context.tileWidth);
      const centerX = state.attackTargetWorldX ?? context.playerWorldX;
      const centerY = state.attackTargetWorldY ?? context.playerWorldY;
      return isPointInsideCircle(pointX, pointY, centerX, centerY, radius);
    }

    case 'ellipse':
      return isPointInsideEllipse(
        pointX,
        pointY,
        state.attackTargetWorldX ?? context.playerWorldX,
        state.attackTargetWorldY ?? context.playerWorldY,
        tilesToWorldX(attack.telegraph.radiusXTiles, context.tileWidth),
        tilesToWorldY(attack.telegraph.radiusYTiles, context.tileHeight),
      );

    case 'cone':
      return isPointInsideCone(
        pointX,
        pointY,
        state.worldX,
        state.worldY,
        state.attackRotationRad ?? state.facingRad,
        tilesToWorldRange(attack.telegraph.rangeTiles, context.tileWidth, context.tileHeight),
        degreesToRadians(attack.telegraph.angleDeg),
      );

    case 'rectangle': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const centerOffset = lengthWorld / 2;
      const rotationRad = state.attackRotationRad ?? state.facingRad;
      const centerX = state.worldX + Math.cos(rotationRad) * centerOffset;
      const centerY = state.worldY + Math.sin(rotationRad) * centerOffset;
      return isPointInsideRotatedRectangle(
        pointX,
        pointY,
        centerX,
        centerY,
        lengthWorld,
        widthWorld,
        rotationRad,
      );
    }

    case 'line': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const rotationRad = state.attackRotationRad ?? state.facingRad;
      const centerOffset = lengthWorld / 2;
      const centerX = state.worldX + Math.cos(rotationRad) * centerOffset;
      const centerY = state.worldY + Math.sin(rotationRad) * centerOffset;
      return isPointInsideRotatedRectangle(pointX, pointY, centerX, centerY, lengthWorld, widthWorld, rotationRad);
    }
  }
}
