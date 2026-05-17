import type { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import type { PlayerInventoryDelta, PlayerResourceKey } from '../player/PlayerInventoryState';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { MapPlacedObject, MapResourceNodeAnchor, ResourceNodeType } from '../world/maps/MapTypes';
import { WorldSessionState } from '../world/session/WorldSessionState';
import type { InteractionResult, ResourceNodeInteractionTarget } from './InteractionTypes';
import { createSingleTileInteractionTiles } from './InteractionTypes';

type ResourceNodeState = {
  mapId: string;
  anchor: MapResourceNodeAnchor;
  linkedObjectDefinitionId?: string;
};

type ResourceNodeObjectSystem = Pick<ObjectPlacementSystem, 'getInstance' | 'placeObject' | 'removeObject'>;

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

const RESOURCE_RESPAWN_MS: Record<ResourceNodeType, number> = {
  driftwood: 45_000,
  stone_pile: 60_000,
  herb_patch: 50_000,
};

const RESOURCE_XP_REWARDS: Record<ResourceNodeType, number> = {
  driftwood: 5,
  stone_pile: 5,
  herb_patch: 5,
};

export class ResourceNodeSystem {
  private currentNodes = new Map<string, ResourceNodeState>();

  constructor(private readonly sessionState: WorldSessionState) {}

  setMapNodes(
    mapId: string,
    anchors: MapResourceNodeAnchor[],
    mapObjects: MapPlacedObject[],
    nowMs: number,
    objectPlacementSystem?: ResourceNodeObjectSystem,
  ): void {
    const objectsById = new Map(mapObjects.map((mapObject) => [mapObject.id, mapObject]));
    this.currentNodes = new Map(
      anchors.map((anchor) => [
        anchor.id,
        {
          mapId,
          anchor,
          linkedObjectDefinitionId: anchor.linkedObjectId
            ? objectsById.get(anchor.linkedObjectId)?.definitionId
            : undefined,
        },
      ]),
    );

    this.updateRuntimeState(nowMs, objectPlacementSystem);
  }

  createInteractionTargets(): ResourceNodeInteractionTarget[] {
    return Array.from(this.currentNodes.values())
      .filter((node) => this.getRespawnAt(node.mapId, node.anchor.id) === null)
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

  updateRuntimeState(
    nowMs: number,
    objectPlacementSystem?: ResourceNodeObjectSystem,
  ): boolean {
    let didChange = false;

    for (const node of this.currentNodes.values()) {
      const respawnAt = this.getRespawnAt(node.mapId, node.anchor.id);

      if (respawnAt !== null && nowMs >= respawnAt) {
        this.clearRespawnAt(node.mapId, node.anchor.id);
        didChange = true;
      }

      if (!objectPlacementSystem || !node.anchor.linkedObjectId) {
        continue;
      }

      const instance = objectPlacementSystem.getInstance(node.anchor.linkedObjectId);
      const isAvailable = this.getRespawnAt(node.mapId, node.anchor.id) === null;

      if (!isAvailable) {
        if (instance) {
          objectPlacementSystem.removeObject(node.anchor.linkedObjectId);
        }
        continue;
      }

      if (!instance && node.linkedObjectDefinitionId) {
        const restored = objectPlacementSystem.placeObject(
          node.linkedObjectDefinitionId,
          node.anchor.tileX,
          node.anchor.tileY,
          node.anchor.linkedObjectId,
        );

        if (!restored) {
          throw new Error(
            `ResourceNodeSystem: failed to restore node "${node.anchor.id}" on map "${node.mapId}" at tile ${node.anchor.tileX},${node.anchor.tileY}. Suggested fix: ensure the resource node tile stays clear for runtime respawn.`,
          );
        }
      }
    }

    return didChange;
  }

  gatherNode(
    nodeId: string,
    playerSessionState: PlayerSessionState,
    nowMs: number,
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

    const respawnAt = this.getRespawnAt(node.mapId, nodeId);

    if (respawnAt !== null && nowMs < respawnAt) {
      return {
        ok: false,
        interactionType: 'resource_node',
        targetId: nodeId,
        message: 'Nothing left to gather.',
      };
    }

    const resourceKey = getInventoryResourceKey(node.anchor.resourceNodeType);
    const inventoryDelta: PlayerInventoryDelta = { [resourceKey]: 1 };
    const inventory = playerSessionState.getInventoryState();
    inventory.addDelta(inventoryDelta);
    playerSessionState.getSkillProgressionSystem().addXp('gathering', RESOURCE_XP_REWARDS[node.anchor.resourceNodeType]);
    this.setRespawnAt(
      node.mapId,
      nodeId,
      nowMs + RESOURCE_RESPAWN_MS[node.anchor.resourceNodeType],
    );

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
      xpDelta: { gathering: RESOURCE_XP_REWARDS[node.anchor.resourceNodeType] },
    };
  }

  private getRespawnAt(mapId: string, nodeId: string): number | null {
    return this.sessionState.getResourceRespawnMap(mapId).get(nodeId) ?? null;
  }

  private setRespawnAt(mapId: string, nodeId: string, respawnAtMs: number): void {
    this.sessionState.getResourceRespawnMap(mapId).set(nodeId, respawnAtMs);
  }

  private clearRespawnAt(mapId: string, nodeId: string): void {
    this.sessionState.getResourceRespawnMap(mapId).delete(nodeId);
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
