import type { EnemyDefinition, EnemyRuntimeState } from './EnemyTypes';

export function applyEnemyDamage(
  state: EnemyRuntimeState,
  amount: number,
  nowMs: number,
  deathResetDelayMs: number,
): { state: EnemyRuntimeState; hit: boolean; killed: boolean; currentHp: number } {
  if (state.currentState === 'dead') {
    return { state, hit: false, killed: false, currentHp: state.health };
  }

  const nextState: EnemyRuntimeState = {
    ...state,
    attackCooldownEndsAtMs: { ...state.attackCooldownEndsAtMs },
    globalCooldownEndsAtMs: state.globalCooldownEndsAtMs,
    health: Math.max(0, state.health - amount),
  };

  if (nextState.health > 0) {
    nextState.leashAnchorWorldX = state.worldX;
    nextState.leashAnchorWorldY = state.worldY;
    return { state: nextState, hit: true, killed: false, currentHp: nextState.health };
  }

  nextState.health = 0;
  nextState.currentState = 'dead';
  nextState.currentAttackId = null;
  nextState.attackTargetWorldX = null;
  nextState.attackTargetWorldY = null;
  nextState.attackRotationRad = null;
  nextState.attackTargetTiles = [];
  nextState.phaseStartedAtMs = nowMs;
  nextState.phaseEndsAtMs = nowMs + deathResetDelayMs;
  nextState.telegraphId = null;
  nextState.attackResolved = false;
  return { state: nextState, hit: true, killed: true, currentHp: 0 };
}

export function shouldRespawnEnemy(state: EnemyRuntimeState, nowMs: number): boolean {
  return state.currentState === 'dead' && state.phaseEndsAtMs !== null && nowMs >= state.phaseEndsAtMs;
}

export function resetEnemyRuntimeState(
  state: EnemyRuntimeState,
  definition: EnemyDefinition,
): EnemyRuntimeState {
  return {
    ...state,
    worldX: state.originWorldX,
    worldY: state.originWorldY,
    currentState: 'idle',
    health: definition.maxHealth,
    facingRad: 0,
    currentAttackId: null,
    attackTargetWorldX: null,
    attackTargetWorldY: null,
    attackRotationRad: null,
    attackTargetTiles: [],
    orbitDirection: state.orbitDirection,
    attackCooldownEndsAtMs: Object.fromEntries(
      definition.attacks.map((attack) => [attack.id, 0]),
    ),
    globalCooldownEndsAtMs: 0,
    phaseStartedAtMs: null,
    phaseEndsAtMs: null,
    telegraphId: null,
    attackResolved: false,
    reactiveAggro: false,
    leashAnchorWorldX: state.originWorldX,
    leashAnchorWorldY: state.originWorldY,
    wanderTargetWorldX: null,
    wanderTargetWorldY: null,
    nextWanderMs: 0,
    nextRegenMs: 0,
  };
}
