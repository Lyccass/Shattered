import { ActionProgressPanel } from './ActionProgressPanel';
import Phaser from 'phaser';
import type { TurnCombatUiSnapshot } from '../combat/CombatUiTypes';
import { formatSkillXpToastLines } from './UiFormatters';
import { ToastSystem } from './ToastSystem';
import type { MinimapSnapshot, UiHandledResult, UiStateSnapshot } from './UiTypes';
import { UIOverlayManager } from './overlay/UIOverlayManager';
import type { ShopPopupCallbacks } from './overlay/ShopPopupContent';
import type { ShopSnapshot } from '../trading/TraderTypes';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import { SKILL_UNLOCKS } from '../skills/SkillUnlockData';
import { SkillUnlockRegistry } from '../skills/SkillUnlockRegistry';

export interface UiManagerCallbacks {
  onCombatToggle: () => void;
  onCombatEndTurn: () => void;
  onCombatAttackMode: (attackId?: string) => void;
  onCombatGuard: () => void;
  onCombatCleanse: () => void;
  onSprintToggle: () => void;
  onInventoryItemUse: (itemId: string) => void;
  onInventoryItemDrop: (itemId: string) => void;
  onInventoryItemInspect: (itemId: string) => void;
  onInventoryItemCombine: (sourceId: string, targetId: string) => void;
  onEquipmentUnequip: (slot: string) => void;
  onChoiceMenuSelect: (index: number) => void;
  onChoiceMenuConfirm: () => void;
  onChoiceMenuCancel: () => void;
  onMinimapClick: () => void;
  onMinimapZoom: (delta: number) => void;
  onMapTileQuery: (tileX: number, tileY: number) => { terrain: string | null; walkable: boolean } | null;
}

const UNLOCK_REGISTRY = new SkillUnlockRegistry(SKILL_UNLOCKS);

export class UiManager {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly actionProgressPanel: ActionProgressPanel;
  private readonly toastSystem: ToastSystem;
  private readonly overlay: UIOverlayManager;

  constructor(
    private readonly scene: Phaser.Scene,
    callbacks: UiManagerCallbacks,
  ) {
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);

    this.actionProgressPanel = new ActionProgressPanel(scene);
    this.toastSystem         = new ToastSystem(scene);

    this.overlay = new UIOverlayManager({
      onCombatToggle:          callbacks.onCombatToggle,
      onCombatEndTurn:         callbacks.onCombatEndTurn,
      onCombatAttackMode:      callbacks.onCombatAttackMode,
      onCombatGuard:           callbacks.onCombatGuard,
      onCombatCleanse:         callbacks.onCombatCleanse,
      onSprintToggle:          callbacks.onSprintToggle,
      onInventoryItemUse:      callbacks.onInventoryItemUse,
      onInventoryItemDrop:     callbacks.onInventoryItemDrop,
      onInventoryItemInspect:  callbacks.onInventoryItemInspect,
      onInventoryItemCombine:  callbacks.onInventoryItemCombine,
      onEquipmentUnequip:      callbacks.onEquipmentUnequip,
      onChoiceMenuSelect:      callbacks.onChoiceMenuSelect,
      onChoiceMenuConfirm:     callbacks.onChoiceMenuConfirm,
      onChoiceMenuCancel:      callbacks.onChoiceMenuCancel,
      onMinimapClick:          callbacks.onMinimapClick,
      onMinimapZoom:           callbacks.onMinimapZoom,
      onMapTileQuery:          callbacks.onMapTileQuery,
    });

    const displayObjects = this.getPhaserDisplayObjects();
    if (displayObjects.length > 0) {
      this.scene.cameras.main.ignore(displayObjects);
      this.ignoreWorldForUiCamera(displayObjects);
    }
    this.registerResizeHandler();
    this.layout();
  }

  update(
    state: UiStateSnapshot,
    combat: TurnCombatUiSnapshot | null = null,
    controlMode: 'explore' | 'combat' = 'explore',
    combatStanceActive = false,
    minimap: MinimapSnapshot | null = null,
  ): void {
    this.actionProgressPanel.update(state.actionProgress);
    this.toastSystem.update();

    this.overlay.update(state, combat, controlMode, combatStanceActive, minimap);
    this.overlay.tick();
  }

  handleResult(result: UiHandledResult | null): void {
    if (!result) return;

    // Combat log line (damage dealt/received) → dedicated combat channel
    if (result.combatLog) {
      this.overlay.pushMessage(result.combatLog, 'combat');
    }

    // Primary message → chat
    const channel = result.toastKind === 'reward'
      ? 'reward'
      : result.ok ? 'game' : 'error';
    this.overlay.pushMessage(result.message, channel);

    // XP lines → chat as reward
    formatSkillXpToastLines(result.xpDelta).forEach((line) => {
      this.overlay.pushMessage(line, 'reward');
    });

    // Level-up announcements
    if (result.levelUps) {
      for (const lu of result.levelUps) {
        const header = lu.rankedUp
          ? `★ ${lu.displayName.toUpperCase()} RANK UP — Rank ${lu.rank} unlocked!`
          : `↑ ${lu.displayName} — Rank ${lu.rank} · Stage ${lu.stage} reached!`;
        this.overlay.pushMessage(header, 'reward');
        const newUnlocks = UNLOCK_REGISTRY.getNewAtRankStage(lu.skillId, lu.rank, lu.stage);
        for (const unlock of newUnlocks) {
          const desc = unlock.description ? ` — ${unlock.description}` : '';
          this.overlay.pushMessage(`  New: ${unlock.displayName}${desc}`, 'reward');
        }
      }
    }

    // Only show a Phaser popup for hard errors so the player never misses them
    if (!result.ok) {
      this.toastSystem.push(result.message, 'error');
    }
  }

  showInfo(message: string): void {
    this.overlay.pushMessage(message, 'system');
  }

  pushMessage(message: string, channel: 'game' | 'error' | 'reward' | 'system' = 'game'): void {
    this.overlay.pushMessage(message, channel);
  }

  toggleJournal(): boolean {
    return this.overlay.toggleTab('journal');
  }

  toggleInventory(): boolean {
    return this.overlay.toggleTab('inventory');
  }

  toggleSkills(): boolean {
    return this.overlay.toggleTab('journal');
  }

  toggleMapWindow(playerTileX: number, playerTileY: number): void {
    this.overlay.toggleMapWindow(playerTileX, playerTileY);
  }

  openShop(
    shopId: string,
    shopSnapshot: ShopSnapshot,
    inventory: PlayerInventorySnapshot,
    currency: CurrencySnapshot,
    callbacks: ShopPopupCallbacks,
  ): void {
    this.overlay.openShop(shopId, shopSnapshot, inventory, currency, callbacks);
  }

  getChoiceMenuOptionIndexAt(screenX: number, screenY: number): number | null {
    return this.overlay.getChoiceMenuOptionIndexAt(screenX, screenY);
  }

  destroy(): void {
    this.scene.scale.off('resize', this.handleResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.handleAddedToScene);
    this.getPhaserDisplayObjects().forEach((obj) => obj.destroy());
    this.scene.cameras.remove(this.uiCamera);
    this.overlay.destroy();
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.uiCamera.setViewport(0, 0, gameSize.width, gameSize.height);
    this.layout();
  };

  private registerResizeHandler(): void {
    this.scene.scale.on('resize', this.handleResize);
  }

  private ignoreWorldForUiCamera(uiObjects: Phaser.GameObjects.GameObject[]): void {
    const isUiObject = (c: Phaser.GameObjects.GameObject): boolean => uiObjects.includes(c);
    const existing = this.scene.children.getChildren().filter((c) => !isUiObject(c));
    this.uiCamera.ignore(existing);

    this.handleAddedToScene = (child: Phaser.GameObjects.GameObject) => {
      if (!isUiObject(child)) this.uiCamera.ignore(child);
    };
    this.scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.handleAddedToScene);
  }

  private layout(): void {
    const width  = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.actionProgressPanel.layout(width, height);
    this.toastSystem.layout(width);
  }

  private getPhaserDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.actionProgressPanel.getDisplayObjects(),
      ...this.toastSystem.getDisplayObjects(),
    ];
  }

  private handleAddedToScene: (child: Phaser.GameObjects.GameObject) => void = () => {};
}
