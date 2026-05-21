// Modular skill list — add new skills here and in SkillProgressionSystem.INITIAL_XP
export type SkillId =
  | 'melee'
  | 'defence'
  | 'metalworking'
  | 'woodworking'
  | 'alchemy'
  | 'trade';
// Future additions: 'survival' | 'magic' | 'ranged' | 'fishing' | 'cooking' | ...

export type SkillXpDelta = Partial<Record<SkillId, number>>;

// Each skill has 10 ranks (1–10), each rank has 10 stages (1–10).
// Absolute level = (rank - 1) * 10 + stage  →  range 1–100.
export type RankStage = { rank: number; stage: number };

export function rankStageToLevel(rank: number, stage: number): number {
  return (rank - 1) * 10 + stage;
}

export function levelToRankStage(level: number): RankStage {
  const clamped = Math.max(1, Math.min(100, Math.floor(level)));
  return {
    rank:  Math.floor((clamped - 1) / 10) + 1,
    stage: ((clamped - 1) % 10) + 1,
  };
}

export type LevelUpEvent = {
  skillId: SkillId;
  displayName: string;
  oldLevel: number;
  newLevel: number;
  rank: number;
  stage: number;
  rankedUp: boolean;
};

export type SkillSnapshot = {
  id: SkillId;
  displayName: string;
  xp: number;
  level: number;              // absolute 1–100
  rank: number;               // 1–10
  stage: number;              // 1–10
  xpIntoStage: number;        // XP earned since entering this stage
  xpForStage: number;         // XP needed to advance one stage
};
