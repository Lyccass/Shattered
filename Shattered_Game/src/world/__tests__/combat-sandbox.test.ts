import { describe, expect, it } from 'vitest';
import {
  advanceDodgeMotion,
  createDodgeMotion,
  resolveCombatDodgeDirection,
  resolveReachableDodgeTarget,
} from '../../combat/CombatDodge';
import {
  isPointInsideCone,
  isPointInsideEllipse,
  isPointInsideRotatedRectangle,
} from '../../combat/EnemyAttackMath';
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
  it('toggles sprint on and off', () => {
    const state = new PlayerCombatState();

    expect(state.toggleSprint()).toEqual({ ok: true, active: true });
    expect(state.getSnapshot(0).isSprinting).toBe(true);
    expect(state.toggleSprint()).toEqual({ ok: true, active: false });
    expect(state.getSnapshot(0).isSprinting).toBe(false);
  });

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
    state.update(1_500, 500, false);
    expect(state.getSnapshot(1_500).stamina).toBe(75);

    state.update(2_200, 700, false);
    expect(state.getSnapshot(2_200).stamina).toBeGreaterThan(75);
  });

  it('drains sprint stamina slowly out of combat and more heavily in combat', () => {
    const state = new PlayerCombatState();

    expect(state.toggleSprint()).toEqual({ ok: true, active: true });
    state.update(1_000, 1_000, true);
    expect(state.getSnapshot(1_000).stamina).toBe(99);

    state.enterCombat();
    state.update(2_000, 1_000, true);
    expect(state.getSnapshot(2_000).stamina).toBe(94);
  });

  it('turns sprint off automatically when stamina reaches zero', () => {
    const state = new PlayerCombatState();

    expect(state.toggleSprint()).toEqual({ ok: true, active: true });
    state.update(100_000, 100_000, true);

    expect(state.getSnapshot(100_000).stamina).toBe(0);
    expect(state.getSnapshot(100_000).isSprinting).toBe(false);
  });

  it('does not regenerate stamina while sprinting', () => {
    const state = new PlayerCombatState();

    expect(state.toggleSprint()).toEqual({ ok: true, active: true });
    state.update(1_000, 1_000, true);
    const afterSprintDrain = state.getSnapshot(1_000).stamina;
    state.update(2_000, 1_000, true);

    expect(state.getSnapshot(2_000).stamina).toBeLessThan(afterSprintDrain);
  });

  it('regenerates more slowly in combat than out of combat', () => {
    const state = new PlayerCombatState();

    state.tryStartDodge(0);
    state.update(1_000, 1_000, false);
    const outOfCombatStamina = state.getSnapshot(1_000).stamina;

    const combatState = new PlayerCombatState();
    combatState.enterCombat();
    combatState.tryStartDodge(0);
    combatState.update(1_000, 1_000, false);
    const combatStamina = combatState.getSnapshot(1_000).stamina;

    expect(outOfCombatStamina).toBeGreaterThan(combatStamina);
  });
});

describe('EnemyAttackMath', () => {
  it('checks ellipse telegraph hits correctly', () => {
    expect(isPointInsideEllipse(10, 0, 0, 0, 12, 6)).toBe(true);
    expect(isPointInsideEllipse(13, 0, 0, 0, 12, 6)).toBe(false);
    expect(isPointInsideEllipse(0, 7, 0, 0, 12, 6)).toBe(false);
  });

  it('checks cone telegraph hits correctly', () => {
    expect(isPointInsideCone(24, 0, 0, 0, 0, 30, Math.PI / 2)).toBe(true);
    expect(isPointInsideCone(16, 12, 0, 0, 0, 30, Math.PI / 2)).toBe(true);
    expect(isPointInsideCone(0, 24, 0, 0, 0, 30, Math.PI / 2)).toBe(false);
  });

  it('checks stab rectangle hits correctly', () => {
    expect(isPointInsideRotatedRectangle(20, 0, 22, 0, 44, 16, 0)).toBe(true);
    expect(isPointInsideRotatedRectangle(20, 12, 22, 0, 44, 16, 0)).toBe(false);
  });
});

describe('EnemyStateMachine', () => {
  const definition = ENEMY_DEFINITIONS[0];
  const tileContext = {
    tileWidth: 32,
    tileHeight: 16,
  };

  function createBaseState(id = 'enemy_01') {
    return createEnemyRuntimeState(
      definition,
      {
        id,
        definitionId: definition.id,
        mapId: 'test_harbor',
        tileX: 10,
        tileY: 10,
      },
      0,
      0,
    );
  }

  it('progresses from windup to active to recovery', () => {
    const state = createBaseState();

    let result = advanceEnemyStateMachine(definition, state, {
      nowMs: 0,
      deltaMs: 16,
      playerWorldX: 24,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    result.state.currentState = 'aggro';

    result = advanceEnemyStateMachine(definition, result.state, {
      nowMs: 100,
      deltaMs: 16,
      playerWorldX: 24,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    expect(result.state.currentState).toBe('windup');
    expect(result.state.currentAttackId).toBe('wretch_stab');
    expect(result.events.some((event) => event.kind === 'telegraph_show')).toBe(true);

    result = advanceEnemyStateMachine(definition, result.state, {
      nowMs: 700,
      deltaMs: 16,
      playerWorldX: 24,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    expect(result.state.currentState).toBe('active');

    result = advanceEnemyStateMachine(definition, result.state, {
      nowMs: 900,
      deltaMs: 16,
      playerWorldX: 24,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    expect(result.state.currentState).toBe('recovery');
  });

  it('creates an ellipse telegraph for jump attacks', () => {
    const aggroState = {
      ...createBaseState('enemy_jump'),
      currentState: 'aggro' as const,
    };

    const result = advanceEnemyStateMachine(definition, aggroState, {
      nowMs: 100,
      deltaMs: 16,
      playerWorldX: 56,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });

    expect(result.state.currentAttackId).toBe('wretch_jump');
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'telegraph_show',
          shape: expect.objectContaining({ kind: 'ellipse' }),
        }),
      ]),
    );
  });

  it('can select jump, cone, and stab based on range and cooldown', () => {
    const jumpResult = advanceEnemyStateMachine(definition, {
      ...createBaseState('enemy_jump_select'),
      currentState: 'aggro',
    }, {
      nowMs: 100,
      deltaMs: 16,
      playerWorldX: 56,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    expect(jumpResult.state.currentAttackId).toBe('wretch_jump');

    const coneResult = advanceEnemyStateMachine(definition, {
      ...createBaseState('enemy_cone_select'),
      currentState: 'aggro',
    }, {
      nowMs: 100,
      deltaMs: 16,
      playerWorldX: 40,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    expect(coneResult.state.currentAttackId).toBe('wretch_cone');

    const stabState = createBaseState('enemy_stab_select');
    stabState.attackCooldownEndsAtMs.wretch_stab = 1_000;
    const fallbackCone = advanceEnemyStateMachine(definition, {
      ...stabState,
      currentState: 'aggro',
    }, {
      nowMs: 100,
      deltaMs: 16,
      playerWorldX: 24,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    expect(fallbackCone.state.currentAttackId).toBe('wretch_cone');

    const stabResult = advanceEnemyStateMachine(definition, {
      ...createBaseState('enemy_stab_ready'),
      currentState: 'aggro',
    }, {
      nowMs: 100,
      deltaMs: 16,
      playerWorldX: 24,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });
    expect(stabResult.state.currentAttackId).toBe('wretch_stab');
  });

  it('registers a hit when the player is inside the stab attack shape and not invulnerable', () => {
    const windupState = {
      ...createBaseState('enemy_02'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_stab',
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_02:wretch_stab:telegraph',
      attackRotationRad: 0,
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 20,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_stab', hit: true }),
      ]),
    );
  });

  it('hits when the player is inside the cone attack shape', () => {
    const windupState = {
      ...createBaseState('enemy_03'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_cone',
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_03:wretch_cone:telegraph',
      attackRotationRad: 0,
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 30,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_cone', hit: true }),
      ]),
    );
  });

  it('misses when the player is outside the cone attack shape', () => {
    const windupState = {
      ...createBaseState('enemy_04'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_cone',
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_04:wretch_cone:telegraph',
      attackRotationRad: 0,
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 0,
      playerWorldY: 30,
      playerInvulnerable: false,
      ...tileContext,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_cone', hit: false, reason: 'outside' }),
      ]),
    );
  });

  it('misses jump attacks when the player is outside the landing ellipse', () => {
    const windupState = {
      ...createBaseState('enemy_05'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_jump',
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_05:wretch_jump:telegraph',
      attackTargetWorldX: 48,
      attackTargetWorldY: 0,
      attackRotationRad: 0,
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 90,
      playerWorldY: 0,
      playerInvulnerable: false,
      ...tileContext,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_jump', hit: false, reason: 'outside' }),
      ]),
    );
  });

  it('misses when the player is invulnerable during the active check', () => {
    const windupState = {
      ...createBaseState('enemy_06'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_stab',
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_06:wretch_stab:telegraph',
      attackRotationRad: 0,
    };

    const result = advanceEnemyStateMachine(definition, windupState, {
      nowMs: 120,
      deltaMs: 16,
      playerWorldX: 20,
      playerWorldY: 0,
      playerInvulnerable: true,
      ...tileContext,
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_stab', hit: false, reason: 'invulnerable' }),
      ]),
    );
  });
});
