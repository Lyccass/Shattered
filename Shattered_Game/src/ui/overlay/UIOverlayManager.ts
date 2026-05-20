import type { CombatUiSnapshot } from '../../combat/CombatUiTypes';
import type { UIOverlayCallbacks, TabId } from './UITokens';
import type { UiStateSnapshot } from '../UiTypes';
import { EnemyPanel } from './panels/EnemyPanel';
import { MinimapPanel } from './panels/MinimapPanel';
import { ChatPanel } from './panels/ChatPanel';
import { TaskbarPanel } from './panels/TaskbarPanel';
import { XpDropPanel } from './panels/XpDropPanel';
import { ChoiceMenuPopup } from './panels/ChoiceMenuPopup';
import { PopupWindow } from './PopupWindow';

export class UIOverlayManager {
  private readonly overlay: HTMLElement;
  private readonly enemyPanel: EnemyPanel;
  private readonly minimapPanel: MinimapPanel;
  private readonly chatPanel: ChatPanel;
  private readonly taskbarPanel: TaskbarPanel;
  private readonly xpDropPanel: XpDropPanel;
  private readonly choiceMenuPopup: ChoiceMenuPopup;
  private popup: PopupWindow | null = null;

  constructor(callbacks: UIOverlayCallbacks) {
    // Locate or create the overlay div (created in index.html)
    this.overlay = document.getElementById('ui-overlay') as HTMLElement;

    this.enemyPanel      = new EnemyPanel(this.overlay);
    this.minimapPanel    = new MinimapPanel(this.overlay);
    this.chatPanel       = new ChatPanel(this.overlay);
    this.taskbarPanel    = new TaskbarPanel(
      this.overlay,
      callbacks.onCombatToggle,
      callbacks.onSprintToggle,
      callbacks.onInventoryItemUse,
    );
    this.xpDropPanel     = new XpDropPanel(this.overlay);
    this.choiceMenuPopup = new ChoiceMenuPopup(
      this.overlay,
      callbacks.onChoiceMenuSelect,
      callbacks.onChoiceMenuConfirm,
      callbacks.onChoiceMenuCancel,
    );
  }

  update(
    state: UiStateSnapshot,
    combat: CombatUiSnapshot | null,
    controlMode: 'explore' | 'combat',
  ): void {
    this.choiceMenuPopup.update(state.choiceMenu);
    this.enemyPanel.update(combat);
    this.minimapPanel.updatePlayerStats(
      combat?.player?.currentHp   ?? null,
      combat?.player?.maxHp       ?? null,
      combat?.player?.stamina     ?? null,
      combat?.player?.maxStamina  ?? null,
    );
    this.taskbarPanel.setCombatMode(controlMode === 'combat');
    this.taskbarPanel.setSprintMode(combat?.player?.isSprinting ?? false);
    this.taskbarPanel.update(
      state.inventory,
      state.currency,
      state.journalEntries,
      state.reputation,
      state.activeTaskCount,
      state.skills,
    );
  }

  /** Push a chat/log message from the game. Reward channel also shows XP drop popup. */
  pushMessage(text: string, channel: 'game' | 'combat' | 'system' | 'reward' | 'error' = 'game'): void {
    this.chatPanel.push(text, channel);
    if (channel === 'reward') {
      this.xpDropPanel.push(text);
    }
  }

  tick(): void {
    this.xpDropPanel.tick();
  }

  /** Open a sidebar tab programmatically (e.g. keyboard shortcut). */
  openTab(tabId: TabId): void {
    this.taskbarPanel.openTab(tabId);
  }

  /** Toggle a sidebar tab (open if closed, close if open). */
  toggleTab(tabId: TabId): boolean {
    const wasOpen = this.taskbarPanel.isTabOpen(tabId);
    this.taskbarPanel.openTab(tabId);
    return !wasOpen;
  }

  getChoiceMenuOptionIndexAt(screenX: number, screenY: number): number | null {
    return this.choiceMenuPopup.getOptionIndexAt(screenX, screenY);
  }

  /**
   * Open a reusable popup window centred over the game.
   * If a popup with the same title is already open it is closed (toggle behaviour).
   * Pass a new contentEl to swap content while keeping the window open.
   */
  openPopup(title: string, contentEl: HTMLElement, onClose?: () => void): void {
    if (this.popup?.isOpen()) {
      this.popup.destroy();
      this.popup = null;
      return;
    }
    this.popup = new PopupWindow(this.overlay, title, onClose);
    this.popup.open(contentEl);
  }

  closePopup(): void {
    this.popup?.close();
    this.popup = null;
  }

  destroy(): void {
    this.enemyPanel.destroy();
    this.minimapPanel.destroy();
    this.chatPanel.destroy();
    this.taskbarPanel.destroy();
    this.xpDropPanel.destroy();
    this.choiceMenuPopup.destroy();
    this.popup?.destroy();
  }
}
