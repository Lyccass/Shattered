export type InventoryItemMeta = {
  label: string;
  icon: string;
  description: string;
  useMode: 'none' | 'place' | 'consume';
};

const META: Record<string, InventoryItemMeta> = {
  wood: {
    label: 'Driftwood',
    icon: '🪵',
    description: 'Dry wood gathered from shore or fallen brush.',
    useMode: 'none',
  },
  stone: {
    label: 'Stone',
    icon: '🪨',
    description: 'A rough stone that can strike sparks or support simple crafting.',
    useMode: 'none',
  },
  herb: {
    label: 'Herb',
    icon: '🌿',
    description: 'A gathered herb that can be brewed over an active fire.',
    useMode: 'none',
  },
  firestarter_set: {
    label: 'Firestarter',
    icon: '🔥',
    description: 'A dry bundle of kindling tied for quick placement.',
    useMode: 'place',
  },
  wooden_marker: {
    label: 'Marker',
    icon: '📌',
    description: 'A simple carved marker for trails or camp notes.',
    useMode: 'none',
  },
  camp_supplies: {
    label: 'Supplies',
    icon: '🎒',
    description: 'A bundled pack of rough camp essentials ready to hand off.',
    useMode: 'none',
  },
  warm_tea: {
    label: 'Warm Tea',
    icon: '🫖',
    description: 'A simple hot drink brewed over a campfire.',
    useMode: 'consume',
  },
};

const FALLBACK: InventoryItemMeta = {
  label: 'Unknown',
  icon: '?',
  description: 'An unknown item.',
  useMode: 'none',
};

export function getInventoryItemMeta(itemId: string): InventoryItemMeta {
  return META[itemId] ?? { ...FALLBACK, label: itemId };
}
