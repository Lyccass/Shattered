import Phaser from 'phaser';
import type { InputCallbacks, InputMode } from './InputTypes';

// Centralises all keyboard input and routes it based on the current mode.
// GameScene calls setMode() each frame before delegating updates,
// keeping input routing explicit and preventing dual-use key conflicts.
export class InputSystem {
  private mode: InputMode = 'normal';
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  private readonly sceneInput: Phaser.Input.InputPlugin;

  private readonly keydownHandlers = new Map<string, (event: KeyboardEvent) => void>();
  private readonly keyupHandlers = new Map<string, (event: KeyboardEvent) => void>();
  private readonly rawKeydownHandlers: Array<(event: KeyboardEvent) => void> = [];
  private readonly pointerDownHandlers: Array<(pointer: Phaser.Input.Pointer) => void> = [];

  constructor(
    scene: Phaser.Scene,
    private readonly callbacks: InputCallbacks,
  ) {
    const keyboard = scene.input.keyboard;

    if (!keyboard) {
      throw new Error('InputSystem: keyboard plugin is unavailable');
    }

    this.keyboard = keyboard;
    this.sceneInput = scene.input;
    this.register();
  }

  setMode(mode: InputMode): void {
    this.mode = mode;
  }

  getMode(): InputMode {
    return this.mode;
  }

  // Returns true when the player controller should process movement input.
  shouldProcessMovement(): boolean {
    return this.mode !== 'menu';
  }

  destroy(): void {
    for (const [event, handler] of this.keydownHandlers) {
      this.keyboard.off(event, handler);
    }

    this.keydownHandlers.clear();

    for (const [event, handler] of this.keyupHandlers) {
      this.keyboard.off(event, handler);
    }

    this.keyupHandlers.clear();

    this.rawKeydownHandlers.forEach((handler) => {
      this.keyboard.off('keydown', handler);
    });
    this.rawKeydownHandlers.length = 0;

    this.pointerDownHandlers.forEach((handler) => {
      this.sceneInput.off('pointerdown', handler);
    });
    this.pointerDownHandlers.length = 0;
  }

  private on(key: string, handler: () => void): void {
    const event = `keydown-${key}`;
    const wrapped = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.altKey || keyboardEvent.ctrlKey || keyboardEvent.metaKey) {
        return;
      }

      handler();
    };

    this.keyboard.on(event, wrapped);
    this.keydownHandlers.set(event, wrapped);
  }

  private onAltCombo(code: string, handler: () => void): void {
    const wrapped = (keyboardEvent: KeyboardEvent) => {
      if (!keyboardEvent.altKey || keyboardEvent.ctrlKey || keyboardEvent.metaKey) {
        return;
      }

      if (keyboardEvent.code !== code) {
        return;
      }

      keyboardEvent.preventDefault();
      handler();
    };

    this.keyboard.on('keydown', wrapped);
    this.rawKeydownHandlers.push(wrapped);
  }

  private onKeyUp(key: string, handler: () => void): void {
    const event = `keyup-${key}`;
    const wrapped = () => {
      handler();
    };

    this.keyboard.on(event, wrapped);
    this.keyupHandlers.set(event, wrapped);
  }

  private onPointerDown(handler: (pointer: Phaser.Input.Pointer) => void): void {
    this.sceneInput.on('pointerdown', handler);
    this.pointerDownHandlers.push(handler);
  }

  private register(): void {
    // --- Debug (always active) ---
    this.on('Z', () => this.callbacks.onDebugCycleZoom());
    this.on('G', () => this.callbacks.onDebugToggleGrid());
    this.on('C', () => this.callbacks.onDebugToggleChunk());
    this.on('O', () => this.callbacks.onDebugToggleObjects());
    this.on('M', () => this.callbacks.onDebugLogPlacement());

    // --- E: interact / confirm ---
    this.on('E', () => {
      if (this.mode === 'menu') {
        this.callbacks.onMenuConfirm();
      } else if (this.mode === 'placement') {
        this.callbacks.onPlacementConfirm();
      } else if (this.mode === 'normal' || this.mode === 'combat') {
        this.callbacks.onInteract();
      }
    });

    // --- ENTER: confirm choice menu ---
    this.on('ENTER', () => {
      if (this.mode === 'menu') {
        this.callbacks.onMenuConfirm();
      }
    });

    // --- SPACE: dodge in normal/combat modes ---
    this.on('SPACE', () => {
      if (this.mode !== 'normal' && this.mode !== 'combat') {
        return;
      }

      this.callbacks.onCombatDodge();
    });

    // --- SHIFT: sprint toggle in normal/combat modes ---
    this.on('SHIFT', () => {
      if (this.mode !== 'normal' && this.mode !== 'combat') {
        return;
      }

      this.callbacks.onToggleSprint();
    });

    // --- Q held: guard in combat mode ---
    this.on('Q', () => {
      if (this.mode !== 'combat') {
        return;
      }

      this.callbacks.onGuardStart();
    });

    this.onKeyUp('Q', () => {
      this.callbacks.onGuardEnd();
    });

    // --- F / LMB: light attack in combat mode ---
    this.on('F', () => {
      if (this.mode !== 'combat') {
        return;
      }

      this.callbacks.onPlayerLightAttack();
    });

    this.onPointerDown((pointer) => {
      if (this.mode !== 'combat') {
        return;
      }

      if (pointer.button !== 0 && !pointer.leftButtonDown()) {
        return;
      }

      this.callbacks.onPlayerLightAttack();
    });

    // --- ESC: cancel active state ---
    this.on('ESC', () => {
      if (this.mode === 'action_progress') {
        this.callbacks.onCancelAction();
      } else if (this.mode === 'menu') {
        this.callbacks.onMenuCancel();
      } else if (this.mode === 'placement') {
        this.callbacks.onPlacementCancel();
      }
    });

    // --- W / UP: menu navigation up (only in menu mode) ---
    this.on('W', () => {
      if (this.mode === 'menu') {
        this.callbacks.onMenuMoveUp();
      }
    });

    this.on('UP', () => {
      if (this.mode === 'menu') {
        this.callbacks.onMenuMoveUp();
      }
    });

    // --- S / DOWN: menu navigation down (only in menu mode) ---
    this.on('S', () => {
      if (this.mode === 'menu') {
        this.callbacks.onMenuMoveDown();
      }
    });

    this.on('DOWN', () => {
      if (this.mode === 'menu') {
        this.callbacks.onMenuMoveDown();
      }
    });

    // --- B: start placement (normal mode only) ---
    this.on('B', () => {
      if (this.mode === 'normal') {
        this.callbacks.onStartPlacement();
      }
    });

    // --- T: use item (normal mode only) ---
    this.on('T', () => {
      if (this.mode === 'normal') {
        this.callbacks.onUseItem('warm_tea');
      }
    });

    // --- Panel toggles (normal mode only) ---
    this.on('I', () => {
      if (this.mode === 'normal') {
        this.callbacks.onToggleInventory();
      }
    });

    this.on('J', () => {
      if (this.mode === 'normal') {
        this.callbacks.onToggleJournal();
      }
    });

    this.on('P', () => {
      if (this.mode === 'normal') {
        this.callbacks.onToggleSkills();
      }
    });

    // --- Local persistence controls ---
    this.onAltCombo('KeyV', () => {
      this.callbacks.onSaveNow();
    });

    this.onAltCombo('KeyL', () => {
      this.callbacks.onLoadSave();
    });

    this.onAltCombo('KeyR', () => {
      this.callbacks.onClearSave();
    });
  }
}
