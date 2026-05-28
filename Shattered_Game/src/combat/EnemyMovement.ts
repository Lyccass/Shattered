import { findGridPath } from '../world/GridPathfinder';
import type { EnemyUpdateContext } from './EnemyStateMachineTypes';
import type { EnemyRuntimeState } from './EnemyTypes';

export function moveToward(
  state: EnemyRuntimeState,
  targetX: number,
  targetY: number,
  moveSpeed: number,
  deltaMs: number,
  stopDistance = 0,
  context?: EnemyUpdateContext,
): void {
  if (context) {
    const pathWaypoint = resolvePathWaypoint(state, targetX, targetY, context);

    if (pathWaypoint) {
      moveTowardPoint(
        state,
        pathWaypoint.x,
        pathWaypoint.y,
        moveSpeed,
        deltaMs,
        pathWaypoint.isFinal ? stopDistance : 0,
        context,
      );
    }
    return;
  }

  moveTowardPoint(state, targetX, targetY, moveSpeed, deltaMs, stopDistance);
}

export function resolveApproachTarget(
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
  orbitTiles = 1.0,
): { x: number; y: number } {
  const dx = state.worldX - context.playerWorldX;
  const dy = state.worldY - context.playerWorldY;
  const distanceToPlayer = Math.hypot(dx, dy);
  const orbitStartDistance = context.tileWidth * 6.5;

  if (distanceToPlayer > orbitStartDistance || distanceToPlayer <= 0.001) {
    return {
      x: context.playerWorldX,
      y: context.playerWorldY,
    };
  }

  const outwardX = dx / distanceToPlayer;
  const outwardY = dy / distanceToPlayer;
  const tangentX = -outwardY * state.orbitDirection;
  const tangentY = outwardX * state.orbitDirection;
  const orbitRadius = context.nowMs < state.settleUntilMs
    ? context.tileWidth * (0.8 + 0.4 * Math.sin(context.nowMs * 0.006))
    : context.tileWidth * orbitTiles;
  const tangentBias = context.tileWidth * 0.5;

  return {
    x: context.playerWorldX + outwardX * orbitRadius + tangentX * tangentBias,
    y: context.playerWorldY + outwardY * orbitRadius + tangentY * tangentBias,
  };
}

export function resolveRetreatTarget(
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
  retreatDistanceWorld: number,
): { x: number; y: number } {
  const dx = state.worldX - context.playerWorldX;
  const dy = state.worldY - context.playerWorldY;
  const distanceToPlayer = Math.hypot(dx, dy);

  if (distanceToPlayer <= 0.001) {
    const angle = state.facingRad + Math.PI;
    return {
      x: state.worldX + Math.cos(angle) * retreatDistanceWorld,
      y: state.worldY + Math.sin(angle) * retreatDistanceWorld,
    };
  }

  const outwardX = dx / distanceToPlayer;
  const outwardY = dy / distanceToPlayer;
  const tangentX = -outwardY * state.orbitDirection;
  const tangentY = outwardX * state.orbitDirection;

  return {
    x: context.playerWorldX + outwardX * retreatDistanceWorld + tangentX * retreatDistanceWorld * 0.2,
    y: context.playerWorldY + outwardY * retreatDistanceWorld + tangentY * retreatDistanceWorld * 0.2,
  };
}

export function resolveJumpLandingPoint(
  targetWorldX: number,
  targetWorldY: number,
  context: EnemyUpdateContext,
): { x: number; y: number } {
  const targetTile = context.worldToTile(targetWorldX, targetWorldY);

  if (!wouldOccupyPlayerTile(targetWorldX, targetWorldY, context)) {
    return { x: targetWorldX, y: targetWorldY };
  }

  const candidateOffsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];

  for (const offset of candidateOffsets) {
    const tileX = targetTile.x + offset.x;
    const tileY = targetTile.y + offset.y;

    if (
      tileX < 0
      || tileY < 0
      || tileX >= context.mapWidth
      || tileY >= context.mapHeight
      || !context.isTileWalkable(tileX, tileY)
      || context.playerOccupiedTiles.some((tile) => tile.x === tileX && tile.y === tileY)
    ) {
      continue;
    }

    return context.getTileCenterWorld(tileX, tileY);
  }

  return context.getTileCenterWorld(targetTile.x, targetTile.y);
}

function moveTowardPoint(
  state: EnemyRuntimeState,
  targetX: number,
  targetY: number,
  moveSpeed: number,
  deltaMs: number,
  stopDistance = 0,
  context?: EnemyUpdateContext,
): void {
  const dx = targetX - state.worldX;
  const dy = targetY - state.worldY;
  const length = Math.hypot(dx, dy);

  if (length <= stopDistance + 0.001) {
    return;
  }

  const step = (moveSpeed * deltaMs) / 1000;
  const availableDistance = Math.max(0, length - stopDistance);

  if (step >= availableDistance) {
    const remaining = stopDistance / length;
    const nextWorldX = targetX - dx * remaining;
    const nextWorldY = targetY - dy * remaining;

    if (context && wouldOccupyPlayerTile(nextWorldX, nextWorldY, context)) {
      return;
    }

    state.worldX = nextWorldX;
    state.worldY = nextWorldY;
    return;
  }

  const nextWorldX = state.worldX + (dx / length) * step;
  const nextWorldY = state.worldY + (dy / length) * step;

  if (context && wouldOccupyPlayerTile(nextWorldX, nextWorldY, context)) {
    return;
  }

  state.worldX = nextWorldX;
  state.worldY = nextWorldY;
}

function resolvePathWaypoint(
  state: EnemyRuntimeState,
  targetX: number,
  targetY: number,
  context: EnemyUpdateContext,
): { x: number; y: number; isFinal: boolean } | null {
  const startTile = context.worldToTile(state.worldX, state.worldY);
  const goalTile = context.worldToTile(targetX, targetY);

  if (startTile.x === goalTile.x && startTile.y === goalTile.y) {
    return {
      x: targetX,
      y: targetY,
      isFinal: true,
    };
  }

  const path = findGridPath({
    width: context.mapWidth,
    height: context.mapHeight,
    start: { x: startTile.x, y: startTile.y },
    goal: { x: goalTile.x, y: goalTile.y },
    isWalkable: context.isTileWalkable,
    maxVisited: 512,
  });

  if (!path || path.length <= 1) {
    return null;
  }

  const nextTile = path[1];
  const nextWorld = context.getTileCenterWorld(nextTile.x, nextTile.y);
  const isFinal = nextTile.x === goalTile.x && nextTile.y === goalTile.y;

  return {
    x: isFinal ? targetX : nextWorld.x,
    y: isFinal ? targetY : nextWorld.y,
    isFinal,
  };
}

function wouldOccupyPlayerTile(
  worldX: number,
  worldY: number,
  context: EnemyUpdateContext,
): boolean {
  const tile = context.worldToTile(worldX, worldY);
  return context.playerOccupiedTiles.some((occupiedTile) =>
    occupiedTile.x === tile.x && occupiedTile.y === tile.y);
}
