import { ActionProgressPanel } from './ActionProgressPanel';
import Phaser from 'phaser';
import type { CombatUiSnapshot } from '../combat/CombatUiTypes';
import { formatPromptPanelText, formatSkillXpToastLines } from './UiFormatters';
import { ChoiceMenuPanel } from './ChoiceMenuPanel';
import { CombatPanel } from './CombatPanel';
import { HudPanel } from './HudPanel';
import { InventoryPanel } from './InventoryPanel';
import { JournalPanel } from './JournalPanel';
import { PromptPanel } from './PromptPanel';
import { SkillPanel } from './SkillPanel';
import { ToastSystem } from './ToastSystem';
import type { UiHandledResult, UiStateSnapshot } from './UiTypes';

export class UiManager {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly promptPanel: PromptPanel;
  private readonly hudPanel: HudPanel;
  private readonly combatPanel: CombatPanel;
  private readonly actionProgressPanel: ActionProgressPanel;
  private readonly inventoryPanel: InventoryPanel;
  private readonly choiceMenuPanel: ChoiceMenuPanel;
  private readonly journalPanel: JournalPanel;
  private readonly skillPanel: SkillPanel;
  private readonly toastSystem: ToastSystem;

  constructor(private readonly scene: Phaser.Scene) {
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.promptPanel = new PromptPanel(scene);
    this.hudPanel = new HudPanel(scene);
    this.combatPanel = new CombatPanel(scene);
    this.actionProgressPanel = new ActionProgressPanel(scene);
    this.inventoryPanel = new InventoryPanel(scene);
    this.choiceMenuPanel = new ChoiceMenuPanel(scene);
    this.journalPanel = new JournalPanel(scene);
    this.skillPanel = new SkillPanel(scene);
    this.toastSystem = new ToastSystem(scene);

    const displayObjects = this.getDisplayObjects();
    this.scene.cameras.main.ignore(displayObjects);
    this.ignoreWorldForUiCamera(displayObjects);
    this.registerResizeHandler();
    this.layout();
  }

  update(state: UiStateSnapshot, combat: CombatUiSnapshot | null = null): void {
    this.promptPanel.update(
      state.choiceMenu || state.actionProgress
        ? ''
        : formatPromptPanelText(state.activeInteraction, state.placementState),
    );
    this.hudPanel.update(
      state.inventory,
      state.activeEffects,
    );
    this.combatPanel.update(combat);
    this.actionProgressPanel.update(state.actionProgress);
    this.inventoryPanel.update(
      state.inventory,
      state.currency,
    );
    this.choiceMenuPanel.update(state.choiceMenu);
    this.journalPanel.update(
      state.journalEntries,
      state.reputation,
      state.activeTaskCount,
    );
    this.skillPanel.update(state.skills);
    this.toastSystem.update();
  }

  handleResult(result: UiHandledResult | null): void {
    if (!result) {
      return;
    }

    this.toastSystem.push(result.message, result.toastKind ?? (result.ok ? 'success' : 'error'));
    formatSkillXpToastLines(result.xpDelta).forEach((line) => {
      this.toastSystem.push(line, 'reward');
    });
  }

  showInfo(message: string): void {
    this.toastSystem.push(message, 'info');
  }

  toggleJournal(): boolean {
    return this.journalPanel.toggle();
  }

  toggleInventory(): boolean {
    return this.inventoryPanel.toggle();
  }

  toggleSkills(): boolean {
    return this.skillPanel.toggle();
  }

  getChoiceMenuOptionIndexAt(screenX: number, screenY: number): number | null {
    return this.choiceMenuPanel.getOptionIndexAt(screenX, screenY);
  }

  destroy(): void {
    this.scene.scale.off('resize', this.handleResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.handleAddedToScene);
    this.getDisplayObjects().forEach((displayObject) => displayObject.destroy());
    this.scene.cameras.remove(this.uiCamera);
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.uiCamera.setViewport(0, 0, gameSize.width, gameSize.height);
    this.layout();
  };

  private registerResizeHandler(): void {
    this.scene.scale.on('resize', this.handleResize);
  }

  private ignoreWorldForUiCamera(uiObjects: Phaser.GameObjects.GameObject[]): void {
    const isUiObject = (child: Phaser.GameObjects.GameObject): boolean =>
      uiObjects.includes(child);

    const existing = this.scene.children.getChildren().filter((child) => !isUiObject(child));
    this.uiCamera.ignore(existing);

    this.handleAddedToScene = (child: Phaser.GameObjects.GameObject) => {
      if (!isUiObject(child)) {
        this.uiCamera.ignore(child);
      }
    };
    this.scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.handleAddedToScene);
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.promptPanel.layout(width, height);
    this.hudPanel.layout(width, height);
    this.combatPanel.layout(width, height);
    this.actionProgressPanel.layout(width, height);
    this.inventoryPanel.layout(width, height);
    this.choiceMenuPanel.layout(width, height);
    this.journalPanel.layout(width, height);
    this.skillPanel.layout(width, height);
    this.toastSystem.layout(width);
  }

  private getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.promptPanel.getDisplayObjects(),
      ...this.hudPanel.getDisplayObjects(),
      ...this.combatPanel.getDisplayObjects(),
      ...this.actionProgressPanel.getDisplayObjects(),
      ...this.inventoryPanel.getDisplayObjects(),
      ...this.choiceMenuPanel.getDisplayObjects(),
      ...this.journalPanel.getDisplayObjects(),
      ...this.skillPanel.getDisplayObjects(),
      ...this.toastSystem.getDisplayObjects(),
    ];
  }

  private handleAddedToScene: (child: Phaser.GameObjects.GameObject) => void = () => {};
}
