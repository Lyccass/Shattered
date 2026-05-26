import type { WeaponAttackShape } from '../equipment/EquipmentTypes';
import type { IsoTilemap } from '../world/IsoTilemap';

export type WorldPoint = { x: number; y: number };

// Resolved world-space hitbox for the player's current attack.
// All distances are in world pixels; facingRad is a standard screen-space angle.
export type PlayerAttackWorldShape =
  | {
      kind: 'cone';
      originX: number;
      originY: number;
      facingRad: number;
      rangePx: number;
      halfAngleRad: number;
      minRangePx: number;
    }
  | {
      kind: 'rectangle';
      centerX: number;
      centerY: number;
      facingRad: number;
      lengthPx: number;
      widthPx: number;
    };

export function resolveAttackTarget(params: {
  tilemap: IsoTilemap;
  playerFeet: WorldPoint;
  aimRad: number;
  attackShape: WeaponAttackShape;
}): { targetWorld: WorldPoint; shape: PlayerAttackWorldShape } {
  const { tilemap, playerFeet, aimRad, attackShape } = params;
  const tw = tilemap.tileWidth;
  const th = tilemap.tileHeight;

  switch (attackShape.kind) {
    case 'arc': {
      const rangePx = tilesToWorldRange(attackShape.rangeTiles, tw, th);
      const minRangePx = tilesToWorldRange(attackShape.minRangeTiles ?? 0, tw, th);
      const halfAngleRad = (attackShape.angleDeg * Math.PI) / 360;
      const midRangePx = minRangePx + (rangePx - minRangePx) * 0.6;
      const targetWorld: WorldPoint = {
        x: playerFeet.x + Math.cos(aimRad) * midRangePx,
        y: playerFeet.y + Math.sin(aimRad) * midRangePx,
      };
      return {
        targetWorld,
        shape: {
          kind: 'cone',
          originX: playerFeet.x,
          originY: playerFeet.y,
          facingRad: aimRad,
          rangePx,
          halfAngleRad,
          minRangePx,
        },
      };
    }

    case 'thrust': {
      const lengthPx = attackShape.lengthTiles * tw;
      const widthPx = attackShape.widthTiles * th;
      const centerX = playerFeet.x + Math.cos(aimRad) * lengthPx * 0.5;
      const centerY = playerFeet.y + Math.sin(aimRad) * lengthPx * 0.5;
      const targetWorld: WorldPoint = {
        x: playerFeet.x + Math.cos(aimRad) * lengthPx,
        y: playerFeet.y + Math.sin(aimRad) * lengthPx,
      };
      return {
        targetWorld,
        shape: {
          kind: 'rectangle',
          centerX,
          centerY,
          facingRad: aimRad,
          lengthPx,
          widthPx,
        },
      };
    }
  }
}

// Returns true if the player's attack shape overlaps the enemy's circular hitbox.
export function playerAttackHitsEnemy(
  shape: PlayerAttackWorldShape,
  enemyX: number,
  enemyY: number,
  enemyRadiusPx: number,
): boolean {
  switch (shape.kind) {
    case 'cone':
      return circleIntersectsCone(
        enemyX, enemyY, enemyRadiusPx,
        shape.originX, shape.originY, shape.facingRad,
        shape.rangePx, shape.halfAngleRad, shape.minRangePx,
      );
    case 'rectangle':
      return circleIntersectsRotatedRect(
        enemyX, enemyY, enemyRadiusPx,
        shape.centerX, shape.centerY, shape.lengthPx, shape.widthPx, shape.facingRad,
      );
  }
}

function tilesToWorldRange(rangeTiles: number, tileWidth: number, tileHeight: number): number {
  return Math.sqrt((rangeTiles * tileWidth) ** 2 + (rangeTiles * tileHeight) ** 2) / Math.SQRT2;
}

function circleIntersectsCone(
  circleX: number,
  circleY: number,
  circleRadius: number,
  coneOriginX: number,
  coneOriginY: number,
  facingRad: number,
  rangePx: number,
  halfAngleRad: number,
  minRangePx = 0,
): boolean {
  const dist = Math.hypot(circleX - coneOriginX, circleY - coneOriginY);

  // Circle entirely inside the inner dead zone (haft / handle area) → no hit.
  if (minRangePx > 0 && dist + circleRadius <= minRangePx) {
    return false;
  }

  // Circle entirely beyond the outer arc → no hit.
  if (dist - circleRadius > rangePx) {
    return false;
  }

  // Check if the enemy center falls inside the angular sector (range expanded by radius
  // to catch enemies whose edge clips the outer arc).
  if (isInsideCone(circleX, circleY, coneOriginX, coneOriginY, facingRad, rangePx + circleRadius, halfAngleRad)) {
    return true;
  }

  // Check if the enemy circle clips either lateral edge segment of the arc.
  // For hollow arcs the segment runs from inner to outer radius; for full cones from origin.
  const innerScale = minRangePx > 0 ? minRangePx : 0;
  const edgeL = {
    ax: coneOriginX + Math.cos(facingRad - halfAngleRad) * innerScale,
    ay: coneOriginY + Math.sin(facingRad - halfAngleRad) * innerScale,
    bx: coneOriginX + Math.cos(facingRad - halfAngleRad) * rangePx,
    by: coneOriginY + Math.sin(facingRad - halfAngleRad) * rangePx,
  };
  const edgeR = {
    ax: coneOriginX + Math.cos(facingRad + halfAngleRad) * innerScale,
    ay: coneOriginY + Math.sin(facingRad + halfAngleRad) * innerScale,
    bx: coneOriginX + Math.cos(facingRad + halfAngleRad) * rangePx,
    by: coneOriginY + Math.sin(facingRad + halfAngleRad) * rangePx,
  };
  return (
    distToSegment(circleX, circleY, edgeL.ax, edgeL.ay, edgeL.bx, edgeL.by) <= circleRadius ||
    distToSegment(circleX, circleY, edgeR.ax, edgeR.ay, edgeR.bx, edgeR.by) <= circleRadius
  );
}

function isInsideCone(
  pointX: number,
  pointY: number,
  originX: number,
  originY: number,
  facingRad: number,
  rangePx: number,
  halfAngleRad: number,
): boolean {
  const dx = pointX - originX;
  const dy = pointY - originY;
  const dist = Math.hypot(dx, dy);

  if (dist > rangePx) {
    return false;
  }

  const cos = Math.cos(-facingRad);
  const sin = Math.sin(-facingRad);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return Math.abs(Math.atan2(localY, localX)) <= halfAngleRad;
}

function circleIntersectsRotatedRect(
  circleX: number,
  circleY: number,
  circleRadius: number,
  centerX: number,
  centerY: number,
  lengthPx: number,
  widthPx: number,
  rotationRad: number,
): boolean {
  const cos = Math.cos(-rotationRad);
  const sin = Math.sin(-rotationRad);
  const dx = circleX - centerX;
  const dy = circleY - centerY;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const halfL = lengthPx / 2;
  const halfW = widthPx / 2;
  const clampedX = Math.max(-halfL, Math.min(halfL, localX));
  const clampedY = Math.max(-halfW, Math.min(halfW, localY));
  const nearX = localX - clampedX;
  const nearY = localY - clampedY;
  return nearX * nearX + nearY * nearY <= circleRadius * circleRadius;
}

function distToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}
