export type SkillId = 'gathering' | 'crafting' | 'survival' | 'trade';

export type SkillXpDelta = Partial<Record<SkillId, number>>;

export type SkillSnapshot = {
  id: SkillId;
  displayName: string;
  xp: number;
  level: number;
};
