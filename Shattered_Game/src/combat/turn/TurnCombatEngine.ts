import type {
  ActionOutcome,
  CombatEndReason,
  StatusEffect,
  TurnAttack,
  TurnAttackUiSnapshot,
  TurnAction,
  TurnCombatState,
  TurnCombatUiSnapshot,
  TurnParticipant,
  TurnParticipantUiSnapshot,
  TurnPhase,
} from './TurnCombatTypes';
import {
  getUsableAttacks,
  isValidAttack,
  isValidMove,
  type TurnTileContext,
} from './TurnActionValidator';

// ─── Combat creation ──────────────────────────────────────────────────────────

/**
 * Builds the initial TurnCombatState from a list of participants.
 * Shuffles initiative with a random 1–6 bonus so each fight feels different.
 */
export function createCombatState(participants: TurnParticipant[]): TurnCombatState {
  const withRoll = participants.map((p) => ({
    ...p,
    statusEffects: [...p.statusEffects],
    attacks: cloneAttacks(p.attacks),
    attackCooldowns: { ...(p.attackCooldowns ?? {}) },
    initiative: p.initiative + Math.floor(Math.random() * 6) + 1,
  }));

  withRoll.sort((a, b) => a.initiative - b.initiative);

  const firstPhase: TurnPhase =
    withRoll[0]?.kind === 'player' ? 'player_turn' : 'enemy_turn';

  return {
    participants: withRoll,
    turnOrderIds: withRoll.map((p) => p.id),
    activeIndex: 0,
    round: 1,
    phase: firstPhase,
  };
}

// ─── Action application ───────────────────────────────────────────────────────

export function applyAction(
  state: TurnCombatState,
  action: TurnAction,
  tileCtx: TurnTileContext,
): { outcome: ActionOutcome; state: TurnCombatState } {
  const active = getActiveParticipant(state);

  if (!active) {
    return {
      outcome: { kind: 'invalid', actorId: '', reason: 'No active participant.' },
      state,
    };
  }

  if (active.hp <= 0) {
    return advanceTurn(state);
  }

  // Stunned participants cannot act — force end-turn
  const isStunned = active.statusEffects.some((e) => e.kind === 'stunned');

  if (isStunned && action.kind !== 'end_turn') {
    const { outcome, state: next } = advanceTurn(state);
    return { outcome, state: next };
  }

  switch (action.kind) {
    case 'move':    return applyMove(state, active, action.toTileX, action.toTileY, tileCtx);
    case 'attack':  return applyAttack(state, active, action.targetId, action.attackId);
    case 'guard':   return applyGuard(state, active);
    case 'end_turn': return advanceTurn(state);
    case 'flee':    return applyFlee(state, active);
  }
}

// ─── Turn advancement ─────────────────────────────────────────────────────────

/**
 * Ends the current participant's turn and moves to the next.
 * Ticks status effects at the START of each participant's turn.
 * Wraps around when all participants have acted (increments round).
 */
export function advanceTurn(
  state: TurnCombatState,
): { outcome: ActionOutcome; state: TurnCombatState } {
  const actorId = state.turnOrderIds[state.activeIndex] ?? '';
  let next = cloneState(state);

  const preAdvanceEndCheck = checkCombatEnd(next);
  if (preAdvanceEndCheck) {
    return {
      outcome: { kind: 'combat_ended', reason: preAdvanceEndCheck },
      state: { ...next, phase: 'combat_ended', endReason: preAdvanceEndCheck },
    };
  }

  const nextIndex = findNextLivingTurnIndex(next);
  if (nextIndex === null) {
    return {
      outcome: { kind: 'combat_ended', reason: 'victory' },
      state: { ...next, phase: 'combat_ended', endReason: 'victory' },
    };
  }

  const isNewRound = nextIndex <= next.activeIndex;
  next.activeIndex = nextIndex;
  if (isNewRound) next.round += 1;

  // Tick status effects for the participant about to act
  next = tickStatusEffects(next, next.turnOrderIds[nextIndex]);

  // Restore AP/MP for the participant now taking their turn
  next = restoreResources(next, next.turnOrderIds[nextIndex]);

  // Check for post-tick deaths (bleeding)
  const endCheck = checkCombatEnd(next);
  if (endCheck) {
    return {
      outcome: { kind: 'combat_ended', reason: endCheck },
      state: { ...next, phase: 'combat_ended', endReason: endCheck },
    };
  }

  const nextParticipant = next.participants.find(
    (p) => p.id === next.turnOrderIds[nextIndex],
  );
  next.phase = nextParticipant?.kind === 'player' ? 'player_turn' : 'enemy_turn';

  return {
    outcome: {
      kind: 'turn_ended',
      actorId,
      nextParticipantId: next.turnOrderIds[nextIndex] ?? null,
    },
    state: next,
  };
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getActiveParticipant(state: TurnCombatState): TurnParticipant | null {
  return (
    state.participants.find((p) => p.id === state.turnOrderIds[state.activeIndex]) ?? null
  );
}

export function buildUiSnapshot(state: TurnCombatState | null): TurnCombatUiSnapshot {
  if (!state || state.phase === 'combat_ended') {
    return {
      active: false,
      phase: 'combat_ended',
      round: 0,
      player: null,
      playerCurrentHp: null,
      playerMaxHp: null,
      isSprinting: false,
      isAttackMode: false,
      selectedAttackId: null,
      activeParticipantId: null,
      turnOrder: [],
    };
  }

  const activeId = state.turnOrderIds[state.activeIndex] ?? null;
  const player = state.participants.find((p) => p.kind === 'player') ?? null;

  const toUiSnap = (p: TurnParticipant): TurnParticipantUiSnapshot => {
    const attacks: TurnAttackUiSnapshot[] = (p.attacks ?? []).map((attack) => ({
      id: attack.id,
      displayName: attack.displayName,
      apCost: attack.apCost,
      minRangeTiles: attack.minRangeTiles,
      maxRangeTiles: attack.maxRangeTiles,
      cooldownRemaining: p.attackCooldowns?.[attack.id] ?? 0,
    }));

    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      hp: p.hp,
      maxHp: p.maxHp,
      apRemaining: p.apRemaining,
      apMax: p.apMax,
      mpRemaining: p.mpRemaining,
      mpMax: p.mpMax,
      secondaryActionRemaining: p.secondaryActionRemaining ?? 0,
      secondaryActionMax: p.secondaryActionMax ?? 0,
      statusEffects: p.statusEffects,
      attacks,
      attackCooldowns: { ...(p.attackCooldowns ?? {}) },
      isActive: p.id === activeId,
    };
  };

  return {
    active: true,
    phase: state.phase,
    round: state.round,
    player: player ? toUiSnap(player) : null,
    playerCurrentHp: player?.hp ?? null,
    playerMaxHp: player?.maxHp ?? null,
    isSprinting: false,
    isAttackMode: false,
    selectedAttackId: null,
    activeParticipantId: activeId,
    turnOrder: state.participants.map(toUiSnap),
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function applyMove(
  state: TurnCombatState,
  actor: TurnParticipant,
  toTileX: number,
  toTileY: number,
  tileCtx: TurnTileContext,
): { outcome: ActionOutcome; state: TurnCombatState } {
  if (!isValidMove(actor, toTileX, toTileY, state, tileCtx)) {
    return {
      outcome: { kind: 'invalid', actorId: actor.id, reason: 'Tile not reachable.' },
      state,
    };
  }

  const fromTile = { x: actor.tileX, y: actor.tileY };
  const toTile   = { x: toTileX,     y: toTileY };

  const stepCost = Math.max(
    Math.abs(toTileX - actor.tileX),
    Math.abs(toTileY - actor.tileY),
  );

  const next = updateParticipant(state, actor.id, {
    tileX: toTileX,
    tileY: toTileY,
    mpRemaining: Math.max(0, actor.mpRemaining - stepCost),
  });

  return { outcome: { kind: 'moved', actorId: actor.id, fromTile, toTile }, state: next };
}

function applyAttack(
  state: TurnCombatState,
  actor: TurnParticipant,
  targetId: string,
  attackId: string | undefined,
): { outcome: ActionOutcome; state: TurnCombatState } {
  if (!isValidAttack(actor, targetId, state, attackId)) {
    return {
      outcome: { kind: 'invalid', actorId: actor.id, reason: 'Attack is on cooldown, target is out of range, or no AP remains.' },
      state,
    };
  }

  const target = state.participants.find((p) => p.id === targetId);
  if (!target) {
    return {
      outcome: { kind: 'invalid', actorId: actor.id, reason: 'Target not found.' },
      state,
    };
  }

  const attack = selectUsableAttack(actor, target, attackId);
  if (!attack) {
    return {
      outcome: { kind: 'invalid', actorId: actor.id, reason: 'No usable attack found.' },
      state,
    };
  }

  // Hit roll: target armour against this attack type reduces hit chance.
  const armourRating = getTargetArmourRating(target, attack.damageType);
  const hitChance = Math.max(10, (attack.hitChance ?? actor.hitChance ?? 80) - armourRating * 5);
  const hitResult = rollAttackHit(attack, hitChance);
  const hit = hitResult.hit;
  const damage = hitResult.damage;
  const statusApplied = hit && attack.statusEffect
    ? {
        kind: attack.statusEffect.kind,
        turnsRemaining: attack.statusEffect.turns,
        value: attack.statusEffect.value,
      }
    : undefined;

  let nextHp = Math.max(0, target.hp - damage);
  const killed = hit && nextHp <= 0;

  const nextCooldowns = {
    ...(actor.attackCooldowns ?? {}),
    ...getAttackCooldownPatch(attack),
  };

  let next = updateParticipant(state, actor.id, {
    apRemaining: Math.max(0, actor.apRemaining - attack.apCost),
    attackCooldowns: nextCooldowns,
  });

  next = updateParticipant(next, targetId, {
    hp: nextHp,
    ...(statusApplied && !killed
      ? { statusEffects: [...target.statusEffects, statusApplied] }
      : {}),
  });

  // Check win condition before resolving status
  const endCheck = checkCombatEnd(next);
  if (endCheck) {
    return {
      outcome: {
        kind: 'attacked',
        actorId: actor.id,
        targetId,
        attackId: attack.id,
        attackName: attack.displayName,
        damage,
        hit,
        killed,
        statusApplied,
      },
      state: { ...next, phase: 'combat_ended', endReason: endCheck },
    };
  }

  return {
    outcome: {
      kind: 'attacked',
      actorId: actor.id,
      targetId,
      attackId: attack.id,
      attackName: attack.displayName,
      damage,
      hit,
      killed,
      statusApplied,
    },
    state: next,
  };
}

function applyFlee(
  state: TurnCombatState,
  actor: TurnParticipant,
): { outcome: ActionOutcome; state: TurnCombatState } {
  // Flee always succeeds for the player — exits combat, enemy resets
  const next = { ...cloneState(state), phase: 'combat_ended' as TurnPhase, endReason: 'player_fled' as const };
  return { outcome: { kind: 'fled', actorId: actor.id }, state: next };
}

function applyGuard(
  state: TurnCombatState,
  actor: TurnParticipant,
): { outcome: ActionOutcome; state: TurnCombatState } {
  if (actor.apRemaining <= 0) {
    return {
      outcome: { kind: 'invalid', actorId: actor.id, reason: 'No Main Action remaining.' },
      state,
    };
  }

  const statusApplied: StatusEffect = {
    kind: 'guarded',
    turnsRemaining: 1,
    value: 4,
  };
  const next = updateParticipant(state, actor.id, {
    apRemaining: Math.max(0, actor.apRemaining - 1),
    statusEffects: [
      ...actor.statusEffects.filter((effect) => effect.kind !== 'guarded'),
      statusApplied,
    ],
  });

  return { outcome: { kind: 'guarded', actorId: actor.id, statusApplied }, state: next };
}

function tickStatusEffects(
  state: TurnCombatState,
  participantId: string,
): TurnCombatState {
  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant) return state;

  let hpDelta = 0;
  let mpReduction = 0;
  const updated: StatusEffect[] = [];

  for (const effect of participant.statusEffects) {
    if (effect.kind === 'bleeding' || effect.kind === 'damage_over_time') hpDelta += effect.value;
    if (effect.kind === 'slowed')   mpReduction += effect.value;

    if (effect.turnsRemaining > 1) {
      updated.push({ ...effect, turnsRemaining: effect.turnsRemaining - 1 });
    }
    // Expired effects are dropped
  }

  return updateParticipant(state, participantId, {
    hp: Math.max(0, participant.hp - hpDelta),
    statusEffects: updated,
    mpRemaining: Math.max(0, participant.mpRemaining - mpReduction),
  });
}

function restoreResources(state: TurnCombatState, participantId: string): TurnCombatState {
  const p = state.participants.find((pp) => pp.id === participantId);
  if (!p) return state;

  const slowedReduction = p.statusEffects
    .filter((e) => e.kind === 'slowed')
    .reduce((sum, e) => sum + e.value, 0);

  return updateParticipant(state, participantId, {
    apRemaining: p.apMax,
    secondaryActionRemaining: p.secondaryActionMax ?? 0,
    mpRemaining: Math.max(0, p.mpMax - slowedReduction),
    attackCooldowns: tickAttackCooldowns(p.attackCooldowns),
  });
}

function checkCombatEnd(state: TurnCombatState): CombatEndReason | null {
  const player = state.participants.find((p) => p.kind === 'player');
  if (player && player.hp <= 0) return 'player_died';

  const livingEnemies = state.participants.filter(
    (p) => p.kind === 'enemy' && p.hp > 0,
  );
  if (livingEnemies.length === 0) return 'victory';

  return null;
}

function findNextLivingTurnIndex(state: TurnCombatState): number | null {
  if (state.turnOrderIds.length === 0) return null;

  for (let offset = 1; offset <= state.turnOrderIds.length; offset += 1) {
    const index = (state.activeIndex + offset) % state.turnOrderIds.length;
    const participant = state.participants.find((p) => p.id === state.turnOrderIds[index]);
    if (participant && participant.hp > 0) {
      return index;
    }
  }

  return null;
}

function selectUsableAttack(
  actor: TurnParticipant,
  target: TurnParticipant,
  attackId: string | undefined,
): TurnAttack | null {
  const attacks = getUsableAttacks(actor, target);
  if (attackId) {
    return attacks.find((attack) => attack.id === attackId) ?? null;
  }

  return attacks[0] ?? null;
}

function getTargetArmourRating(
  target: TurnParticipant,
  damageType: TurnAttack['damageType'],
): number {
  const typedDefence = (() => {
    switch (damageType) {
      case 'slash':  return target.slashDefence ?? target.defensePower;
      case 'pierce': return target.pierceDefence ?? target.defensePower;
      case 'crush':  return target.crushDefence ?? target.defensePower;
      default:       return target.defensePower;
    }
  })();

  const guardBonus = target.statusEffects
    .filter((effect) => effect.kind === 'guarded')
    .reduce((sum, effect) => sum + effect.value, 0);

  return typedDefence + guardBonus;
}

function tickAttackCooldowns(cooldowns: Record<string, number> | undefined): Record<string, number> {
  if (!cooldowns) return {};

  const next: Record<string, number> = {};
  for (const [attackId, remaining] of Object.entries(cooldowns)) {
    const decremented = Math.max(0, remaining - 1);
    if (decremented > 0) {
      next[attackId] = decremented;
    }
  }

  return next;
}

function getAttackCooldownPatch(attack: TurnAttack): Record<string, number> {
  if (attack.cooldownTurns && attack.cooldownTurns > 0) {
    return { [attack.id]: attack.cooldownTurns + 1 };
  }

  if (attack.oncePerTurn) {
    return { [attack.id]: 1 };
  }

  return {};
}

/** Roll 1 to maxHit inclusive so a successful hit always produces feedback. */
function rollDamage(attackPower: number): number {
  return Math.floor(Math.random() * Math.max(1, attackPower)) + 1;
}

function rollAttackHit(attack: TurnAttack, hitChance: number): { hit: boolean; damage: number } {
  const hitCount = Math.max(1, Math.floor(attack.hitCount ?? 1));
  let damage = 0;

  for (let i = 0; i < hitCount; i += 1) {
    if (Math.random() * 100 < hitChance) {
      damage += rollDamage(attack.damage);
    }
  }

  return { hit: damage > 0, damage };
}

// ─── Immutable state helpers ──────────────────────────────────────────────────

function updateParticipant(
  state: TurnCombatState,
  id: string,
  patch: Partial<TurnParticipant>,
): TurnCombatState {
  return {
    ...state,
    participants: state.participants.map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    ),
  };
}

function cloneState(state: TurnCombatState): TurnCombatState {
  return {
    ...state,
    participants: state.participants.map((p) => ({
      ...p,
      statusEffects: [...p.statusEffects],
      attacks: cloneAttacks(p.attacks),
      attackCooldowns: { ...(p.attackCooldowns ?? {}) },
    })),
  };
}

function cloneAttacks(attacks: TurnAttack[] | undefined): TurnAttack[] | undefined {
  return attacks?.map((attack) => ({
    ...attack,
    statusEffect: attack.statusEffect ? { ...attack.statusEffect } : undefined,
  }));
}
