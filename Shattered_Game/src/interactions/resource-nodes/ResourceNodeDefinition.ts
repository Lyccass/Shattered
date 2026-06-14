import type { SkillId } from '../../skills/SkillTypes';
import type { ResourceNodeType } from '../../world/maps/MapTypes';

export type ResourceNodeDefinition = {
  type:            ResourceNodeType;
  skill:           SkillId;
  xpReward:        number;       // XP granted on successful gather
  respawnMs:       number;       // ms until the node respawns
  priority:        number;       // interaction target priority (higher = shown first)
  promptText:      string;       // "Press E: …" hint
  inventoryKey:    string;
  levelRequired?:  number;       // minimum skill level required to gather (default: 1)
  /** skillId that a tool must cover (checks equipped slots then inventory). */
  toolRequired?:   string;
  /** Base items yielded per gather (default: 1). */
  yieldBase?:      number;
  /** Additional items per tool gatherTier above 1 (default: 0). */
  toolTierBonus?:  number;
};
