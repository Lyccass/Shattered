import type { ObjectPlacementSystem } from '../objects/ObjectPlacementSystem';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { MapPlacedObject, MapResourceNodeAnchor } from '../world/maps/MapTypes';
import type { ItemDefinition } from '../items/ItemTypes';
import { getItem } from '../items/ItemRegistry';
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

    // Skill level gate
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

    // Tool gate + yield calculation
    let toolTier = 1;
    if (def.toolRequired) {
      const bestTool = findBestTool(def.toolRequired, playerSessionState);
      if (!bestTool) {
        return {
          ok: false,
          interactionType: 'resource_node',
          targetId: nodeId,
          message: getToolRequiredMessage(def.toolRequired),
          toastKind: 'error',
        };
      }
      toolTier = bestTool.gatherTier ?? 1;
    }

    const yieldAmount = (def.yieldBase ?? 1) + (def.toolTierBonus ?? 0) * Math.max(0, toolTier - 1);

    const inventoryDelta: Record<string, number> = { [def.inventoryKey]: yieldAmount };
    playerSessionState.getInventoryState().add(def.inventoryKey, yieldAmount);
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
      message: `Gathered ${yieldAmount}x ${def.inventoryKey}.`,
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

// Tool helpers

/** Returns the highest-tier item in equipment or inventory that covers the given skillId. */
function findBestTool(skillId: string, playerSessionState: PlayerSessionState): ItemDefinition | null {
  let best: ItemDefinition | null = null;

  const pickBetter = (item: ItemDefinition | undefined) => {
    if (!item?.toolFor?.includes(skillId)) return;
    if (!best || (item.gatherTier ?? 1) > (best.gatherTier ?? 1)) best = item;
  };

  // Check equipped weapon slots
  const equipState = playerSessionState.getEquipmentState();
  pickBetter(equipState.getEquipped('main_hand'));
  pickBetter(equipState.getEquipped('off_hand'));

  // Check inventory
  for (const { id } of playerSessionState.getInventoryState().listOccupied()) {
    pickBetter(getItem(id));
  }

  return best;
}

const TOOL_NAMES: Record<string, string> = {
  woodworking:    'an axe',
  metalworking:   'a pickaxe',
  leatherworking: 'a skinning knife',
};

function getToolRequiredMessage(skillId: string): string {
  const toolName = TOOL_NAMES[skillId] ?? `a ${skillId} tool`;
  return `You need ${toolName} to gather this.`;
}
