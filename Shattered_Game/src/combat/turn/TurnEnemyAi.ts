import {
  advanceTurn,
  applyAction,
  getActiveParticipant,
  resolvePendingTelegraphsForActor,
} from './TurnCombatEngine';
import type { ActionOutcome, TurnAction, TurnAttack, TurnCombatState, TurnParticipant } from './TurnCombatTypes';
import {
  chebyshevDist,
  getBestApproachTile,
  getAttackableTargets,
  getReachableTiles,
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

  // 3. Retreat when critically low HP (< 25%)
  if (actor.maxHp > 0 && actor.hp / actor.maxHp < 0.25 && actor.mpRemaining > 0) {
    const retreatTile = findRetreatTile(actor, state, tileCtx);
    if (retreatTile) {
      return { kind: 'move', toTileX: retreatTile.x, toTileY: retreatTile.y };
    }
  }

  // 4. Move toward the nearest non-enemy target, preferring flanking positions
  const moveTarget = pickMoveTarget(actor, state);
  if (moveTarget && actor.mpRemaining > 0) {
    const approachTile = getFlankOrBestApproachTile(actor, moveTarget, state, tileCtx);
    if (approachTile) {
      return { kind: 'move', toTileX: approachTile.x, toTileY: approachTile.y };
    }
  }

  // 5. Nothing useful — end turn
  return { kind: 'end_turn' };
}

function pickMoveTarget(actor: TurnParticipant, state: TurnCombatState): TurnParticipant | null {
  const threats = state.participants.filter(
    (p) => (p.kind === 'player' || p.kind === 'companion') && p.hp > 0,
  );
  if (threats.length === 0) return null;
  return threats.reduce<TurnParticipant>((best, p) => {
    const distP    = chebyshevDist(actor.tileX, actor.tileY, p.tileX, p.tileY);
    const distBest = chebyshevDist(actor.tileX, actor.tileY, best.tileX, best.tileY);
    if (distP < distBest) return p;
    // prefer player at equal distance
    if (distP === distBest && p.kind === 'player') return p;
    return best;
  }, threats[0]);
}

/**
 * Find the best approach tile, preferring flanking positions (behind/side of target)
 * over purely-closest tiles when the difference is at most 1 step.
 */
function getFlankOrBestApproachTile(
  actor: TurnParticipant,
  moveTarget: TurnParticipant,
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): { x: number; y: number } | null {
  const best = getBestApproachTile(actor, moveTarget.tileX, moveTarget.tileY, state, tileCtx);
  if (!best) return null;

  const bestDist = chebyshevDist(best.x, best.y, moveTarget.tileX, moveTarget.tileY);
  const reachable = getReachableTiles(actor, state, tileCtx);

  let topScore = getFlankScore(best, moveTarget);
  let topTile = best;

  for (const tile of reachable) {
    const distToTarget = chebyshevDist(tile.x, tile.y, moveTarget.tileX, moveTarget.tileY);
    // Accept tiles up to 1 further than the optimal approach distance
    if (distToTarget > bestDist + 1) continue;
    const score = getFlankScore(tile, moveTarget);
    if (score > topScore) {
      topScore = score;
      topTile = tile;
    }
  }

  return topTile;
}

/**
 * Higher score = better flanking position (behind or side of target).
 * Ranges roughly −1 (head-on) to +1 (directly behind).
 */
function getFlankScore(tile: { x: number; y: number }, target: TurnParticipant): number {
  const dx = tile.x - target.tileX;
  const dy = tile.y - target.tileY;
  if (dx === 0 && dy === 0) return 0;
  const len = Math.hypot(dx, dy);
  const relX = dx / len;
  const relY = dy / len;
  const facingX = target.facingX ?? 0;
  const facingY = target.facingY ?? 1;
  // Negative alignment = attacker is behind target (good for attacker)
  return -(facingX * relX + facingY * relY);
}

/**
 * Try to move to a tile that maximises minimum distance from all threats.
 * Only returns a tile if it genuinely increases the enemy's safety.
 */
function findRetreatTile(
  actor: TurnParticipant,
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): { x: number; y: number } | null {
  const threats = state.participants.filter(
    (p) => (p.kind === 'player' || p.kind === 'companion') && p.hp > 0,
  );
  if (threats.length === 0) return null;

  const reachable = getReachableTiles(actor, state, tileCtx);
  if (reachable.length === 0) return null;

  const currentMinDist = Math.min(
    ...threats.map((t) => chebyshevDist(actor.tileX, actor.tileY, t.tileX, t.tileY)),
  );

  let bestMinDist = currentMinDist;
  let bestTile: { x: number; y: number } | null = null;

  for (const tile of reachable) {
    const minDist = Math.min(
      ...threats.map((t) => chebyshevDist(tile.x, tile.y, t.tileX, t.tileY)),
    );
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestTile = tile;
    }
  }

  return bestTile;
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
      .sort((a, b) => scoreAttack(b, target.mpRemaining) - scoreAttack(a, target.mpRemaining))[0] ?? null;
    if (attack) return { target, attack };
  }

  return null;
}

function scoreAttack(
  attack: {
    damage: number;
    maxRangeTiles: number;
    cooldownTurns?: number;
    statusEffect?: unknown;
    telegraph?: unknown;
    forcedMovement?: unknown;
  },
  targetMp = 0,
): number {
  // Telegraph attacks are valuable when the target can dodge (has MP), less so when they can't
  const telegraphBonus = attack.telegraph ? (targetMp > 0 ? 1.5 : -0.5) : 0;
  return attack.damage
    + (attack.statusEffect ? 2 : 0)
    + telegraphBonus
    + (attack.forcedMovement ? 0.75 : 0)
    + (attack.cooldownTurns && attack.cooldownTurns > 0 ? 0.5 : 0)
    + attack.maxRangeTiles * 0.1;
}
