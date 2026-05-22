import Phaser from 'phaser';
import type { InteractionResult, InteractionTarget } from '../../interactions/InteractionTypes';
import type { PlayerController } from '../../player/PlayerController';
import type { TelegraphSystem } from '../../combat/TelegraphSystem';
import type { UiManager } from '../../ui/UiManager';
import type {
  DeferredInteractionAction,
  WorldRuntimeCoordinator,
} from '../../world/maps/WorldRuntimeCoordinator';

type ControlMode = 'explore' | 'combat';
type InteractionTargetType = InteractionTarget['definition']['interactionType'];
type GameplayResultHandler = (
  result: InteractionResult | null,
  options: { allowAutosave: boolean },
) => void;

type GameInteractionControllerDeps = {
  getWorldRuntimeCoordinator: () => WorldRuntimeCoordinator | undefined;
  getPlayerController: () => PlayerController | undefined;
  getTelegraphSystem: () => TelegraphSystem | undefined;
  getUiManager: () => UiManager | undefined;
  getControlMode: () => ControlMode;
  handleGameplayResult: GameplayResultHandler;
};

export class GameInteractionController {

  private pendingPointerInteraction: {
    interactionType: InteractionTargetType;
    targetId: string;
    action: 'use' | 'inspect';
  } | null = null;

  private lastInteractionAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: GameInteractionControllerDeps,
  ) {}

  triggerActiveInteraction(): void {
    const worldRuntimeCoordinator = this.deps.getWorldRuntimeCoordinator();

    if (!worldRuntimeCoordinator || !this.deps.getUiManager()) {
      return;
    }

    const now = this.scene.time.now;

    if (now - this.lastInteractionAt < 250) {
      return;
    }

    const result = worldRuntimeCoordinator.triggerActiveInteraction();

    if (!result) {
      return;
    }

    this.clearPendingPointerInteraction();
    this.lastInteractionAt = now;
    this.deps.handleGameplayResult(result, { allowAutosave: true });
  }

  confirmPlacementMode(): void {
    const worldRuntimeCoordinator = this.deps.getWorldRuntimeCoordinator();

    if (!worldRuntimeCoordinator || !this.deps.getUiManager()) {
      return;
    }

    const now = this.scene.time.now;

    if (now - this.lastInteractionAt < 250) {
      return;
    }

    const result = worldRuntimeCoordinator.confirmPlacementMode();

    if (!result) {
      return;
    }

    this.lastInteractionAt = now;
    this.deps.handleGameplayResult(result, { allowAutosave: false });
  }

  pointerInteraction(worldX: number, worldY: number): void {
    const worldRuntimeCoordinator = this.deps.getWorldRuntimeCoordinator();
    const playerController = this.deps.getPlayerController();

    if (!worldRuntimeCoordinator || !playerController) {
      return;
    }

    const clickedTarget = worldRuntimeCoordinator.findInteractionTargetAtWorldPoint(worldX, worldY);

    if (!clickedTarget) {
      this.moveToPointer(worldX, worldY);
      return;
    }

    const interactionType = clickedTarget.definition.interactionType;
    const targetId = clickedTarget.definition.id;

    if (worldRuntimeCoordinator.isTargetInInteractionRange(interactionType, targetId)) {
      this.clearPendingPointerInteraction();
      const result = worldRuntimeCoordinator.triggerTargetInteractionByRef(
        interactionType,
        targetId,
      );

      if (result) {
        this.deps.handleGameplayResult(result, { allowAutosave: true });
      }
      return;
    }

    const approachPoint = worldRuntimeCoordinator.findInteractionApproachWorldPoint(
      interactionType,
      targetId,
    );

    if (!approachPoint) {
      return;
    }

    this.pendingPointerInteraction = {
      interactionType,
      targetId,
      action: 'use',
    };
    worldRuntimeCoordinator.setActiveInteractionTiles(
      clickedTarget.tiles.map((t) => ({ x: t.x, y: t.y })),
    );
    this.moveToPointer(approachPoint.x, approachPoint.y, true);
  }

  pointerContext(worldX: number, worldY: number): void {
    const worldRuntimeCoordinator = this.deps.getWorldRuntimeCoordinator();

    if (!worldRuntimeCoordinator) {
      return;
    }

    const clickedTarget = worldRuntimeCoordinator.findInteractionTargetAtWorldPoint(worldX, worldY);

    if (!clickedTarget) {
      return;
    }

    this.clearPendingPointerInteraction();
    worldRuntimeCoordinator.openInteractionChoiceMenuByRef(
      clickedTarget.definition.interactionType,
      clickedTarget.definition.id,
    );
  }

  menuPointer(_screenX: number, _screenY: number): void {
    // Choice menu clicks are handled by the HTML popup — nothing to do here.
  }

  resolvePendingPointerInteraction(): void {
    const worldRuntimeCoordinator = this.deps.getWorldRuntimeCoordinator();
    const playerController = this.deps.getPlayerController();

    if (!this.pendingPointerInteraction || !worldRuntimeCoordinator || !playerController) {
      return;
    }

    if (
      worldRuntimeCoordinator.isChoiceMenuOpen()
      || worldRuntimeCoordinator.isPlacementModeActive()
      || worldRuntimeCoordinator.isActionInProgress()
    ) {
      return;
    }

    const { interactionType, targetId, action } = this.pendingPointerInteraction;

    if (!worldRuntimeCoordinator.isTargetInInteractionRange(interactionType, targetId)) {
      if (!playerController.hasClickMoveTarget()) {
        this.clearPendingPointerInteraction();
      }

      return;
    }

    playerController.clearClickMoveTarget();
    this.clearPendingPointerInteraction();
    const result = action === 'inspect'
      ? worldRuntimeCoordinator.inspectTargetByRef(interactionType, targetId)
      : worldRuntimeCoordinator.triggerTargetInteractionByRef(interactionType, targetId);

    if (result) {
      this.deps.handleGameplayResult(result, { allowAutosave: true });
    }
  }

  moveToPointer(worldX: number, worldY: number, preservePendingInteraction = false): void {
    const playerController = this.deps.getPlayerController();
    const worldRuntimeCoordinator = this.deps.getWorldRuntimeCoordinator();
    const telegraphSystem = this.deps.getTelegraphSystem();

    if (!playerController || !worldRuntimeCoordinator || !telegraphSystem) {
      return;
    }

    const isoTilemap = worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const targetTile = isoTilemap.transform.worldToTile(worldX, worldY);

    if (!isoTilemap.isTileInBounds(targetTile.x, targetTile.y)) {
      if (!preservePendingInteraction) {
        playerController.clearClickMoveTarget();
        this.clearPendingPointerInteraction();
      }
      return;
    }

    const tileCenter = isoTilemap.transform.getTileCenterWorld(targetTile.x, targetTile.y);
    const tilePoints = isoTilemap.transform.getTileDiamondPoints(targetTile.x, targetTile.y);
    const walkable = isoTilemap.isTileWalkable(targetTile.x, targetTile.y);

    if (!walkable) {
      telegraphSystem.showTelegraph({
        id: 'move-blocked',
        worldX: tileCenter.x,
        worldY: tileCenter.y,
        shape: {
          kind: 'polygon',
          points: tilePoints.map((point) => ({
            x: point.x - tileCenter.x,
            y: point.y - tileCenter.y,
          })),
        },
        startedAtMs: this.scene.time.now,
        durationMs: 800,
        warningColor: 0xef4444,
        strokeAlpha: 0.9,
        fillAlphaMultiplier: 0.3,
      });
      playerController.clearClickMoveTarget();
      if (!preservePendingInteraction) {
        this.clearPendingPointerInteraction();
      }
      return;
    }

    if (!preservePendingInteraction) {
      this.clearPendingPointerInteraction();
    }

    playerController.setClickMoveTarget(
      tileCenter.x,
      tileCenter.y,
      this.deps.getControlMode() === 'combat' ? 4 : undefined,
    );
  }

  beginDeferredInteractionAction(action: DeferredInteractionAction): void {
    const worldRuntimeCoordinator = this.deps.getWorldRuntimeCoordinator();

    if (!worldRuntimeCoordinator) {
      return;
    }

    const approachPoint = worldRuntimeCoordinator.findInteractionApproachWorldPoint(
      action.interactionType,
      action.targetId,
    );

    if (!approachPoint) {
      return;
    }

    this.pendingPointerInteraction = {
      interactionType: action.interactionType,
      targetId: action.targetId,
      action: action.action,
    };
    this.moveToPointer(approachPoint.x, approachPoint.y, true);
  }

  clearPendingPointerInteraction(): void {
    this.pendingPointerInteraction = null;
    const wrc = this.deps.getWorldRuntimeCoordinator();
    if (wrc && !wrc.isActionInProgress()) {
      wrc.setActiveInteractionTiles(null);
    }
  }

}
