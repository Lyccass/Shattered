import { computeEnemyBlockingRadius } from './EnemyMetrics';
import { findGridPath } from '../world/GridPathfinder';
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
      tiles?: Array<{ x: number; y: number }>;
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
  playerHitPoints: Array<{ x: number; y: number }>;
  playerOccupiedTiles: Array<{ x: number; y: number }>;
  tileWidth: number;
  tileHeight: number;
  mapWidth: number;
  mapHeight: number;
  worldToTile: (worldX: number, worldY: number) => { x: number; y: number };
  getTileCenterWorld: (tileX: number, tileY: number) => { x: number; y: number };
  getTileDiamondPoints: (tileX: number, tileY: number) => Array<{ x: number; y: number }>;
  isTileWalkable: (tileX: number, tileY: number) => boolean;
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
    attackTargetTiles: [],
    orbitDirection: hashStringToOrbitDirection(spawn.id),
    attackCooldownEndsAtMs: Object.fromEntries(
      definition.attacks.map((attack) => [attack.id, 0]),
    ),
    globalCooldownEndsAtMs: 0,
    phaseStartedAtMs: null,
    phaseEndsAtMs: null,
    telegraphId: null,
    attackResolved: false,
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

      const approachTarget = resolveApproachTarget(nextState, context);

      moveToward(
        nextState,
        approachTarget.x,
        approachTarget.y,
        definition.moveSpeed,
        context.deltaMs,
        minimumBodySpacingWorld,
        context,
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
          const landingPoint = resolveJumpLandingPoint(
            nextState.attackTargetWorldX,
            nextState.attackTargetWorldY,
            context,
          );
          nextState.worldX = landingPoint.x;
          nextState.worldY = landingPoint.y;
        }

        nextState.currentState = 'active';
        nextState.phaseStartedAtMs = context.nowMs;
        nextState.phaseEndsAtMs = context.nowMs + attack.timing.activeMs;
        if (nextState.attackTargetTiles.length === 0) {
          nextState.attackTargetTiles = buildAttackTargetTiles(attack, nextState, context);
        }
        nextState.attackResolved = false;
      }
      break;

    case 'active': {
      const attack = getCurrentAttack(definition, nextState);

      if (!attack) {
        nextState.currentState = 'recovery';
        nextState.phaseStartedAtMs = context.nowMs;
        nextState.phaseEndsAtMs = context.nowMs;
        nextState.attackResolved = false;
        break;
      }

      if (!nextState.attackResolved) {
        const hitResult = evaluateAttackHit(nextState, context);

        if (hitResult.reason !== 'outside') {
          events.push({
            kind: 'attack_result',
            attackId: attack.id,
            damage: attack.damage,
            hit: hitResult.hit,
            reason: hitResult.reason,
          });
          nextState.attackResolved = true;
        }
      }

      if ((nextState.phaseEndsAtMs ?? 0) <= context.nowMs) {
        if (!nextState.attackResolved) {
          events.push({
            kind: 'attack_result',
            attackId: attack.id,
            damage: attack.damage,
            hit: false,
            reason: 'outside',
          });
          nextState.attackResolved = true;
        }

        nextState.currentState = 'recovery';
        nextState.phaseStartedAtMs = context.nowMs;
        nextState.phaseEndsAtMs = context.nowMs + attack.timing.recoveryMs;
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
          nextState.globalCooldownEndsAtMs = context.nowMs + attack.globalCooldownMs;
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
        0,
        context,
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
      && context.nowMs >= state.globalCooldownEndsAtMs
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
  state.attackTargetTiles = telegraph.tiles;

  events.push({
    kind: 'telegraph_show',
    telegraphId: state.telegraphId,
    worldX: telegraph.worldX,
    worldY: telegraph.worldY,
    shape: telegraph.shape,
    tiles: telegraph.tiles,
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
): {
  worldX: number;
  worldY: number;
  rotationRad: number;
  shape: TelegraphShape;
  tiles: Array<{ x: number; y: number }>;
} {
  const attackRotation = angleTo(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY);

  switch (attack.telegraph.kind) {
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
      const angleRad = PhaserMathDegToRad(attack.telegraph.angleDeg);
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
  }
}

function evaluateAttackHit(
  state: EnemyRuntimeState,
  context: UpdateContext,
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

function isPointInsideAttackAtPoint(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
  pointX: number,
  pointY: number,
): boolean {
  switch (attack.telegraph.kind) {
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
        pointX,
        pointY,
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
  state.attackTargetTiles = [];
  state.phaseStartedAtMs = null;
  state.telegraphId = null;
  state.attackResolved = false;
}

function buildAttackTargetTiles(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
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
  context: UpdateContext,
): { minTileX: number; minTileY: number; maxTileX: number; maxTileY: number } {
  switch (attack.telegraph.kind) {
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
      const rangeWorld = tilesToWorldRange(attack.telegraph.rangeTiles, context.tileWidth, context.tileHeight);
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
  }
}

function tileMatchesAttackShape(
  attack: EnemyAttackDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
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
  context: UpdateContext,
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

function moveToward(
  state: EnemyRuntimeState,
  targetX: number,
  targetY: number,
  moveSpeed: number,
  deltaMs: number,
  stopDistance = 0,
  context?: UpdateContext,
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
      return;
    }
  }

  moveTowardPoint(state, targetX, targetY, moveSpeed, deltaMs, stopDistance, context);
}

function resolveApproachTarget(
  state: EnemyRuntimeState,
  context: UpdateContext,
): { x: number; y: number } {
  const dx = state.worldX - context.playerWorldX;
  const dy = state.worldY - context.playerWorldY;
  const distanceToPlayer = Math.hypot(dx, dy);
  const orbitStartDistance = context.tileWidth * 4.5;

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
  const orbitRadius = context.tileWidth * 1.8;
  const tangentBias = context.tileWidth * 1.1;

  return {
    x: context.playerWorldX + outwardX * orbitRadius + tangentX * tangentBias,
    y: context.playerWorldY + outwardY * orbitRadius + tangentY * tangentBias,
  };
}

function moveTowardPoint(
  state: EnemyRuntimeState,
  targetX: number,
  targetY: number,
  moveSpeed: number,
  deltaMs: number,
  stopDistance = 0,
  context?: UpdateContext,
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
  context: UpdateContext,
): { x: number; y: number; isFinal: boolean } | null {
  const startTile = context.worldToTile(state.worldX, state.worldY);
  const goalTile = context.worldToTile(targetX, targetY);

  if (
    startTile.x === goalTile.x
    && startTile.y === goalTile.y
  ) {
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

function resolveJumpLandingPoint(
  targetWorldX: number,
  targetWorldY: number,
  context: UpdateContext,
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

function wouldOccupyPlayerTile(
  worldX: number,
  worldY: number,
  context: UpdateContext,
): boolean {
  const tile = context.worldToTile(worldX, worldY);
  return context.playerOccupiedTiles.some((occupiedTile) =>
    occupiedTile.x === tile.x && occupiedTile.y === tile.y);
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

function hashStringToOrbitDirection(value: string): -1 | 1 {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % 2 === 0 ? 1 : -1;
}

function normalizeTileBounds(
  minTileX: number,
  minTileY: number,
  maxTileX: number,
  maxTileY: number,
): { minTileX: number; minTileY: number; maxTileX: number; maxTileY: number } {
  return {
    minTileX: Math.min(minTileX, maxTileX),
    minTileY: Math.min(minTileY, maxTileY),
    maxTileX: Math.max(minTileX, maxTileX),
    maxTileY: Math.max(minTileY, maxTileY),
  };
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
