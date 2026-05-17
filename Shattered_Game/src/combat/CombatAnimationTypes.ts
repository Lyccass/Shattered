export type CombatAnimationStateId =
  | 'idle'
  | 'move'
  | 'attack_windup'
  | 'attack_active'
  | 'attack_recovery'
  | 'dodge'
  | 'hurt'
  | 'dead';

export type CombatAnimationSnapshot = {
  state: CombatAnimationStateId;
  lockedUntilMs: number | null;
};
