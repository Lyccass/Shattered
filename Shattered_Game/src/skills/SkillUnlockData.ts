import type { SkillUnlockEntry } from './SkillUnlockTypes';
import { WOODWORKING_UNLOCKS } from './unlocks/WoodworkingUnlocks';
import { METALWORKING_UNLOCKS } from './unlocks/MetalworkingUnlocks';
import { LEATHERWORKING_UNLOCKS } from './unlocks/LeatherworkingUnlocks';
import { ALCHEMY_UNLOCKS } from './unlocks/AlchemyUnlocks';
import { MELEE_UNLOCKS } from './unlocks/MeleeUnlocks';
import { RANGED_UNLOCKS } from './unlocks/RangedUnlocks';
import { TRADE_UNLOCKS } from './unlocks/TradeUnlocks';
import { MAGIC_UNLOCKS } from './unlocks/MagicUnlocks';
import { DEVOTION_UNLOCKS } from './unlocks/DevotionUnlocks';

export const SKILL_UNLOCKS: SkillUnlockEntry[] = [
  ...WOODWORKING_UNLOCKS,
  ...METALWORKING_UNLOCKS,
  ...LEATHERWORKING_UNLOCKS,
  ...ALCHEMY_UNLOCKS,
  ...MELEE_UNLOCKS,
  ...RANGED_UNLOCKS,
  ...MAGIC_UNLOCKS,
  ...DEVOTION_UNLOCKS,
  ...TRADE_UNLOCKS,
];
