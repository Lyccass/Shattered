import { getItem } from '../../items/ItemRegistry';

// Thin adapter — keeps the existing call-site API intact while reading from
// the unified ItemRegistry. Callers that need richer data should import
// from ItemRegistry and ItemTypes directly.

export type InventoryItemMeta = {
  label: string;
  icon: string;
  description: string;
  useMode: 'none' | 'place' | 'consume' | 'equip';
};

export function getInventoryItemMeta(itemId: string): InventoryItemMeta {
  const def = getItem(itemId);
  if (!def) {
    return { label: itemId, icon: '?', description: 'Unknown item.', useMode: 'none' };
  }

  const useMode: InventoryItemMeta['useMode'] = def.consume
    ? 'consume'
    : def.placementObjectDefinitionId
      ? 'place'
      : def.equipment
        ? 'equip'
        : 'none';

  return {
    label: def.name,
    icon: def.icon,
    description: def.examine,
    useMode,
  };
}
