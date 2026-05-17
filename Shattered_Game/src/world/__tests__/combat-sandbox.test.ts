import { describe, expect, it } from 'vitest';
import {
  advanceDodgeMotion,
  createDodgeMotion,
  resolveCombatDodgeDirection,
  resolveReachableDodgeTarget,
} from '../../combat/CombatDodge';
import { ENEMY_DEFINITIONS } from '../../combat/EnemyDefinitions';
import {
  advanceEnemyStateMachine,
  createEnemyRuntimeState,
} from '../../combat/EnemyStateMachine';
import { PlayerCombatState } from '../../combat/PlayerCombatState';

describe('CombatDodge', () => {
  it('resolves W/A/S/D input and facing into stable dodge directions', () => {
    expect(resolveCombatDodgeDirection({ x: 0, y: -1 }, 'down')).toEqual({ x: 0, y: -1 });
    expect(resolveCombatDodgeDirection({ x: 0, y: 1 }, 'up')).toEqual({ x: 0, y: 1 });
    expect(resolveCombatDodgeDirection({ x: -1, y: 0 }, 'right')).toEqual({ x: -1, y: 0 });
    expect(resolveCombatDodgeDirection({ x: 1, y: 0 }, 'left')).toEqual({ x: 1, y: 0 });
    expect(resolveCombatDodgeDirection({ x: 1, y: -1 }, 'down')).toEqual({ x: 1, y: -1 });
    expect(resolveCombatDodgeDirection({ x: -1, y: 1 }, 'up')).toEqual({ x: -1, y: 1 });
    expect(resolveCombatDodgeDirection({ x: 0, y: 0 }, 'left')).toEqual({ x: -1, y: 0 });
  });

  it('advances dodge movement over time instead of completing instantly', () => {
    const motion = createDodgeMotion(0, 0, 30, 0, 250);
    const midStep = advanceDodgeMotion(motion, 100);

    expect(midStep.complete).toBe(false);
    expect(midStep.x).toBeGreaterThan(0);
    expect(midStep.x).toBeLessThan(30);

    const endStep = advanceDodgeMotion(midStep.state!, 150);
    expect(endStep.complete).toBe(true);
    expect(endStep.x).toBe(30);
  });

  it('stops dodge travel at the last reachable point', () => {
    const target = resolveReachableDodgeTarget(
      0,
      0,
      { x: 1, y: 0 },
      30,
      5,
      (worldX) => worldX <= 20,
    );

    expect(target).toEqual({ x: 20, y: 0 });
  });
});

describe('PlayerCombatState', () => {
  it('decreases stamina on dodge', () => {
    const state = new PlayerCombatState();

    expect(state.tryStartDodge(1_000)).toEqual({ ok: true });
    expect(state.getSnapshot(1_000).stamina).toBe(75);
    expect(state.getSnapshot(1_050).isDodging).toBe(true);
  });

  it('fails dodge when stamina is too low', () => {
    const state = new PlayerCombatState();

    state.tryStartDodge(0);
    state.tryStartDodge(500);
    state.tryStartDodge(1_000);
    state.tryStartDodge(1_500);

    expect(state.tryStartDodge(2_000)).toEqual({
      ok: false,
      reason: 'Too exhausted to dodge.',
    });
  });

  it('fails dodge during cooldown even if stamina is available', () => {
    const state = new PlayerCombatState();

    expect(state.tryStartDodge(1_000)).toEqual({ ok: true });
    expect(state.tryStartDodge(1_200)).toEqual({
      ok: false,
      reason: 'Need a moment before dodging again.',
    });
    expect(state.tryStartDodge(1_500)).toEqual({ ok: true });
  });

  it('regenerates stamina after the regen delay', () => {
    const state = new PlayerCombatState();

    state.tryStartDodge(1_000);
    state.update(1_500, 500);
    expect(state.getSnapshot(1_500).stamina).toBe(75);

    state.update(2_200, 700);
    expect(state.getSnapshot(2_200).stamina).toBeGreaterThan(75);
  });
});

describe('EnemyStateMachine', () => {
  const definition = ENEMY_DEFINITIONS[0];

  it('progresses from windup to active to recovery', () => {
    const state = createEnemyRuntimeState(
      definition,
      {
        id: 'enemy_01',
        definitionId: definition.id,
        mapId: 'test_harbor',
        tileX: 10,
        tileY: 10,
      },
      0,
      0,
    );

    let result = advanceEnemyStateMachine(definition, state, {
      nowMs: 0,
      deltaMs: 16,
      playerWorldX: 20,
      playerWorldY: 0,
      playerInvulnerable: false,
      tileWidth: 32,
      tileHeight: 16,
    });
    result.state.currentState = 'aggro';

    result = advanceEnemyStateMachine(definition, result.state, {
      nowMs: 100,
      deltaMs: 16,
      playerWorldX: 20,
      playerWorldY: 0,
      playerInvulnerable: false,
      tileWidth: 32,
      tileHeight: 16,
    });
    expect(result.state.currentState).toBe('windup');
    expect(result.events.some((event) => event.kind === 'telegraph_show')).toBe(true);

    result = advanceEnemyStateMachine(definition, result.state, {
      nowMs: 1_100,
      deltaMs: 16,
      playerWorldX: 20,
      playerWorldY: 0,
      playerInvulnerable: false,
      tileWidth: 32,
      tileHeight: 16,
    });
    expect(result.state.currentState).toBe('active');

    result = advanceEnemyStateMachine(definition, result.state, {
      nowMs: 1_400,
      deltaMs: 16,
      playerWorldX: 20,
      playerWorldY: 0,
      playerInvulnerable: false,
      tileWidth: 32,
      tileHeight: 16,
    });
    expect(result.state.currentState).toBe('recovery');
  });

  it('registers a hit when the player is inside the attack shape and not invulnerable', () => {
    const windupState = {
      ...createEnemyRuntimeState(
        definition,
        {
          id: 'enemy_02',
          definitionId: definition.id,
          mapId: 'test_harbor',
          tileX: 10,
          tileY: 10,
        },
        0,
        0,
      ),
      currentState: 'windup' as const,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_02:telegraph',
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 10,
      playerWorldY: 0,
      playerInvulnerable: false,
      tileWidth: 32,
      tileHeight: 16,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', hit: true }),
      ]),
    );
  });

  it('misses when the player is outside the attack shape', () => {
    const windupState = {
      ...createEnemyRuntimeState(
        definition,
        {
          id: 'enemy_03',
          definitionId: definition.id,
          mapId: 'test_harbor',
          tileX: 10,
          tileY: 10,
        },
        0,
        0,
      ),
      currentState: 'windup' as const,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_03:telegraph',
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 200,
      playerWorldY: 0,
      playerInvulnerable: false,
      tileWidth: 32,
      tileHeight: 16,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', hit: false, reason: 'outside' }),
      ]),
    );
  });

  it('misses when the player is invulnerable during the active check', () => {
    const windupState = {
      ...createEnemyRuntimeState(
        definition,
        {
          id: 'enemy_04',
          definitionId: definition.id,
          mapId: 'test_harbor',
          tileX: 10,
          tileY: 10,
        },
        0,
        0,
      ),
      currentState: 'windup' as const,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_04:telegraph',
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 10,
      playerWorldY: 0,
      playerInvulnerable: true,
      tileWidth: 32,
      tileHeight: 16,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', hit: false, reason: 'invulnerable' }),
      ]),
    );
  });
});
