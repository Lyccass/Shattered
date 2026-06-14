// Registration entry point — import this once at app startup to populate the
// module-level ItemRegistry with all known item definitions.
// To add a new item: create it in the appropriate category file and add it to
// that file's exported array. No other file needs changing.

import { registerItem } from '../ItemRegistry';
import { MATERIAL_ITEMS } from './materials';
import { CONSUMABLE_ITEMS } from './consumables';
import { TOOL_ITEMS } from './tools';
import { WEAPON_ITEMS } from './equipment/weapons';
import { RANGED_WEAPON_ITEMS } from './equipment/ranged';
import { ARMOR_ITEMS } from './equipment/armor';
import { LEATHER_ARMOR_ITEMS } from './equipment/leather-armor';
import { ACCESSORY_ITEMS } from './equipment/accessories';
import { COMPANION_ITEMS } from './companions';

const ALL_ITEMS = [
  ...MATERIAL_ITEMS,
  ...CONSUMABLE_ITEMS,
  ...TOOL_ITEMS,
  ...WEAPON_ITEMS,
  ...RANGED_WEAPON_ITEMS,
  ...ARMOR_ITEMS,
  ...LEATHER_ARMOR_ITEMS,
  ...ACCESSORY_ITEMS,
  ...COMPANION_ITEMS,
];

for (const def of ALL_ITEMS) {
  registerItem(def);
}
