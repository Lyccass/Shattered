import type { SkillUnlockEntry } from './SkillUnlockTypes';
import { WOODWORKING_UNLOCKS } from './unlocks/WoodworkingUnlocks';
import { METALWORKING_UNLOCKS } from './unlocks/MetalworkingUnlocks';
import { ALCHEMY_UNLOCKS } from './unlocks/AlchemyUnlocks';
import { MELEE_UNLOCKS } from './unlocks/MeleeUnlocks';
import { DEFENCE_UNLOCKS } from './unlocks/DefenceUnlocks';
import { TRADE_UNLOCKS } from './unlocks/TradeUnlocks';

export const SKILL_UNLOCKS: SkillUnlockEntry[] = [
  ...WOODWORKING_UNLOCKS,
  ...METALWORKING_UNLOCKS,
  ...ALCHEMY_UNLOCKS,
  ...MELEE_UNLOCKS,
  ...DEFENCE_UNLOCKS,
  ...TRADE_UNLOCKS,
];
