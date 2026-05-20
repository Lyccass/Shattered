import type { SkillSnapshot } from '../../../skills/SkillTypes';

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level - 1, 1.6));
}

function xpForNextLevel(level: number): number {
  return xpForLevel(level + 1);
}

export class SkillsTabContent {
  readonly el: HTMLElement;
  private readonly rows: Map<string, { bar: HTMLElement; xpText: HTMLElement; levelEl: HTMLElement }> = new Map();

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'skills-tab';
  }

  update(skills: SkillSnapshot[]): void {
    if (skills.length === 0) return;

    skills.forEach((skill) => {
      let row = this.rows.get(skill.id);

      if (!row) {
        row = this.createRow(skill);
        this.rows.set(skill.id, row);
      }

      const currentLevelXp = xpForLevel(skill.level);
      const nextLevelXp    = xpForNextLevel(skill.level);
      const progress       = nextLevelXp > currentLevelXp
        ? Math.min(1, (skill.xp - currentLevelXp) / (nextLevelXp - currentLevelXp))
        : 1;

      row.levelEl.textContent  = String(skill.level);
      row.bar.style.width      = `${Math.round(progress * 100)}%`;
      row.xpText.textContent   = `${skill.xp} xp`;
    });
  }

  private createRow(skill: SkillSnapshot): { bar: HTMLElement; xpText: HTMLElement; levelEl: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <div class="skill-header">
        <span class="skill-name">${skill.displayName}</span>
        <span class="skill-level"></span>
      </div>
      <div class="skill-bar-track">
        <div class="skill-bar-fill"></div>
      </div>
      <div class="skill-xp"></div>
    `;

    this.el.appendChild(row);

    return {
      levelEl: row.querySelector('.skill-level')!,
      bar:     row.querySelector('.skill-bar-fill')!,
      xpText:  row.querySelector('.skill-xp')!,
    };
  }
}
