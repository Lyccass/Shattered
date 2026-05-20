import Phaser from 'phaser';
import type { InteractionResult } from '../../interactions/InteractionTypes';
import { LocalSaveService } from '../../persistence/LocalSaveService';
import type { UiManager } from '../../ui/UiManager';
import type { WorldRuntimeCoordinator } from '../../world/maps/WorldRuntimeCoordinator';

type GameSaveControllerContext = {
  uiManager?: UiManager;
  worldRuntimeCoordinator?: WorldRuntimeCoordinator;
  onRestored?: () => void;
};

export class GameSaveController {
  private readonly localSaveService = new LocalSaveService();
  private lastAutosaveAt = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  tryAutoLoadSave(context: GameSaveControllerContext): void {
    const loadResult = this.localSaveService.load();

    if (loadResult.status === 'no_save') {
      return;
    }

    this.applyLoadResult(loadResult, context, true);
  }

  saveNow(context: GameSaveControllerContext): void {
    const { uiManager, worldRuntimeCoordinator } = context;

    if (!worldRuntimeCoordinator || !uiManager) {
      return;
    }

    const saveGame = worldRuntimeCoordinator.createPrototypeSaveSnapshot(this.scene.time.now);
    const result = this.localSaveService.save(saveGame);

    if (!result.ok) {
      uiManager.showInfo(result.error);
      return;
    }

    this.lastAutosaveAt = this.scene.time.now;
    uiManager.showInfo('Game saved.');
  }

  loadSavedGame(context: GameSaveControllerContext): void {
    this.applyLoadResult(this.localSaveService.load(), context, false);
  }

  clearSavedGame(context: GameSaveControllerContext): void {
    const { uiManager } = context;

    if (!uiManager) {
      return;
    }

    if (!this.localSaveService.hasSave()) {
      uiManager.showInfo('No save found.');
      return;
    }

    const cleared = this.localSaveService.clearSave();
    uiManager.showInfo(cleared ? 'Save cleared.' : 'Save could not be cleared.');
  }

  maybeAutosaveForResult(result: InteractionResult, context: GameSaveControllerContext): void {
    const { uiManager, worldRuntimeCoordinator } = context;

    if (!worldRuntimeCoordinator) {
      return;
    }

    const shouldAutosave = Boolean(result.transitionRequest) || result.sfxId === 'contract_completed';

    if (!shouldAutosave || this.scene.time.now - this.lastAutosaveAt < 5_000) {
      return;
    }

    const saveGame = worldRuntimeCoordinator.createPrototypeSaveSnapshot(this.scene.time.now);
    const writeResult = this.localSaveService.save(saveGame);

    if (writeResult.ok) {
      this.lastAutosaveAt = this.scene.time.now;
      uiManager?.showInfo('Autosaved.');
    } else {
      uiManager?.showInfo(writeResult.error);
    }
  }

  private applyLoadResult(
    loadResult: ReturnType<LocalSaveService['load']>,
    context: GameSaveControllerContext,
    automatic: boolean,
  ): void {
    const { uiManager, worldRuntimeCoordinator, onRestored } = context;

    if (!uiManager || !worldRuntimeCoordinator) {
      return;
    }

    switch (loadResult.status) {
      case 'success': {
        const restoreResult = worldRuntimeCoordinator.restorePrototypeSaveSnapshot(
          loadResult.saveGame,
          this.scene.time.now,
        );

        if (!restoreResult.ok) {
          uiManager.showInfo(`Save load failed. ${restoreResult.message}`);
          return;
        }

        onRestored?.();
        this.lastAutosaveAt = this.scene.time.now;
        uiManager.showInfo(automatic ? 'Save loaded on startup.' : restoreResult.message);
        restoreResult.warnings.forEach((warning) => uiManager.showInfo(warning));
        return;
      }

      case 'no_save':
        if (!automatic) {
          uiManager.showInfo('No save found.');
        }
        return;

      case 'invalid_json':
        uiManager.showInfo(`Save invalid. ${loadResult.error}`);
        return;

      case 'unsupported_version':
        uiManager.showInfo(
          `Save version ${loadResult.version ?? 'unknown'} is unsupported.`,
        );
        return;

      case 'validation_failed':
        uiManager.showInfo(`Save invalid. ${loadResult.error}`);
        return;

      case 'storage_unavailable':
        uiManager.showInfo(loadResult.error);
        return;
    }
  }
}
