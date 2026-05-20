import type { EnemyAttackDefinition, EnemyDefinition, EnemyRuntimeState } from './EnemyTypes';

export function getCurrentAttack(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
): EnemyAttackDefinition | null {
  if (!state.currentAttackId) {
    return null;
  }

  return definition.attacks.find((attack) => attack.id === state.currentAttackId) ?? null;
}

export function clearAttackState(state: EnemyRuntimeState): void {
  state.currentAttackId = null;
  state.attackTargetWorldX = null;
  state.attackTargetWorldY = null;
  state.attackRotationRad = null;
  state.attackTargetTiles = [];
  state.phaseStartedAtMs = null;
  state.telegraphId = null;
  state.attackResolved = false;
  state.jumpOriginWorldX = null;
  state.jumpOriginWorldY = null;
  state.jumpLandingWorldX = null;
  state.jumpLandingWorldY = null;
}
