import type { EquipmentSlot, WeaponStats, ArmorStats } from '../equipment/EquipmentTypes';
import type { EffectId } from '../effects/EffectTypes';
import type { MapSpaceType, MapZoneTag } from '../world/maps/MapTypes';

// ─── Categories ───────────────────────────────────────────────────────────────
// Used for bank tab grouping and inventory filtering.
// One item belongs to exactly one category.

export type ItemCategory =
  | 'equipment'   // weapons, armour, accessories — can be equipped to a slot
  | 'material'    // raw resources and drops (wood, ore, pelts, bones, etc.)
  | 'consumable'  // food and drinks
  | 'ammo'        // stackable projectiles (arrows, bolts, darts)
  | 'tool'        // skill-enabling items; not consumed (tinderbox, knife, spade…)
  | 'readable'    // books and scrolls with text content
  | 'misc';       // markers, trade goods, low-value drops

// ─── Capability sub-types ─────────────────────────────────────────────────────
// Presence of a capability field determines which interactions are available.
// All items support: examine, use (routes to relevant action), drop.

export type ItemEquipmentData = {
  slot: EquipmentSlot;
  requiredLevel?: number;   // minimum skill level to equip; default 1
  twoHanded?: boolean;      // occupies both main_hand and off_hand slots
  weaponStats?: WeaponStats;
  armorStats?: ArmorStats;
};

export type ConsumeEffect = {
  effectId?: EffectId;      // ID wired to ConsumableEffectSystem
  message?: string;         // shown on use
  hpRestore?: number;
  staminaRestore?: number;
};

export type ReadableContent = {
  title: string;
  pages: string[];          // each element is one page of text
};

// Placement rules for tool items that can be placed in the world
export type PlacementRules = {
  allowedSpaceTypes?: MapSpaceType[];
  forbiddenSpaceTypes?: MapSpaceType[];
  allowedZoneTags?: MapZoneTag[];
  forbiddenZoneTags?: MapZoneTag[];
  mustBeWalkable?: boolean;
  mustNotBeBlocked?: boolean;
  maxActivePerSession?: number;
  durationMs?: number;
  minTransitionDistanceTiles?: number;
};

// ─── Core item definition ─────────────────────────────────────────────────────

export type ItemDefinition = {
  id: string;
  name: string;             // display name shown to player
  examine: string;          // flavour text shown on Examine
  icon: string;             // emoji (or future sprite key)
  category: ItemCategory;
  stackable: boolean;       // true = stacks in inventory (ammo, runes, coins)
                            // false = each item occupies one inventory slot
  weight: number;           // kg; contributes to carry weight when in inventory
  value: number;            // base shop buy/sell price in coins

  // Capability fields — only present when relevant.
  equipment?: ItemEquipmentData;    // present → item can be equipped
  consume?: ConsumeEffect;          // present → item has Eat / Drink / Use action
  readable?: ReadableContent;       // present → item has Read action
  toolFor?: string[];               // skill IDs this tool enables (knife → fletching)
  gatherTier?: number;              // 1–7; higher tier = more yield when gathering resources
  companionId?: string;             // present → item is a companion; value = CompanionDefinition id

  // Placement (tool items placed in the world)
  placementRules?: PlacementRules;
  placementObjectDefinitionId?: string;
};
