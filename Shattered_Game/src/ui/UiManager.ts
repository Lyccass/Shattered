import { ActionProgressPanel } from './ActionProgressPanel';
import Phaser from 'phaser';
import type { CombatUiSnapshot } from '../combat/CombatUiTypes';
import { formatSkillXpToastLines } from './UiFormatters';
import { ChoiceMenuPanel } from './ChoiceMenuPanel';
import { ToastSystem } from './ToastSystem';
import type { UiHandledResult, UiStateSnapshot } from './UiTypes';
import { UIOverlayManager } from './overlay/UIOverlayManager';

export interface UiManagerCallbacks {
  onCombatToggle: () => void;
  onSprintToggle: () => void;
}

export class UiManager {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly actionProgressPanel: ActionProgressPanel;
  private readonly choiceMenuPanel: ChoiceMenuPanel;
  private readonly toastSystem: ToastSystem;
  private readonly overlay: UIOverlayManager;

  constructor(
    private readonly scene: Phaser.Scene,
    callbacks: UiManagerCallbacks,
  ) {
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);

    // Phaser panels: only choice menus and action progress (no hint text)
    this.actionProgressPanel = new ActionProgressPanel(scene);
    this.choiceMenuPanel     = new ChoiceMenuPanel(scene);
    this.toastSystem         = new ToastSystem(scene);

    // HTML overlay handles all main game UI panels
    this.overlay = new UIOverlayManager({ onCombatToggle: callbacks.onCombatToggle, onSprintToggle: callbacks.onSprintToggle });

    const displayObjects = this.getPhaserDisplayObjects();
    this.scene.cameras.main.ignore(displayObjects);
    this.ignoreWorldForUiCamera(displayObjects);
    this.registerResizeHandler();
    this.layout();
  }

  update(
    state: UiStateSnapshot,
    combat: CombatUiSnapshot | null = null,
    controlMode: 'explore' | 'combat' = 'explore',
  ): void {
    this.actionProgressPanel.update(state.actionProgress);
    this.choiceMenuPanel.update(state.choiceMenu);
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
    return this.choiceMenuPanel.getOptionIndexAt(screenX, screenY);
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
    this.choiceMenuPanel.layout(width, height);
    this.toastSystem.layout(width);
  }

  private getPhaserDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.actionProgressPanel.getDisplayObjects(),
      ...this.choiceMenuPanel.getDisplayObjects(),
      ...this.toastSystem.getDisplayObjects(),
    ];
  }

  private handleAddedToScene: (child: Phaser.GameObjects.GameObject) => void = () => {};
}
