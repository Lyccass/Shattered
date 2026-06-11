import type { SkillUnlockEntry } from './SkillUnlockTypes';
import { WOODWORKING_UNLOCKS } from './unlocks/WoodworkingUnlocks';
import { METALWORKING_UNLOCKS } from './unlocks/MetalworkingUnlocks';
import { ALCHEMY_UNLOCKS } from './unlocks/AlchemyUnlocks';
import { MELEE_UNLOCKS } from './unlocks/MeleeUnlocks';
import { TRADE_UNLOCKS } from './unlocks/TradeUnlocks';
import { MAGIC_UNLOCKS } from './unlocks/MagicUnlocks';
import { DEVOTION_UNLOCKS } from './unlocks/DevotionUnlocks';

export const SKILL_UNLOCKS: SkillUnlockEntry[] = [
  ...WOODWORKING_UNLOCKS,
  ...METALWORKING_UNLOCKS,
  ...ALCHEMY_UNLOCKS,
  ...MELEE_UNLOCKS,
  ...MAGIC_UNLOCKS,
  ...DEVOTION_UNLOCKS,
  ...TRADE_UNLOCKS,
];
