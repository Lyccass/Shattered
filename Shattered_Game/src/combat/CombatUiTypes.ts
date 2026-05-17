import type { EnemyUiSnapshot } from './EnemyTypes';
import type { PlayerCombatSnapshot } from './PlayerCombatState';

export type CombatUiSnapshot = {
  active: boolean;
  player: PlayerCombatSnapshot;
  enemy: EnemyUiSnapshot | null;
};
