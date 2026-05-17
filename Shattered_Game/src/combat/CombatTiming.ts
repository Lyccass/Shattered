export type CombatActionPhase = 'windup' | 'active' | 'recovery' | 'complete';

export type AttackTimingDefinition = {
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
};

export function getAttackTotalDuration(timing: AttackTimingDefinition): number {
  return timing.windupMs + timing.activeMs + timing.recoveryMs;
}

export function getAttackPhaseAtElapsed(
  timing: AttackTimingDefinition,
  elapsedMs: number,
): CombatActionPhase {
  if (elapsedMs < timing.windupMs) {
    return 'windup';
  }

  if (elapsedMs < timing.windupMs + timing.activeMs) {
    return 'active';
  }

  if (elapsedMs < getAttackTotalDuration(timing)) {
    return 'recovery';
  }

  return 'complete';
}
