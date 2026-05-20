import { worldDistanceToTiles } from './EnemyStateMath';
import type { EnemyUpdateContext } from './EnemyStateMachineTypes';
import type { EnemyAttackDefinition, EnemyDefinition, EnemyRuntimeState } from './EnemyTypes';

export function selectEnemyAttack(
  definition: EnemyDefinition,
  state: EnemyRuntimeState,
  context: EnemyUpdateContext,
  distanceToPlayer: number,
): EnemyAttackDefinition | null {
  if (context.nowMs < state.settleUntilMs) {
    return null;
  }

  const readyAttacks = definition.attacks.filter((attack) => {
    const distanceTiles = worldDistanceToTiles(
      distanceToPlayer,
      context.tileWidth,
      context.tileHeight,
    );
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
