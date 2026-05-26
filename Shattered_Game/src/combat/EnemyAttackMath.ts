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

export function doesEllipseIntersectRotatedRectangle(
  ellipseCenterX: number,
  ellipseCenterY: number,
  radiusX: number,
  radiusY: number,
  rectCenterX: number,
  rectCenterY: number,
  rectWidth: number,
  rectHeight: number,
  rotationRad: number,
): boolean {
  if (
    isPointInsideRotatedRectangle(
      ellipseCenterX,
      ellipseCenterY,
      rectCenterX,
      rectCenterY,
      rectWidth,
      rectHeight,
      rotationRad,
    )
  ) {
    return true;
  }

  const rectCorners = getRotatedRectangleCorners(
    rectCenterX,
    rectCenterY,
    rectWidth,
    rectHeight,
    rotationRad,
  );

  if (rectCorners.some((corner) =>
    isPointInsideEllipse(corner.x, corner.y, ellipseCenterX, ellipseCenterY, radiusX, radiusY))) {
    return true;
  }

  return getEllipseSamplePoints(ellipseCenterX, ellipseCenterY, radiusX, radiusY).some((point) =>
    isPointInsideRotatedRectangle(
      point.x,
      point.y,
      rectCenterX,
      rectCenterY,
      rectWidth,
      rectHeight,
      rotationRad,
    ));
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

export function doesAxisAlignedRectIntersectRotatedRectangle(
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): boolean {
  const axisAlignedCorners = [
    { x: rectX, y: rectY },
    { x: rectX + rectWidth, y: rectY },
    { x: rectX + rectWidth, y: rectY + rectHeight },
    { x: rectX, y: rectY + rectHeight },
  ];
  const rotatedCorners = getRotatedRectangleCorners(centerX, centerY, width, height, rotationRad);

  return polygonsIntersect(axisAlignedCorners, rotatedCorners);
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
  minRange = 0,
): TelegraphShape {
  const startAngle = rotationRad - angleRad / 2;
  const stepCount = Math.max(2, steps);

  if (minRange <= 0) {
    // Full wedge from origin.
    const points: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
    for (let i = 0; i <= stepCount; i++) {
      const a = startAngle + (angleRad * i) / stepCount;
      points.push({ x: Math.cos(a) * range, y: Math.sin(a) * range });
    }
    return { kind: 'polygon', points };
  }

  // Donut sector: outer arc forward, inner arc reversed (all relative to enemy origin).
  const outerPoints: Array<{ x: number; y: number }> = [];
  const innerPoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= stepCount; i++) {
    const a = startAngle + (angleRad * i) / stepCount;
    outerPoints.push({ x: Math.cos(a) * range, y: Math.sin(a) * range });
    innerPoints.push({ x: Math.cos(a) * minRange, y: Math.sin(a) * minRange });
  }

  return {
    kind: 'polygon',
    points: [...outerPoints, ...innerPoints.reverse()],
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

function getRotatedRectangleCorners(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationRad: number,
): Array<{ x: number; y: number }> {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const localCorners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  return localCorners.map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));
}

function getEllipseSamplePoints(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  steps = 16,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [{ x: centerX, y: centerY }];

  for (let index = 0; index < steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    points.push({
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    });
  }

  return points;
}

function polygonsIntersect(
  a: Array<{ x: number; y: number }>,
  b: Array<{ x: number; y: number }>,
): boolean {
  const axes = [...getPolygonAxes(a), ...getPolygonAxes(b)];

  return axes.every((axis) => {
    const aProjection = projectPolygonOntoAxis(a, axis);
    const bProjection = projectPolygonOntoAxis(b, axis);
    return aProjection.max >= bProjection.min && bProjection.max >= aProjection.min;
  });
}

function getPolygonAxes(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const axes: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const edgeX = next.x - current.x;
    const edgeY = next.y - current.y;
    const axisX = -edgeY;
    const axisY = edgeX;
    const length = Math.hypot(axisX, axisY);

    if (length <= 0.0001) {
      continue;
    }

    axes.push({
      x: axisX / length,
      y: axisY / length,
    });
  }

  return axes;
}

function projectPolygonOntoAxis(
  points: Array<{ x: number; y: number }>,
  axis: { x: number; y: number },
): { min: number; max: number } {
  let min = points[0].x * axis.x + points[0].y * axis.y;
  let max = min;

  for (let index = 1; index < points.length; index += 1) {
    const projection = points[index].x * axis.x + points[index].y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }

  return { min, max };
}
