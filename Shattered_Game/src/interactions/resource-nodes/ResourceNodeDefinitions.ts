import type { ResourceNodeType } from '../../world/maps/MapTypes';
import type { ResourceNodeDefinition } from './ResourceNodeDefinition';
import { WOODCUTTING_NODES } from './WoodcuttingNodes';
import { MINING_NODES }      from './MiningNodes';
import { ALCHEMY_NODES }     from './AlchemyNodes';

// Central registry — add new skill node arrays here when expanding the game.
export const ALL_RESOURCE_NODE_DEFINITIONS: readonly ResourceNodeDefinition[] = [
  ...WOODCUTTING_NODES,
  ...MINING_NODES,
  ...ALCHEMY_NODES,
];

export const RESOURCE_NODE_DEF_MAP: Record<ResourceNodeType, ResourceNodeDefinition> =
  ALL_RESOURCE_NODE_DEFINITIONS.reduce(
    (acc, def) => { acc[def.type] = def; return acc; },
    {} as Record<ResourceNodeType, ResourceNodeDefinition>,
  );
