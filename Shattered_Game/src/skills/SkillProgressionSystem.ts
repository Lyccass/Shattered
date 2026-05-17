import type { SkillId, SkillSnapshot, SkillXpDelta } from './SkillTypes';

const SKILL_DISPLAY_NAMES: Record<SkillId, string> = {
  gathering: 'Gathering',
  crafting: 'Crafting',
  survival: 'Survival',
  trade: 'Trade',
};

const XP_PER_LEVEL = 100;

export class SkillProgressionSystem {
  private readonly xpBySkill: Record<SkillId, number> = {
    gathering: 0,
    crafting: 0,
    survival: 0,
    trade: 0,
  };

  addXp(skillId: SkillId, amount: number): number {
    const resolvedAmount = Math.max(0, amount);
    this.xpBySkill[skillId] += resolvedAmount;
    return this.xpBySkill[skillId];
  }

  addXpDelta(delta: SkillXpDelta): void {
    for (const [skillId, amount] of Object.entries(delta) as Array<[SkillId, number | undefined]>) {
      if ((amount ?? 0) > 0) {
        this.addXp(skillId, amount ?? 0);
      }
    }
  }

  getXp(skillId: SkillId): number {
    return this.xpBySkill[skillId];
  }

  getLevel(skillId: SkillId): number {
    return 1 + Math.floor(this.xpBySkill[skillId] / XP_PER_LEVEL);
  }

  getAllSkills(): SkillSnapshot[] {
    return (Object.keys(this.xpBySkill) as SkillId[]).map((skillId) => ({
      id: skillId,
      displayName: SKILL_DISPLAY_NAMES[skillId],
      xp: this.getXp(skillId),
      level: this.getLevel(skillId),
    }));
  }

  createSaveSnapshot(): Record<string, number> {
    return { ...this.xpBySkill };
  }

  restoreSaveSnapshot(snapshot: Record<string, number>): void {
    (Object.keys(this.xpBySkill) as SkillId[]).forEach((skillId) => {
      const value = snapshot[skillId];
      this.xpBySkill[skillId] = sanitizeCount(value);
    });
  }
}

function sanitizeCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}
