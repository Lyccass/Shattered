import type { LevelUpEvent, SkillId, SkillSnapshot, SkillXpDelta } from './SkillTypes';
import { levelToRankStage } from './SkillTypes';

// XP per stage per rank. Each rank doubles the previous, giving an exponential grind curve.
// Key property: cumulative XP at max rank 9 = exactly half of cumulative XP at max rank 10
// (i.e. rank 10 alone costs as much as all ranks 1–9 combined — OSRS-style endgame).
//
// Rank totals (×10 stages): 1k → 2k → 4k → 8k → 16k → 32k → 64k → 128k → 256k → 511k
// Cumulative max: 511 000 at rank 9  |  1 022 000 at rank 10 (max level)
const XP_PER_STAGE: readonly number[] = [
    100,  // rank  1  →    1 000 XP total
    200,  // rank  2  →    2 000
    400,  // rank  3  →    4 000
    800,  // rank  4  →    8 000
   1600,  // rank  5  →   16 000
   3200,  // rank  6  →   32 000
   6400,  // rank  7  →   64 000
  12800,  // rank  8  →  128 000
  25600,  // rank  9  →  256 000  ← cumulative = 511 000 (half of total max)
  51100,  // rank 10  →  511 000  ← cumulative = 1 022 000 (max level)
] as const;

// LEVEL_THRESHOLD[i] = total XP needed to reach level (i+1).
// Level 1 starts at 0 XP; level 100 starts at 797 450 XP.
const LEVEL_THRESHOLD: readonly number[] = (() => {
  const t: number[] = [];
  let cumulative = 0;
  for (let rankIdx = 0; rankIdx < 10; rankIdx++) {
    for (let stageIdx = 0; stageIdx < 10; stageIdx++) {
      t.push(cumulative);
      cumulative += XP_PER_STAGE[rankIdx];
    }
  }
  return t;
})();

const MAX_LEVEL = 100;

export function xpToLevel(xp: number): number {
  let level = MAX_LEVEL;
  for (let i = 0; i < LEVEL_THRESHOLD.length; i++) {
    if (xp < LEVEL_THRESHOLD[i]) {
      level = i; // i is the first index the player hasn't reached
      break;
    }
  }
  return Math.max(1, level);
}

export function xpThresholdForLevel(level: number): number {
  const idx = Math.max(0, Math.min(MAX_LEVEL - 1, level - 1));
  return LEVEL_THRESHOLD[idx];
}

const SKILL_DISPLAY_NAMES: Record<SkillId, string> = {
  melee:        'Melee',
  defence:      'Defence',
  metalworking: 'Metalworking',
  woodworking:  'Woodworking',
  alchemy:      'Alchemy',
  trade:        'Trade',
};

export class SkillProgressionSystem {
  // Add new SkillId entries here when expanding the skill set.
  private readonly xpBySkill: Record<SkillId, number> = {
    melee:        0,
    defence:      0,
    metalworking: 0,
    woodworking:  0,
    alchemy:      0,
    trade:        0,
  };

  addXp(skillId: SkillId, amount: number): number {
    const resolved = Math.max(0, amount);
    this.xpBySkill[skillId] += resolved;
    return this.xpBySkill[skillId];
  }

  addXpDelta(delta: SkillXpDelta): LevelUpEvent[] {
    const events: LevelUpEvent[] = [];
    for (const [skillId, amount] of Object.entries(delta) as Array<[SkillId, number | undefined]>) {
      if ((amount ?? 0) > 0) {
        const oldLevel = this.getLevel(skillId);
        this.addXp(skillId, amount ?? 0);
        const newLevel = this.getLevel(skillId);
        if (newLevel > oldLevel) {
          const { rank, stage } = levelToRankStage(newLevel);
          const { rank: oldRank } = levelToRankStage(oldLevel);
          events.push({
            skillId,
            displayName: SKILL_DISPLAY_NAMES[skillId],
            oldLevel,
            newLevel,
            rank,
            stage,
            rankedUp: rank > oldRank,
          });
        }
      }
    }
    return events;
  }

  getXp(skillId: SkillId): number {
    return this.xpBySkill[skillId];
  }

  getLevel(skillId: SkillId): number {
    return xpToLevel(this.xpBySkill[skillId]);
  }

  getAllSkills(): SkillSnapshot[] {
    return (Object.keys(this.xpBySkill) as SkillId[]).map((skillId) => {
      const xp    = this.xpBySkill[skillId];
      const level = xpToLevel(xp);
      const { rank, stage } = levelToRankStage(level);
      const stageStart  = xpThresholdForLevel(level);
      const stageEnd    = level < MAX_LEVEL ? xpThresholdForLevel(level + 1) : stageStart;
      return {
        id:           skillId,
        displayName:  SKILL_DISPLAY_NAMES[skillId],
        xp,
        level,
        rank,
        stage,
        xpIntoStage:  xp - stageStart,
        xpForStage:   stageEnd - stageStart,
      };
    });
  }

  createSaveSnapshot(): Record<string, number> {
    return { ...this.xpBySkill };
  }

  restoreSaveSnapshot(snapshot: Record<string, number>): void {
    (Object.keys(this.xpBySkill) as SkillId[]).forEach((skillId) => {
      const value = snapshot[skillId];
      this.xpBySkill[skillId] = sanitize(value);
    });
  }
}

function sanitize(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}
