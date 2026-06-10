import {
  advanceTurn,
  applyAction,
  getActiveParticipant,
  resolvePendingTelegraphsForActor,
} from './TurnCombatEngine';
import type { ActionOutcome, TurnAction, TurnAttack, TurnCombatState, TurnParticipant } from './TurnCombatTypes';
import {
  getBestApproachTile,
  getAttackableTargets,
  getUsableAttacks,
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
    const resolved = resolveEnemyTurnStep(current, tileCtx);
    outcomes.push(...resolved.outcomes);
    current = resolved.state;

    if (
      resolved.turnComplete ||
      current.phase !== 'enemy_turn'
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
 * Resolves one useful enemy action. The session calls this between animation
 * beats so movement can visibly finish before the next AI decision happens.
 */
export function resolveEnemyTurnStep(
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): { outcomes: ActionOutcome[]; state: TurnCombatState; turnComplete: boolean } {
  const actor = getActiveParticipant(state);
  if (!actor || actor.kind !== 'enemy' || state.phase === 'combat_ended') {
    return { outcomes: [], state, turnComplete: true };
  }

  const resolved = resolvePendingTelegraphsForActor(state, actor.id, tileCtx);
  if (resolved.outcomes.length > 0) {
    if (resolved.state.phase === 'combat_ended') {
      return { outcomes: resolved.outcomes, state: resolved.state, turnComplete: true };
    }
    return { outcomes: resolved.outcomes, state: resolved.state, turnComplete: false };
  }

  const action = chooseEnemyAction(state, tileCtx);
  const { outcome, state: next } = applyAction(state, action, tileCtx);

  if (outcome.kind === 'invalid') {
    const ended = advanceTurn(next);
    return {
      outcomes: [outcome, ended.outcome],
      state: ended.state,
      turnComplete: true,
    };
  }

  if (outcome.kind === 'moved') {
    return { outcomes: [outcome], state: next, turnComplete: false };
  }

  if (outcome.kind === 'attacked' || outcome.kind === 'telegraph_prepared') {
    if (next.phase === 'combat_ended') {
      return { outcomes: [outcome], state: next, turnComplete: true };
    }
    const ended = advanceTurn(next);
    return {
      outcomes: [outcome, ended.outcome],
      state: ended.state,
      turnComplete: true,
    };
  }

  return {
    outcomes: [outcome],
    state: next,
    turnComplete: outcome.kind === 'turn_ended' ||
      outcome.kind === 'combat_ended' ||
      outcome.kind === 'fled' ||
      next.phase !== 'enemy_turn',
  };
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
  const attackChoice = chooseBestTargetAttack(actor, state);
  if (attackChoice) {
    return {
      kind: 'attack',
      targetId: attackChoice.target.id,
      attackId: attackChoice.attack.id,
    };
  }

  // 2. Should we end turn? (no AP and no MP left)
  if (actor.apRemaining <= 0 && actor.mpRemaining <= 0) {
    return { kind: 'end_turn' };
  }

  // 3. Move toward the nearest non-enemy target (player or companion)
  const moveTarget = pickMoveTarget(actor, state);
  if (moveTarget && actor.mpRemaining > 0) {
    const approachTile = getBestApproachTile(
      actor,
      moveTarget.tileX,
      moveTarget.tileY,
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

function pickMoveTarget(actor: TurnParticipant, state: TurnCombatState): TurnParticipant | null {
  const threats = state.participants.filter(
    (p) => (p.kind === 'player' || p.kind === 'companion') && p.hp > 0,
  );
  if (threats.length === 0) return null;
  return threats.reduce<TurnParticipant>((best, p) => {
    const distP = Math.abs(p.tileX - actor.tileX) + Math.abs(p.tileY - actor.tileY);
    const distBest = Math.abs(best.tileX - actor.tileX) + Math.abs(best.tileY - actor.tileY);
    if (distP < distBest) return p;
    // prefer player at equal distance
    if (distP === distBest && p.kind === 'player') return p;
    return best;
  }, threats[0]);
}

function chooseBestTargetAttack(
  actor: TurnParticipant,
  state: TurnCombatState,
): { target: TurnParticipant; attack: TurnAttack } | null {
  const targets = getAttackableTargets(actor, state)
    .slice()
    .sort((a, b) => Number(b.kind === 'player') - Number(a.kind === 'player'));

  for (const target of targets) {
    const attack = getUsableAttacks(actor, target)
      .slice()
      .sort((a, b) => scoreAttack(b) - scoreAttack(a))[0] ?? null;
    if (attack) return { target, attack };
  }

  return null;
}

function scoreAttack(attack: {
  damage: number;
  maxRangeTiles: number;
  cooldownTurns?: number;
  statusEffect?: unknown;
  telegraph?: unknown;
  forcedMovement?: unknown;
}): number {
  return attack.damage
    + (attack.statusEffect ? 2 : 0)
    + (attack.telegraph ? 1.5 : 0)
    + (attack.forcedMovement ? 0.75 : 0)
    + (attack.cooldownTurns && attack.cooldownTurns > 0 ? 0.5 : 0)
    + attack.maxRangeTiles * 0.1;
}
