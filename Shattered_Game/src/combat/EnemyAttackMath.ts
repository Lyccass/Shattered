import type { TelegraphShape } from './TelegraphTypes';

export function isPointInsideCircle(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  radius: number,
): boolean {
  return Math.hypot(pointX - centerX, pointY - centerY) <= radius;
}

export function isPointInsideEllipse(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): boolean {
  if (radiusX <= 0 || radiusY <= 0) {
    return false;
  }

  const normalizedX = (pointX - centerX) / radiusX;
  const normalizedY = (pointY - centerY) / radiusY;
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

export function isPointInsideRotatedRectangle(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): boolean {
  const local = rotateIntoLocal(pointX - centerX, pointY - centerY, rotationRad);
  return Math.abs(local.x) <= width / 2 && Math.abs(local.y) <= height / 2;
}

export function doesCircleIntersectRotatedRectangle(
  circleX: number,
  circleY: number,
  radius: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): boolean {
  const local = rotateIntoLocal(circleX - centerX, circleY - centerY, rotationRad);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const clampedX = clamp(local.x, -halfWidth, halfWidth);
  const clampedY = clamp(local.y, -halfHeight, halfHeight);
  const dx = local.x - clampedX;
  const dy = local.y - clampedY;
  return dx * dx + dy * dy <= radius * radius;
}

export function isPointInsideCone(
  pointX: number,
  pointY: number,
  originX: number,
  originY: number,
  rotationRad: number,
  range: number,
  angleRad: number,
): boolean {
  const local = rotateIntoLocal(pointX - originX, pointY - originY, rotationRad);
  const distance = Math.hypot(local.x, local.y);

  if (distance > range) {
    return false;
  }

  const halfAngle = angleRad / 2;
  const angle = Math.atan2(local.y, local.x);
  return Math.abs(angle) <= halfAngle;
}

export function buildConeTelegraphPolygon(
  range: number,
  angleRad: number,
  rotationRad: number,
  steps = 8,
): TelegraphShape {
  const points: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  const startAngle = rotationRad - angleRad / 2;
  const stepCount = Math.max(2, steps);

  for (let index = 0; index <= stepCount; index += 1) {
    const angle = startAngle + (angleRad * index) / stepCount;
    points.push({
      x: Math.cos(angle) * range,
      y: Math.sin(angle) * range,
    });
  }

  return {
    kind: 'polygon',
    points,
  };
}

function rotateIntoLocal(x: number, y: number, rotationRad: number): { x: number; y: number } {
  const cos = Math.cos(-rotationRad);
  const sin = Math.sin(-rotationRad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
