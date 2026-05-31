import { describe, expect, it } from 'vitest';
import {
  advanceDodgeMotion,
  createDodgeMotion,
  resolveClickMovementDodgeDirection,
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
import {
  doesEnemyHitEllipseIntersectPlayerLightAttackByRotation,
  getPlayerLightAttackHitbox,
  getPlayerLightAttackSlash,
} from '../../combat/CombatPlayerMath';
import { snapToIsometricGridDirection } from '../../combat/CombatGridDirection';
import {
  applyEnemyDamage,
  resetEnemyRuntimeState,
  shouldRespawnEnemy,
} from '../../combat/EnemyRuntimeStateUtils';
import { PlayerCombatState } from '../../combat/PlayerCombatState';

describe('CombatDodge', () => {
  it('snaps free-angle dodge aim to the nearest isometric grid direction', () => {
    expect(snapToIsometricGridDirection(0, 64, 32)).toEqual([1, -1]);
    expect(snapToIsometricGridDirection(Math.PI, 64, 32)).toEqual([-1, 1]);
    expect(snapToIsometricGridDirection(Math.PI / 2, 64, 32)).toEqual([1, 1]);
    expect(snapToIsometricGridDirection(-Math.PI / 2, 64, 32)).toEqual([-1, -1]);
  });

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

  it('prefers click-move direction, then enemy push-away, then last movement, then facing', () => {
    expect(resolveClickMovementDodgeDirection({
      currentMoveDirection: { x: 5, y: 2 },
      awayFromEnemyDirection: { x: -2, y: 0 },
      lastMovementDirection: { x: 0, y: -1 },
      facing: 'down',
    })).toEqual({ x: 1, y: 1 });

    expect(resolveClickMovementDodgeDirection({
      currentMoveDirection: null,
      awayFromEnemyDirection: { x: -2, y: 0 },
      lastMovementDirection: { x: 0, y: -1 },
      facing: 'down',
    })).toEqual({ x: -1, y: 0 });

    expect(resolveClickMovementDodgeDirection({
      currentMoveDirection: null,
      awayFromEnemyDirection: null,
      lastMovementDirection: { x: 0, y: -3 },
      facing: 'down',
    })).toEqual({ x: 0, y: -1 });

    expect(resolveClickMovementDodgeDirection({
      currentMoveDirection: null,
      awayFromEnemyDirection: null,
      lastMovementDirection: null,
      facing: 'left',
    })).toEqual({ x: -1, y: 0 });
  });
});

describe('Player light attack indicator math', () => {
  it('places the hit lane in front of the player and aligns the slash marker to it', () => {
    const hitbox = getPlayerLightAttackHitbox(100, 50, 'right');
    const slash = getPlayerLightAttackSlash(100, 50, 'right');

    expect(hitbox.worldX).toBeGreaterThan(100);
    expect(hitbox.worldY).toBe(50);
    expect(hitbox.shape).toEqual(
      expect.objectContaining({
        kind: 'rectangle',
        rotationRad: 0,
      }),
    );
    expect(slash.worldX).toBe(hitbox.worldX);
    expect(slash.worldY).toBe(hitbox.worldY);
    expect(slash.shape).toEqual(
      expect.objectContaining({
        kind: 'line',
      }),
    );
  });

  it('registers an overlap when the enemy body ellipse is inside the visible stab lane', () => {
    expect(
      doesEnemyHitEllipseIntersectPlayerLightAttackByRotation(
        100,
        50,
        0,
        {
          centerX: 150,
          centerY: 50,
          radiusX: 14,
          radiusY: 18,
        },
      ),
    ).toBe(true);

    expect(
      doesEnemyHitEllipseIntersectPlayerLightAttackByRotation(
        100,
        50,
        0,
        {
          centerX: 156,
          centerY: 72,
          radiusX: 10,
          radiusY: 10,
        },
      ),
    ).toBe(false);
  });
});

describe('PlayerCombatState', () => {
  it('starts with 10 HP and full stamina', () => {
    const state = new PlayerCombatState();

    expect(state.getSnapshot(0).currentHp).toBe(10);
    expect(state.getSnapshot(0).stamina).toBe(100);
  });

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
    expect(state.getSnapshot(1_000).stamina).toBe(85);
    expect(state.getSnapshot(1_050).isDodging).toBe(true);
  });

  it('uses more stamina when dodging while sprinting', () => {
    const state = new PlayerCombatState();

    expect(state.toggleSprint()).toEqual({ ok: true, active: true });
    expect(state.tryStartDodge(1_000)).toEqual({ ok: true });
    expect(state.getSnapshot(1_000).stamina).toBe(75);
    expect(state.getSnapshot(1_000).isSprinting).toBe(true);
  });

  it('keeps sprint active after starting a light attack', () => {
    const state = new PlayerCombatState();

    expect(state.toggleSprint()).toEqual({ ok: true, active: true });
    expect(state.tryStartLightAttack(1_000)).toEqual({ ok: true });
    expect(state.getSnapshot(1_000).isSprinting).toBe(true);
  });

  it('fails dodge when stamina is too low', () => {
    const state = new PlayerCombatState();

    state.tryStartDodge(0);
    state.tryStartDodge(500);
    state.tryStartDodge(1_000);
    state.tryStartDodge(1_500);
    state.tryStartDodge(2_000);
    state.tryStartDodge(2_500);

    expect(state.tryStartDodge(3_000)).toEqual({
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
    expect(state.getSnapshot(1_500).stamina).toBe(85);

    state.update(2_200, 700, false);
    expect(state.getSnapshot(2_200).stamina).toBeGreaterThan(85);
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
    state.tryStartDodge(500);
    state.tryStartDodge(1_000);
    state.update(1_950, 950, false);
    const outOfCombatStamina = state.getSnapshot(1_950).stamina;

    const combatState = new PlayerCombatState();
    combatState.enterCombat();
    combatState.tryStartDodge(0);
    combatState.tryStartDodge(500);
    combatState.tryStartDodge(1_000);
    combatState.update(1_950, 950, false);
    const combatStamina = combatState.getSnapshot(1_950).stamina;

    expect(outOfCombatStamina).toBeGreaterThan(combatStamina);
  });

  it('does not reduce HP on a successful dodge result', () => {
    const state = new PlayerCombatState();

    expect(state.tryStartDodge(0)).toEqual({ ok: true });
    const resolution = state.resolveIncomingAttack(100, 2, false);

    expect(resolution.kind).toBe('dodged');
    expect(resolution.damageApplied).toBe(0);
    expect(state.getSnapshot(100).currentHp).toBe(10);
  });

  it('prevents HP damage on a successful block and consumes stamina', () => {
    const state = new PlayerCombatState();
    state.enterCombat();
    state.setGuardHeld(true);

    const resolution = state.resolveIncomingAttack(100, 1, true);

    expect(resolution.kind).toBe('blocked');
    expect(state.getSnapshot(100).currentHp).toBe(10);
    expect(state.getSnapshot(100).stamina).toBe(90);
  });

  it('triggers guard break and full damage when stamina is too low', () => {
    const state = new PlayerCombatState();
    state.enterCombat();
    state.tryStartDodge(0);
    state.tryStartDodge(500);
    state.tryStartDodge(1_000);
    state.tryStartDodge(1_500);
    state.tryStartDodge(2_000);
    state.tryStartDodge(2_500);
    state.setGuardHeld(true);

    const resolution = state.resolveIncomingAttack(3_000, 2, true);

    expect(resolution.kind).toBe('guard_broken');
    expect(resolution.damageApplied).toBe(2);
    expect(state.getSnapshot(3_000).currentHp).toBe(8);
    expect(state.getSnapshot(3_000).isGuardBroken).toBe(true);
  });

  it('consumes stamina on player light attack and exposes the active timing window', () => {
    const state = new PlayerCombatState();

    expect(state.tryStartLightAttack(1_000)).toEqual({ ok: true });
    expect(state.getSnapshot(1_000).stamina).toBe(88);

    state.update(1_200, 200, false);
    expect(state.consumePendingLightAttackActivation()).toBe(true);
    expect(state.getSnapshot(1_200).lightAttackPhase).toBe('active');
  });

  it('refunds light-attack stamina on hit response', () => {
    const state = new PlayerCombatState();

    expect(state.tryStartLightAttack(1_000)).toEqual({ ok: true });
    expect(state.getSnapshot(1_000).stamina).toBe(88);

    state.refundLightAttackStamina();
    expect(state.getSnapshot(1_000).stamina).toBe(100);
  });

  it('prevents light-attack spam during recovery', () => {
    const state = new PlayerCombatState();

    expect(state.tryStartLightAttack(1_000)).toEqual({ ok: true });
    state.update(1_200, 200, false);
    state.consumePendingLightAttackActivation();
    state.update(1_400, 200, false);

    expect(state.getSnapshot(1_400).lightAttackPhase).toBe('recovery');
    expect(state.tryStartLightAttack(1_400)).toEqual({
      ok: false,
      reason: 'Still recovering.',
    });

    state.update(2_050, 650, false);
    expect(state.getSnapshot(2_050).lightAttackPhase).toBe('idle');
    expect(state.tryStartLightAttack(2_050)).toEqual({ ok: true });
  });

  it('restores the player safely after being downed', () => {
    const state = new PlayerCombatState();

    for (let index = 0; index < 5; index += 1) {
      state.resolveIncomingAttack(index * 10, 2, false);
    }

    expect(state.getSnapshot(50).currentHp).toBe(0);
    expect(state.getSnapshot(50).isDowned).toBe(true);

    state.update(1_550, 1_500, false);

    expect(state.consumeRecoveredFromDowned()).toBe(true);
    expect(state.getSnapshot(1_550).currentHp).toBe(10);
    expect(state.getSnapshot(1_550).stamina).toBe(100);
  });

  it('does not expose deflect or parry results yet', () => {
    const state = new PlayerCombatState();
    const observedKinds = new Set([
      state.resolveIncomingAttack(0, 1, false).kind,
      (() => {
        const guarded = new PlayerCombatState();
        guarded.setGuardHeld(true);
        return guarded.resolveIncomingAttack(0, 1, true).kind;
      })(),
    ]);

    expect(observedKinds.has('deflected' as never)).toBe(false);
    expect(observedKinds.has('parried' as never)).toBe(false);
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
    mapWidth: 64,
    mapHeight: 64,
    worldToTile: (worldX: number, worldY: number) => ({
      x: Math.round(worldX / 16),
      y: Math.round(worldY / 16),
    }),
    getTileCenterWorld: (tileX: number, tileY: number) => ({
      x: tileX * 16,
      y: tileY * 16,
    }),
    getTileDiamondPoints: (tileX: number, tileY: number) => {
      const centerX = tileX * 16;
      const centerY = tileY * 16;
      return [
        { x: centerX, y: centerY - 8 },
        { x: centerX + 16, y: centerY },
        { x: centerX, y: centerY + 8 },
        { x: centerX - 16, y: centerY },
      ];
    },
    isTileWalkable: () => true,
  };

  function buildUpdateContext(
    nowMs: number,
    playerWorldX: number,
    playerWorldY: number,
    playerInvulnerable = false,
  ) {
    return {
      nowMs,
      deltaMs: 16,
      playerWorldX,
      playerWorldY,
      playerInvulnerable,
      playerHitPoints: [{ x: playerWorldX, y: playerWorldY }],
      playerOccupiedTiles: [{
        x: Math.round(playerWorldX / 16),
        y: Math.round(playerWorldY / 16),
      }],
      playerEngagedWithEnemyId: null,
      playerTier: 1,
      ...tileContext,
    };
  }

  it('starts the training enemy with 5 HP and data-driven damage values', () => {
    expect(definition.maxHealth).toBe(5);
    expect(definition.attacks.find((attack) => attack.id === 'wretch_swipe')?.damage).toBe(1);
    expect(definition.attacks.find((attack) => attack.id === 'wretch_roar')?.damage).toBe(1);
    expect(definition.attacks.find((attack) => attack.id === 'wretch_jump')?.damage).toBe(2);
  });

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
    const swipeAttack = definition.attacks.find((attack) => attack.id === 'wretch_swipe');

    expect(swipeAttack).toBeDefined();
    const stabTiming = swipeAttack!.timing;

    let result = advanceEnemyStateMachine(definition, state, buildUpdateContext(0, 24, 0));
    result.state.currentState = 'aggro';

    result = advanceEnemyStateMachine(definition, result.state, buildUpdateContext(100, 24, 0));
    expect(result.state.currentState).toBe('windup');
    expect(result.state.currentAttackId).toBe('wretch_swipe');
    expect(result.events.some((event) => event.kind === 'telegraph_show')).toBe(true);

    result = advanceEnemyStateMachine(
      definition,
      result.state,
      buildUpdateContext(100 + stabTiming.windupMs + 1, 24, 0),
    );
    expect(result.state.currentState).toBe('active');

    result = advanceEnemyStateMachine(
      definition,
      result.state,
      buildUpdateContext(100 + stabTiming.windupMs + stabTiming.activeMs + 2, 24, 0),
    );
    expect(result.state.currentState).toBe('recovery');
  });

  it('creates an ellipse telegraph for jump attacks', () => {
    const aggroState = {
      ...createBaseState('enemy_jump'),
      currentState: 'aggro' as const,
    };

    const result = advanceEnemyStateMachine(definition, aggroState, buildUpdateContext(100, 80, 0));

    expect(result.state.currentAttackId).toBe('wretch_jump');
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'telegraph_show',
          shape: expect.objectContaining({ kind: 'ellipse' }),
          tiles: expect.any(Array),
        }),
      ]),
    );
  });

  it('can select leap, roar, and swipe based on range and cooldown', () => {
    // Jump/leap: player at 80 world units = 5 tiles — in leap range (4.5–9.5)
    const jumpResult = advanceEnemyStateMachine(definition, {
      ...createBaseState('enemy_jump_select'),
      currentState: 'aggro',
    }, buildUpdateContext(100, 80, 0));
    expect(jumpResult.state.currentAttackId).toBe('wretch_jump');

    // Roar: player at 48 world units = 3 tiles - in roar range while swipe is cooling down
    const roarState = createBaseState('enemy_roar_select');
    roarState.attackCooldownEndsAtMs.wretch_swipe = 1_000;
    const roarResult = advanceEnemyStateMachine(definition, {
      ...roarState,
      currentState: 'aggro',
    }, buildUpdateContext(100, 48, 0));
    expect(roarResult.state.currentAttackId).toBe('wretch_roar');

    // Swipe on cooldown — roar should fire instead at 1.5 tiles
    const swipeState = createBaseState('enemy_swipe_select');
    swipeState.attackCooldownEndsAtMs.wretch_swipe = 1_000;
    const fallbackRoar = advanceEnemyStateMachine(definition, {
      ...swipeState,
      currentState: 'aggro',
    }, buildUpdateContext(100, 24, 0));
    expect(fallbackRoar.state.currentAttackId).toBe('wretch_roar');

    // Swipe ready: player at 24 world units = 1.5 tiles — swipe fires first
    const swipeResult = advanceEnemyStateMachine(definition, {
      ...createBaseState('enemy_swipe_ready'),
      currentState: 'aggro',
    }, buildUpdateContext(100, 24, 0));
    expect(swipeResult.state.currentAttackId).toBe('wretch_swipe');
  });

  it('waits for the active window before resolving a hit', () => {
    const windupState = {
      ...createBaseState('enemy_02'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_swipe',
      phaseStartedAtMs: 0,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_02:wretch_swipe:telegraph',
      attackRotationRad: 0,
    };

    const result = advanceEnemyStateMachine(definition, windupState, buildUpdateContext(120, 20, 0));

    expect(result.state.currentState).toBe('active');
    expect(result.events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_swipe', damage: 1, hit: true }),
      ]),
    );

    const activeResult = advanceEnemyStateMachine(definition, result.state, buildUpdateContext(136, 20, 0));

    expect(activeResult.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_swipe', damage: 1, hit: true }),
      ]),
    );
  });

  it('hits when the player is inside the roar cone shape', () => {
    const windupState = {
      ...createBaseState('enemy_03'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_roar',
      phaseStartedAtMs: 0,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_03:wretch_roar:telegraph',
      attackRotationRad: 0,
    };

    const activeState = advanceEnemyStateMachine(definition, windupState, buildUpdateContext(120, 30, 0));

    const result = advanceEnemyStateMachine(definition, activeState.state, buildUpdateContext(136, 30, 0));

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_roar', damage: 1, hit: true }),
      ]),
    );
  });

  it('misses when the player is outside the roar cone shape', () => {
    const windupState = {
      ...createBaseState('enemy_04'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_roar',
      phaseStartedAtMs: 0,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_04:wretch_roar:telegraph',
      attackRotationRad: 0,
    };

    const activeState = advanceEnemyStateMachine(definition, windupState, buildUpdateContext(120, 0, 30));
    // roar activeMs=350, so phase ends at 120+350=470 — sample past that
    const result = advanceEnemyStateMachine(definition, activeState.state, buildUpdateContext(500, 0, 30));

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_roar', damage: 1, hit: false, reason: 'outside' }),
      ]),
    );
  });

  it('misses jump attacks when the player is outside the landing ellipse', () => {
    const windupState = {
      ...createBaseState('enemy_05'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_jump',
      phaseStartedAtMs: 0,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_05:wretch_jump:telegraph',
      attackTargetWorldX: 48,
      attackTargetWorldY: 0,
      attackRotationRad: 0,
    };

    const activeState = advanceEnemyStateMachine(definition, windupState, buildUpdateContext(120, 104, 0));

    const result = advanceEnemyStateMachine(definition, activeState.state, buildUpdateContext(450, 104, 0));

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_jump', damage: 2, hit: false, reason: 'outside' }),
      ]),
    );
  });

  it('misses when the player is invulnerable during the active check', () => {
    const windupState = {
      ...createBaseState('enemy_06'),
      currentState: 'windup' as const,
      currentAttackId: 'wretch_swipe',
      phaseStartedAtMs: 0,
      phaseEndsAtMs: 100,
      telegraphId: 'enemy_06:wretch_swipe:telegraph',
      attackRotationRad: 0,
    };

    const activeState = advanceEnemyStateMachine(definition, windupState, buildUpdateContext(120, 20, 0, true));

    const result = advanceEnemyStateMachine(definition, activeState.state, buildUpdateContext(136, 20, 0, true));

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'attack_result', attackId: 'wretch_swipe', damage: 1, hit: false, reason: 'invulnerable' }),
      ]),
    );
  });
});

describe('EnemySystem runtime HP/reset', () => {
  it('resets the enemy after HP reaches 0', () => {
    const definition = ENEMY_DEFINITIONS[0];
    const state = createEnemyRuntimeState(
      definition,
      {
        id: 'enemy_runtime_01',
        definitionId: definition.id,
        mapId: 'test_harbor',
        tileX: 10,
        tileY: 10,
      },
      160,
      80,
    );

    expect(state.health).toBe(5);
    const outcome = applyEnemyDamage(state, 5, 100, 1_800);
    expect(outcome).toEqual({
      state: expect.objectContaining({
        currentState: 'dead',
        health: 0,
        phaseEndsAtMs: 1_900,
      }),
      hit: true,
      killed: true,
      currentHp: 0,
    });
    expect(shouldRespawnEnemy(outcome.state, 2_000)).toBe(true);

    const resetState = resetEnemyRuntimeState(outcome.state, definition);
    expect(resetState.currentState).toBe('idle');
    expect(resetState.health).toBe(5);
  });
});
