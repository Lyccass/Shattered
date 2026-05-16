import type { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import type { PlayerInventoryDelta, PlayerInventoryState, PlayerResourceKey } from '../player/PlayerInventoryState';
import type { MapResourceNodeAnchor, ResourceNodeType } from '../world/maps/MapTypes';
import type { InteractionResult, ResourceNodeInteractionTarget } from './InteractionTypes';
import { createSingleTileInteractionTiles } from './InteractionTypes';

type ResourceNodeState = {
  mapId: string;
  anchor: MapResourceNodeAnchor;
};

const RESOURCE_NODE_PRIORITIES: Record<ResourceNodeType, number> = {
  driftwood: 90,
  stone_pile: 85,
  herb_patch: 80,
};

const RESOURCE_NODE_PROMPTS: Record<ResourceNodeType, string> = {
  driftwood: 'Press E: Gather Driftwood',
  stone_pile: 'Press E: Gather Stone',
  herb_patch: 'Press E: Gather Herbs',
};

export class ResourceNodeSystem {
  private readonly depletedNodeIdsByMap = new Map<string, Set<string>>();
  private currentNodes = new Map<string, ResourceNodeState>();

  setMapNodes(
    mapId: string,
    anchors: MapResourceNodeAnchor[],
    objectPlacementSystem?: Pick<ObjectPlacementSystem, 'removeObject'>,
  ): void {
    this.currentNodes = new Map(
      anchors.map((anchor) => [
        anchor.id,
        {
          mapId,
          anchor,
        },
      ]),
    );

    const depletedIds = this.getDepletedNodeIds(mapId);

    if (!objectPlacementSystem) {
      return;
    }

    depletedIds.forEach((nodeId) => {
      const node = this.currentNodes.get(nodeId);

      if (node?.anchor.linkedObjectId) {
        objectPlacementSystem.removeObject(node.anchor.linkedObjectId);
      }
    });
  }

  createInteractionTargets(): ResourceNodeInteractionTarget[] {
    return Array.from(this.currentNodes.values())
      .filter((node) => !this.isNodeDepleted(node.mapId, node.anchor.id))
      .map((node) => ({
        definition: {
          id: node.anchor.id,
          interactionType: 'resource_node',
          promptText: RESOURCE_NODE_PROMPTS[node.anchor.resourceNodeType],
          interactionRangeTiles: node.anchor.interactionRangeTiles ?? 1,
          priority: RESOURCE_NODE_PRIORITIES[node.anchor.resourceNodeType],
        },
        tiles: createSingleTileInteractionTiles(node.anchor.tileX, node.anchor.tileY),
        anchor: node.anchor,
      }));
  }

  gatherNode(
    nodeId: string,
    inventory: PlayerInventoryState,
    objectPlacementSystem?: Pick<ObjectPlacementSystem, 'removeObject'>,
  ): InteractionResult {
    const node = this.currentNodes.get(nodeId);

    if (!node) {
      return {
        ok: false,
        interactionType: 'resource_node',
        targetId: nodeId,
        message: 'Nothing useful there.',
      };
    }

    if (this.isNodeDepleted(node.mapId, nodeId)) {
      return {
        ok: false,
        interactionType: 'resource_node',
        targetId: nodeId,
        message: 'Nothing left to gather.',
      };
    }

    const resourceKey = getInventoryResourceKey(node.anchor.resourceNodeType);
    const inventoryDelta: PlayerInventoryDelta = { [resourceKey]: 1 };
    inventory.addDelta(inventoryDelta);
    this.getDepletedNodeIds(node.mapId).add(nodeId);

    if (objectPlacementSystem && node.anchor.linkedObjectId) {
      objectPlacementSystem.removeObject(node.anchor.linkedObjectId);
    }

    return {
      ok: true,
      interactionType: 'resource_node',
      targetId: nodeId,
      message: `Gathered 1 ${resourceKey}.`,
      inventoryDelta,
      depleted: true,
    };
  }

  private isNodeDepleted(mapId: string, nodeId: string): boolean {
    return this.getDepletedNodeIds(mapId).has(nodeId);
  }

  private getDepletedNodeIds(mapId: string): Set<string> {
    const depletedIds = this.depletedNodeIdsByMap.get(mapId) ?? new Set<string>();
    this.depletedNodeIdsByMap.set(mapId, depletedIds);
    return depletedIds;
  }
}

function getInventoryResourceKey(resourceNodeType: ResourceNodeType): PlayerResourceKey {
  switch (resourceNodeType) {
    case 'driftwood':
      return 'wood';
    case 'stone_pile':
      return 'stone';
    case 'herb_patch':
      return 'herb';
  }
}
