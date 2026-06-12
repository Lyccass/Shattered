import type {
  PlacementModeSystem,
  PlacementPreviewState,
} from '../../interactions/PlacementModeSystem';
import type { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import type { ItemRegistry } from '../../items/ItemRegistry';
import type { PlayerInventoryState } from '../../player/PlayerInventoryState';
import type { ObjectPlacementSystem } from '../../objects/ObjectPlacementSystem';
import type { InteractionResult } from '../../interactions/InteractionTypes';
import type { PlayerController } from '../../player/PlayerController';
import type { GameEventBus } from '../../events/GameEventBus';

export type WorldPlacementDeps = {
  getPlayerController: () => PlayerController | null;
  hasActiveRuntime: () => boolean;
  getInventory: () => PlayerInventoryState;
  getObjectPlacementSystem: () => ObjectPlacementSystem | null;
  getNowMs: () => number;
  rebuildInteractionTargets: () => void;
};

export class WorldPlacementController {
  constructor(
    private readonly placementModeSystem: PlacementModeSystem,
    private readonly placedStructureSystem: PlacedStructureSystem,
    private readonly itemRegistry: ItemRegistry,
    private readonly eventBus: GameEventBus,
    private readonly deps: WorldPlacementDeps,
  ) {}

  getPlacementState(): PlacementPreviewState | null {
    return this.placementModeSystem.getState();
  }

  isActive(): boolean {
    return this.placementModeSystem.isActive();
  }

  updatePreview(): void {
    const playerController = this.deps.getPlayerController();
    if (playerController) this.placementModeSystem.updatePreview(playerController);
  }

  placeItemInFacingDirection(itemId: string): InteractionResult {
    const playerController = this.deps.getPlayerController();
    if (!playerController || !this.deps.hasActiveRuntime()) {
      return { ok: false, interactionType: 'item_use', targetId: itemId, message: 'Placement unavailable.' };
    }

    const inventory = this.deps.getInventory();
    if (!inventory.hasAtLeast(itemId, 1)) {
      return {
        ok: false,
        interactionType: 'item_use',
        targetId: itemId,
        message: `No ${this.itemRegistry.get(itemId).name} in inventory.`,
      };
    }

    const placementState = this.placementModeSystem.startPlacement(itemId);
    if (!placementState) {
      return { ok: false, interactionType: 'item_use', targetId: itemId, message: `${this.itemRegistry.get(itemId).name} cannot be placed.` };
    }

    const preview = this.placementModeSystem.updatePreview(playerController);
    if (!preview?.valid) {
      this.placementModeSystem.cancelPlacement();
      return {
        ok: false,
        interactionType: 'item_use',
        targetId: itemId,
        message: preview?.invalidReason ?? `Can't place ${this.itemRegistry.get(itemId).name} here.`,
        toastKind: 'error',
      };
    }

    return this.confirm() ?? { ok: false, interactionType: 'item_use', targetId: itemId, message: 'Placement failed.' };
  }

  start(itemId: string = 'firestarter_set'): string {
    const playerController = this.deps.getPlayerController();
    if (!playerController || !this.deps.hasActiveRuntime()) {
      return 'Placement is unavailable right now.';
    }

    if (!this.deps.getInventory().hasAtLeast(itemId, 1)) {
      return `You don't have a ${this.itemRegistry.get(itemId).name}.`;
    }

    const placementState = this.placementModeSystem.startPlacement(itemId);
    if (!placementState) {
      return `${this.itemRegistry.get(itemId).name} cannot be placed.`;
    }

    this.placementModeSystem.updatePreview(playerController);
    return `Placing ${placementState.itemDisplayName}.`;
  }

  confirm(): InteractionResult | null {
    const placementState = this.placementModeSystem.getState();
    const objectPlacementSystem = this.deps.getObjectPlacementSystem();

    if (!placementState || !objectPlacementSystem) return null;

    if (!placementState.valid) {
      this.eventBus.emitSfx('invalid_action');
      return {
        ok: false,
        sfxId: 'invalid_action',
        interactionType: 'placed_object',
        targetId: placementState.itemId,
        message: placementState.invalidReason ?? `Can't place ${placementState.itemDisplayName} there.`,
      };
    }

    const result = this.placedStructureSystem.placeItem(
      placementState.itemId,
      placementState.targetTileX,
      placementState.targetTileY,
      this.deps.getNowMs(),
      this.deps.getInventory(),
      this.itemRegistry,
      objectPlacementSystem,
    );

    if (result.ok) {
      this.placementModeSystem.cancelPlacement();
      this.deps.rebuildInteractionTargets();
    }

    if (result.sfxId) this.eventBus.emitSfx(result.sfxId);
    if (result.xpDelta) this.eventBus.emitSfx('xp_gain');
    return result;
  }

  cancel(): string | null {
    if (!this.placementModeSystem.isActive()) return null;
    this.placementModeSystem.cancelPlacement();
    return 'Placement cancelled.';
  }
}
