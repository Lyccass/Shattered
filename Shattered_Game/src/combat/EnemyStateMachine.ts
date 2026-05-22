import {
  handleEnemyActive,
  handleEnemyAggro,
  handleEnemyApproach,
  handleEnemyIdle,
  handleEnemyRecovery,
  handleEnemyReset,
  handleEnemyWindup,
} from './EnemyStateTransitions';
import { angleTo, hashStringToOrbitDirection } from './EnemyStateMath';
import type {
  EnemyAdvanceResult,
  EnemyUpdateContext,
  EnemyUpdateEvent,
} from './EnemyStateMachineTypes';
import type {
  EnemyDefinition,
  EnemyRuntimeState,
  EnemySpawnDefinition,
} from './EnemyTypes';

export type { EnemyUpdateEvent } from './EnemyStateMachineTypes';

type UpdateContext = EnemyUpdateContext;
type AdvanceResult = EnemyAdvanceResult<EnemyRuntimeState>;

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
    settleUntilMs: 0,
    attackCooldownEndsAtMs: Object.fromEntries(
      definition.attacks.map((attack) => [attack.id, 0]),
    ),
    globalCooldownEndsAtMs: 0,
    phaseStartedAtMs: null,
    phaseEndsAtMs: null,
    telegraphId: null,
    attackResolved: false,
    jumpOriginWorldX: null,
    jumpOriginWorldY: null,
    jumpLandingWorldX: null,
    jumpLandingWorldY: null,
    reactiveAggro: false,
    leashAnchorWorldX: originWorldX,
    leashAnchorWorldY: originWorldY,
    wanderTargetWorldX: null,
    wanderTargetWorldY: null,
    nextWanderMs: 0,
    nextRegenMs: 0,
  };
}

export function advanceEnemyStateMachine(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: UpdateContext,
): AdvanceResult {
  const nextState = { ...state, attackCooldownEndsAtMs: { ...state.attackCooldownEndsAtMs } };
  const events: EnemyUpdateEvent[] = [];
  nextState.facingRad = angleTo(nextState.worldX, nextState.worldY, context.playerWorldX, context.playerWorldY);

  switch (nextState.currentState) {
    case 'idle':
      handleEnemyIdle({ definition, state: nextState, context, events });
      break;

    case 'aggro':
      handleEnemyAggro({ definition, state: nextState, context, events });
      break;

    case 'approach':
      handleEnemyApproach({ definition, state: nextState, context, events });
      break;

    case 'windup':
      handleEnemyWindup({ definition, state: nextState, context, events });
      break;

    case 'active':
      handleEnemyActive({ definition, state: nextState, context, events });
      break;

    case 'recovery':
      handleEnemyRecovery({ definition, state: nextState, context, events });
      break;

    case 'reset':
      handleEnemyReset({ definition, state: nextState, context, events });
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
