import type { SkillId, SkillSnapshot } from '../../../skills/SkillTypes';

export class SkillsTabContent {
  readonly el: HTMLElement;

  private readonly rows = new Map<SkillId, {
    rankEl:  HTMLElement;
    stageEl: HTMLElement;
    bar:     HTMLElement;
    xpText:  HTMLElement;
  }>();

  private readonly latestSnaps = new Map<SkillId, SkillSnapshot>();

  constructor(
    private readonly onSkillClick: (skill: SkillSnapshot) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'skills-tab';
  }

  update(skills: SkillSnapshot[]): void {
    if (skills.length === 0) return;

    for (const skill of skills) {
      this.latestSnaps.set(skill.id, skill);

      let row = this.rows.get(skill.id);
      if (!row) {
        row = this.createRow(skill);
        this.rows.set(skill.id, row);
      }

      const progress = skill.xpForStage > 0
        ? Math.min(1, skill.xpIntoStage / skill.xpForStage)
        : 1;

      row.rankEl.textContent  = `R${skill.rank}`;
      row.stageEl.textContent = `S${skill.stage}`;
      row.bar.style.width     = `${Math.round(progress * 100)}%`;
      row.xpText.textContent  =
        `${skill.xpIntoStage.toLocaleString()} / ${skill.xpForStage.toLocaleString()} xp`;
    }
  }

  private createRow(skill: SkillSnapshot) {
    const rowEl = document.createElement('div');
    rowEl.className = 'skill-row';

    const headerEl = document.createElement('div');
    headerEl.className = 'skill-header skill-header--clickable';
    headerEl.innerHTML = `
      <span class="skill-name">${skill.displayName}</span>
      <span class="skill-rank-stage">
        <span class="skill-rank"></span>
        <span class="skill-sep">·</span>
        <span class="skill-stage"></span>
      </span>
    `;
    headerEl.addEventListener('click', () => {
      const snap = this.latestSnaps.get(skill.id);
      if (snap) this.onSkillClick(snap);
    });

    const barTrack = document.createElement('div');
    barTrack.className = 'skill-bar-track';
    const barFill = document.createElement('div');
    barFill.className = 'skill-bar-fill';
    barTrack.appendChild(barFill);

    const xpText = document.createElement('div');
    xpText.className = 'skill-xp';

    rowEl.appendChild(headerEl);
    rowEl.appendChild(barTrack);
    rowEl.appendChild(xpText);
    this.el.appendChild(rowEl);

    return {
      rankEl:  headerEl.querySelector<HTMLElement>('.skill-rank')!,
      stageEl: headerEl.querySelector<HTMLElement>('.skill-stage')!,
      bar:     barFill,
      xpText,
    };
  }
}
