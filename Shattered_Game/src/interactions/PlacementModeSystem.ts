import Phaser from 'phaser';
import { ItemRegistry } from '../items/ItemRegistry';
import type { PlayerController } from '../player/PlayerController';
import type { PlayerItemKey } from '../player/PlayerInventoryState';
import { getFacingLookaheadWorldOffset } from '../player/PlayerFacing';
import { getDynamicDepth, RENDER_DEPTHS } from '../render/RenderLayers';
import type { IsoTransform } from '../world/IsoTransform';
import {
  describeObjectPlacementFailure,
  type ObjectPlacementEvaluation,
} from '../objects/ObjectPlacementPolicy';

type PlacementPreviewSystem = Pick<ObjectPlacementSystemLike, 'getPlacementEvaluation'>;

type ObjectPlacementSystemLike = {
  getPlacementEvaluation(
    definitionId: string,
    tileX: number,
    tileY: number,
  ): ObjectPlacementEvaluation;
};

export type PlacementPreviewState = {
  active: boolean;
  itemId: PlayerItemKey;
  itemDisplayName: string;
  placementObjectDefinitionId: string;
  targetTileX: number;
  targetTileY: number;
  valid: boolean;
  invalidReason?: string;
  promptText: string;
};

type PlacementRuntimeContext = {
  transform: IsoTransform;
  objectPlacementSystem: PlacementPreviewSystem;
};

export class PlacementModeSystem {
  private readonly previewGraphics: Phaser.GameObjects.Graphics;
  private runtimeContext: PlacementRuntimeContext | null = null;
  private state: PlacementPreviewState | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly itemRegistry: ItemRegistry,
  ) {
    this.previewGraphics = scene.add.graphics();
    this.previewGraphics.setDepth(RENDER_DEPTHS.DEBUG - 50);
    this.previewGraphics.setVisible(false);
  }

  bindRuntimeContext(
    transform: IsoTransform,
    objectPlacementSystem: PlacementPreviewSystem,
  ): void {
    this.runtimeContext = {
      transform,
      objectPlacementSystem,
    };
    this.clearPreview();
  }

  startPlacement(itemId: PlayerItemKey): PlacementPreviewState | null {
    const itemDefinition = this.itemRegistry.get(itemId);
    const placementObjectDefinitionId = itemDefinition.placementObjectDefinitionId;

    if (!placementObjectDefinitionId || !itemDefinition.placeable) {
      this.state = null;
      this.clearPreview();
      return null;
    }

    this.state = {
      active: true,
      itemId,
      itemDisplayName: itemDefinition.displayName,
      placementObjectDefinitionId,
      targetTileX: 0,
      targetTileY: 0,
      valid: false,
      promptText: `Place ${itemDefinition.displayName}`,
    };

    return this.state;
  }

  updatePreview(playerController: PlayerController): PlacementPreviewState | null {
    if (!this.state || !this.runtimeContext) {
      this.clearPreview();
      return null;
    }

    const feetPoint = playerController.getFeetPoint();
    const facing = playerController.getFacingDirection();
    const lookahead = getFacingLookaheadWorldOffset(
      facing,
      this.runtimeContext.transform.tileWidth,
      this.runtimeContext.transform.tileHeight,
    );
    const targetTile = this.runtimeContext.transform.worldToTile(
      feetPoint.x + lookahead.x,
      feetPoint.y + lookahead.y,
    );
    const evaluation = this.runtimeContext.objectPlacementSystem.getPlacementEvaluation(
      this.state.placementObjectDefinitionId,
      targetTile.x,
      targetTile.y,
    );

    this.state = {
      ...this.state,
      targetTileX: targetTile.x,
      targetTileY: targetTile.y,
      valid: evaluation.ok,
      invalidReason: evaluation.ok
        ? undefined
        : describeObjectPlacementFailure(evaluation.failure).reason,
      promptText: evaluation.ok
        ? `Place ${this.state.itemDisplayName} [E/Space confirm, Esc cancel]`
        : `Can't place ${this.state.itemDisplayName} here [Esc cancel]`,
    };

    this.renderPreview(this.state);
    return this.state;
  }

  getState(): PlacementPreviewState | null {
    return this.state ? { ...this.state } : null;
  }

  isActive(): boolean {
    return !!this.state;
  }

  cancelPlacement(): void {
    this.state = null;
    this.clearPreview();
  }

  destroy(): void {
    this.previewGraphics.destroy();
    this.runtimeContext = null;
    this.state = null;
  }

  private renderPreview(state: PlacementPreviewState): void {
    if (!this.runtimeContext) {
      this.clearPreview();
      return;
    }

    const center = this.runtimeContext.transform.getTileCenterWorld(
      state.targetTileX,
      state.targetTileY,
    );
    const diamond = this.runtimeContext.transform.getTileDiamondPoints(
      state.targetTileX,
      state.targetTileY,
    );
    const color = state.valid ? 0x22c55e : 0xef4444;
    const alpha = state.valid ? 0.18 : 0.26;

    this.previewGraphics.clear();
    this.previewGraphics.fillStyle(color, alpha);
    this.previewGraphics.lineStyle(2, color, 0.95);
    this.previewGraphics.beginPath();
    this.previewGraphics.moveTo(diamond[0].x, diamond[0].y);
    diamond.slice(1).forEach((point) => {
      this.previewGraphics.lineTo(point.x, point.y);
    });
    this.previewGraphics.closePath();
    this.previewGraphics.fillPath();
    this.previewGraphics.strokePath();
    this.previewGraphics.fillStyle(color, 0.45);
    this.previewGraphics.fillCircle(center.x, center.y - 6, 6);
    this.previewGraphics.setDepth(getDynamicDepth(center.y, 250));
    this.previewGraphics.setVisible(true);
  }

  private clearPreview(): void {
    this.previewGraphics.clear();
    this.previewGraphics.setVisible(false);
  }
}
