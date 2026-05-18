import { describe, expect, it, vi } from 'vitest';
import { CombatAnimationStateController } from '../../combat/CombatAnimationStateController';
import {
  getAttackPhaseAtElapsed,
  getAttackTotalDuration,
  type AttackTimingDefinition,
} from '../../combat/CombatTiming';
import { TelegraphStore } from '../../combat/TelegraphStore';
import { InputSystem } from '../../input/InputSystem';
import type { InputCallbacks } from '../../input/InputTypes';

class FakeKeyboardPlugin {
  private readonly handlers = new Map<string, Set<(event: KeyboardEvent) => void>>();

  on(event: string, handler: (event: KeyboardEvent) => void): void {
    const set = this.handlers.get(event) ?? new Set<(event: KeyboardEvent) => void>();
    set.add(handler);
    this.handlers.set(event, set);
  }

  off(event: string, handler: (event: KeyboardEvent) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, overrides: Partial<KeyboardEvent> = {}): void {
    const keyboardEvent = {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      code: '',
      preventDefault: () => undefined,
      ...overrides,
    } as KeyboardEvent;
    this.handlers.get(event)?.forEach((handler) => handler(keyboardEvent));
  }
}

function createInputHarness() {
  const keyboard = new FakeKeyboardPlugin();
  const calls = {
    onInteract: vi.fn(),
    onStartPlacement: vi.fn(),
    onUseItem: vi.fn(),
    onCancelAction: vi.fn(),
    onCombatDodge: vi.fn(),
    onToggleSprint: vi.fn(),
    onMenuMoveUp: vi.fn(),
    onMenuMoveDown: vi.fn(),
    onMenuConfirm: vi.fn(),
    onMenuCancel: vi.fn(),
    onPlacementConfirm: vi.fn(),
    onPlacementCancel: vi.fn(),
    onToggleInventory: vi.fn(),
    onToggleJournal: vi.fn(),
    onToggleSkills: vi.fn(),
    onSaveNow: vi.fn(),
    onLoadSave: vi.fn(),
    onClearSave: vi.fn(),
    onDebugCycleZoom: vi.fn(),
    onDebugToggleGrid: vi.fn(),
    onDebugToggleChunk: vi.fn(),
    onDebugToggleObjects: vi.fn(),
    onDebugLogPlacement: vi.fn(),
  };
  const callbacks: InputCallbacks = {
    onInteract: calls.onInteract,
    onStartPlacement: calls.onStartPlacement,
    onUseItem: calls.onUseItem,
    onCancelAction: calls.onCancelAction,
    onCombatDodge: calls.onCombatDodge,
    onToggleSprint: calls.onToggleSprint,
    onMenuMoveUp: calls.onMenuMoveUp,
    onMenuMoveDown: calls.onMenuMoveDown,
    onMenuConfirm: calls.onMenuConfirm,
    onMenuCancel: calls.onMenuCancel,
    onPlacementConfirm: calls.onPlacementConfirm,
    onPlacementCancel: calls.onPlacementCancel,
    onToggleInventory: calls.onToggleInventory,
    onToggleJournal: calls.onToggleJournal,
    onToggleSkills: calls.onToggleSkills,
    onSaveNow: calls.onSaveNow,
    onLoadSave: calls.onLoadSave,
    onClearSave: calls.onClearSave,
    onDebugCycleZoom: calls.onDebugCycleZoom,
    onDebugToggleGrid: calls.onDebugToggleGrid,
    onDebugToggleChunk: calls.onDebugToggleChunk,
    onDebugToggleObjects: calls.onDebugToggleObjects,
    onDebugLogPlacement: calls.onDebugLogPlacement,
  };
  const scene = {
    input: {
      keyboard,
    },
  } as never;
  const system = new InputSystem(scene, callbacks);

  return { keyboard, callbacks: calls, system };
}

describe('Combat foundation input routing', () => {
  it('uses Space for dodge in normal mode instead of placement', () => {
    const { keyboard, callbacks, system } = createInputHarness();

    system.setMode('normal');
    keyboard.emit('keydown-SPACE');

    expect(callbacks.onStartPlacement).not.toHaveBeenCalled();
    expect(callbacks.onCancelAction).not.toHaveBeenCalled();
    expect(callbacks.onCombatDodge).toHaveBeenCalledTimes(1);
  });

  it('starts placement with B in normal mode', () => {
    const { keyboard, callbacks, system } = createInputHarness();

    system.setMode('normal');
    keyboard.emit('keydown-B');

    expect(callbacks.onStartPlacement).toHaveBeenCalledTimes(1);
  });

  it('confirms placement with E in placement mode', () => {
    const { keyboard, callbacks, system } = createInputHarness();

    system.setMode('placement');
    keyboard.emit('keydown-E');

    expect(callbacks.onPlacementConfirm).toHaveBeenCalledTimes(1);
    expect(callbacks.onInteract).not.toHaveBeenCalled();
  });

  it('cancels placement with Escape', () => {
    const { keyboard, callbacks, system } = createInputHarness();

    system.setMode('placement');
    keyboard.emit('keydown-ESC');

    expect(callbacks.onPlacementCancel).toHaveBeenCalledTimes(1);
    expect(callbacks.onCancelAction).not.toHaveBeenCalled();
  });

  it('routes menu, action-progress, and combat modes explicitly', () => {
    const { keyboard, callbacks, system } = createInputHarness();

    system.setMode('menu');
    keyboard.emit('keydown-W');
    keyboard.emit('keydown-E');
    keyboard.emit('keydown-SPACE');
    keyboard.emit('keydown-SHIFT');
    expect(callbacks.onMenuMoveUp).toHaveBeenCalledTimes(1);
    expect(callbacks.onMenuConfirm).toHaveBeenCalledTimes(1);
    expect(callbacks.onCombatDodge).not.toHaveBeenCalled();
    expect(callbacks.onToggleSprint).not.toHaveBeenCalled();

    system.setMode('action_progress');
    keyboard.emit('keydown-E');
    keyboard.emit('keydown-SPACE');
    keyboard.emit('keydown-ESC');
    expect(callbacks.onInteract).not.toHaveBeenCalled();
    expect(callbacks.onCancelAction).toHaveBeenCalledTimes(1);
    expect(callbacks.onCombatDodge).not.toHaveBeenCalled();

    system.setMode('placement');
    keyboard.emit('keydown-SPACE');
    keyboard.emit('keydown-SHIFT');
    expect(callbacks.onCombatDodge).not.toHaveBeenCalled();
    expect(callbacks.onToggleSprint).not.toHaveBeenCalled();

    system.setMode('combat');
    keyboard.emit('keydown-E');
    keyboard.emit('keydown-SPACE');
    keyboard.emit('keydown-SHIFT');
    expect(callbacks.onInteract).toHaveBeenCalledTimes(1);
    expect(callbacks.onCombatDodge).toHaveBeenCalledTimes(1);
    expect(callbacks.onToggleSprint).toHaveBeenCalledTimes(1);

    system.setMode('normal');
    keyboard.emit('keydown-SHIFT');
    expect(callbacks.onToggleSprint).toHaveBeenCalledTimes(2);
  });
});

describe('Combat timing foundation', () => {
  const timing: AttackTimingDefinition = {
    windupMs: 300,
    activeMs: 150,
    recoveryMs: 250,
  };

  it('calculates attack phase from elapsed time', () => {
    expect(getAttackPhaseAtElapsed(timing, 0)).toBe('windup');
    expect(getAttackPhaseAtElapsed(timing, 299)).toBe('windup');
    expect(getAttackPhaseAtElapsed(timing, 300)).toBe('active');
    expect(getAttackPhaseAtElapsed(timing, 449)).toBe('active');
    expect(getAttackPhaseAtElapsed(timing, 450)).toBe('recovery');
    expect(getAttackPhaseAtElapsed(timing, 699)).toBe('recovery');
    expect(getAttackPhaseAtElapsed(timing, 700)).toBe('complete');
    expect(getAttackTotalDuration(timing)).toBe(700);
  });
});

describe('TelegraphStore', () => {
  it('cleans up expired telegraphs over time', () => {
    const store = new TelegraphStore();
    store.showTelegraph({
      id: 'swing_warning',
      worldX: 100,
      worldY: 200,
      shape: { kind: 'circle', radius: 24 },
      startedAtMs: 1_000,
      durationMs: 600,
      warningColor: 0xef4444,
    });

    expect(store.getSnapshots(1_200)).toHaveLength(1);
    expect(store.getSnapshots(1_700)).toHaveLength(0);
  });
});

describe('CombatAnimationStateController', () => {
  it('keeps temporary combat states locked until their duration ends', () => {
    const controller = new CombatAnimationStateController();

    controller.syncMovementState(true, 100);
    expect(controller.getState(100)).toBe('move');

    controller.requestState('attack_windup', 200, 400);
    controller.syncMovementState(true, 300);
    expect(controller.getState(300)).toBe('attack_windup');

    controller.syncMovementState(true, 650);
    expect(controller.getState(650)).toBe('move');
  });
});
