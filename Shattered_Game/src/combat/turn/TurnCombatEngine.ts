import type {
  ActionOutcome,
  CombatEndReason,
  StatusEffect,
  PendingTurnTelegraph,
  TurnAttack,
  TurnAttackUiSnapshot,
  TurnAction,
  TurnCombatState,
  TurnCombatUiSnapshot,
  TurnForcedMovement,
  TurnParticipant,
  TurnTelegraphConfig,
  TurnTelegraphTile,
  TurnParticipantUiSnapshot,
  TurnPhase,
} from './TurnCombatTypes';
import {
  getMovePath,
  getUsableAttacks,
  isValidAttack,
  isValidMove,
  type TurnTileContext,
} from './TurnActionValidator';

const DIRS_8 = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
] as const;

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
    pendingTelegraphs: [],
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
    case 'attack':  return applyAttack(state, active, action.targetId, action.attackId, tileCtx);
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
  const ticked = tickStatusEffects(next, next.turnOrderIds[nextIndex]);
  next = ticked.state;

  // Restore AP/MP for the participant now taking their turn
  next = restoreResources(next, next.turnOrderIds[nextIndex]);

  // Check for post-tick deaths (bleeding)
  const endCheck = checkCombatEnd(next);
  if (endCheck) {
    return {
      outcome: { kind: 'combat_ended', reason: endCheck, statusTicks: ticked.outcomes },
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
      statusTicks: ticked.outcomes,
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

export function resolvePendingTelegraphsForActor(
  state: TurnCombatState,
  actorId: string,
  tileCtx: TurnTileContext,
): { outcomes: ActionOutcome[]; state: TurnCombatState } {
  const pendingTelegraphs = state.pendingTelegraphs ?? [];
  const pending = pendingTelegraphs.filter((telegraph) => telegraph.actorId === actorId);
  if (pending.length === 0) return { outcomes: [], state };

  const outcomes: ActionOutcome[] = [];
  let current: TurnCombatState = {
    ...cloneState(state),
    pendingTelegraphs: pendingTelegraphs.filter((telegraph) => telegraph.actorId !== actorId),
  };

  for (const telegraph of pending) {
    const actor = current.participants.find((p) => p.id === telegraph.actorId);
    const target = current.participants.find((p) => p.id === telegraph.targetId);
    if (!actor || !target || actor.hp <= 0 || target.hp <= 0) {
      outcomes.push(buildTelegraphResolvedOutcome(telegraph, false, 0, false, false));
      continue;
    }

    const hitTile = telegraph.tiles.find((tile) => tile.x === target.tileX && tile.y === target.tileY);
    if (!hitTile) {
      const actorMoved = getTelegraphActorLandingResult(current, actor, telegraph.targetTile, tileCtx);
      if (actorMoved) {
        current = updateParticipant(current, actor.id, {
          tileX: actorMoved.toTile.x,
          tileY: actorMoved.toTile.y,
        });
      }
      outcomes.push({
        ...buildTelegraphResolvedOutcome(telegraph, false, 0, false, false),
        ...(actorMoved ? { actorMoved } : {}),
      });
      continue;
    }

    const armourRating = getTargetArmourRating(target, telegraph.damageType);
    const hitChance = Math.max(10, (telegraph.hitChance ?? actor.hitChance ?? 80) - armourRating * 5);
    const hit = Math.random() * 100 < hitChance;
    const damage = hit
      ? Math.max(1, Math.ceil(rollDamage(telegraph.damage) * hitTile.damageMultiplier))
      : 0;
    const nextHp = Math.max(0, target.hp - damage);
    const killed = hit && nextHp <= 0;
    const statusApplied = hit && telegraph.statusEffect
      ? {
          kind: telegraph.statusEffect.kind,
          turnsRemaining: telegraph.statusEffect.turns,
          value: telegraph.statusEffect.value,
        }
      : undefined;

    current = updateParticipant(current, target.id, {
      hp: nextHp,
      ...(statusApplied && !killed
        ? { statusEffects: [...target.statusEffects, statusApplied] }
        : {}),
    });

    const pushed = hit && !killed && telegraph.forcedMovement
      ? getForcedMovementResult(current, actor, target.id, telegraph.forcedMovement, tileCtx, telegraph.originTile)
      : null;
    if (pushed) {
      current = updateParticipant(current, target.id, {
        tileX: pushed.toTile.x,
        tileY: pushed.toTile.y,
      });
    }

    const actorMoved = getTelegraphActorLandingResult(current, actor, telegraph.targetTile, tileCtx);
    if (actorMoved) {
      current = updateParticipant(current, actor.id, {
        tileX: actorMoved.toTile.x,
        tileY: actorMoved.toTile.y,
      });
    }

    outcomes.push({
      ...buildTelegraphResolvedOutcome(telegraph, true, damage, hit, killed, statusApplied),
      ...(pushed ? { pushed } : {}),
      ...(actorMoved ? { actorMoved } : {}),
    });

    const endCheck = checkCombatEnd(current);
    if (endCheck) {
      current = { ...current, phase: 'combat_ended', endReason: endCheck };
      outcomes.push({ kind: 'combat_ended', reason: endCheck });
      break;
    }
  }

  return { outcomes, state: current };
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
  const path = getMovePath(actor, toTileX, toTileY, state, tileCtx) ?? [toTile];

  const stepCost = Math.max(
    Math.abs(toTileX - actor.tileX),
    Math.abs(toTileY - actor.tileY),
  );

  const next = updateParticipant(state, actor.id, {
    tileX: toTileX,
    tileY: toTileY,
    mpRemaining: Math.max(0, actor.mpRemaining - stepCost),
    bleedMovementTiles: (actor.bleedMovementTiles ?? 0) + stepCost,
  });

  return { outcome: { kind: 'moved', actorId: actor.id, fromTile, toTile, path }, state: next };
}

function applyAttack(
  state: TurnCombatState,
  actor: TurnParticipant,
  targetId: string,
  attackId: string | undefined,
  tileCtx: TurnTileContext,
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

  const telegraphConfig = attack.telegraph;
  if (telegraphConfig) {
    return prepareTelegraphedAttack(state, actor, target, attack, telegraphConfig, tileCtx);
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

  const nextHp = Math.max(0, target.hp - damage);
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

  const pushed = hit && !killed && attack.forcedMovement
    ? getForcedMovementResult(next, actor, targetId, attack.forcedMovement, tileCtx)
    : null;
  if (pushed) {
    next = updateParticipant(next, targetId, {
      tileX: pushed.toTile.x,
      tileY: pushed.toTile.y,
    });
  }

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
        ...(pushed ? { pushed } : {}),
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
      ...(pushed ? { pushed } : {}),
    },
    state: next,
  };
}

function prepareTelegraphedAttack(
  state: TurnCombatState,
  actor: TurnParticipant,
  target: TurnParticipant,
  attack: TurnAttack,
  telegraphConfig: TurnTelegraphConfig,
  tileCtx: TurnTileContext,
): { outcome: ActionOutcome; state: TurnCombatState } {
  const telegraph: PendingTurnTelegraph = {
    id: `${actor.id}_${attack.id}_${state.round}_${state.pendingTelegraphs?.length ?? 0}`,
    actorId: actor.id,
    targetId: target.id,
    attackId: attack.id,
    attackName: attack.displayName,
    damage: attack.damage,
    damageType: attack.damageType,
    hitChance: attack.hitChance ?? actor.hitChance,
    statusEffect: attack.statusEffect ? { ...attack.statusEffect } : undefined,
    forcedMovement: attack.forcedMovement ? { ...attack.forcedMovement } : undefined,
    originTile: { x: actor.tileX, y: actor.tileY },
    targetTile: { x: target.tileX, y: target.tileY },
    tiles: buildTelegraphTiles(target.tileX, target.tileY, telegraphConfig, tileCtx),
  };
  const nextCooldowns = {
    ...(actor.attackCooldowns ?? {}),
    ...getAttackCooldownPatch(attack),
  };
  const next = updateParticipant(
    {
      ...state,
      pendingTelegraphs: [...(state.pendingTelegraphs ?? []), telegraph],
    },
    actor.id,
    {
      apRemaining: Math.max(0, actor.apRemaining - attack.apCost),
      attackCooldowns: nextCooldowns,
    },
  );

  return {
    outcome: {
      kind: 'telegraph_prepared',
      actorId: actor.id,
      targetId: target.id,
      attackId: attack.id,
      attackName: attack.displayName,
      telegraphId: telegraph.id,
      tiles: telegraph.tiles,
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

function buildTelegraphTiles(
  targetTileX: number,
  targetTileY: number,
  config: NonNullable<TurnAttack['telegraph']>,
  tileCtx: TurnTileContext,
) {
  const tiles: TurnTelegraphTile[] = [{
    x: targetTileX,
    y: targetTileY,
    intensity: 'danger' as const,
    damageMultiplier: 1,
  }];

  if (config.pattern === 'target_plus_adjacent') {
    const warningDamageMultiplier = config.warningDamageMultiplier ?? 0.5;
    for (const [dx, dy] of DIRS_8) {
      const x = targetTileX + dx;
      const y = targetTileY + dy;
      if (!isTileWithinBounds(x, y, tileCtx)) continue;
      tiles.push({
        x,
        y,
        intensity: 'warning' as const,
        damageMultiplier: warningDamageMultiplier,
      });
    }
  }

  return tiles.filter((tile) => isTileWithinBounds(tile.x, tile.y, tileCtx));
}

function buildTelegraphResolvedOutcome(
  telegraph: PendingTurnTelegraph,
  targetWasInArea: boolean,
  damage: number,
  hit: boolean,
  killed: boolean,
  statusApplied?: StatusEffect,
): Extract<ActionOutcome, { kind: 'telegraph_resolved' }> {
  return {
    kind: 'telegraph_resolved',
    actorId: telegraph.actorId,
    targetId: telegraph.targetId,
    attackId: telegraph.attackId,
    attackName: telegraph.attackName,
    damage,
    hit,
    killed,
    targetWasInArea,
    ...(statusApplied ? { statusApplied } : {}),
  };
}

function getForcedMovementResult(
  state: TurnCombatState,
  actor: TurnParticipant,
  targetId: string,
  forcedMovement: TurnForcedMovement,
  tileCtx: TurnTileContext,
  originTile = { x: actor.tileX, y: actor.tileY },
) {
  if (forcedMovement.kind !== 'push' || forcedMovement.distance <= 0) return null;

  const target = state.participants.find((p) => p.id === targetId);
  if (!target) return null;

  let dx = Math.sign(target.tileX - originTile.x);
  let dy = Math.sign(target.tileY - originTile.y);
  if (dx === 0 && dy === 0) {
    dx = Math.sign(target.tileX - actor.tileX);
    dy = Math.sign(target.tileY - actor.tileY);
  }
  if (dx === 0 && dy === 0) dy = 1;

  const fromTile = { x: target.tileX, y: target.tileY };
  let toTile = fromTile;

  for (let step = 0; step < forcedMovement.distance; step += 1) {
    const nextTile = { x: toTile.x + dx, y: toTile.y + dy };
    if (!isTileOpenForForcedMove(nextTile.x, nextTile.y, target.id, state, tileCtx)) break;
    toTile = nextTile;
  }

  if (toTile.x === fromTile.x && toTile.y === fromTile.y) return null;
  return { targetId: target.id, fromTile, toTile };
}

function getTelegraphActorLandingResult(
  state: TurnCombatState,
  actor: TurnParticipant,
  targetTile: { x: number; y: number },
  tileCtx: TurnTileContext,
) {
  const adjacentCandidates = DIRS_8
    .map(([dx, dy]) => ({ x: targetTile.x + dx, y: targetTile.y + dy }))
    .sort((a, b) =>
      Math.max(Math.abs(a.x - actor.tileX), Math.abs(a.y - actor.tileY)) -
      Math.max(Math.abs(b.x - actor.tileX), Math.abs(b.y - actor.tileY)),
    );

  const toTile = [targetTile, ...adjacentCandidates].find((tile) =>
    isTileOpenForForcedMove(tile.x, tile.y, actor.id, state, tileCtx),
  );
  if (!toTile || (toTile.x === actor.tileX && toTile.y === actor.tileY)) return null;

  return {
    targetId: actor.id,
    fromTile: { x: actor.tileX, y: actor.tileY },
    toTile,
  };
}

function isTileOpenForForcedMove(
  tileX: number,
  tileY: number,
  movingParticipantId: string,
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): boolean {
  if (!isTileWithinBounds(tileX, tileY, tileCtx)) return false;
  if (!tileCtx.isTileWalkable(tileX, tileY)) return false;

  return !state.participants.some((participant) =>
    participant.id !== movingParticipantId &&
    participant.hp > 0 &&
    participant.tileX === tileX &&
    participant.tileY === tileY,
  );
}

function isTileWithinBounds(tileX: number, tileY: number, tileCtx: TurnTileContext): boolean {
  return tileX >= 0 && tileY >= 0 && tileX < tileCtx.mapWidth && tileY < tileCtx.mapHeight;
}

function tickStatusEffects(
  state: TurnCombatState,
  participantId: string,
): { state: TurnCombatState; outcomes: Extract<ActionOutcome, { kind: 'status_tick' }>[] } {
  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant) return { state, outcomes: [] };

  let nextHp = participant.hp;
  let mpReduction = 0;
  const updated: StatusEffect[] = [];
  const outcomes: Extract<ActionOutcome, { kind: 'status_tick' }>[] = [];

  for (const effect of participant.statusEffects) {
    if (effect.kind === 'bleeding' || effect.kind === 'damage_over_time') {
      const movedTiles = participant.bleedMovementTiles ?? 0;
      const rawDamage = effect.kind === 'bleeding'
        ? movedTiles <= 0
          ? 0
          : effect.value * (movedTiles > 2 ? 2 : 1)
        : effect.value;
      const damage = Math.min(nextHp, Math.max(0, rawDamage));
      nextHp = Math.max(0, nextHp - damage);
      if (damage > 0) {
        outcomes.push({
          kind: 'status_tick',
          targetId: participantId,
          effectKind: effect.kind,
          damage,
          killed: nextHp <= 0,
        });
      }
    }
    if (effect.kind === 'slowed')   mpReduction += effect.value;

    if (effect.turnsRemaining > 1) {
      updated.push({ ...effect, turnsRemaining: effect.turnsRemaining - 1 });
    }
    // Expired effects are dropped
  }

  return {
    state: updateParticipant(state, participantId, {
      hp: nextHp,
      statusEffects: updated,
      mpRemaining: Math.max(0, participant.mpRemaining - mpReduction),
      bleedMovementTiles: 0,
    }),
    outcomes,
  };
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
    pendingTelegraphs: (state.pendingTelegraphs ?? []).map((telegraph) => ({
      ...telegraph,
      statusEffect: telegraph.statusEffect ? { ...telegraph.statusEffect } : undefined,
      forcedMovement: telegraph.forcedMovement ? { ...telegraph.forcedMovement } : undefined,
      originTile: { ...telegraph.originTile },
      targetTile: { ...telegraph.targetTile },
      tiles: telegraph.tiles.map((tile) => ({ ...tile })),
    })),
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
    telegraph: attack.telegraph ? { ...attack.telegraph } : undefined,
    forcedMovement: attack.forcedMovement ? { ...attack.forcedMovement } : undefined,
  }));
}
