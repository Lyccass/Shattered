import type { ShopDefinition } from './TraderTypes';

export const SHOP_DEFINITIONS: ShopDefinition[] = [
  {
    id: 'maren_general',
    displayName: "Maren's Wares",
    buyMarkupBase: 1.5,
    sellMarkdownBase: 0.5,
    entries: [
      // ── Consumables ────────────────────────────────────────────────────────
      { itemId: 'warm_tea',        stock: 10, maxStock: 10, restockRatePerMin: 0.5 },
      // ── Materials ──────────────────────────────────────────────────────────
      { itemId: 'herb',            stock: 20, maxStock: 20, restockRatePerMin: 1.0 },
      // ── Starter weapons ────────────────────────────────────────────────────
      { itemId: 'copper_sword',    stock: 2,  maxStock: 5 },
      { itemId: 'copper_axe',      stock: 2,  maxStock: 5 },
      { itemId: 'copper_dagger',   stock: 2,  maxStock: 5 },
      { itemId: 'copper_hammer',   stock: 1,  maxStock: 3 },
      { itemId: 'copper_spear',    stock: 2,  maxStock: 5 },
      // ── Starter armour ────────────────────────────────────────────────────
      { itemId: 'copper_head',      stock: 1,  maxStock: 2 },
      { itemId: 'copper_gloves',    stock: 1,  maxStock: 2 },
      { itemId: 'copper_body',      stock: 1,  maxStock: 2 },
      { itemId: 'copper_legs',      stock: 1,  maxStock: 2 },
      { itemId: 'copper_feet',      stock: 1,  maxStock: 2 },
    ],
  },
];
