import type { PlayerFacingDirection } from '../player/PlayerFacing';

export type CombatDodgeDirection = {
  x: number;
  y: number;
};

export type DodgeMotionState = {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  elapsedMs: number;
  durationMs: number;
};

export type DodgeMotionStep = {
  state: DodgeMotionState | null;
  x: number;
  y: number;
  progress: number;
  complete: boolean;
};

export function resolveCombatDodgeDirection(
  intent: { x: number; y: number },
  facing: PlayerFacingDirection,
): CombatDodgeDirection {
  const absX = Math.abs(intent.x);
  const absY = Math.abs(intent.y);

  if (absX > 0 || absY > 0) {
    if (absX > 0 && absY > 0) {
      return {
        x: Math.sign(intent.x) || 1,
        y: Math.sign(intent.y) || 1,
      };
    }

    if (absX > 0) {
      return { x: Math.sign(intent.x) || 1, y: 0 };
    }

    return { x: 0, y: Math.sign(intent.y) || 1 };
  }

  switch (facing) {
    case 'up':
      return { x: 0, y: -1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'down':
    default:
      return { x: 0, y: 1 };
  }
}

export function resolveReachableDodgeTarget(
  startX: number,
  startY: number,
  direction: CombatDodgeDirection,
  desiredDistance: number,
  stepDistance: number,
  canOccupy: (worldX: number, worldY: number) => boolean,
): { x: number; y: number } | null {
  const length = Math.hypot(direction.x, direction.y);

  if (length <= 0.0001 || desiredDistance <= 0 || stepDistance <= 0) {
    return null;
  }

  const dirX = direction.x / length;
  const dirY = direction.y / length;
  let furthestX = startX;
  let furthestY = startY;
  let foundReachable = false;
  const stepCount = Math.max(1, Math.ceil(desiredDistance / stepDistance));

  for (let step = 1; step <= stepCount; step += 1) {
    const distance = Math.min(desiredDistance, step * stepDistance);
    const sampleX = startX + dirX * distance;
    const sampleY = startY + dirY * distance;

    if (!canOccupy(sampleX, sampleY)) {
      break;
    }

    furthestX = sampleX;
    furthestY = sampleY;
    foundReachable = true;
  }

  if (!foundReachable) {
    return null;
  }

  return {
    x: furthestX,
    y: furthestY,
  };
}

export function createDodgeMotion(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  durationMs: number,
): DodgeMotionState {
  return {
    startX,
    startY,
    targetX,
    targetY,
    elapsedMs: 0,
    durationMs: Math.max(1, durationMs),
  };
}

export function advanceDodgeMotion(
  state: DodgeMotionState,
  deltaMs: number,
): DodgeMotionStep {
  const elapsedMs = Math.min(state.durationMs, state.elapsedMs + Math.max(0, deltaMs));
  const progress = elapsedMs / state.durationMs;
  const x = lerp(state.startX, state.targetX, easeOutQuad(progress));
  const y = lerp(state.startY, state.targetY, easeOutQuad(progress));
  const complete = elapsedMs >= state.durationMs;

  return {
    state: complete ? null : { ...state, elapsedMs },
    x,
    y,
    progress,
    complete,
  };
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
