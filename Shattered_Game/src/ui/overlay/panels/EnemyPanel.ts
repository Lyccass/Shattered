import type { CombatUiSnapshot } from '../../../combat/CombatUiTypes';

const LOW_HP_THRESHOLD = 0.25;

export class EnemyPanel {
  private readonly root: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly tierEl: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;

  constructor(overlay: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ui-enemy';
    this.root.classList.add('ui-hidden');

    this.root.innerHTML = `
      <div class="enemy-name-row">
        <span class="enemy-name"></span>
        <span class="enemy-tier"></span>
      </div>
      <div class="enemy-hp-wrap">
        <div class="enemy-hp-track">
          <div class="enemy-hp-fill" style="width:100%"></div>
        </div>
        <div class="enemy-hp-text"></div>
      </div>
    `;

    this.nameEl = this.root.querySelector('.enemy-name')!;
    this.tierEl = this.root.querySelector('.enemy-tier')!;
    this.hpFill = this.root.querySelector('.enemy-hp-fill')!;
    this.hpText = this.root.querySelector('.enemy-hp-text')!;

    overlay.appendChild(this.root);
  }

  update(combat: CombatUiSnapshot | null): void {
    const enemy = combat?.enemy ?? null;

    if (!enemy) {
      this.root.classList.add('ui-hidden');
      return;
    }

    this.root.classList.remove('ui-hidden');
    this.nameEl.textContent = enemy.name;
    this.tierEl.textContent = `Rank ${enemy.tier}`;

    const ratio = enemy.maxHealth > 0
      ? Math.max(0, Math.min(1, enemy.health / enemy.maxHealth))
      : 0;

    this.hpFill.style.width = `${ratio * 100}%`;
    this.hpFill.classList.toggle('is-low', ratio <= LOW_HP_THRESHOLD);
    this.hpText.textContent = `${enemy.health} / ${enemy.maxHealth}`;
  }

  destroy(): void {
    this.root.remove();
  }
}
