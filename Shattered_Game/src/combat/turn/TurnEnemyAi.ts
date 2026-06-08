import {
  advanceTurn,
  applyAction,
  getActiveParticipant,
} from './TurnCombatEngine';
import type { ActionOutcome, TurnAction, TurnCombatState } from './TurnCombatTypes';
import {
  getBestApproachTile,
  getAttackableTargets,
  type TurnTileContext,
} from './TurnActionValidator';

/**
 * Resolves a full enemy turn by applying actions until the enemy has no useful
 * moves left, then ends the turn. Returns all outcomes produced.
 *
 * Strategy (greedy):
 *   1. If player is in attack range → attack.
 *   2. Else if still has MP → move toward player, then try to attack.
 *   3. If nothing useful left → end turn.
 */
export function resolveEnemyTurn(
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): { outcomes: ActionOutcome[]; state: TurnCombatState } {
  const outcomes: ActionOutcome[] = [];
  let current = state;

  // Safety cap to prevent any possible infinite loop
  const MAX_STEPS = 10;

  for (let step = 0; step < MAX_STEPS; step++) {
    const actor = getActiveParticipant(current);
    if (!actor || actor.kind !== 'enemy') break;
    if (current.phase === 'combat_ended') break;

    const action = chooseEnemyAction(current, tileCtx);
    const { outcome, state: next } = applyAction(current, action, tileCtx);
    outcomes.push(outcome);
    current = next;

    if (
      outcome.kind === 'turn_ended' ||
      outcome.kind === 'combat_ended' ||
      outcome.kind === 'fled'
    ) {
      break;
    }
  }

  // If we hit the cap without ending the turn, force it
  if (current.phase !== 'combat_ended') {
    const actor = getActiveParticipant(current);
    if (actor?.kind === 'enemy') {
      const { outcome, state: next } = advanceTurn(current);
      outcomes.push(outcome);
      current = next;
    }
  }

  return { outcomes, state: current };
}

/**
 * Picks a single action for the active enemy participant.
 * Exported for unit testing.
 */
export function chooseEnemyAction(
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): TurnAction {
  const actor = getActiveParticipant(state);
  if (!actor || actor.kind !== 'enemy') return { kind: 'end_turn' };

  // 1. Can we attack right now?
  const targets = getAttackableTargets(actor, state);
  if (targets.length > 0 && actor.apRemaining > 0) {
    // Prefer the player; fall back to any attackable target
    const playerTarget = targets.find((t) => t.kind === 'player') ?? targets[0];
    return { kind: 'attack', targetId: playerTarget.id };
  }

  // 2. Should we end turn? (no AP and no MP left)
  if (actor.apRemaining <= 0 && actor.mpRemaining <= 0) {
    return { kind: 'end_turn' };
  }

  // 3. Move toward the closest player tile
  const player = state.participants.find((p) => p.kind === 'player' && p.hp > 0);
  if (player && actor.mpRemaining > 0) {
    const approachTile = getBestApproachTile(
      actor,
      player.tileX,
      player.tileY,
      state,
      tileCtx,
    );
    if (approachTile) {
      return { kind: 'move', toTileX: approachTile.x, toTileY: approachTile.y };
    }
  }

  // 4. Nothing useful — end turn
  return { kind: 'end_turn' };
}
