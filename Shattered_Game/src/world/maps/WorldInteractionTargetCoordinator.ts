import Phaser from 'phaser';
import type {
  ActiveInteraction,
  InteractionResult,
  InteractionTarget,
} from '../../interactions/InteractionTypes';
import { isMapTransitionTarget } from '../../interactions/InteractionTypes';
import type { InteractionSystem } from '../../interactions/InteractionSystem';
import { findInteractionApproachWorldPoint as findApproachWorldPoint } from './InteractionApproachFinder';
import type { LoadedMapRuntime } from './MapRuntime';
import type { MapTransitionSystem } from './MapTransitionSystem';
import type { MapTransitionVisualSystem } from './MapTransitionVisualSystem';
import type { WorldInteractionOrchestrator } from './WorldInteractionOrchestrator';
import type { WorldRuntimeBindings } from './WorldMapRuntimeConfigurator';

type InteractionTargetType = InteractionTarget['definition']['interactionType'];

type WorldInteractionTargetCoordinatorDeps = {
  cancelConflictingActionForTarget: (target: InteractionTarget) => void;
  getBindings: () => WorldRuntimeBindings | undefined;
  getRuntime: () => LoadedMapRuntime | undefined;
  interactionOrchestrator: WorldInteractionOrchestrator;
  interactionSystem: InteractionSystem;
  mapTransitionSystem: MapTransitionSystem;
  mapTransitionVisualSystem: MapTransitionVisualSystem;
};

export class WorldInteractionTargetCoordinator {
  constructor(private readonly deps: WorldInteractionTargetCoordinatorDeps) {}

  updateActiveInteraction(tileX: number, tileY: number): ActiveInteraction | null {
    this.deps.mapTransitionSystem.updateActiveTransition(tileX, tileY);
    const activeInteraction = this.deps.interactionSystem.updateActiveInteraction(tileX, tileY);
    const activeTarget = activeInteraction?.target;
    const highlightedTransitionId =
      activeTarget && isMapTransitionTarget(activeTarget) ? activeTarget.transition.id : null;

    this.deps.mapTransitionVisualSystem.setActiveTransition(highlightedTransitionId);
    return activeInteraction;
  }

  triggerActiveInteraction(): InteractionResult | null {
    const activeInteraction = this.deps.interactionSystem.getActiveInteraction();
    if (!activeInteraction) {
      return null;
    }

    return this.triggerTarget(activeInteraction.target);
  }

  triggerPointerInteraction(worldX: number, worldY: number): InteractionResult | null {
    const bindings = this.deps.getBindings();
    const runtime = this.deps.getRuntime();

    if (!bindings || !runtime) {
      return null;
    }

    const clickedTile = runtime.isoTilemap.transform.worldToTile(worldX, worldY);
    const playerTile = bindings.playerController.getFeetTile();
    const interaction = this.deps.interactionSystem.findInteractionAtTile(
      playerTile.x,
      playerTile.y,
      clickedTile.x,
      clickedTile.y,
    );

    if (!interaction) {
      return null;
    }

    return this.triggerTarget(interaction.target);
  }

  findInteractionTargetAtWorldPoint(worldX: number, worldY: number): InteractionTarget | null {
    const runtime = this.deps.getRuntime();

    if (!runtime) {
      return null;
    }

    const clickedTile = runtime.isoTilemap.transform.worldToTile(worldX, worldY);
    return this.deps.interactionSystem.findTargetAtTile(clickedTile.x, clickedTile.y);
  }

  isTargetInInteractionRange(
    interactionType: InteractionTargetType,
    targetId: string,
  ): boolean {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target) {
      return false;
    }

    return this.isTargetStillInRange(
      interactionType,
      targetId,
      target.definition.interactionRangeTiles,
    );
  }

  findInteractionApproachWorldPoint(
    interactionType: InteractionTargetType,
    targetId: string,
  ): Phaser.Math.Vector2 | null {
    const bindings = this.deps.getBindings();
    const runtime = this.deps.getRuntime();

    if (!runtime || !bindings) {
      return null;
    }

    const target = this.findTargetByRef(interactionType, targetId);

    if (!target) {
      return null;
    }

    const playerTile = bindings.playerController.getFeetTile();
    return findApproachWorldPoint({
      runtime,
      playerTile,
      target,
    });
  }

  triggerTargetInteractionByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): InteractionResult | null {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target || !this.isTargetInInteractionRange(interactionType, targetId)) {
      return null;
    }

    this.deps.cancelConflictingActionForTarget(target);
    return this.deps.interactionOrchestrator.executeTargetUse(target);
  }

  inspectTargetByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): InteractionResult | null {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target || !this.isTargetInInteractionRange(interactionType, targetId)) {
      return null;
    }

    return this.deps.interactionOrchestrator.inspectTarget(target);
  }

  openInteractionChoiceMenuByRef(
    interactionType: InteractionTargetType,
    targetId: string,
  ): boolean {
    const target = this.findTargetByRef(interactionType, targetId);

    if (!target) {
      return false;
    }

    return this.deps.interactionOrchestrator.openInteractionChoiceMenuForTarget(target);
  }

  isTargetStillInRange(
    interactionType: InteractionResult['interactionType'],
    targetId: string,
    rangeTiles: number,
  ): boolean {
    const bindings = this.deps.getBindings();

    if (!bindings) {
      return false;
    }

    const target = this.findTargetByRef(interactionType, targetId);

    if (!target) {
      return false;
    }

    const feetTile = bindings.playerController.getFeetTile();
    const distanceTiles = target.tiles.reduce(
      (best, tile) => Math.min(best, Math.abs(tile.x - feetTile.x) + Math.abs(tile.y - feetTile.y)),
      Number.POSITIVE_INFINITY,
    );

    return distanceTiles <= rangeTiles;
  }

  private triggerTarget(target: InteractionTarget): InteractionResult | null {
    this.deps.cancelConflictingActionForTarget(target);

    if (this.deps.interactionOrchestrator.openInteractionChoiceMenuForTarget(target)) {
      return null;
    }

    return this.deps.interactionOrchestrator.executeTargetUse(target);
  }

  private findTargetByRef(
    interactionType: InteractionResult['interactionType'],
    targetId: string,
  ): InteractionTarget | null {
    if (!isWorldTargetInteractionType(interactionType)) {
      return null;
    }

    return this.deps.interactionSystem.findTargetByRef(interactionType, targetId);
  }
}

function isWorldTargetInteractionType(
  interactionType: InteractionResult['interactionType'],
): interactionType is InteractionTargetType {
  return interactionType !== 'item_use';
}
