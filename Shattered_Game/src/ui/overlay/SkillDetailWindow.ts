import { SKILL_UNLOCKS } from '../../skills/SkillUnlockData';
import { SkillUnlockRegistry } from '../../skills/SkillUnlockRegistry';
import type { SkillSnapshot } from '../../skills/SkillTypes';
import { rankStageToLevel } from '../../skills/SkillTypes';
import type { SkillUnlockEntry, UnlockKind } from '../../skills/SkillUnlockTypes';

const REGISTRY = new SkillUnlockRegistry(SKILL_UNLOCKS);

type TabDef = {
  id:    UnlockKind;
  label: string;
};

const TABS: TabDef[] = [
  { id: 'misc',          label: 'Misc'       },
  { id: 'weapon',        label: 'Weapons'    },
  { id: 'armor',         label: 'Armour'     },
  { id: 'recipe',        label: 'Recipes'    },
  { id: 'resource_node', label: 'Resources'  },
  { id: 'tool',          label: 'Equipment'  },
  { id: 'combat_spell',  label: 'Combat'     },
  { id: 'utility_spell', label: 'Utility'    },
  { id: 'devotion_ability', label: 'Devotion' },
  { id: 'passive',       label: 'Activities' },
];

export class SkillDetailWindow {
  readonly el: HTMLElement;

  private activeTab: UnlockKind | null = null;
  private readonly tabBtns = new Map<UnlockKind, HTMLElement>();
  private readonly bodyEl: HTMLElement;

  // Progress elements for live updates
  private readonly stageLabelEl: HTMLElement;
  private readonly xpLabelEl: HTMLElement;
  private readonly fillEl: HTMLElement;
  private readonly totalEl: HTMLElement;
  private readonly pipEls: HTMLElement[] = [];

  constructor(private skill: SkillSnapshot) {
    this.el = document.createElement('div');
    this.el.className = 'skd';

    const progress = this.buildProgress();
    this.stageLabelEl = progress.stageLabel;
    this.xpLabelEl    = progress.xpLabel;
    this.fillEl       = progress.fill;
    this.totalEl      = progress.total;
    this.pipEls       = progress.pips;
    this.el.appendChild(progress.el);
    const tabBar = this.buildTabBar();
    if (tabBar) this.el.appendChild(tabBar);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'skd-body';
    this.el.appendChild(this.bodyEl);

    this.renderTab(this.getDefaultTab());
  }

  // ── Live update ─────────────────────────────────────────────────────────────

  update(skill: SkillSnapshot): void {
    if (skill.xp === this.skill.xp) return;
    this.skill = skill;
    this.refreshProgress();
  }

  // ── Progress bar ────────────────────────────────────────────────────────────

  private buildProgress(): {
    el: HTMLElement;
    stageLabel: HTMLElement;
    xpLabel: HTMLElement;
    fill: HTMLElement;
    total: HTMLElement;
    pips: HTMLElement[];
  } {
    const wrap = document.createElement('div');
    wrap.className = 'skd-progress';

    // Header row
    const header = document.createElement('div');
    header.className = 'skd-progress-header';

    const levelBadge = document.createElement('span');
    levelBadge.className = 'skd-level-badge';
    levelBadge.textContent = `Lv.${this.skill.level}`;

    const stageLabel = document.createElement('span');
    stageLabel.className = 'skd-progress-stage';
    stageLabel.innerHTML = `Rank ${this.skill.rank} &middot; Stage ${this.skill.stage}`;

    const xpLabel = document.createElement('span');
    xpLabel.className = 'skd-progress-xp';
    xpLabel.textContent = `${fmt(this.skill.xpIntoStage)} / ${fmt(this.skill.xpForStage)} xp`;

    header.appendChild(levelBadge);
    header.appendChild(stageLabel);
    header.appendChild(xpLabel);
    wrap.appendChild(header);

    // Stage pips (10 dots for stages 1–10 within current rank)
    const pipsRow = document.createElement('div');
    pipsRow.className = 'skd-pips';
    const pips: HTMLElement[] = [];
    for (let i = 1; i <= 10; i++) {
      const pip = document.createElement('span');
      pip.className = this.pipClass(i);
      pipsRow.appendChild(pip);
      pips.push(pip);
    }
    wrap.appendChild(pipsRow);

    // XP bar
    const track = document.createElement('div');
    track.className = 'skd-progress-track';
    const fill = document.createElement('div');
    fill.className = 'skd-progress-fill';
    fill.style.width = `${this.xpPct()}%`;
    track.appendChild(fill);
    wrap.appendChild(track);

    // Total XP line
    const total = document.createElement('div');
    total.className = 'skd-progress-total';
    total.textContent = `Total XP: ${fmt(this.skill.xp)}`;
    wrap.appendChild(total);

    return { el: wrap, stageLabel, xpLabel, fill, total, pips };
  }

  private refreshProgress(): void {
    this.stageLabelEl.innerHTML = `Rank ${this.skill.rank} &middot; Stage ${this.skill.stage}`;
    this.xpLabelEl.textContent  = `${fmt(this.skill.xpIntoStage)} / ${fmt(this.skill.xpForStage)} xp`;
    this.fillEl.style.width     = `${this.xpPct()}%`;
    this.totalEl.textContent    = `Total XP: ${fmt(this.skill.xp)}`;
    this.pipEls.forEach((pip, i) => { pip.className = this.pipClass(i + 1); });
  }

  private xpPct(): number {
    return this.skill.xpForStage > 0
      ? Math.round((this.skill.xpIntoStage / this.skill.xpForStage) * 100)
      : 100;
  }

  private pipClass(pipStage: number): string {
    if (pipStage < this.skill.stage)  return 'skd-pip skd-pip--done';
    if (pipStage === this.skill.stage) return 'skd-pip skd-pip--current';
    return 'skd-pip';
  }

  // ── Tab bar ─────────────────────────────────────────────────────────────────

  private buildTabBar(): HTMLElement | null {
    const availableTabs = this.getAvailableTabs();
    if (availableTabs.length === 0) return null;

    const bar = document.createElement('div');
    bar.className = 'skd-tabbar';

    for (const tab of availableTabs) {
      const btn = document.createElement('button');
      btn.className = 'skd-tab';
      btn.textContent = tab.label;
      btn.addEventListener('click', () => this.renderTab(tab.id));
      this.tabBtns.set(tab.id, btn);
      bar.appendChild(btn);
    }

    return bar;
  }

  // ── Tab content ─────────────────────────────────────────────────────────────

  private renderTab(kind: UnlockKind | null): void {
    if (this.activeTab) this.tabBtns.get(this.activeTab)?.classList.remove('skd-tab--active');
    this.activeTab = kind;
    if (kind) this.tabBtns.get(kind)?.classList.add('skd-tab--active');

    this.bodyEl.innerHTML = '';
    const overview = kind === 'misc' ? this.buildSkillOverview() : null;
    if (overview) {
      this.bodyEl.appendChild(overview);
      return;
    }

    const all = kind
      ? REGISTRY.getAllForSkill(this.skill.id).filter((e) => e.kind === kind)
      : [];

    if (all.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'skd-empty';
      empty.textContent = 'Nothing here yet — content coming in a future update.';
      this.bodyEl.appendChild(empty);
      return;
    }

    const unlocked = all.filter((e) => rankStageToLevel(e.rankRequired, e.stageRequired) <= this.skill.level);
    const upcoming = all.filter((e) => rankStageToLevel(e.rankRequired, e.stageRequired) >  this.skill.level);

    if (unlocked.length > 0) this.bodyEl.appendChild(this.buildSection('Unlocked', unlocked, true));
    if (upcoming.length  > 0) this.bodyEl.appendChild(this.buildSection('Up Next',  upcoming,  false));
  }

  private buildSkillOverview(): HTMLElement | null {
    if (
      this.skill.id !== 'melee' &&
      this.skill.id !== 'ranged' &&
      this.skill.id !== 'magic' &&
      this.skill.id !== 'devotion'
    ) return null;

    if (this.skill.id === 'magic' || this.skill.id === 'devotion') {
      return this.buildResourceOverview();
    }

    const rankDamageBonus = Math.max(0, this.skill.rank - 1);
    const nextRankLevel = this.skill.rank < 10 ? rankStageToLevel(this.skill.rank + 1, 1) : null;
    const skillName = this.skill.id === 'melee' ? 'Melee' : 'Ranged';
    const weaponText = this.skill.id === 'melee'
      ? 'melee weapons and fists'
      : 'bows and crossbows';

    const section = document.createElement('div');
    section.className = 'skd-section';

    const hd = document.createElement('div');
    hd.className = 'skd-section-hd skd-section-hd--done';
    hd.textContent = 'Combat Scaling';
    section.appendChild(hd);

    section.appendChild(this.buildInfoRow(
      'Current Damage Bonus',
      `+${rankDamageBonus} max hit`,
      `${skillName} rank adds this bonus to ${weaponText}.`,
      true,
    ));
    section.appendChild(this.buildInfoRow(
      'Accuracy',
      '+0.4% per level',
      `${skillName} level raises base accuracy before armour and facing modifiers are applied.`,
      true,
    ));
    section.appendChild(this.buildInfoRow(
      'Next Rank',
      nextRankLevel ? `Lv.${nextRankLevel}: +1 max hit` : 'Max rank reached',
      `Each rank-up increases max hit by 1 for ${weaponText}.`,
      nextRankLevel === null || this.skill.level >= nextRankLevel,
    ));

    return section;
  }

  private buildResourceOverview(): HTMLElement {
    const nextRankLevel = this.skill.rank < 10 ? rankStageToLevel(this.skill.rank + 1, 1) : null;
    const resourceName = this.skill.id === 'magic' ? 'Magic' : 'Devotion';
    const restoreText = this.skill.id === 'magic'
      ? 'Spent by combat spells and restored by resting, cities, shrines, camps, rare events, or rare items.'
      : 'Spent by devotion abilities and restored by resting, cities, shrines, camps, rare events, or rare items.';
    const section = document.createElement('div');
    section.className = 'skd-section';

    const hd = document.createElement('div');
    hd.className = 'skd-section-hd skd-section-hd--done';
    hd.textContent = `${resourceName} Resource`;
    section.appendChild(hd);

    section.appendChild(this.buildInfoRow(
      'Current Resource Max',
      `${getPersistentResourceMaxForRank(this.skill.rank)} ${resourceName}`,
      `Rank ${this.skill.rank} lets you spend more ${resourceName.toLowerCase()} before returning to rest.`,
      true,
    ));
    section.appendChild(this.buildInfoRow(
      'Restoration',
      'Persistent',
      restoreText,
      true,
    ));
    section.appendChild(this.buildInfoRow(
      'Next Rank',
      nextRankLevel
        ? `Lv.${nextRankLevel}: +1 ${resourceName}`
        : 'Max rank reached',
      `Each rank-up increases ${resourceName.toLowerCase()} resource by 1.`,
      nextRankLevel === null || this.skill.level >= nextRankLevel,
    ));

    return section;
  }

  private buildInfoRow(
    name: string,
    value: string,
    description: string,
    done: boolean,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = `skd-row ${done ? 'skd-row--done' : 'skd-row--locked'}`;
    row.innerHTML = `
      <span class="skd-row-badge skd-row-badge--wide">${value}</span>
      <div class="skd-row-info">
        <span class="skd-row-name">${name}</span>
        <span class="skd-row-desc">${description}</span>
      </div>
    `;
    return row;
  }

  private getDefaultTab(): UnlockKind | null {
    return this.getAvailableTabs()[0]?.id ?? null;
  }

  private getAvailableTabs(): TabDef[] {
    const entries = REGISTRY.getAllForSkill(this.skill.id);
    return TABS.filter((tab) =>
      entries.some((entry) => entry.kind === tab.id) ||
      (tab.id === 'misc' && (
        this.skill.id === 'melee' ||
        this.skill.id === 'ranged' ||
        this.skill.id === 'magic' ||
        this.skill.id === 'devotion'
      )),
    );
  }

  private buildSection(title: string, entries: SkillUnlockEntry[], done: boolean): HTMLElement {
    const section = document.createElement('div');
    section.className = 'skd-section';

    const hd = document.createElement('div');
    hd.className = `skd-section-hd ${done ? 'skd-section-hd--done' : 'skd-section-hd--next'}`;
    hd.textContent = title;
    section.appendChild(hd);

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = `skd-row ${done ? 'skd-row--done' : 'skd-row--locked'}`;

      row.innerHTML = `
        <span class="skd-row-badge">R${entry.rankRequired}&middot;S${entry.stageRequired}</span>
        <div class="skd-row-info">
          <span class="skd-row-name">${entry.displayName}</span>
          ${entry.description ? `<span class="skd-row-desc">${entry.description}</span>` : ''}
        </div>
      `;
      section.appendChild(row);
    }

    return section;
  }
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function getPersistentResourceMaxForRank(rank: number): number {
  return 4 + Math.max(0, rank - 1);
}
