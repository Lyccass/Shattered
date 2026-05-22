import { computeEnemyBlockingRadius } from './EnemyMetrics';
import { clearAttackState, getCurrentAttack } from './EnemyAttackState';
import { selectEnemyAttack } from './EnemyAttackSelection';
import { buildAttackTargetTiles } from './EnemyAttackTiles';
import {
  moveToward,
  resolveApproachTarget,
  resolveJumpLandingPoint,
} from './EnemyMovement';
import { buildConeTelegraphPolygon } from './EnemyAttackMath';
import {
  angleTo,
  degreesToRadians,
  distance,
  lerp,
  tilesToWorldRange,
  tilesToWorldX,
  tilesToWorldY,
} from './EnemyStateMath';
import type { EnemyUpdateContext, EnemyUpdateEvent } from './EnemyStateMachineTypes';
import type { TelegraphShape } from './TelegraphTypes';
import type { EnemyAttackDefinition, EnemyDefinition, EnemyRuntimeState } from './EnemyTypes';

type EnemyTransitionArgs = {
  definition: EnemyDefinition;
  state: EnemyRuntimeState;
  context: EnemyUpdateContext;
  events: EnemyUpdateEvent[];
};

const WANDER_SPEED_MULTIPLIER = 0.3;
const WANDER_MIN_WAIT_MS = 3_000;
const WANDER_MAX_WAIT_MS = 8_000;
const WANDER_RADIUS_TILES = 3;
const WANDER_ARRIVAL_THRESHOLD = 4;

export function handleEnemyIdle({ definition, state, context }: EnemyTransitionArgs): void {
  const isPassive = definition.behavior === 'passive';

  // 1v1 lock: if player is already engaged with a different enemy, stay idle (but still wander)
  const lockedOut =
    context.playerEngagedWithEnemyId !== null &&
    context.playerEngagedWithEnemyId !== state.id;

  if (!lockedOut) {
    if (isPassive) {
      if (state.reactiveAggro) {
        state.wanderTargetWorldX = null;
        state.wanderTargetWorldY = null;
        state.currentState = 'aggro';
        return;
      }
    } else {
      const distanceToPlayer = distance(
        state.worldX,
        state.worldY,
        context.playerWorldX,
        context.playerWorldY,
      );
      const aggroRangeWorld = definition.aggroRangeTiles * context.tileWidth;

      if (distanceToPlayer <= aggroRangeWorld) {
        state.wanderTargetWorldX = null;
        state.wanderTargetWorldY = null;
        state.currentState = 'aggro';
        return;
      }
    }
  }

  updateIdleWander(definition, state, context);
}

function updateIdleWander(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
): void {
  if (state.wanderTargetWorldX !== null && state.wanderTargetWorldY !== null) {
    const dist = distance(state.worldX, state.worldY, state.wanderTargetWorldX, state.wanderTargetWorldY);

    if (dist <= WANDER_ARRIVAL_THRESHOLD) {
      state.wanderTargetWorldX = null;
      state.wanderTargetWorldY = null;
      state.nextWanderMs =
        context.nowMs + WANDER_MIN_WAIT_MS + Math.random() * (WANDER_MAX_WAIT_MS - WANDER_MIN_WAIT_MS);
    } else {
      moveToward(
        state,
        state.wanderTargetWorldX,
        state.wanderTargetWorldY,
        definition.moveSpeed * WANDER_SPEED_MULTIPLIER,
        context.deltaMs,
        0,
        context,
      );
      state.facingRad = angleTo(
        state.worldX,
        state.worldY,
        state.wanderTargetWorldX,
        state.wanderTargetWorldY,
      );
    }
    return;
  }

  if (context.nowMs < state.nextWanderMs) {
    return;
  }

  const wanderTarget = pickWanderTarget(state, context);
  if (wanderTarget) {
    state.wanderTargetWorldX = wanderTarget.x;
    state.wanderTargetWorldY = wanderTarget.y;
  } else {
    state.nextWanderMs = context.nowMs + WANDER_MIN_WAIT_MS;
  }
}

function pickWanderTarget(
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
): { x: number; y: number } | null {
  const originTile = context.worldToTile(state.originWorldX, state.originWorldY);

  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1 + Math.random() * WANDER_RADIUS_TILES;
    const tileX = Math.round(originTile.x + Math.cos(angle) * radius);
    const tileY = Math.round(originTile.y + Math.sin(angle) * radius);

    if (
      tileX >= 0 && tileY >= 0
      && tileX < context.mapWidth && tileY < context.mapHeight
      && context.isTileWalkable(tileX, tileY)
    ) {
      return context.getTileCenterWorld(tileX, tileY);
    }
  }

  return null;
}

export function handleEnemyAggro({
  definition,
  state,
  context,
  events,
}: EnemyTransitionArgs): void {
  const selectedAttack = selectEnemyAttack(
    definition,
    state,
    context,
    distance(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY),
  );

  if (selectedAttack) {
    enterWindup(state, selectedAttack, context, events);
  } else {
    state.currentState = 'approach';
  }
}

export function handleEnemyApproach({
  definition,
  state,
  context,
  events,
}: EnemyTransitionArgs): void {
  const distanceToPlayer = distance(
    state.worldX,
    state.worldY,
    context.playerWorldX,
    context.playerWorldY,
  );
  const distanceToLeashAnchor = distance(
    state.worldX,
    state.worldY,
    state.leashAnchorWorldX,
    state.leashAnchorWorldY,
  );
  const minimumBodySpacingWorld = computeEnemyBlockingRadius(
    definition.collisionRadiusTiles,
    context.tileWidth,
    context.tileHeight,
  );
  const aggroRangeWorld = definition.aggroRangeTiles * context.tileWidth;
  const leashRangeWorld = definition.leashRangeTiles * context.tileWidth;
  const deAggroRangeWorld = (definition.deAggroRangeTiles ?? 15) * context.tileWidth;

  if (distanceToPlayer > deAggroRangeWorld) {
    clearAttackState(state);
    state.currentState = 'reset';
    return;
  }

  if (distanceToLeashAnchor > leashRangeWorld && distanceToPlayer > aggroRangeWorld) {
    clearAttackState(state);
    state.currentState = 'reset';
    return;
  }

  const approachTarget = resolveApproachTarget(state, context);
  const preApproachX = state.worldX;
  const preApproachY = state.worldY;

  moveToward(
    state,
    approachTarget.x,
    approachTarget.y,
    definition.moveSpeed,
    context.deltaMs,
    minimumBodySpacingWorld,
    context,
  );

  if (state.worldX === preApproachX && state.worldY === preApproachY) {
    moveToward(
      state,
      context.playerWorldX,
      context.playerWorldY,
      definition.moveSpeed,
      context.deltaMs,
      minimumBodySpacingWorld,
      context,
    );
  }

  state.facingRad = angleTo(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY);

  const selectedAttack = selectEnemyAttack(
    definition,
    state,
    context,
    distance(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY),
  );

  if (selectedAttack) {
    enterWindup(state, selectedAttack, context, events);
  }
}

export function handleEnemyWindup({
  definition,
  state,
  context,
  events,
}: EnemyTransitionArgs): void {
  if ((state.phaseEndsAtMs ?? 0) > context.nowMs) {
    return;
  }

  const attack = getCurrentAttack(definition, state);

  if (!attack) {
    clearAttackState(state);
    state.currentState = 'aggro';
    return;
  }

  if (state.telegraphId) {
    events.push({
      kind: 'telegraph_remove',
      telegraphId: state.telegraphId,
    });
    state.telegraphId = null;
  }

  if (
    attack.kind === 'jump'
    && state.attackTargetWorldX !== null
    && state.attackTargetWorldY !== null
  ) {
    const landingPoint = resolveJumpLandingPoint(
      state.attackTargetWorldX,
      state.attackTargetWorldY,
      context,
    );
    state.jumpOriginWorldX = state.worldX;
    state.jumpOriginWorldY = state.worldY;
    state.jumpLandingWorldX = landingPoint.x;
    state.jumpLandingWorldY = landingPoint.y;
  }

  state.currentState = 'active';
  state.phaseStartedAtMs = context.nowMs;
  state.phaseEndsAtMs = context.nowMs + attack.timing.activeMs;
  if (state.attackTargetTiles.length === 0) {
    state.attackTargetTiles = buildAttackTargetTiles(attack, state, context);
  }
  state.attackResolved = false;
}

export function handleEnemyActive({
  definition,
  state,
  context,
  events,
}: EnemyTransitionArgs): void {
  const attack = getCurrentAttack(definition, state);

  if (
    attack?.kind === 'jump'
    && state.jumpOriginWorldX !== null
    && state.jumpLandingWorldX !== null
    && state.jumpOriginWorldY !== null
    && state.jumpLandingWorldY !== null
    && state.phaseStartedAtMs !== null
    && state.phaseEndsAtMs !== null
  ) {
    const duration = Math.max(1, state.phaseEndsAtMs - state.phaseStartedAtMs);
    const t = Math.min(1, (context.nowMs - state.phaseStartedAtMs) / duration);
    state.worldX = lerp(state.jumpOriginWorldX, state.jumpLandingWorldX, t);
    state.worldY = lerp(state.jumpOriginWorldY, state.jumpLandingWorldY, t);
  }

  if (!attack) {
    state.currentState = 'recovery';
    state.phaseStartedAtMs = context.nowMs;
    state.phaseEndsAtMs = context.nowMs;
    state.attackResolved = false;
    return;
  }

  if (!state.attackResolved) {
    const hitResult = evaluateAttackHit(state, context);

    if (hitResult.reason !== 'outside') {
      const knockbackFields = attack.knockback && hitResult.hit
        ? {
            knockbackDirX: Math.cos(state.facingRad),
            knockbackDirY: Math.sin(state.facingRad),
            knockbackDistanceWorld: attack.knockback.forceTiles * context.tileWidth * 0.5,
          }
        : {};
      events.push({
        kind: 'attack_result',
        attackId: attack.id,
        damage: attack.damage,
        hit: hitResult.hit,
        reason: hitResult.reason,
        ...knockbackFields,
      });
      state.attackResolved = true;
    }
  }

  if ((state.phaseEndsAtMs ?? 0) <= context.nowMs) {
    if (!state.attackResolved) {
      events.push({
        kind: 'attack_result',
        attackId: attack.id,
        damage: attack.damage,
        hit: false,
        reason: 'outside',
      });
      state.attackResolved = true;
    }

    state.currentState = 'recovery';
    state.phaseStartedAtMs = context.nowMs;
    state.phaseEndsAtMs = context.nowMs + attack.timing.recoveryMs;
  }
}

export function handleEnemyRecovery({
  definition,
  state,
  context,
}: EnemyTransitionArgs): void {
  const attack = getCurrentAttack(definition, state);

  if ((state.phaseEndsAtMs ?? 0) > context.nowMs) {
    return;
  }

  state.currentState = 'aggro';
  state.phaseStartedAtMs = null;
  state.phaseEndsAtMs = null;
  state.settleUntilMs = context.nowMs + 500 + Math.floor(Math.random() * 600);

  if (attack) {
    state.attackCooldownEndsAtMs[attack.id] = context.nowMs + attack.cooldownMs;
    state.globalCooldownEndsAtMs = context.nowMs + attack.globalCooldownMs;
  }

  clearAttackState(state);
}

export function handleEnemyReset({ definition, state, context }: EnemyTransitionArgs): void {
  moveToward(
    state,
    state.originWorldX,
    state.originWorldY,
    definition.moveSpeed,
    context.deltaMs,
    0,
    context,
  );
  state.facingRad = angleTo(state.worldX, state.worldY, state.originWorldX, state.originWorldY);

  if (distance(state.worldX, state.worldY, state.originWorldX, state.originWorldY) <= 2) {
    state.worldX = state.originWorldX;
    state.worldY = state.originWorldY;
    state.reactiveAggro = false;
    state.leashAnchorWorldX = state.originWorldX;
    state.leashAnchorWorldY = state.originWorldY;
    state.wanderTargetWorldX = null;
    state.wanderTargetWorldY = null;
    state.nextWanderMs = context.nowMs + 2_000;
    state.currentState = 'idle';
  }
}

function enterWindup(
  state: EnemyRuntimeState,
  attack: EnemyAttackDefinition,
  context: EnemyUpdateContext,
  events: EnemyUpdateEvent[],
): void {
  const tile = context.worldToTile(state.worldX, state.worldY);
  const tileCenter = context.getTileCenterWorld(tile.x, tile.y);
  state.worldX = tileCenter.x;
  state.worldY = tileCenter.y;

  state.currentState = 'windup';
  state.phaseStartedAtMs = context.nowMs;
  state.phaseEndsAtMs = context.nowMs + attack.timing.windupMs;
  state.currentAttackId = attack.id;
  state.telegraphId = `${state.id}:${attack.id}:telegraph`;

  const telegraph = buildAttackTelegraph(state, attack, context);
  state.attackTargetWorldX = telegraph.worldX;
  state.attackTargetWorldY = telegraph.worldY;
  state.attackRotationRad = telegraph.rotationRad;
  state.attackTargetTiles = telegraph.tiles;

  events.push({
    kind: 'telegraph_show',
    telegraphId: state.telegraphId,
    worldX: telegraph.worldX,
    worldY: telegraph.worldY,
    shape: telegraph.shape,
    tiles: telegraph.tiles,
    durationMs: attack.timing.windupMs,
    attackKind: attack.kind,
  });

  if (attack.kind === 'jump') {
    state.facingRad = angleTo(state.worldX, state.worldY, telegraph.worldX, telegraph.worldY);
  }
}

function buildAttackTelegraph(
  state: EnemyRuntimeState,
  attack: EnemyAttackDefinition,
  context: EnemyUpdateContext,
): {
  worldX: number;
  worldY: number;
  rotationRad: number;
  shape: TelegraphShape;
  tiles: Array<{ x: number; y: number }>;
} {
  const attackRotation = angleTo(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY);

  switch (attack.telegraph.kind) {
    case 'circle': {
      const worldX = context.playerWorldX;
      const worldY = context.playerWorldY;
      const rotationRad = attackRotation;
      const radius = tilesToWorldX(attack.telegraph.radiusTiles, context.tileWidth);
      return {
        worldX,
        worldY,
        rotationRad,
        shape: { kind: 'circle', radius },
        tiles: buildAttackTargetTiles(
          attack,
          { ...state, attackTargetWorldX: worldX, attackTargetWorldY: worldY, attackRotationRad: rotationRad },
          context,
        ),
      };
    }

    case 'ellipse': {
      const worldX = context.playerWorldX;
      const worldY = context.playerWorldY;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: {
          kind: 'ellipse',
          radiusX: tilesToWorldX(attack.telegraph.radiusXTiles, context.tileWidth),
          radiusY: tilesToWorldY(attack.telegraph.radiusYTiles, context.tileHeight),
        },
        tiles: buildAttackTargetTiles(
          attack,
          {
            ...state,
            attackTargetWorldX: worldX,
            attackTargetWorldY: worldY,
            attackRotationRad: rotationRad,
          },
          context,
        ),
      };
    }

    case 'cone': {
      const rangeWorld = tilesToWorldRange(attack.telegraph.rangeTiles, context.tileWidth, context.tileHeight);
      const angleRad = degreesToRadians(attack.telegraph.angleDeg);
      const worldX = state.worldX;
      const worldY = state.worldY;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: buildConeTelegraphPolygon(rangeWorld, angleRad, attackRotation),
        tiles: buildAttackTargetTiles(
          attack,
          {
            ...state,
            attackTargetWorldX: worldX,
            attackTargetWorldY: worldY,
            attackRotationRad: rotationRad,
          },
          context,
        ),
      };
    }

    case 'rectangle': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const centerOffset = lengthWorld / 2;
      const worldX = state.worldX + Math.cos(attackRotation) * centerOffset;
      const worldY = state.worldY + Math.sin(attackRotation) * centerOffset;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: {
          kind: 'rectangle',
          width: lengthWorld,
          height: widthWorld,
          rotationRad: attackRotation,
        },
        tiles: buildAttackTargetTiles(
          attack,
          {
            ...state,
            attackTargetWorldX: worldX,
            attackTargetWorldY: worldY,
            attackRotationRad: rotationRad,
          },
          context,
        ),
      };
    }

    case 'line': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const thickness = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const centerOffset = lengthWorld / 2;
      const worldX = state.worldX + Math.cos(attackRotation) * centerOffset;
      const worldY = state.worldY + Math.sin(attackRotation) * centerOffset;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: { kind: 'line', length: lengthWorld, thickness, rotationRad: attackRotation },
        tiles: buildAttackTargetTiles(
          attack,
          { ...state, attackTargetWorldX: worldX, attackTargetWorldY: worldY, attackRotationRad: rotationRad },
          context,
        ),
      };
    }
  }
}

function evaluateAttackHit(
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
): { hit: boolean; reason: 'hit' | 'outside' | 'invulnerable' } {
  const inShape = state.attackTargetTiles.some((attackTile) =>
    context.playerOccupiedTiles.some((playerTile) =>
      playerTile.x === attackTile.x && playerTile.y === attackTile.y,
    ));

  if (!inShape) {
    return { hit: false, reason: 'outside' };
  }

  if (context.playerInvulnerable) {
    return { hit: false, reason: 'invulnerable' };
  }

  return { hit: true, reason: 'hit' };
}
