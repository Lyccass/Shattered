import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyAction,
  advanceTurn,
  createCombatState,
  buildUiSnapshot,
  resolvePendingTelegraphsForActor,
} from './TurnCombatEngine';
import { chooseEnemyAction, resolveEnemyTurn, resolveEnemyTurnStep } from './TurnEnemyAi';
import type { TurnParticipant } from './TurnCombatTypes';
import type { TurnTileContext } from './TurnActionValidator';

// ─── Test fixtures ─────────────────────────────────────────────────────────

const OPEN_CTX: TurnTileContext = {
  isTileWalkable: () => true,
  mapWidth: 64,
  mapHeight: 64,
};

afterEach(() => {
  vi.restoreAllMocks();
});

function makePlayer(overrides: Partial<TurnParticipant> = {}): TurnParticipant {
  return {
    id: 'player',
    kind: 'player',
    name: 'Player',
    tileX: 10,
    tileY: 10,
    hp: 10,
    maxHp: 10,
    apMax: 1,
    mpMax: 3,
    apRemaining: 1,
    mpRemaining: 3,
    secondaryActionMax: 1,
    secondaryActionRemaining: 1,
    initiative: 5,
    attackPower: 3,
    defensePower: 0,
    attackRangeTiles: 1,
    statusEffects: [],
    ...overrides,
  };
}

function makeEnemy(id: string, overrides: Partial<TurnParticipant> = {}): TurnParticipant {
  return {
    id,
    kind: 'enemy',
    name: 'Wolf',
    tileX: 14,
    tileY: 10,
    hp: 5,
    maxHp: 5,
    apMax: 1,
    mpMax: 2,
    apRemaining: 1,
    mpRemaining: 2,
    secondaryActionMax: 1,
    secondaryActionRemaining: 1,
    initiative: 8,
    attackPower: 1,
    defensePower: 0,
    attackRangeTiles: 1,
    definitionId: 'wolf_aggressive',
    spawnId: id,
    statusEffects: [],
    ...overrides,
  };
}

// ─── createCombatState ─────────────────────────────────────────────────────

describe('createCombatState', () => {
  it('produces a valid initial state with all participants', () => {
    const state = createCombatState([makePlayer(), makeEnemy('e1')]);
    expect(state.participants).toHaveLength(2);
    expect(state.round).toBe(1);
    expect(['player_turn', 'enemy_turn']).toContain(state.phase);
  });

  it('sorts turn order by initiative (ascending)', () => {
    const player = makePlayer({ initiative: 2 });
    const enemy  = makeEnemy('e1', { initiative: 10 });
    const state  = createCombatState([enemy, player]);
    // Player has lower base initiative → likely first, but random roll adds 1–6
    // We can only check that first participant has the lower effective initiative
    const first = state.participants.find((p) => p.id === state.turnOrderIds[0])!;
    const second = state.participants.find((p) => p.id === state.turnOrderIds[1])!;
    expect(first.initiative).toBeLessThanOrEqual(second.initiative);
  });
});

// ─── move action ──────────────────────────────────────────────────────────

describe('move action', () => {
  it('moves the player to a reachable tile', () => {
    const player = makePlayer({ initiative: 1 });
    const enemy  = makeEnemy('e1', { initiative: 10 });
    const state  = createCombatState([player, enemy]);

    // Force player to be first if not already
    const playerFirst = {
      ...state,
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(
      playerFirst,
      { kind: 'move', toTileX: 12, toTileY: 10 },
      OPEN_CTX,
    );

    expect(outcome.kind).toBe('moved');
    expect(outcome).toMatchObject({
      path: [{ x: 11, y: 10 }, { x: 12, y: 10 }],
    });
    const movedPlayer = next.participants.find((p) => p.id === 'player')!;
    expect(movedPlayer.tileX).toBe(12);
    expect(movedPlayer.tileY).toBe(10);
    expect(movedPlayer.mpRemaining).toBe(1); // 3 - 2 steps (Chebyshev)
  });

  it('rejects movement beyond MP range', () => {
    const state = createCombatState([makePlayer({ initiative: 1 }), makeEnemy('e1', { initiative: 10 })]);
    const playerFirst = {
      ...state,
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome } = applyAction(
      playerFirst,
      { kind: 'move', toTileX: 20, toTileY: 10 }, // 10 tiles away, MP=3
      OPEN_CTX,
    );

    expect(outcome.kind).toBe('invalid');
  });

  it('rejects movement onto an occupied tile', () => {
    const player = makePlayer({ initiative: 1, tileX: 10, tileY: 10 });
    const enemy  = makeEnemy('e1', { initiative: 10, tileX: 11, tileY: 10 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome } = applyAction(
      state,
      { kind: 'move', toTileX: 11, toTileY: 10 }, // enemy is here
      OPEN_CTX,
    );

    expect(outcome.kind).toBe('invalid');
  });
});

// ─── attack action ────────────────────────────────────────────────────────

describe('attack action', () => {
  it('applies damage when player attacks an adjacent enemy', () => {
    const player = makePlayer({ tileX: 10, tileY: 10, attackRangeTiles: 1, attackPower: 5 });
    const enemy  = makeEnemy('e1', { tileX: 11, tileY: 10, hp: 5 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(state, { kind: 'attack', targetId: 'e1' }, OPEN_CTX);
    const attacked = outcome as { kind: 'attacked'; damage: number; hit: boolean };
    expect(['attacked', 'combat_ended']).toContain(outcome.kind);

    if (attacked.hit) {
      expect(attacked.damage).toBeGreaterThan(0);
      const remainingEnemyHp = next.participants.find((p) => p.id === 'e1')!.hp;
      expect(remainingEnemyHp).toBeLessThan(5);
    }
  });

  it('spends 1 AP on attack', () => {
    const player = makePlayer({ tileX: 10, tileY: 10, attackRangeTiles: 1, apRemaining: 1 });
    const enemy  = makeEnemy('e1', { tileX: 11, tileY: 10 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { state: next } = applyAction(state, { kind: 'attack', targetId: 'e1' }, OPEN_CTX);
    const p = next.participants.find((pp) => pp.id === 'player')!;
    expect(p.apRemaining).toBe(0);
  });

  it('rejects attack when enemy is out of range', () => {
    const player = makePlayer({ tileX: 10, tileY: 10, attackRangeTiles: 1 });
    const enemy  = makeEnemy('e1', { tileX: 15, tileY: 10 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome } = applyAction(state, { kind: 'attack', targetId: 'e1' }, OPEN_CTX);
    expect(outcome.kind).toBe('invalid');
  });

  it('allows selected weapon attacks to use their own max range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const player = makePlayer({
      tileX: 10,
      tileY: 10,
      attackRangeTiles: 2,
      attacks: [
        {
          id: 'slash',
          displayName: 'Slash',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 1,
          hitChance: 100,
        },
        {
          id: 'stab',
          displayName: 'Stab',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 2,
          damage: 1,
          hitChance: 100,
        },
      ],
    });
    const enemy = makeEnemy('e1', { tileX: 12, tileY: 10 });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const shortAttack = applyAction(state, { kind: 'attack', targetId: 'e1', attackId: 'slash' }, OPEN_CTX);
    expect(shortAttack.outcome.kind).toBe('invalid');

    const longAttack = applyAction(state, { kind: 'attack', targetId: 'e1', attackId: 'stab' }, OPEN_CTX);
    expect(longAttack.outcome).toMatchObject({ kind: 'attacked', attackId: 'stab' });
  });

  it('sets combat_ended with victory when enemy HP drops to 0', () => {
    const player = makePlayer({ tileX: 10, tileY: 10, attackRangeTiles: 1, attackPower: 100 });
    const enemy  = makeEnemy('e1', { tileX: 11, tileY: 10, hp: 1, defensePower: 0 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    // With attackPower=100, damage roll 1-100; defence=0 so hitChance=80%
    // Run multiple times to get a guaranteed kill eventually
    let ended = false;
    for (let i = 0; i < 20; i++) {
      const { state: next } = applyAction(state, { kind: 'attack', targetId: 'e1' }, OPEN_CTX);
      if (next.phase === 'combat_ended' && next.endReason === 'victory') {
        ended = true;
        break;
      }
    }
    expect(ended).toBe(true);
  });

  it('uses actor hit chance before target defence', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // createCombatState player roll
      .mockReturnValueOnce(0.5) // createCombatState enemy roll
      .mockReturnValueOnce(0.5); // attack roll = 50

    const player = makePlayer({ tileX: 10, tileY: 10, attackRangeTiles: 1, hitChance: 40 });
    const enemy  = makeEnemy('e1', { tileX: 11, tileY: 10, defensePower: 0 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(state, { kind: 'attack', targetId: 'e1' }, OPEN_CTX);

    expect(outcome).toMatchObject({ kind: 'attacked', hit: false, damage: 0 });
    expect(next.participants.find((p) => p.id === 'e1')?.hp).toBe(5);
  });

  it('uses armour rating against the selected damage type for hit chance', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5); // attack roll = 50

    const player = makePlayer({
      tileX: 10,
      tileY: 10,
      attacks: [{
        id: 'stab',
        displayName: 'Stab',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 1,
        damage: 2,
        damageType: 'pierce',
        hitChance: 80,
      }],
    });
    const enemy = makeEnemy('e1', {
      tileX: 11,
      tileY: 10,
      defensePower: 0,
      pierceDefence: 8,
      slashDefence: 0,
      crushDefence: 0,
    });
    const state = {
      participants: [player, enemy],
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      round: 1,
      phase: 'player_turn' as const,
    };

    const { outcome } = applyAction(
      state,
      { kind: 'attack', targetId: 'e1', attackId: 'stab' },
      OPEN_CTX,
    );

    expect(outcome).toMatchObject({ kind: 'attacked', hit: false, damage: 0 });
  });

  it('guard spends the secondary action and reduces incoming hit chance', () => {
    const player = makePlayer({ tileX: 10, tileY: 10, apRemaining: 1, defensePower: 0 });
    const enemy = makeEnemy('e1', {
      tileX: 11,
      tileY: 10,
      attacks: [{
        id: 'bite',
        displayName: 'Bite',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 1,
        damage: 2,
        damageType: 'slash',
        hitChance: 80,
      }],
    });
    const state = {
      participants: [player, enemy],
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      round: 1,
      phase: 'player_turn' as const,
    };

    const { outcome, state: guardedState } = applyAction(state, { kind: 'guard' }, OPEN_CTX);
    expect(outcome).toMatchObject({ kind: 'guarded', actorId: 'player' });
    expect(guardedState.participants.find((p) => p.id === 'player')?.apRemaining).toBe(1);
    expect(guardedState.participants.find((p) => p.id === 'player')?.secondaryActionRemaining).toBe(0);

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.65); // attack roll = 65, misses guarded 80 - 4*5 = 60

    const enemyAttackState = {
      ...guardedState,
      activeIndex: 1,
      phase: 'enemy_turn' as const,
      participants: guardedState.participants.map((p) =>
        p.id === 'e1' ? { ...p, apRemaining: 1 } : p,
      ),
    };
    const { outcome: attackOutcome } = applyAction(
      enemyAttackState,
      { kind: 'attack', targetId: 'player', attackId: 'bite' },
      OPEN_CTX,
    );
    expect(attackOutcome).toMatchObject({ kind: 'attacked', hit: false, damage: 0 });
  });

  it('cleanse spends the secondary action and removes one harmful status', () => {
    const player = makePlayer({
      statusEffects: [
        { kind: 'bleeding', turnsRemaining: 2, value: 2 },
        { kind: 'guarded', turnsRemaining: 1, value: 4 },
      ],
    });
    const enemy = makeEnemy('e1');
    const state = {
      participants: [player, enemy],
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      round: 1,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(state, { kind: 'cleanse' }, OPEN_CTX);

    expect(outcome).toMatchObject({
      kind: 'cleansed',
      actorId: 'player',
      removedEffect: { kind: 'bleeding' },
    });
    const cleansed = next.participants.find((p) => p.id === 'player')!;
    expect(cleansed.secondaryActionRemaining).toBe(0);
    expect(cleansed.statusEffects.map((effect) => effect.kind)).toEqual(['guarded']);
  });

  it('starts and ticks cooldowns per attack on the actor turn cycle', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // hit roll
      .mockReturnValueOnce(0); // damage roll

    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 11,
      tileY: 10,
      attacks: [
        {
          id: 'bite',
          displayName: 'Bite',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 1,
        },
        {
          id: 'roar',
          displayName: 'Roar',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 2,
          damage: 1,
          cooldownTurns: 2,
        },
      ],
      attackCooldowns: {},
    });
    const state = {
      participants: [enemy, player],
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      round: 1,
      phase: 'enemy_turn' as const,
    };

    const { outcome, state: afterAttack } = applyAction(
      state,
      { kind: 'attack', targetId: 'player', attackId: 'roar' },
      OPEN_CTX,
    );

    expect(outcome).toMatchObject({ kind: 'attacked', attackId: 'roar' });
    expect(afterAttack.participants.find((p) => p.id === 'e1')?.attackCooldowns?.roar).toBe(3);

    const { state: playerTurn } = advanceTurn(afterAttack);
    const { state: enemyTurn } = advanceTurn(playerTurn);

    expect(enemyTurn.participants.find((p) => p.id === 'e1')?.attackCooldowns?.roar).toBe(2);
  });

  it('sums damage from multi-hit attacks', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // first hit roll
      .mockReturnValueOnce(0) // first damage roll
      .mockReturnValueOnce(0) // second hit roll
      .mockReturnValueOnce(0); // second damage roll

    const player = makePlayer({
      tileX: 10,
      tileY: 10,
      attacks: [{
        id: 'double_strike',
        displayName: 'Double Strike',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 1,
        damage: 2,
        hitChance: 100,
        hitCount: 2,
      }],
    });
    const enemy = makeEnemy('e1', { tileX: 11, tileY: 10, hp: 10 });
    const state = {
      participants: [player, enemy],
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      round: 1,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(
      state,
      { kind: 'attack', targetId: 'e1', attackId: 'double_strike' },
      OPEN_CTX,
    );

    expect(outcome).toMatchObject({ kind: 'attacked', attackId: 'double_strike', damage: 2 });
    expect(next.participants.find((p) => p.id === 'e1')?.hp).toBe(8);
  });

  it('builds stagger on hit and stuns when the target threshold is reached', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const player = makePlayer({
      tileX: 10,
      tileY: 10,
      attacks: [{
        id: 'hammer_crush',
        displayName: 'Crush',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 1,
        damage: 1,
        hitChance: 100,
        staggerDamage: 10,
      }],
    });
    const enemy = makeEnemy('e1', {
      tileX: 11,
      tileY: 10,
      hp: 10,
      staggerThreshold: 10,
    });
    const state = {
      participants: [player, enemy],
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      round: 1,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(
      state,
      { kind: 'attack', targetId: 'e1', attackId: 'hammer_crush' },
      OPEN_CTX,
    );

    expect(outcome).toMatchObject({
      kind: 'attacked',
      statusApplied: { kind: 'stunned', turnsRemaining: 2 },
    });
    const staggered = next.participants.find((p) => p.id === 'e1')!;
    expect(staggered.stagger).toBe(0);
    expect(staggered.statusEffects.some((effect) => effect.kind === 'stunned')).toBe(true);
  });

  it('defaults to the first usable attack and spends that main action cost', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const player = makePlayer({
      tileX: 10,
      tileY: 10,
      apMax: 1,
      apRemaining: 1,
      attacks: [
        {
          id: 'sword_light',
          displayName: 'Strike',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 2,
          hitChance: 100,
        },
        {
          id: 'sword_heavy',
          displayName: 'Power Strike',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 5,
          hitChance: 100,
        },
      ],
    });
    const enemy = makeEnemy('e1', { tileX: 11, tileY: 10, hp: 10 });
    const state = {
      participants: [player, enemy],
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      round: 1,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(
      state,
      { kind: 'attack', targetId: 'e1' },
      OPEN_CTX,
    );

    expect(outcome).toMatchObject({ kind: 'attacked', attackId: 'sword_light' });
    expect(next.participants.find((p) => p.id === 'player')?.apRemaining).toBe(0);
  });

  it('locks once-per-turn attacks until the actor next turn starts', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const player = makePlayer({
      tileX: 10,
      tileY: 10,
      apMax: 2,
      apRemaining: 2,
      attacks: [{
        id: 'dagger_light',
        displayName: 'Double Strike',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 1,
        damage: 1,
        hitChance: 100,
        oncePerTurn: true,
      }],
    });
    const enemy = makeEnemy('e1', { tileX: 11, tileY: 10, hp: 10 });
    const state = {
      participants: [player, enemy],
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      round: 1,
      phase: 'player_turn' as const,
    };

    const { state: afterAttack } = applyAction(
      state,
      { kind: 'attack', targetId: 'e1', attackId: 'dagger_light' },
      OPEN_CTX,
    );
    expect(afterAttack.participants.find((p) => p.id === 'player')?.attackCooldowns?.dagger_light).toBe(1);

    const secondAttempt = applyAction(
      afterAttack,
      { kind: 'attack', targetId: 'e1', attackId: 'dagger_light' },
      OPEN_CTX,
    );
    expect(secondAttempt.outcome.kind).toBe('invalid');

    const { state: enemyTurn } = advanceTurn(afterAttack);
    const { state: playerTurn } = advanceTurn(enemyTurn);
    expect(playerTurn.participants.find((p) => p.id === 'player')?.attackCooldowns?.dagger_light).toBeUndefined();
  });

  it('prepares telegraphed attacks instead of dealing immediate damage', () => {
    const player = makePlayer({ tileX: 10, tileY: 10, hp: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 12,
      tileY: 10,
      attacks: [{
        id: 'pounce',
        displayName: 'Pounce',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 3,
        damage: 3,
        hitChance: 100,
        telegraph: { pattern: 'target_plus_adjacent', warningDamageMultiplier: 0.5 },
        forcedMovement: { kind: 'push', distance: 1 },
      }],
    });
    const state = {
      participants: [enemy, player],
      pendingTelegraphs: [],
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      round: 1,
      phase: 'enemy_turn' as const,
    };

    const { outcome, state: next } = applyAction(
      state,
      { kind: 'attack', targetId: 'player', attackId: 'pounce' },
      OPEN_CTX,
    );

    expect(outcome).toMatchObject({ kind: 'telegraph_prepared', attackId: 'pounce' });
    expect(next.participants.find((p) => p.id === 'player')?.hp).toBe(10);
    expect(next.pendingTelegraphs).toHaveLength(1);
    expect(next.pendingTelegraphs?.[0].tiles.some((tile) => tile.x === 10 && tile.y === 10)).toBe(true);
  });

  it('keeps newly prepared enemy telegraphs pending until that enemy acts again', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const player = makePlayer({ tileX: 10, tileY: 10, hp: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 12,
      tileY: 10,
      attacks: [{
        id: 'pounce',
        displayName: 'Pounce',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 3,
        damage: 3,
        hitChance: 100,
        telegraph: { pattern: 'target', warningDamageMultiplier: 0.5 },
      }],
    });
    const state = {
      participants: [enemy, player],
      pendingTelegraphs: [],
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      round: 1,
      phase: 'enemy_turn' as const,
    };

    const { outcomes, state: next } = resolveEnemyTurn(state, OPEN_CTX);

    expect(outcomes.some((outcome) => outcome.kind === 'telegraph_prepared')).toBe(true);
    expect(outcomes.some((outcome) => outcome.kind === 'telegraph_resolved')).toBe(false);
    expect(next.phase).toBe('player_turn');
    expect(next.pendingTelegraphs).toHaveLength(1);
    expect(next.participants.find((p) => p.id === 'player')?.hp).toBe(10);
  });

  it('lets movement avoid a telegraphed hit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const player = makePlayer({ tileX: 10, tileY: 10, hp: 10 });
    const enemy = makeEnemy('e1', { tileX: 12, tileY: 10 });
    const state = {
      participants: [enemy, player],
      pendingTelegraphs: [{
        id: 'pending',
        actorId: 'e1',
        targetId: 'player',
        attackId: 'pounce',
        attackName: 'Pounce',
        damage: 3,
        hitChance: 100,
        forcedMovement: { kind: 'push' as const, distance: 1 },
        originTile: { x: 12, y: 10 },
        targetTile: { x: 10, y: 10 },
        tiles: [{ x: 10, y: 10, intensity: 'danger' as const, damageMultiplier: 1 }],
      }],
      turnOrderIds: ['e1', 'player'],
      activeIndex: 1,
      round: 1,
      phase: 'player_turn' as const,
    };

    const moved = applyAction(state, { kind: 'move', toTileX: 10, toTileY: 11 }, OPEN_CTX);
    const enemyTurn = {
      ...moved.state,
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };
    const { outcomes, state: resolved } = resolvePendingTelegraphsForActor(enemyTurn, 'e1', OPEN_CTX);

    expect(outcomes[0]).toMatchObject({ kind: 'telegraph_resolved', targetWasInArea: false, hit: false, damage: 0 });
    expect(outcomes[0]).toMatchObject({
      actorMoved: { targetId: 'e1', fromTile: { x: 12, y: 10 }, toTile: { x: 10, y: 10 } },
    });
    expect(resolved.participants.find((p) => p.id === 'player')?.hp).toBe(10);
    expect(resolved.participants.find((p) => p.id === 'e1')).toMatchObject({ tileX: 10, tileY: 10 });
    expect(resolved.pendingTelegraphs).toHaveLength(0);
  });

  it('resolves telegraphed hits and pushes the target from the origin', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const player = makePlayer({ tileX: 10, tileY: 10, hp: 10 });
    const enemy = makeEnemy('e1', { tileX: 12, tileY: 10 });
    const state = {
      participants: [enemy, player],
      pendingTelegraphs: [{
        id: 'pending',
        actorId: 'e1',
        targetId: 'player',
        attackId: 'pounce',
        attackName: 'Pounce',
        damage: 3,
        hitChance: 100,
        forcedMovement: { kind: 'push' as const, distance: 1 },
        originTile: { x: 12, y: 10 },
        targetTile: { x: 10, y: 10 },
        tiles: [{ x: 10, y: 10, intensity: 'danger' as const, damageMultiplier: 1 }],
      }],
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      round: 2,
      phase: 'enemy_turn' as const,
    };

    const { outcomes, state: resolved } = resolvePendingTelegraphsForActor(state, 'e1', OPEN_CTX);

    expect(outcomes[0]).toMatchObject({
      kind: 'telegraph_resolved',
      targetWasInArea: true,
      hit: true,
      damage: 1,
      pushed: { targetId: 'player', fromTile: { x: 10, y: 10 }, toTile: { x: 9, y: 10 } },
      actorMoved: { targetId: 'e1', fromTile: { x: 12, y: 10 }, toTile: { x: 10, y: 10 } },
    });
    expect(resolved.participants.find((p) => p.id === 'player')).toMatchObject({
      hp: 9,
      tileX: 9,
      tileY: 10,
    });
    expect(resolved.participants.find((p) => p.id === 'e1')).toMatchObject({ tileX: 10, tileY: 10 });
  });

  it('can keep acting after resolving a pending telegraph', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const player = makePlayer({ tileX: 10, tileY: 10, hp: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 12,
      tileY: 10,
      attacks: [{
        id: 'bite',
        displayName: 'Bite',
        apCost: 1,
        minRangeTiles: 0,
        maxRangeTiles: 3,
        damage: 2,
        hitChance: 100,
      }],
    });
    const state = {
      participants: [enemy, player],
      pendingTelegraphs: [{
        id: 'pending',
        actorId: 'e1',
        targetId: 'player',
        attackId: 'pounce',
        attackName: 'Pounce',
        damage: 3,
        hitChance: 100,
        originTile: { x: 12, y: 10 },
        targetTile: { x: 10, y: 10 },
        tiles: [{ x: 10, y: 10, intensity: 'danger' as const, damageMultiplier: 1 }],
      }],
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      round: 2,
      phase: 'enemy_turn' as const,
    };

    const { outcomes, state: next } = resolveEnemyTurn(state, OPEN_CTX);

    expect(outcomes.some((outcome) => outcome.kind === 'telegraph_resolved')).toBe(true);
    expect(outcomes.some((outcome) => outcome.kind === 'attacked')).toBe(true);
    expect(next.phase).toBe('player_turn');
  });
});

// ─── flee action ──────────────────────────────────────────────────────────

describe('flee action', () => {
  it('ends combat with player_fled reason', () => {
    const player = makePlayer({ initiative: 1 });
    const enemy  = makeEnemy('e1', { initiative: 10 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = applyAction(state, { kind: 'flee' }, OPEN_CTX);
    expect(outcome.kind).toBe('fled');
    expect(next.phase).toBe('combat_ended');
    expect(next.endReason).toBe('player_fled');
  });
});

// ─── turn advancement ─────────────────────────────────────────────────────

describe('turn advancement', () => {
  it('increments round after all participants have acted', () => {
    const player = makePlayer({ initiative: 1 });
    const enemy  = makeEnemy('e1', { initiative: 10 });
    const state  = createCombatState([player, enemy]);
    const ordered = {
      ...state,
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    // End player turn → enemy turn
    const { state: afterPlayer } = advanceTurn(ordered);
    expect(afterPlayer.round).toBe(1);

    // End enemy turn → wraps back, round 2
    const { state: afterEnemy } = advanceTurn(afterPlayer);
    expect(afterEnemy.round).toBe(2);
  });

  it('restores AP and MP at turn start', () => {
    const player = makePlayer({ initiative: 1, apRemaining: 0, mpRemaining: 0 });
    const enemy  = makeEnemy('e1', { initiative: 10 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 1, // enemy is currently active; advancing wraps to player
      phase: 'enemy_turn' as const,
    };

    const { state: next } = advanceTurn(state);
    const p = next.participants.find((pp) => pp.id === 'player')!;
    expect(p.apRemaining).toBe(p.apMax);
    expect(p.mpRemaining).toBe(p.mpMax);
  });

  it('skips dead participants in the turn order', () => {
    const player = makePlayer({ initiative: 1 });
    const deadEnemy = makeEnemy('e1', { initiative: 5, hp: 0 });
    const livingEnemy = makeEnemy('e2', { initiative: 10, hp: 5 });
    const state = {
      ...createCombatState([player, deadEnemy, livingEnemy]),
      turnOrderIds: ['player', 'e1', 'e2'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const { outcome, state: next } = advanceTurn(state);

    expect(outcome).toMatchObject({ kind: 'turn_ended', nextParticipantId: 'e2' });
    expect(next.activeIndex).toBe(2);
    expect(next.phase).toBe('enemy_turn');
  });
});

// ─── status effects ───────────────────────────────────────────────────────

describe('bleeding status effect', () => {
  it('does not deal tick damage when the target stood still', () => {
    const player = makePlayer({
      initiative: 1,
      hp: 10,
      statusEffects: [{ kind: 'bleeding', turnsRemaining: 2, value: 2 }],
    });
    const enemy = makeEnemy('e1', { initiative: 10, tileX: 20, tileY: 20 });

    // Wrap: enemy is active (index=1), advancing wraps to player turn (index=0)
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 1,
      phase: 'enemy_turn' as const,
    };

    const { outcome, state: next } = advanceTurn(state);
    const p = next.participants.find((pp) => pp.id === 'player')!;
    expect(p.hp).toBe(10);
    expect(p.statusEffects[0]?.turnsRemaining).toBe(1);
    expect(outcome).toMatchObject({
      kind: 'turn_ended',
      statusTicks: [],
    });
  });

  it('doubles bleeding tick damage after moving more than two tiles', () => {
    const player = makePlayer({
      initiative: 1,
      hp: 10,
      bleedMovementTiles: 3,
      statusEffects: [{ kind: 'bleeding', turnsRemaining: 2, value: 2 }],
    });
    const enemy = makeEnemy('e1', { initiative: 10, tileX: 20, tileY: 20 });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 1,
      phase: 'enemy_turn' as const,
    };

    const { outcome, state: next } = advanceTurn(state);
    const p = next.participants.find((pp) => pp.id === 'player')!;
    expect(p.hp).toBe(6);
    expect(p.bleedMovementTiles).toBe(0);
    expect(outcome).toMatchObject({
      kind: 'turn_ended',
      statusTicks: [{ kind: 'status_tick', targetId: 'player', effectKind: 'bleeding', damage: 4 }],
    });
  });
});

// ─── stunned cannot act ───────────────────────────────────────────────────

describe('stunned status effect', () => {
  it('forces end_turn when participant is stunned', () => {
    const player = makePlayer({
      initiative: 1,
      statusEffects: [{ kind: 'stunned', turnsRemaining: 1, value: 0 }],
    });
    const enemy = makeEnemy('e1', { initiative: 10, tileX: 15, tileY: 10 });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    // Player tries to move but is stunned — should auto end_turn
    const { outcome } = applyAction(
      state,
      { kind: 'move', toTileX: 11, toTileY: 10 },
      OPEN_CTX,
    );
    expect(outcome.kind).toBe('turn_ended');
  });
});

// ─── UI snapshot ──────────────────────────────────────────────────────────

describe('buildUiSnapshot', () => {
  it('returns active:false when state is null', () => {
    const snap = buildUiSnapshot(null);
    expect(snap.active).toBe(false);
  });

  it('reflects player HP and AP correctly', () => {
    const player = makePlayer({ hp: 7, apRemaining: 0 });
    const enemy  = makeEnemy('e1');
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['player', 'e1'],
      activeIndex: 0,
      phase: 'player_turn' as const,
    };

    const snap = buildUiSnapshot(state);
    expect(snap.active).toBe(true);
    expect(snap.player?.hp).toBe(7);
    expect(snap.player?.apRemaining).toBe(0);
  });
});

// ─── enemy AI ─────────────────────────────────────────────────────────────

describe('enemy AI', () => {
  it('chooses attack when player is in range', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy  = makeEnemy('e1', { tileX: 11, tileY: 10, attackRangeTiles: 1 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    const action = chooseEnemyAction(state, OPEN_CTX);
    expect(action.kind).toBe('attack');
  });

  it('chooses an available special attack, then falls back while it is cooling down', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy  = makeEnemy('e1', {
      tileX: 11,
      tileY: 10,
      attacks: [
        {
          id: 'bite',
          displayName: 'Bite',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 2,
        },
        {
          id: 'roar',
          displayName: 'Roar',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 2,
          damage: 1,
          statusEffect: { kind: 'slowed', turns: 2, value: 1 },
          cooldownTurns: 3,
        },
      ],
      attackCooldowns: {},
    });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    const specialAction = chooseEnemyAction(state, OPEN_CTX);
    expect(specialAction).toMatchObject({ kind: 'attack', attackId: 'roar' });

    const coolingDown = {
      ...state,
      participants: state.participants.map((p) =>
        p.id === 'e1' ? { ...p, attackCooldowns: { roar: 2 } } : p,
      ),
    };
    const fallbackAction = chooseEnemyAction(coolingDown, OPEN_CTX);
    expect(fallbackAction).toMatchObject({ kind: 'attack', attackId: 'bite' });
  });

  it('chooses bite instead of telegraphed lunge when already adjacent', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 11,
      tileY: 10,
      attacks: [
        {
          id: 'bite',
          displayName: 'Bite',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 2,
        },
        {
          id: 'lunge',
          displayName: 'Lunge',
          apCost: 1,
          minRangeTiles: 2,
          maxRangeTiles: 3,
          damage: 4,
          telegraph: { pattern: 'target_plus_adjacent' },
        },
      ],
    });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    expect(chooseEnemyAction(state, OPEN_CTX)).toMatchObject({ kind: 'attack', attackId: 'bite' });
  });

  it('can choose a telegraphed lunge after spending movement into range', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 12,
      tileY: 10,
      mpMax: 3,
      mpRemaining: 1,
      attacks: [
        {
          id: 'bite',
          displayName: 'Bite',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 2,
        },
        {
          id: 'lunge',
          displayName: 'Lunge',
          apCost: 1,
          minRangeTiles: 2,
          maxRangeTiles: 3,
          damage: 4,
          telegraph: { pattern: 'target_plus_adjacent' },
        },
      ],
    });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    expect(chooseEnemyAction(state, OPEN_CTX)).toMatchObject({ kind: 'attack', attackId: 'lunge' });
  });

  it('chooses move when player is out of range', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy  = makeEnemy('e1', { tileX: 20, tileY: 10, attackRangeTiles: 1 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    const action = chooseEnemyAction(state, OPEN_CTX);
    expect(action.kind).toBe('move');
  });

  it('ends turn when no AP or MP remaining', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy  = makeEnemy('e1', {
      tileX: 20,
      tileY: 10,
      apRemaining: 0,
      mpRemaining: 0,
    });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    const action = chooseEnemyAction(state, OPEN_CTX);
    expect(action.kind).toBe('end_turn');
  });

  it('resolveEnemyTurn always ends the turn', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy  = makeEnemy('e1', { tileX: 20, tileY: 10 });
    const state  = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    const { outcomes } = resolveEnemyTurn(state, OPEN_CTX);
    const endOutcomes = outcomes.filter(
      (o) => o.kind === 'turn_ended' || o.kind === 'combat_ended',
    );
    expect(endOutcomes.length).toBeGreaterThanOrEqual(1);
  });

  it('walks into lunge range, then prepares lunge before ending the enemy turn', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 15,
      tileY: 10,
      mpMax: 3,
      mpRemaining: 3,
      attacks: [
        {
          id: 'bite',
          displayName: 'Bite',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 2,
        },
        {
          id: 'lunge',
          displayName: 'Lunge',
          apCost: 1,
          minRangeTiles: 2,
          maxRangeTiles: 3,
          damage: 4,
          telegraph: { pattern: 'target_plus_adjacent' },
        },
      ],
    });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    const { outcomes, state: next } = resolveEnemyTurn(state, OPEN_CTX);

    expect(outcomes.some((outcome) => outcome.kind === 'moved')).toBe(true);
    expect(outcomes.some((outcome) => outcome.kind === 'telegraph_prepared')).toBe(true);
    expect(outcomes.at(-1)).toMatchObject({ kind: 'turn_ended', nextParticipantId: 'player' });
    expect(next.pendingTelegraphs ?? []).toHaveLength(1);
    expect(next.phase).toBe('player_turn');
  });

  it('resolves enemy AI one action per step so movement can animate before lunge setup', () => {
    const player = makePlayer({ tileX: 10, tileY: 10 });
    const enemy = makeEnemy('e1', {
      tileX: 15,
      tileY: 10,
      mpMax: 3,
      mpRemaining: 3,
      attacks: [
        {
          id: 'bite',
          displayName: 'Bite',
          apCost: 1,
          minRangeTiles: 0,
          maxRangeTiles: 1,
          damage: 2,
        },
        {
          id: 'lunge',
          displayName: 'Lunge',
          apCost: 1,
          minRangeTiles: 2,
          maxRangeTiles: 3,
          damage: 4,
          telegraph: { pattern: 'target_plus_adjacent' },
        },
      ],
    });
    const state = {
      ...createCombatState([player, enemy]),
      turnOrderIds: ['e1', 'player'],
      activeIndex: 0,
      phase: 'enemy_turn' as const,
    };

    const moved = resolveEnemyTurnStep(state, OPEN_CTX);
    expect(moved.outcomes).toHaveLength(1);
    expect(moved.outcomes[0]).toMatchObject({ kind: 'moved' });
    expect(moved.turnComplete).toBe(false);
    expect(moved.state.phase).toBe('enemy_turn');

    const prepared = resolveEnemyTurnStep(moved.state, OPEN_CTX);
    expect(prepared.outcomes[0]).toMatchObject({ kind: 'telegraph_prepared', attackId: 'lunge' });
    expect(prepared.outcomes.at(-1)).toMatchObject({ kind: 'turn_ended', nextParticipantId: 'player' });
    expect(prepared.turnComplete).toBe(true);
    expect(prepared.state.phase).toBe('player_turn');
  });
});
