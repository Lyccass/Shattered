import { computeEnemyBlockingRadius } from './EnemyMetrics';
import {
  buildConeTelegraphPolygon,
  isPointInsideCone,
  isPointInsideEllipse,
  isPointInsideRotatedRectangle,
} from './EnemyAttackMath';
import type { TelegraphShape } from './TelegraphTypes';
import type {
  EnemyAttackDefinition,
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
      attackId: string;
      damage: number;
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
    facingRad: 0,
    currentAttackId: null,
    attackTargetWorldX: null,
    attackTargetWorldY: null,
    attackRotationRad: null,
    attackCooldownEndsAtMs: Object.fromEntries(
      definition.attacks.map((attack) => [attack.id, 0]),
    ),
    phaseStartedAtMs: null,
    phaseEndsAtMs: null,
    telegraphId: null,
  };
}

export function advanceEnemyStateMachine(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
): AdvanceResult {
  const nextState = { ...state, attackCooldownEndsAtMs: { ...state.attackCooldownEndsAtMs } };
  const events: EnemyUpdateEvent[] = [];
  const distanceToPlayer = distance(
    nextState.worldX,
    nextState.worldY,
    context.playerWorldX,
    context.playerWorldY,
  );
  const distanceToOrigin = distance(
    nextState.worldX,
    nextState.worldY,
    nextState.originWorldX,
    nextState.originWorldY,
  );
  const minimumBodySpacingWorld = computeEnemyBlockingRadius(
    definition.collisionRadiusTiles,
    context.tileWidth,
    context.tileHeight,
  );
  const aggroRangeWorld = definition.aggroRangeTiles * context.tileWidth;
  const leashRangeWorld = definition.leashRangeTiles * context.tileWidth;
  nextState.facingRad = angleTo(nextState.worldX, nextState.worldY, context.playerWorldX, context.playerWorldY);

  switch (nextState.currentState) {
    case 'idle':
      if (distanceToPlayer <= aggroRangeWorld) {
        nextState.currentState = 'aggro';
      }
      break;

    case 'aggro': {
      const selectedAttack = selectAttack(definition, nextState, context, distanceToPlayer);

      if (selectedAttack) {
        enterWindup(nextState, selectedAttack, context, events);
      } else {
        nextState.currentState = 'approach';
      }
      break;
    }

    case 'approach': {
      if (distanceToOrigin > leashRangeWorld && distanceToPlayer > aggroRangeWorld) {
        clearAttackState(nextState);
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
      nextState.facingRad = angleTo(nextState.worldX, nextState.worldY, context.playerWorldX, context.playerWorldY);

      const selectedAttack = selectAttack(
        definition,
        nextState,
        context,
        distance(nextState.worldX, nextState.worldY, context.playerWorldX, context.playerWorldY),
      );

      if (selectedAttack) {
        enterWindup(nextState, selectedAttack, context, events);
      }
      break;
    }

    case 'windup':
      if ((nextState.phaseEndsAtMs ?? 0) <= context.nowMs) {
        const attack = getCurrentAttack(definition, nextState);

        if (!attack) {
          clearAttackState(nextState);
          nextState.currentState = 'aggro';
          break;
        }

        if (nextState.telegraphId) {
          events.push({
            kind: 'telegraph_remove',
            telegraphId: nextState.telegraphId,
          });
          nextState.telegraphId = null;
        }

        if (attack.kind === 'jump'
          && nextState.attackTargetWorldX !== null
          && nextState.attackTargetWorldY !== null) {
          nextState.worldX = nextState.attackTargetWorldX;
          nextState.worldY = nextState.attackTargetWorldY;
        }

        const hitResult = evaluateAttackHit(attack, nextState, context);
        events.push({
          kind: 'attack_result',
          attackId: attack.id,
          damage: attack.damage,
          hit: hitResult.hit,
          reason: hitResult.reason,
        });
        nextState.currentState = 'active';
        nextState.phaseStartedAtMs = context.nowMs;
        nextState.phaseEndsAtMs = context.nowMs + attack.timing.activeMs;
      }
      break;

    case 'active': {
      const attack = getCurrentAttack(definition, nextState);

      if (!attack || (nextState.phaseEndsAtMs ?? 0) <= context.nowMs) {
        nextState.currentState = 'recovery';
        nextState.phaseStartedAtMs = context.nowMs;
        nextState.phaseEndsAtMs = context.nowMs + (attack?.timing.recoveryMs ?? 0);
      }
      break;
    }

    case 'recovery': {
      const attack = getCurrentAttack(definition, nextState);

      if ((nextState.phaseEndsAtMs ?? 0) <= context.nowMs) {
        nextState.currentState = 'aggro';
        nextState.phaseStartedAtMs = null;
        nextState.phaseEndsAtMs = null;

        if (attack) {
          nextState.attackCooldownEndsAtMs[attack.id] = context.nowMs + attack.cooldownMs;
        }

        clearAttackState(nextState);
      }
      break;
    }

    case 'reset':
      moveToward(
        nextState,
        nextState.originWorldX,
        nextState.originWorldY,
        definition.moveSpeed,
        context.deltaMs,
      );
      nextState.facingRad = angleTo(nextState.worldX, nextState.worldY, nextState.originWorldX, nextState.originWorldY);

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

function selectAttack(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
  distanceToPlayer: number,
): EnemyAttackDefinition | null {
  const readyAttacks = definition.attacks.filter((attack) => {
    const distanceTiles = worldDistanceToTiles(distanceToPlayer, context.tileWidth, context.tileHeight);
    return distanceTiles >= attack.minRangeTiles
      && distanceTiles <= attack.maxRangeTiles
      && context.nowMs >= (state.attackCooldownEndsAtMs[attack.id] ?? 0);
  });

  if (readyAttacks.length === 0) {
    return null;
  }

  const stab = readyAttacks.find((attack) => attack.kind === 'stab');
  const cone = readyAttacks.find((attack) => attack.kind === 'cone');
  const jump = readyAttacks.find((attack) => attack.kind === 'jump');

  return stab ?? cone ?? jump ?? readyAttacks[0] ?? null;
}

function enterWindup(
  state: EnemyRuntimeState,
  attack: EnemyAttackDefinition,
  context: UpdateContext,
  events: EnemyUpdateEvent[],
): void {
  state.currentState = 'windup';
  state.phaseStartedAtMs = context.nowMs;
  state.phaseEndsAtMs = context.nowMs + attack.timing.windupMs;
  state.currentAttackId = attack.id;
  state.telegraphId = `${state.id}:${attack.id}:telegraph`;

  const telegraph = buildAttackTelegraph(state, attack, context);
  state.attackTargetWorldX = telegraph.worldX;
  state.attackTargetWorldY = telegraph.worldY;
  state.attackRotationRad = telegraph.rotationRad;

  events.push({
    kind: 'telegraph_show',
    telegraphId: state.telegraphId,
    worldX: telegraph.worldX,
    worldY: telegraph.worldY,
    shape: telegraph.shape,
    durationMs: attack.timing.windupMs,
  });

  if (attack.kind === 'jump') {
    state.facingRad = angleTo(state.worldX, state.worldY, telegraph.worldX, telegraph.worldY);
  }
}

function buildAttackTelegraph(
  state: EnemyRuntimeState,
  attack: EnemyAttackDefinition,
  context: UpdateContext,
): { worldX: number; worldY: number; rotationRad: number; shape: TelegraphShape } {
  const attackRotation = angleTo(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY);

  switch (attack.telegraph.kind) {
    case 'ellipse':
      return {
        worldX: context.playerWorldX,
        worldY: context.playerWorldY,
        rotationRad: attackRotation,
        shape: {
          kind: 'ellipse',
          radiusX: tilesToWorldX(attack.telegraph.radiusXTiles, context.tileWidth),
          radiusY: tilesToWorldY(attack.telegraph.radiusYTiles, context.tileHeight),
        },
      };

    case 'cone': {
      const rangeWorld = tilesToWorldRange(attack.telegraph.rangeTiles, context.tileWidth, context.tileHeight);
      const angleRad = PhaserMathDegToRad(attack.telegraph.angleDeg);
      return {
        worldX: state.worldX,
        worldY: state.worldY,
        rotationRad: attackRotation,
        shape: buildConeTelegraphPolygon(rangeWorld, angleRad, attackRotation),
      };
    }

    case 'rectangle': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const centerOffset = lengthWorld / 2;
      return {
        worldX: state.worldX + Math.cos(attackRotation) * centerOffset,
        worldY: state.worldY + Math.sin(attackRotation) * centerOffset,
        rotationRad: attackRotation,
        shape: {
          kind: 'rectangle',
          width: lengthWorld,
          height: widthWorld,
          rotationRad: attackRotation,
        },
      };
    }
  }
}

function evaluateAttackHit(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
): { hit: boolean; reason: 'hit' | 'outside' | 'invulnerable' } {
  const inShape = isPointInsideAttack(attack, state, context);

  if (!inShape) {
    return { hit: false, reason: 'outside' };
  }

  if (context.playerInvulnerable) {
    return { hit: false, reason: 'invulnerable' };
  }

  return { hit: true, reason: 'hit' };
}

function isPointInsideAttack(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
): boolean {
  switch (attack.telegraph.kind) {
    case 'ellipse':
      return isPointInsideEllipse(
        context.playerWorldX,
        context.playerWorldY,
        state.attackTargetWorldX ?? context.playerWorldX,
        state.attackTargetWorldY ?? context.playerWorldY,
        tilesToWorldX(attack.telegraph.radiusXTiles, context.tileWidth),
        tilesToWorldY(attack.telegraph.radiusYTiles, context.tileHeight),
      );

    case 'cone':
      return isPointInsideCone(
        context.playerWorldX,
        context.playerWorldY,
        state.worldX,
        state.worldY,
        state.attackRotationRad ?? state.facingRad,
        tilesToWorldRange(attack.telegraph.rangeTiles, context.tileWidth, context.tileHeight),
        PhaserMathDegToRad(attack.telegraph.angleDeg),
      );

    case 'rectangle': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const centerOffset = lengthWorld / 2;
      const rotationRad = state.attackRotationRad ?? state.facingRad;
      const centerX = state.worldX + Math.cos(rotationRad) * centerOffset;
      const centerY = state.worldY + Math.sin(rotationRad) * centerOffset;
      return isPointInsideRotatedRectangle(
        context.playerWorldX,
        context.playerWorldY,
        centerX,
        centerY,
        lengthWorld,
        widthWorld,
        rotationRad,
      );
    }
  }
}

function getCurrentAttack(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
): EnemyAttackDefinition | null {
  if (!state.currentAttackId) {
    return null;
  }

  return definition.attacks.find((attack) => attack.id === state.currentAttackId) ?? null;
}

function clearAttackState(state: EnemyRuntimeState): void {
  state.currentAttackId = null;
  state.attackTargetWorldX = null;
  state.attackTargetWorldY = null;
  state.attackRotationRad = null;
  state.phaseStartedAtMs = null;
  state.telegraphId = null;
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

function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

function tilesToWorldRange(tiles: number, tileWidth: number, tileHeight: number): number {
  return tiles * Math.max(tileWidth, tileHeight) * 0.5;
}

function tilesToWorldX(tiles: number, tileWidth: number): number {
  return tiles * tileWidth * 0.5;
}

function tilesToWorldY(tiles: number, tileHeight: number): number {
  return tiles * tileHeight;
}

function worldDistanceToTiles(distance: number, tileWidth: number, tileHeight: number): number {
  const scale = Math.max(tileWidth, tileHeight) * 0.5;
  return scale <= 0 ? 0 : distance / scale;
}

function PhaserMathDegToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
