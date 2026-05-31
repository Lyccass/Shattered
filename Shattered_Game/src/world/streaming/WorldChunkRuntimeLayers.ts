import { createChunkKey, type ChunkKey } from '../../shared/world/ChunkKey';
import type { WorldChunkDefinition } from '../../shared/world/ChunkTypes';
import type {
  MapNpcAnchor,
  MapPlacedObject,
  MapResourceNodeAnchor,
  MapTransition,
  MapZone,
  MapZoneTag,
  ResourceNodeType,
} from '../maps/MapTypes';

export type RuntimeManualEnemySpawn = {
  id: string;
  enemyDefinitionId: string;
  tileX: number;
  tileY: number;
  respawnMs?: number;
  areaId?: string;
  lootTableId?: string;
};

export type WorldChunkRuntimeLayers = {
  chunkKey: ChunkKey;
  objects: MapPlacedObject[];
  resourceAnchors: MapResourceNodeAnchor[];
  npcAnchors: MapNpcAnchor[];
  manualEnemySpawns: RuntimeManualEnemySpawn[];
  transitions: MapTransition[];
  zones: MapZone[];
};

const RESOURCE_NODE_TYPES = ['driftwood', 'stone_pile', 'herb_patch'] as const;
const MAP_ZONE_TAGS = [
  'personal_build',
  'wilderness_camp',
  'town',
  'harbor',
  'transition',
  'combat_sandbox',
  'wilds',
  'elite',
  'dungeon',
  'locked',
] as const;

export function materializeWorldChunkRuntimeLayers(chunk: WorldChunkDefinition): WorldChunkRuntimeLayers {
  const chunkKey = createChunkKey(chunk);
  const tileOrigin = getChunkTileOrigin(chunk);

  return {
    chunkKey,
    objects: chunk.objectLayer.objects.map((object) => ({
      id: createChunkScopedId(chunk, chunkKey, 'object', object.id),
      definitionId: object.definitionId,
      tileX: tileOrigin.x + object.tileX,
      tileY: tileOrigin.y + object.tileY,
      orientation: object.orientation,
      state: object.state,
    })),
    resourceAnchors: chunk.resourceLayer.nodes
      .filter((node) => isResourceNodeType(node.resourceDefinitionId))
      .map((node) => ({
        id: createChunkScopedId(chunk, chunkKey, 'resource', node.id),
        tileX: tileOrigin.x + node.tileX,
        tileY: tileOrigin.y + node.tileY,
        interactionType: 'resource_node',
        resourceNodeType: node.resourceDefinitionId as ResourceNodeType,
        metadata: {
          sourceChunkKey: chunkKey,
          respawnProfileId: node.respawnProfileId,
          maturityProfileId: node.maturityProfileId,
          candidateWeight: node.candidateWeight,
          tags: node.tags,
        },
      })),
    transitions: (chunk.connectionLayer?.transitions ?? []).map((transition) => ({
      ...transition,
      id: createChunkScopedId(chunk, chunkKey, 'transition', transition.id),
      fromTile: {
        tileX: tileOrigin.x + transition.fromTile.tileX,
        tileY: tileOrigin.y + transition.fromTile.tileY,
      },
      visualAnchor: transition.visualAnchor
        ? {
          ...transition.visualAnchor,
          tileX: tileOrigin.x + transition.visualAnchor.tileX,
          tileY: tileOrigin.y + transition.visualAnchor.tileY,
        }
        : undefined,
      metadata: {
        ...(transition.metadata ?? {}),
        sourceChunkKey: chunkKey,
      },
    })),
    npcAnchors: (chunk.npcLayer?.anchors ?? []).map((anchor) => ({
      id: createChunkScopedId(chunk, chunkKey, 'npc', anchor.id),
      interactionType: 'npc' as const,
      tileX: tileOrigin.x + anchor.tileX,
      tileY: tileOrigin.y + anchor.tileY,
      npcDefinitionId: anchor.npcDefinitionId,
      text: anchor.text ?? anchor.npcDefinitionId,
    })),
    manualEnemySpawns: chunk.habitatLayer.habitats.flatMap((habitat) => [
      ...(habitat.manualSpawns ?? []).map((spawn) => ({
        id: createChunkScopedId(chunk, chunkKey, 'spawn', spawn.id),
        enemyDefinitionId: spawn.enemyDefinitionId,
        tileX: tileOrigin.x + spawn.tileX,
        tileY: tileOrigin.y + spawn.tileY,
        ...(spawn.respawnMs !== undefined ? { respawnMs: spawn.respawnMs } : {}),
        areaId: habitat.id,
        ...(spawn.lootTableId !== undefined ? { lootTableId: spawn.lootTableId } : {}),
      })),
      ...synthesizeHabitatRuleSpawns(chunk, chunkKey, habitat, tileOrigin),
    ]),
    zones: chunk.zoneLayer.zones.map((zone) => ({
      id: createChunkScopedId(chunk, chunkKey, 'zone', zone.id),
      tileX: tileOrigin.x + zone.tileX,
      tileY: tileOrigin.y + zone.tileY,
      width: zone.width,
      height: zone.height,
      tags: filterMapZoneTags(zone.tags),
    })),
  };
}

function getChunkTileOrigin(chunk: WorldChunkDefinition): { x: number; y: number } {
  return {
    x: chunk.chunkX * chunk.width,
    y: chunk.chunkY * chunk.height,
  };
}

function createChunkScopedId(
  chunk: WorldChunkDefinition,
  chunkKey: ChunkKey,
  kind: 'object' | 'resource' | 'transition' | 'zone' | 'npc' | 'spawn',
  localId: string,
): string {
  return `${chunk.worldId}:${chunkKey}:${kind}:${localId}`;
}

function synthesizeHabitatRuleSpawns(
  chunk: WorldChunkDefinition,
  chunkKey: ChunkKey,
  habitat: WorldChunkDefinition['habitatLayer']['habitats'][number],
  tileOrigin: { x: number; y: number },
): RuntimeManualEnemySpawn[] {
  const totalTiles = habitat.width * habitat.height;
  return habitat.spawnRules.flatMap((rule, ruleIndex) => {
    const defId = rule.enemyDefinitionId ?? rule.creatureFamilyId;
    const count = Math.min(rule.maxPopulation ?? 1, totalTiles);
    const stride = Math.max(1, Math.floor(totalTiles / count));
    return Array.from({ length: count }, (_, i) => {
      const index = (i * stride) % totalTiles;
      return {
        id: createChunkScopedId(chunk, chunkKey, 'spawn', `${habitat.id}_r${ruleIndex}_${i}`),
        enemyDefinitionId: defId,
        tileX: tileOrigin.x + habitat.tileX + (index % habitat.width),
        tileY: tileOrigin.y + habitat.tileY + Math.floor(index / habitat.width),
        ...(rule.respawnMs !== undefined ? { respawnMs: rule.respawnMs } : {}),
        areaId: habitat.id,
        ...(rule.lootTableId !== undefined ? { lootTableId: rule.lootTableId } : {}),
      };
    });
  });
}

function isResourceNodeType(value: unknown): value is ResourceNodeType {
  return typeof value === 'string' && RESOURCE_NODE_TYPES.includes(value as ResourceNodeType);
}

function isMapZoneTag(value: unknown): value is MapZoneTag {
  return typeof value === 'string' && MAP_ZONE_TAGS.includes(value as MapZoneTag);
}

function filterMapZoneTags(tags: readonly unknown[]): MapZoneTag[] {
  return tags.filter(isMapZoneTag);
}
