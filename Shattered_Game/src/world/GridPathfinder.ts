export type GridTile = {
  x: number;
  y: number;
};

type FindGridPathParams = {
  width: number;
  height: number;
  start: GridTile;
  goal: GridTile;
  isWalkable: (tileX: number, tileY: number) => boolean;
  maxVisited?: number;
};

type NeighbourOffset = {
  x: number;
  y: number;
  cost: number;
};

const SQRT2 = Math.SQRT2;

const NEIGHBOURS: NeighbourOffset[] = [
  { x: 1, y: 0, cost: 1 },
  { x: -1, y: 0, cost: 1 },
  { x: 0, y: 1, cost: 1 },
  { x: 0, y: -1, cost: 1 },
  { x: 1, y: 1, cost: SQRT2 },
  { x: 1, y: -1, cost: SQRT2 },
  { x: -1, y: 1, cost: SQRT2 },
  { x: -1, y: -1, cost: SQRT2 },
];

export function findGridPath(params: FindGridPathParams): GridTile[] | null {
  if (
    !isInBounds(params.start.x, params.start.y, params.width, params.height)
    || !isInBounds(params.goal.x, params.goal.y, params.width, params.height)
    || !params.isWalkable(params.goal.x, params.goal.y)
  ) {
    return null;
  }

  if (params.start.x === params.goal.x && params.start.y === params.goal.y) {
    return [{ x: params.start.x, y: params.start.y }];
  }

  const maxVisited = params.maxVisited ?? Math.max(256, params.width * params.height * 2);
  const startTile = { x: params.start.x, y: params.start.y };
  const open: Array<{ tile: GridTile; g: number; f: number }> = [{
    tile: startTile,
    g: 0,
    f: octileDistance(params.start, params.goal),
  }];
  const cameFrom = new Map<string, GridTile>();
  const gScore = new Map<string, number>([[tileKey(params.start.x, params.start.y), 0]]);
  const visited = new Set<string>();
  let visitedCount = 0;

  while (open.length > 0 && visitedCount < maxVisited) {
    open.sort((a, b) => a.f - b.f || a.g - b.g);
    const current = open.shift()!;
    const currentKey = tileKey(current.tile.x, current.tile.y);

    if (visited.has(currentKey)) {
      continue;
    }

    visited.add(currentKey);
    visitedCount += 1;

    if (current.tile.x === params.goal.x && current.tile.y === params.goal.y) {
      const rawPath = reconstructPath(cameFrom, current.tile);
      return smoothGridPath(rawPath, params);
    }

    for (const offset of NEIGHBOURS) {
      const nextX = current.tile.x + offset.x;
      const nextY = current.tile.y + offset.y;

      if (
        !isInBounds(nextX, nextY, params.width, params.height)
        || !params.isWalkable(nextX, nextY)
        || !canTraverseNeighbour(current.tile.x, current.tile.y, offset, params.isWalkable)
      ) {
        continue;
      }

      const nextKey = tileKey(nextX, nextY);
      const tentativeG = current.g + offset.cost;
      const bestKnownG = gScore.get(nextKey);

      if (bestKnownG !== undefined && tentativeG >= bestKnownG) {
        continue;
      }

      const nextTile = { x: nextX, y: nextY };
      cameFrom.set(nextKey, current.tile);
      gScore.set(nextKey, tentativeG);
      open.push({
        tile: nextTile,
        g: tentativeG,
        f: tentativeG + octileDistance(nextTile, params.goal),
      });
    }
  }

  return null;
}

function smoothGridPath(path: GridTile[], params: FindGridPathParams): GridTile[] {
  if (path.length <= 2) {
    return path;
  }

  const smoothed: GridTile[] = [path[0]];
  let anchorIndex = 0;

  while (anchorIndex < path.length - 1) {
    let furthestVisibleIndex = anchorIndex + 1;

    for (let index = anchorIndex + 2; index < path.length; index += 1) {
      if (!hasLineOfSight(path[anchorIndex], path[index], params.isWalkable)) {
        break;
      }

      furthestVisibleIndex = index;
    }

    smoothed.push(path[furthestVisibleIndex]);
    anchorIndex = furthestVisibleIndex;
  }

  return smoothed;
}

function hasLineOfSight(
  from: GridTile,
  to: GridTile,
  isWalkable: (tileX: number, tileY: number) => boolean,
): boolean {
  let currentX = from.x;
  let currentY = from.y;
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));

  if (steps === 0) {
    return true;
  }

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const nextX = Math.round(from.x + deltaX * t);
    const nextY = Math.round(from.y + deltaY * t);

    if (!isWalkable(nextX, nextY)) {
      return false;
    }

    const moveX = nextX - currentX;
    const moveY = nextY - currentY;

    if (moveX !== 0 && moveY !== 0) {
      if (!isWalkable(currentX + moveX, currentY) || !isWalkable(currentX, currentY + moveY)) {
        return false;
      }
    }

    currentX = nextX;
    currentY = nextY;
  }

  return true;
}

function reconstructPath(cameFrom: Map<string, GridTile>, goal: GridTile): GridTile[] {
  const path: GridTile[] = [goal];
  let current = goal;

  while (true) {
    const previous = cameFrom.get(tileKey(current.x, current.y));

    if (!previous) {
      break;
    }

    path.push(previous);
    current = previous;
  }

  path.reverse();
  return path;
}

function canTraverseNeighbour(
  fromX: number,
  fromY: number,
  offset: NeighbourOffset,
  isWalkable: (tileX: number, tileY: number) => boolean,
): boolean {
  if (offset.x === 0 || offset.y === 0) {
    return true;
  }

  return isWalkable(fromX + offset.x, fromY) && isWalkable(fromX, fromY + offset.y);
}

function octileDistance(a: GridTile, b: GridTile): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

function isInBounds(tileX: number, tileY: number, width: number, height: number): boolean {
  return tileX >= 0 && tileY >= 0 && tileX < width && tileY < height;
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}
