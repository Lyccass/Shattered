import type {
  ActiveInteraction,
  InteractionHandlers,
  InteractionResult,
  InteractionTarget,
} from './InteractionTypes';
import {
  isContractBoardTarget,
  isGenericDebugTarget,
  isGroundItemTarget,
  isMapTransitionTarget,
  isNpcTarget,
  isPlacedObjectTarget,
  isResourceNodeTarget,
  isWorkbenchTarget,
} from './InteractionTypes';

export class InteractionSystem {
  private targets: InteractionTarget[] = [];
  private dynamicTargets: InteractionTarget[] = [];
  private activeInteraction: ActiveInteraction | null = null;

  constructor(private readonly handlers: InteractionHandlers) {}

  setTargets(targets: InteractionTarget[]): void {
    this.targets = targets;
    this.activeInteraction = null;
  }

  setDynamicTargets(targets: InteractionTarget[]): void {
    this.dynamicTargets = targets;
  }

  getTargets(): InteractionTarget[] {
    return [...this.targets, ...this.dynamicTargets];
  }

  getActiveInteraction(): ActiveInteraction | null {
    return this.activeInteraction;
  }

  findTargetByRef(
    interactionType: InteractionTarget['definition']['interactionType'],
    targetId: string,
  ): InteractionTarget | null {
    return [...this.targets, ...this.dynamicTargets].find((target) =>
      target.definition.interactionType === interactionType
      && target.definition.id === targetId,
    ) ?? null;
  }

  findTargetAtTile(targetTileX: number, targetTileY: number): InteractionTarget | null {
    let bestTarget: InteractionTarget | null = null;

    for (const target of [...this.targets, ...this.dynamicTargets]) {
      if (!target.tiles.some((tile) => tile.x === targetTileX && tile.y === targetTileY)) {
        continue;
      }

      if (!bestTarget || isHigherPriorityTarget(target, bestTarget)) {
        bestTarget = target;
      }
    }

    return bestTarget;
  }

  findInteractionAtTile(
    playerTileX: number,
    playerTileY: number,
    targetTileX: number,
    targetTileY: number,
  ): ActiveInteraction | null {
    let bestInteraction: ActiveInteraction | null = null;

    for (const target of [...this.targets, ...this.dynamicTargets]) {
      if (!target.tiles.some((tile) => tile.x === targetTileX && tile.y === targetTileY)) {
        continue;
      }

      const distanceTiles = getInteractionDistanceTiles(target, playerTileX, playerTileY);

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

    if (bestInteraction) {
      this.activeInteraction = bestInteraction;
    }

    return bestInteraction;
  }

  updateActiveInteraction(tileX: number, tileY: number): ActiveInteraction | null {
    let bestInteraction: ActiveInteraction | null = null;

    for (const target of [...this.targets, ...this.dynamicTargets]) {
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

  triggerTarget(target: InteractionTarget): InteractionResult {
    const { interactionType } = target.definition;
    if (isMapTransitionTarget(target)) return this.handlers.onMapTransition(target);
    if (isResourceNodeTarget(target)) return this.handlers.onResourceNode(target);
    if (isNpcTarget(target)) return this.handlers.onNpc(target);
    if (isWorkbenchTarget(target)) return this.handlers.onWorkbench(target);
    if (isContractBoardTarget(target)) return this.handlers.onContractBoard(target);
    if (isPlacedObjectTarget(target)) return this.handlers.onPlacedObject(target);
    if (isGenericDebugTarget(target)) return this.handlers.onGenericDebug(target);
    if (isGroundItemTarget(target)) return this.handlers.onGroundItem(target);
    throw new Error(`Unhandled interaction type: ${interactionType}`);
  }
}

function isHigherPriorityTarget(candidate: InteractionTarget, currentBest: InteractionTarget): boolean {
  if (candidate.definition.priority !== currentBest.definition.priority) {
    return candidate.definition.priority > currentBest.definition.priority;
  }

  return candidate.definition.id < currentBest.definition.id;
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
