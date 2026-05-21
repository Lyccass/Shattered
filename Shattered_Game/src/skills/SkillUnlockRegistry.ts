import type { SkillId } from './SkillTypes';
import { rankStageToLevel } from './SkillTypes';
import type { SkillUnlockEntry } from './SkillUnlockTypes';

export class SkillUnlockRegistry {
  private readonly bySkill     = new Map<SkillId, SkillUnlockEntry[]>();
  private readonly bySkillLevel = new Map<string, SkillUnlockEntry[]>();

  constructor(entries: SkillUnlockEntry[]) {
    for (const entry of entries) {
      const list = this.bySkill.get(entry.skillId) ?? [];
      list.push(entry);
      this.bySkill.set(entry.skillId, list);

      const key = `${entry.skillId}:${rankStageToLevel(entry.rankRequired, entry.stageRequired)}`;
      const levelList = this.bySkillLevel.get(key) ?? [];
      levelList.push(entry);
      this.bySkillLevel.set(key, levelList);
    }
  }

  /** All unlock entries for a skill, sorted ascending by level. */
  getAllForSkill(skillId: SkillId): SkillUnlockEntry[] {
    return [...(this.bySkill.get(skillId) ?? [])].sort(
      (a, b) =>
        rankStageToLevel(a.rankRequired, a.stageRequired) -
        rankStageToLevel(b.rankRequired, b.stageRequired),
    );
  }

  /** Entries that unlock exactly at a specific rank+stage (for level-up announcements). */
  getNewAtRankStage(skillId: SkillId, rank: number, stage: number): SkillUnlockEntry[] {
    const key = `${skillId}:${rankStageToLevel(rank, stage)}`;
    return this.bySkillLevel.get(key) ?? [];
  }

  /** All entries the player has access to at their current level. */
  getUnlockedFor(skillId: SkillId, currentLevel: number): SkillUnlockEntry[] {
    return (this.bySkill.get(skillId) ?? []).filter(
      (e) => rankStageToLevel(e.rankRequired, e.stageRequired) <= currentLevel,
    );
  }

  /** Next entry above currentLevel (for "what's coming next" display). */
  getNextUnlock(skillId: SkillId, currentLevel: number): SkillUnlockEntry | undefined {
    return this.getAllForSkill(skillId).find(
      (e) => rankStageToLevel(e.rankRequired, e.stageRequired) > currentLevel,
    );
  }
}
