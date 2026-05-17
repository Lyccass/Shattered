import { computeEnemyBlockingRadius } from './EnemyMetrics';
import type { TelegraphShape } from './TelegraphTypes';
import type {
  EnemyDefinition,
  EnemyRuntimeState,
  EnemySpawnDefinition,
} from './EnemyTypes';

export type EnemyUpdateEvent =
  | {
      kind: 'telegraph_show';
      telegraphId: string;
      worldX: number;
      worldY: number;
      shape: TelegraphShape;
      durationMs: number;
    }
  | {
      kind: 'telegraph_remove';
      telegraphId: string;
    }
  | {
      kind: 'attack_result';
      hit: boolean;
      reason: 'hit' | 'outside' | 'invulnerable';
    };

type UpdateContext = {
  nowMs: number;
  deltaMs: number;
  playerWorldX: number;
  playerWorldY: number;
  playerInvulnerable: boolean;
  tileWidth: number;
  tileHeight: number;
};

type AdvanceResult = {
  state: EnemyRuntimeState;
  events: EnemyUpdateEvent[];
};

export function createEnemyRuntimeState(
  definition: EnemyDefinition,
  spawn: EnemySpawnDefinition,
  originWorldX: number,
  originWorldY: number,
): EnemyRuntimeState {
  return {
    id: spawn.id,
    definitionId: definition.id,
    mapId: spawn.mapId,
    originTileX: spawn.tileX,
    originTileY: spawn.tileY,
    originWorldX,
    originWorldY,
    worldX: originWorldX,
    worldY: originWorldY,
    currentState: 'idle',
    health: definition.maxHealth,
    cooldownEndsAtMs: 0,
    phaseEndsAtMs: null,
    telegraphId: null,
  };
}

export function advanceEnemyStateMachine(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
): AdvanceResult {
  const nextState = { ...state };
  const events: EnemyUpdateEvent[] = [];
  const distanceToPlayer = distance(nextState.worldX, nextState.worldY, context.playerWorldX, context.playerWorldY);
  const distanceToOrigin = distance(nextState.worldX, nextState.worldY, nextState.originWorldX, nextState.originWorldY);
  const minimumBodySpacingWorld = computeEnemyBlockingRadius(
    definition.collisionRadiusTiles,
    context.tileWidth,
    context.tileHeight,
  );
  const attackRangeWorld = definition.attackRangeTiles * Math.max(context.tileWidth, context.tileHeight) * 0.5;
  const aggroRangeWorld = definition.aggroRangeTiles * context.tileWidth;
  const leashRangeWorld = definition.leashRangeTiles * context.tileWidth;

  switch (nextState.currentState) {
    case 'idle':
      if (distanceToPlayer <= aggroRangeWorld) {
        nextState.currentState = 'aggro';
      }
      break;

    case 'aggro':
      if (distanceToPlayer <= attackRangeWorld && context.nowMs >= nextState.cooldownEndsAtMs) {
        enterWindup(nextState, definition, context, events);
      } else {
        nextState.currentState = 'approach';
      }
      break;

    case 'approach':
      if (distanceToOrigin > leashRangeWorld && distanceToPlayer > aggroRangeWorld) {
        nextState.currentState = 'reset';
        break;
      }

      moveToward(
        nextState,
        context.playerWorldX,
        context.playerWorldY,
        definition.moveSpeed,
        context.deltaMs,
        minimumBodySpacingWorld,
      );

      if (distance(nextState.worldX, nextState.worldY, context.playerWorldX, context.playerWorldY) <= attackRangeWorld
        && context.nowMs >= nextState.cooldownEndsAtMs) {
        enterWindup(nextState, definition, context, events);
      }
      break;

    case 'windup':
      if ((nextState.phaseEndsAtMs ?? 0) <= context.nowMs) {
        if (nextState.telegraphId) {
          events.push({
            kind: 'telegraph_remove',
            telegraphId: nextState.telegraphId,
          });
          nextState.telegraphId = null;
        }

        const hitResult = evaluateAttackHit(definition, nextState, context);
        events.push({
          kind: 'attack_result',
          hit: hitResult.hit,
          reason: hitResult.reason,
        });
        nextState.currentState = 'active';
        nextState.phaseEndsAtMs = context.nowMs + definition.attackTiming.activeMs;
      }
      break;

    case 'active':
      if ((nextState.phaseEndsAtMs ?? 0) <= context.nowMs) {
        nextState.currentState = 'recovery';
        nextState.phaseEndsAtMs = context.nowMs + definition.attackTiming.recoveryMs;
      }
      break;

    case 'recovery':
      if ((nextState.phaseEndsAtMs ?? 0) <= context.nowMs) {
        nextState.currentState = 'aggro';
        nextState.phaseEndsAtMs = null;
        nextState.cooldownEndsAtMs = context.nowMs + definition.attackCooldownMs;
      }
      break;

    case 'reset':
      moveToward(
        nextState,
        nextState.originWorldX,
        nextState.originWorldY,
        definition.moveSpeed,
        context.deltaMs,
      );

      if (distance(nextState.worldX, nextState.worldY, nextState.originWorldX, nextState.originWorldY) <= 2) {
        nextState.worldX = nextState.originWorldX;
        nextState.worldY = nextState.originWorldY;
        nextState.currentState = 'idle';
      }
      break;

    case 'hurt':
    case 'dead':
      break;
  }

  return {
    state: nextState,
    events,
  };
}

function enterWindup(
  state: EnemyRuntimeState,
  definition: EnemyDefinition,
  context: UpdateContext,
  events: EnemyUpdateEvent[],
): void {
  state.currentState = 'windup';
  state.phaseEndsAtMs = context.nowMs + definition.attackTiming.windupMs;
  state.telegraphId = `${state.id}:telegraph`;
  events.push({
    kind: 'telegraph_show',
    telegraphId: state.telegraphId,
    worldX: state.worldX,
    worldY: state.worldY,
    shape: buildTelegraphShape(definition, context.tileWidth, context.tileHeight),
    durationMs: definition.attackTiming.windupMs,
  });
}

function buildTelegraphShape(
  definition: EnemyDefinition,
  tileWidth: number,
  tileHeight: number,
): TelegraphShape {
  switch (definition.telegraphShape.kind) {
    case 'circle':
      return {
        kind: 'circle',
        radius: definition.telegraphShape.radiusTiles * Math.max(tileWidth, tileHeight) * 0.5,
      };
    case 'rectangle':
      return {
        kind: 'rectangle',
        width: definition.telegraphShape.widthTiles * tileWidth,
        height: definition.telegraphShape.heightTiles * tileHeight,
      };
  }
}

function evaluateAttackHit(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
): { hit: boolean; reason: 'hit' | 'outside' | 'invulnerable' } {
  const inShape = isPointInsideTelegraph(definition, state, context);

  if (!inShape) {
    return { hit: false, reason: 'outside' };
  }

  if (context.playerInvulnerable) {
    return { hit: false, reason: 'invulnerable' };
  }

  return { hit: true, reason: 'hit' };
}

function isPointInsideTelegraph(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
): boolean {
  switch (definition.telegraphShape.kind) {
    case 'circle': {
      const radius = definition.telegraphShape.radiusTiles * Math.max(context.tileWidth, context.tileHeight) * 0.5;
      return distance(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY) <= radius;
    }

    case 'rectangle': {
      const halfWidth = (definition.telegraphShape.widthTiles * context.tileWidth) / 2;
      const halfHeight = (definition.telegraphShape.heightTiles * context.tileHeight) / 2;
      return Math.abs(context.playerWorldX - state.worldX) <= halfWidth
        && Math.abs(context.playerWorldY - state.worldY) <= halfHeight;
    }
  }
}

function moveToward(
  state: EnemyRuntimeState,
  targetX: number,
  targetY: number,
  moveSpeed: number,
  deltaMs: number,
  stopDistance = 0,
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
    state.worldX = targetX - dx * remaining;
    state.worldY = targetY - dy * remaining;
    return;
  }

  state.worldX += (dx / length) * step;
  state.worldY += (dy / length) * step;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
