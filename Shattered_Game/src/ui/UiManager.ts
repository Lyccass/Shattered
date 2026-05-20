import { ActionProgressPanel } from './ActionProgressPanel';
import Phaser from 'phaser';
import type { CombatUiSnapshot } from '../combat/CombatUiTypes';
import { formatSkillXpToastLines } from './UiFormatters';
import { ToastSystem } from './ToastSystem';
import type { UiHandledResult, UiStateSnapshot } from './UiTypes';
import { UIOverlayManager } from './overlay/UIOverlayManager';

export interface UiManagerCallbacks {
  onCombatToggle: () => void;
  onSprintToggle: () => void;
  onChoiceMenuSelect: (index: number) => void;
  onChoiceMenuConfirm: () => void;
  onChoiceMenuCancel: () => void;
}

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
      onCombatToggle:      callbacks.onCombatToggle,
      onSprintToggle:      callbacks.onSprintToggle,
      onChoiceMenuSelect:  callbacks.onChoiceMenuSelect,
      onChoiceMenuConfirm: callbacks.onChoiceMenuConfirm,
      onChoiceMenuCancel:  callbacks.onChoiceMenuCancel,
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
    combat: CombatUiSnapshot | null = null,
    controlMode: 'explore' | 'combat' = 'explore',
  ): void {
    this.actionProgressPanel.update(state.actionProgress);
    this.toastSystem.update();

    this.overlay.update(state, combat, controlMode);
    this.overlay.tick();
  }

  handleResult(result: UiHandledResult | null): void {
    if (!result) return;

    // Primary message → chat
    const channel = result.toastKind === 'reward'
      ? 'reward'
      : result.ok ? 'game' : 'error';
    this.overlay.pushMessage(result.message, channel);

    // XP lines → chat as reward
    formatSkillXpToastLines(result.xpDelta).forEach((line) => {
      this.overlay.pushMessage(line, 'reward');
    });

    // Only show a Phaser popup for hard errors so the player never misses them
    if (!result.ok) {
      this.toastSystem.push(result.message, 'error');
    }
  }

  showInfo(message: string): void {
    this.overlay.pushMessage(message, 'system');
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
