import type { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import type { PlayerInventoryDelta } from '../player/PlayerInventoryState';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { MapPlacedObject, MapResourceNodeAnchor } from '../world/maps/MapTypes';
import { WorldSessionState } from '../world/session/WorldSessionState';
import type { InteractionResult, ResourceNodeInteractionTarget } from './InteractionTypes';
import { createSingleTileInteractionTiles } from './InteractionTypes';
import { RESOURCE_NODE_DEF_MAP } from './resource-nodes/ResourceNodeDefinitions';

type ResourceNodeState = {
  mapId: string;
  anchor: MapResourceNodeAnchor;
  linkedObjectDefinitionId?: string;
};

type ResourceNodeObjectSystem = Pick<ObjectPlacementSystem, 'getInstance' | 'placeObject' | 'removeObject'>;

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
    const objectsById = new Map(mapObjects.map((obj) => [obj.id, obj]));
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
      .map((node) => {
        const def = RESOURCE_NODE_DEF_MAP[node.anchor.resourceNodeType];
        return {
          definition: {
            id: node.anchor.id,
            interactionType: 'resource_node',
            promptText: def.promptText,
            interactionRangeTiles: node.anchor.interactionRangeTiles ?? 1,
            priority: def.priority,
          },
          tiles: createSingleTileInteractionTiles(node.anchor.tileX, node.anchor.tileY),
          anchor: node.anchor,
        };
      });
  }

  getNodeAnchor(nodeId: string): MapResourceNodeAnchor | null {
    return this.currentNodes.get(nodeId)?.anchor ?? null;
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

      if (!objectPlacementSystem || !node.anchor.linkedObjectId) continue;

      const instance   = objectPlacementSystem.getInstance(node.anchor.linkedObjectId);
      const isAvailable = this.getRespawnAt(node.mapId, node.anchor.id) === null;

      if (!isAvailable) {
        if (instance) objectPlacementSystem.removeObject(node.anchor.linkedObjectId);
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
            `ResourceNodeSystem: failed to restore node "${node.anchor.id}" on map "${node.mapId}" ` +
            `at tile ${node.anchor.tileX},${node.anchor.tileY}. ` +
            `Ensure the tile stays clear for runtime respawn.`,
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
      return { ok: false, interactionType: 'resource_node', targetId: nodeId, message: 'Nothing useful there.' };
    }

    const respawnAt = this.getRespawnAt(node.mapId, nodeId);
    if (respawnAt !== null && nowMs < respawnAt) {
      return { ok: false, interactionType: 'resource_node', targetId: nodeId, message: 'Nothing left to gather.' };
    }

    const def = RESOURCE_NODE_DEF_MAP[node.anchor.resourceNodeType];

    // Level-gate check
    if (def.levelRequired) {
      const currentLevel = playerSessionState.getSkillProgressionSystem().getLevel(def.skill);
      if (currentLevel < def.levelRequired) {
        return {
          ok: false,
          interactionType: 'resource_node',
          targetId: nodeId,
          message: `Requires ${def.skill} level ${def.levelRequired} (you have ${currentLevel}).`,
          toastKind: 'error',
        };
      }
    }

    const inventoryDelta: PlayerInventoryDelta = { [def.inventoryKey]: 1 };
    playerSessionState.getInventoryState().addDelta(inventoryDelta);
    const xpDelta = { [def.skill]: def.xpReward };
    const levelUps = playerSessionState.getSkillProgressionSystem().addXpDelta(xpDelta);
    this.setRespawnAt(node.mapId, nodeId, nowMs + def.respawnMs);

    if (objectPlacementSystem && node.anchor.linkedObjectId) {
      objectPlacementSystem.removeObject(node.anchor.linkedObjectId);
    }

    return {
      ok: true,
      sfxId: 'gather_success',
      interactionType: 'resource_node',
      targetId: nodeId,
      message: `Gathered 1 ${def.inventoryKey}.`,
      inventoryDelta,
      depleted: true,
      xpDelta,
      levelUps: levelUps.length > 0 ? levelUps : undefined,
    };
  }

  private getRespawnAt(mapId: string, nodeId: string): number | null {
    return this.sessionState.getResourceRespawnAt(mapId, nodeId);
  }

  private setRespawnAt(mapId: string, nodeId: string, respawnAtMs: number): void {
    this.sessionState.setResourceRespawnAt(mapId, nodeId, respawnAtMs);
  }

  private clearRespawnAt(mapId: string, nodeId: string): void {
    this.sessionState.clearResourceRespawnAt(mapId, nodeId);
  }
}
