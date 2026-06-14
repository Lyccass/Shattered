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
      // ── Starter armour ─────────────────────────────────────────────────────
      { itemId: 'copper_head',     stock: 1,  maxStock: 2 },
      { itemId: 'copper_gloves',   stock: 1,  maxStock: 2 },
      { itemId: 'copper_body',     stock: 1,  maxStock: 2 },
      { itemId: 'copper_legs',     stock: 1,  maxStock: 2 },
      { itemId: 'copper_feet',     stock: 1,  maxStock: 2 },
      // ── Pickaxes (copper–titanite) ─────────────────────────────────────────
      { itemId: 'copper_pickaxe',   stock: 3,  maxStock: 5, restockRatePerMin: 0.2 },
      { itemId: 'iron_pickaxe',     stock: 2,  maxStock: 3 },
      { itemId: 'steel_pickaxe',    stock: 2,  maxStock: 3 },
      { itemId: 'cobalt_pickaxe',   stock: 1,  maxStock: 2 },
      { itemId: 'tungsten_pickaxe', stock: 1,  maxStock: 2 },
      { itemId: 'adamant_pickaxe',  stock: 1,  maxStock: 1 },
      { itemId: 'titanite_pickaxe', stock: 1,  maxStock: 1 },
      // ── Skinning knives (copper–titanite) ─────────────────────────────────
      { itemId: 'copper_skinning_knife',   stock: 3,  maxStock: 5, restockRatePerMin: 0.2 },
      { itemId: 'iron_skinning_knife',     stock: 2,  maxStock: 3 },
      { itemId: 'steel_skinning_knife',    stock: 2,  maxStock: 3 },
      { itemId: 'cobalt_skinning_knife',   stock: 1,  maxStock: 2 },
      { itemId: 'tungsten_skinning_knife', stock: 1,  maxStock: 2 },
      { itemId: 'adamant_skinning_knife',  stock: 1,  maxStock: 1 },
      { itemId: 'titanite_skinning_knife', stock: 1,  maxStock: 1 },
    ],
  },
];
