import type { GameEventBus } from '../events/GameEventBus';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import { ChoiceMenuState } from './ChoiceMenuState';
import type { ChoiceMenuOption, ChoiceMenuStateSnapshot } from './ChoiceMenuTypes';
import type { InteractionResult, InteractionTarget } from './InteractionTypes';

// Returned by ChoiceMenuHandler.onConfirm so systems declare what
// they want done without depending on ActionProgressSystem or the coordinator.
export type ChoiceMenuHandlerOutcome =
  | { kind: 'none' }
  | { kind: 'craft'; workbenchId: string; recipeId: string }
  | { kind: 'use_target'; target: InteractionTarget }
  | { kind: 'inspect_target'; target: InteractionTarget }
  | { kind: 'result'; result: InteractionResult; closeMenu?: boolean };

// Implemented by each system that can open a choice menu.
// The coordinator calls getOptions/onConfirm without knowing
// the concrete system type — adding a new menu only requires a
// new ChoiceMenuHandler, not editing the coordinator.
export type ChoiceMenuHandler = {
  readonly title: string;
  getOptions(playerState: PlayerSessionState): ChoiceMenuOption[];
  onConfirm(optionId: string, playerState: PlayerSessionState): ChoiceMenuHandlerOutcome;
};

// Returned by ChoiceMenuCoordinator.confirm() so WorldRuntimeCoordinator
// can act on the outcome without string matching.
export type ChoiceMenuConfirmResult =
  | { kind: 'none' }
  | { kind: 'disabled'; reason: string }
  | { kind: 'craft'; workbenchId: string; recipeId: string }
  | { kind: 'use_target'; target: InteractionTarget }
  | { kind: 'inspect_target'; target: InteractionTarget }
  | { kind: 'result'; result: InteractionResult };

export class ChoiceMenuCoordinator {
  private readonly state = new ChoiceMenuState();
  private handler: ChoiceMenuHandler | null = null;

  constructor(private readonly eventBus: GameEventBus) {}

  // Returns true if the menu was opened (handler has >1 option).
  tryOpen(handler: ChoiceMenuHandler, playerState: PlayerSessionState): boolean {
    const options = handler.getOptions(playerState);

    if (options.length <= 1) {
      return false;
    }

    this.handler = handler;
    this.state.open(handler.title, options);
    this.eventBus.emitSfx('menu_open');
    return true;
  }

  confirm(playerState: PlayerSessionState): ChoiceMenuConfirmResult {
    const selectedOption = this.state.getSelectedOption();

    if (!selectedOption || !this.handler) {
      return { kind: 'none' };
    }

    if (selectedOption.disabledReason) {
      this.eventBus.emitSfx('invalid_action');
      return { kind: 'disabled', reason: selectedOption.disabledReason };
    }

    const outcome = this.handler.onConfirm(selectedOption.id, playerState);

    if (outcome.kind === 'none') {
      this.eventBus.emitSfx('invalid_action');
      return { kind: 'none' };
    }

    this.eventBus.emitSfx('menu_confirm');

    if (outcome.kind === 'craft') {
      // Close menu — crafting starts as a timed action outside this class.
      this.state.cancel();
      this.handler = null;
      return { kind: 'craft', workbenchId: outcome.workbenchId, recipeId: outcome.recipeId };
    }

    if (outcome.kind === 'use_target') {
      this.state.cancel();
      this.handler = null;
      return { kind: 'use_target', target: outcome.target };
    }

    if (outcome.kind === 'inspect_target') {
      this.state.cancel();
      this.handler = null;
      return { kind: 'inspect_target', target: outcome.target };
    }

    if (outcome.closeMenu) {
      this.state.cancel();
      this.handler = null;
    } else {
      this.refreshOrClose(playerState);
    }

    return { kind: 'result', result: outcome.result };
  }

  cancel(): void {
    if (!this.state.isOpen()) {
      return;
    }

    this.state.cancel();
    this.handler = null;
    this.eventBus.emitSfx('menu_cancel');
  }

  moveSelection(delta: number): ChoiceMenuStateSnapshot | null {
    const snapshot = this.state.moveSelection(delta);

    if (snapshot) {
      this.eventBus.emitSfx('menu_select');
    }

    return snapshot;
  }

  setSelection(index: number): ChoiceMenuStateSnapshot | null {
    const snapshot = this.state.setSelection(index);

    if (snapshot) {
      this.eventBus.emitSfx('menu_select');
    }

    return snapshot;
  }

  getSnapshot(): ChoiceMenuStateSnapshot | null {
    return this.state.getSnapshot();
  }

  isOpen(): boolean {
    return this.state.isOpen();
  }

  private refreshOrClose(playerState: PlayerSessionState): void {
    if (!this.handler) {
      return;
    }

    const options = this.handler.getOptions(playerState);

    if (options.length === 0) {
      this.state.cancel();
      this.handler = null;
      return;
    }

    this.state.open(this.handler.title, options);
  }
}
