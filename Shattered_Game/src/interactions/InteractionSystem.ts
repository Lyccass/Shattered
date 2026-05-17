import type {
  ActiveInteraction,
  ContractBoardInteractionTarget,
  GenericDebugInteractionTarget,
  InteractionHandlers,
  InteractionResult,
  InteractionTarget,
  MapTransitionInteractionTarget,
  NpcInteractionTarget,
  PlacedObjectInteractionTarget,
  ResourceNodeInteractionTarget,
  WorkbenchInteractionTarget,
} from './InteractionTypes';

export class InteractionSystem {
  private targets: InteractionTarget[] = [];
  private activeInteraction: ActiveInteraction | null = null;

  constructor(private readonly handlers: InteractionHandlers) {}

  setTargets(targets: InteractionTarget[]): void {
    this.targets = targets;
    this.activeInteraction = null;
  }

  getTargets(): InteractionTarget[] {
    return this.targets;
  }

  getActiveInteraction(): ActiveInteraction | null {
    return this.activeInteraction;
  }

  updateActiveInteraction(tileX: number, tileY: number): ActiveInteraction | null {
    let bestInteraction: ActiveInteraction | null = null;

    for (const target of this.targets) {
      const distanceTiles = getInteractionDistanceTiles(target, tileX, tileY);

      if (distanceTiles > target.definition.interactionRangeTiles) {
        continue;
      }

      const candidate: ActiveInteraction = {
        target,
        distanceTiles,
        promptText: target.definition.promptText,
      };

      if (!bestInteraction || isHigherPriorityInteraction(candidate, bestInteraction)) {
        bestInteraction = candidate;
      }
    }

    this.activeInteraction = bestInteraction;
    return bestInteraction;
  }

  triggerActiveInteraction(): InteractionResult | null {
    if (!this.activeInteraction) {
      return null;
    }

    return this.triggerTarget(this.activeInteraction.target);
  }

  private triggerTarget(target: InteractionTarget): InteractionResult {
    switch (target.definition.interactionType) {
      case 'map_transition':
        return this.handlers.onMapTransition(target as MapTransitionInteractionTarget);
      case 'resource_node':
        return this.handlers.onResourceNode(target as ResourceNodeInteractionTarget);
      case 'npc':
        return this.handlers.onNpc(target as NpcInteractionTarget);
      case 'workbench':
        return this.handlers.onWorkbench(target as WorkbenchInteractionTarget);
      case 'contract_board':
        return this.handlers.onContractBoard(target as ContractBoardInteractionTarget);
      case 'placed_object':
        return this.handlers.onPlacedObject(target as PlacedObjectInteractionTarget);
      case 'generic_debug':
        return this.handlers.onGenericDebug(target as GenericDebugInteractionTarget);
    }
  }
}

function getInteractionDistanceTiles(target: InteractionTarget, tileX: number, tileY: number): number {
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const interactionTile of target.tiles) {
    const distance = Math.abs(interactionTile.x - tileX) + Math.abs(interactionTile.y - tileY);
    bestDistance = Math.min(bestDistance, distance);
  }

  return bestDistance;
}

function isHigherPriorityInteraction(candidate: ActiveInteraction, currentBest: ActiveInteraction): boolean {
  const candidatePriority = candidate.target.definition.priority;
  const currentPriority = currentBest.target.definition.priority;

  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority;
  }

  if (candidate.distanceTiles !== currentBest.distanceTiles) {
    return candidate.distanceTiles < currentBest.distanceTiles;
  }

  return candidate.target.definition.id < currentBest.target.definition.id;
}
