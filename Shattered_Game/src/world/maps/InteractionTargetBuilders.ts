import {
  createFootprintInteractionTiles,
  createSingleTileInteractionTiles,
  type GenericDebugInteractionTarget,
  type MapTransitionInteractionTarget,
  type NpcInteractionTarget,
} from '../../interactions/InteractionTypes';
import { getMapDisplayName } from './MapDefinitions';
import { getTransitionTiles } from './MapTransitionSystem';
import type { MapGenericDebugAnchor, MapNpcAnchor, MapTransition } from './MapTypes';

export function buildTransitionTargets(transitions: MapTransition[]): MapTransitionInteractionTarget[] {
  return transitions.map((transition) => ({
    definition: {
      id: transition.id,
      interactionType: 'map_transition' as const,
      promptText: `Press E: Travel to ${getMapDisplayName(transition.targetMapId)}`,
      interactionRangeTiles: 1,
      priority: 60,
    },
    tiles: createFootprintInteractionTiles(
      transition.fromTile.tileX,
      transition.fromTile.tileY,
      getTransitionTiles(transition),
    ),
    transition,
  }));
}

export function buildNpcTargets(anchors: MapNpcAnchor[]): NpcInteractionTarget[] {
  return anchors.map((anchor) => ({
    definition: {
      id: anchor.id,
      interactionType: 'npc' as const,
      promptText: `Press E: ${anchor.promptLabel ?? 'Talk'}`,
      interactionRangeTiles: anchor.interactionRangeTiles ?? 1,
      priority: 80,
    },
    tiles: createSingleTileInteractionTiles(anchor.tileX, anchor.tileY),
    anchor,
  }));
}

export function buildDebugTargets(anchors: MapGenericDebugAnchor[]): GenericDebugInteractionTarget[] {
  return anchors.map((anchor) => ({
    definition: {
      id: anchor.id,
      interactionType: 'generic_debug' as const,
      promptText: `Press E: ${anchor.promptLabel ?? 'Inspect'}`,
      interactionRangeTiles: anchor.interactionRangeTiles ?? 1,
      priority: 10,
    },
    tiles: createSingleTileInteractionTiles(anchor.tileX, anchor.tileY),
    anchor,
  }));
}
