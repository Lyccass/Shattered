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
    health: Math.max(0, state.health - amount),
  };

  if (nextState.health > 0) {
    return { state: nextState, hit: true, killed: false, currentHp: nextState.health };
  }

  nextState.health = 0;
  nextState.currentState = 'dead';
  nextState.currentAttackId = null;
  nextState.attackTargetWorldX = null;
  nextState.attackTargetWorldY = null;
  nextState.attackRotationRad = null;
  nextState.phaseStartedAtMs = nowMs;
  nextState.phaseEndsAtMs = nowMs + deathResetDelayMs;
  nextState.telegraphId = null;
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
    attackCooldownEndsAtMs: Object.fromEntries(
      definition.attacks.map((attack) => [attack.id, 0]),
    ),
    phaseStartedAtMs: null,
    phaseEndsAtMs: null,
    telegraphId: null,
  };
}
