import type {
  InteractionTarget,
  PlacedObjectInteractionTarget,
} from '../../interactions/InteractionTypes';

export function getInteractionMenuTitle(target: InteractionTarget): string {
  switch (target.definition.interactionType) {
    case 'map_transition':
      return 'Travel';
    case 'resource_node':
      return 'Resource';
    case 'npc':
      return 'Interaction';
    case 'workbench':
      return 'Workbench';
    case 'contract_board':
      return 'Contracts';
    case 'placed_object':
      return (target as PlacedObjectInteractionTarget).placedObjectKind === 'campfire'
        ? 'Campfire'
        : 'Firestarter';
    case 'generic_debug':
      return 'Inspect';
  }
}

export function getInteractionUseLabel(target: InteractionTarget): string {
  switch (target.definition.interactionType) {
    case 'map_transition':
      return 'Use Route';
    case 'resource_node':
      return 'Gather';
    case 'npc':
      return 'Talk';
    case 'workbench':
      return 'Use Workbench';
    case 'contract_board':
      return 'Read Contracts';
    case 'placed_object':
      return (target as PlacedObjectInteractionTarget).placedObjectKind === 'campfire'
        ? 'Use Campfire'
        : 'Light Firestarter';
    case 'generic_debug':
      return 'Use';
  }
}

export function getInteractionUseDetails(target: InteractionTarget): string {
  switch (target.definition.interactionType) {
    case 'map_transition':
      return 'Travel onward.';
    case 'resource_node':
      return 'Harvest what you can carry.';
    case 'npc':
      return 'Start a conversation.';
    case 'workbench':
      return 'Craft using the workbench.';
    case 'contract_board':
      return 'Review and manage posted tasks.';
    case 'placed_object':
      return (target as PlacedObjectInteractionTarget).placedObjectKind === 'campfire'
        ? 'Brew or use the fire.'
        : 'Try to light it.';
    case 'generic_debug':
      return 'Interact with it.';
  }
}
