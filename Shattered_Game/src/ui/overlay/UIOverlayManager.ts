import type { CombatUiSnapshot } from '../../combat/CombatUiTypes';
import type { SkillSnapshot } from '../../skills/SkillTypes';
import type { UIOverlayCallbacks, TabId } from './UITokens';
import type { UiStateSnapshot } from '../UiTypes';
import { EnemyPanel } from './panels/EnemyPanel';
import { MinimapPanel } from './panels/MinimapPanel';
import { ChatPanel } from './panels/ChatPanel';
import { TaskbarPanel } from './panels/TaskbarPanel';
import { XpDropPanel } from './panels/XpDropPanel';
import { ChoiceMenuPopup } from './panels/ChoiceMenuPopup';
import { PopupWindow } from './PopupWindow';
import { SkillDetailWindow } from './SkillDetailWindow';

export class UIOverlayManager {
  private readonly overlay: HTMLElement;
  private readonly enemyPanel: EnemyPanel;
  private readonly minimapPanel: MinimapPanel;
  private readonly chatPanel: ChatPanel;
  private readonly taskbarPanel: TaskbarPanel;
  private readonly xpDropPanel: XpDropPanel;
  private readonly choiceMenuPopup: ChoiceMenuPopup;
  private popup: PopupWindow | null = null;
  private lastSkillPopupId: string | null = null;
  private skillDetailWindow: SkillDetailWindow | null = null;

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
      callbacks.onInventoryItemDrop,
      callbacks.onInventoryItemInspect,
      callbacks.onInventoryItemCombine,
      (skill) => this.openSkillDetail(skill),
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

    // Live-update the open skill detail popup
    if (this.skillDetailWindow && this.lastSkillPopupId && this.popup?.isOpen()) {
      const snap = state.skills.find(s => s.id === this.lastSkillPopupId);
      if (snap) this.skillDetailWindow.update(snap);
    }
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

  /** Open the skill detail popup. Clicking the same skill again closes it (toggle). */
  openSkillDetail(skill: SkillSnapshot): void {
    const isSameSkillOpen = this.popup?.isOpen() && this.lastSkillPopupId === skill.id;
    if (this.popup?.isOpen()) {
      this.popup.destroy();
      this.popup = null;
      this.skillDetailWindow = null;
    }
    if (isSameSkillOpen) return;

    this.lastSkillPopupId = skill.id;
    const content = new SkillDetailWindow(skill);
    this.skillDetailWindow = content;
    this.popup = new PopupWindow(this.overlay, skill.displayName, () => {
      this.popup = null;
      this.skillDetailWindow = null;
    });
    this.popup.addModifier('ui-popup--skill');
    this.popup.open(content.el);
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
