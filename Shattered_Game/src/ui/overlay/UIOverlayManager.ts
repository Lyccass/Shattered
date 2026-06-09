import type { TurnCombatUiSnapshot } from '../../combat/CombatUiTypes';
import type { SkillSnapshot } from '../../skills/SkillTypes';
import type { UIOverlayCallbacks, TabId } from './UITokens';
import type { MinimapSnapshot, UiStateSnapshot } from '../UiTypes';
import { EnemyPanel } from './panels/EnemyPanel';
import { MinimapPanel } from './panels/MinimapPanel';
import { MapWindow } from './MapWindow';
import { ChatPanel } from './panels/ChatPanel';
import { TaskbarPanel } from './panels/TaskbarPanel';
import { XpDropPanel } from './panels/XpDropPanel';
import { ChoiceMenuPopup } from './panels/ChoiceMenuPopup';
import { CombatHud } from './panels/CombatHud';
import { PopupWindow } from './PopupWindow';
import { SkillDetailWindow } from './SkillDetailWindow';
import { ShopPopupContent, type ShopPopupCallbacks } from './ShopPopupContent';
import type { ShopSnapshot } from '../../trading/TraderTypes';
import type { PlayerInventorySnapshot } from '../../player/PlayerInventoryState';
import type { CurrencySnapshot } from '../../player/PlayerCurrencyState';

export class UIOverlayManager {
  private readonly overlay: HTMLElement;
  private readonly enemyPanel: EnemyPanel;
  private readonly minimapPanel: MinimapPanel;
  private readonly chatPanel: ChatPanel;
  private readonly taskbarPanel: TaskbarPanel;
  private readonly xpDropPanel: XpDropPanel;
  private readonly choiceMenuPopup: ChoiceMenuPopup;
  private readonly combatHud: CombatHud;
  private readonly mapContent: MapWindow;
  private readonly mapPopup: PopupWindow;
  private lastPlayerTileX = 0;
  private lastPlayerTileY = 0;
  private popup: PopupWindow | null = null;
  private lastSkillPopupId: string | null = null;
  private skillDetailWindow: SkillDetailWindow | null = null;
  private shopContent: ShopPopupContent | null = null;
  private openShopId: string | null = null;

  constructor(callbacks: UIOverlayCallbacks) {
    // Locate or create the overlay div (created in index.html)
    this.overlay = document.getElementById('ui-overlay') as HTMLElement;

    this.enemyPanel      = new EnemyPanel(this.overlay);
    this.minimapPanel    = new MinimapPanel(this.overlay, () => callbacks.onMinimapClick(), (d) => callbacks.onMinimapZoom(d));
    this.mapContent      = new MapWindow(callbacks.onMapTileQuery);
    this.mapPopup        = new PopupWindow(this.overlay, 'World Map');
    this.mapPopup.addModifier('ui-popup--map');
    this.mapPopup.setContent(this.mapContent.el);
    this.chatPanel       = new ChatPanel(this.overlay);
    this.taskbarPanel    = new TaskbarPanel(
      this.overlay,
      callbacks.onCombatToggle,
      callbacks.onSprintToggle,
      callbacks.onInventoryItemUse,
      callbacks.onInventoryItemDrop,
      callbacks.onInventoryItemInspect,
      callbacks.onInventoryItemCombine,
      callbacks.onEquipmentUnequip,
      (skill) => this.openSkillDetail(skill),
      () => this.toggleMapWindow(this.lastPlayerTileX, this.lastPlayerTileY),
    );
    this.xpDropPanel     = new XpDropPanel(this.overlay);
    this.combatHud       = new CombatHud(
      this.overlay,
      callbacks.onCombatEndTurn,
      callbacks.onCombatAttackMode,
      callbacks.onCombatGuard,
      callbacks.onCombatCleanse,
    );
    this.choiceMenuPopup = new ChoiceMenuPopup(
      this.overlay,
      callbacks.onChoiceMenuSelect,
      callbacks.onChoiceMenuConfirm,
      callbacks.onChoiceMenuCancel,
    );
  }

  update(
    state: UiStateSnapshot,
    combat: TurnCombatUiSnapshot | null,
    controlMode: 'explore' | 'combat',
    combatStanceActive = false,
    minimap: MinimapSnapshot | null = null,
  ): void {
    this.choiceMenuPopup.update(state.choiceMenu);
    this.combatHud.update(combat);
    this.enemyPanel.update(combat);
    this.minimapPanel.updatePlayerStats(
      combat?.playerCurrentHp ?? null,
      combat?.playerMaxHp     ?? null,
      null,
      null,
    );
    this.minimapPanel.updateMap(minimap);
    if (this.mapPopup.isOpen()) this.mapContent.update(minimap);
    if (minimap) {
      this.lastPlayerTileX = minimap.playerTileX;
      this.lastPlayerTileY = minimap.playerTileY;
    }
    this.taskbarPanel.setCombatMode(
      controlMode === 'combat'
        ? 'engaged'
        : combatStanceActive ? 'armed' : 'passive',
    );
    this.taskbarPanel.setSprintMode(combat?.isSprinting ?? false);
    this.taskbarPanel.update(
      state.inventory,
      state.currency,
      state.journalEntries,
      state.reputation,
      state.activeTaskCount,
      state.skills,
      state.equipment,
    );

    // Live-update the open skill detail popup
    if (this.skillDetailWindow && this.lastSkillPopupId && this.popup?.isOpen()) {
      const snap = state.skills.find(s => s.id === this.lastSkillPopupId);
      if (snap) this.skillDetailWindow.update(snap);
    }
  }

  toggleMapWindow(playerTileX: number, playerTileY: number): void {
    if (this.mapPopup.isOpen()) {
      this.mapPopup.close();
    } else {
      this.mapContent.setCenter(playerTileX, playerTileY);
      this.mapPopup.open();
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

  /**
   * Open (or toggle) the shop popup for the given shopId.
   * Calling with the same shopId while already open closes it.
   */
  openShop(
    shopId: string,
    shopSnapshot: ShopSnapshot,
    inventory: PlayerInventorySnapshot,
    currency: CurrencySnapshot,
    callbacks: ShopPopupCallbacks,
  ): void {
    const isSameShopOpen = this.popup?.isOpen() && this.openShopId === shopId;
    if (this.popup?.isOpen()) {
      this.popup.destroy();
      this.popup = null;
      this.shopContent = null;
      this.openShopId = null;
    }
    if (isSameShopOpen) return;

    this.openShopId = shopId;
    this.shopContent = new ShopPopupContent(shopSnapshot, inventory, currency, callbacks);
    this.popup = new PopupWindow(this.overlay, shopSnapshot.displayName, () => {
      this.popup = null;
      this.shopContent = null;
      this.openShopId = null;
    });
    this.popup.addModifier('ui-popup--shop');
    this.popup.open(this.shopContent.el);
  }

  destroy(): void {
    this.combatHud.destroy();
    this.enemyPanel.destroy();
    this.minimapPanel.destroy();
    this.mapPopup.destroy();
    this.mapContent.destroy();
    this.chatPanel.destroy();
    this.taskbarPanel.destroy();
    this.xpDropPanel.destroy();
    this.choiceMenuPopup.destroy();
    this.popup?.destroy();
  }
}
