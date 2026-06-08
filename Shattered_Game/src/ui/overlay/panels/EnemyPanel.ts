import type { TurnCombatUiSnapshot } from '../../../combat/CombatUiTypes';
import { requireElement } from '../../domUtils';

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
          <div class="enemy-hp-fill"></div>
        </div>
        <div class="enemy-hp-text"></div>
      </div>
    `;

    this.nameEl = requireElement(this.root, '.enemy-name');
    this.tierEl = requireElement(this.root, '.enemy-tier');
    this.hpFill = requireElement(this.root, '.enemy-hp-fill');
    this.hpText = requireElement(this.root, '.enemy-hp-text');

    overlay.appendChild(this.root);
  }

  update(combat: TurnCombatUiSnapshot | null): void {
    const enemy = combat?.active
      ? (combat.turnOrder.find((p) => p.kind === 'enemy') ?? null)
      : null;

    if (!enemy) {
      this.root.classList.add('ui-hidden');
      return;
    }

    this.root.classList.remove('ui-hidden');
    this.nameEl.textContent = enemy.name;
    this.tierEl.textContent = enemy.isActive ? '◀' : '';

    const ratio = enemy.maxHp > 0
      ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp))
      : 0;

    this.hpFill.style.width = `${ratio * 100}%`;
    this.hpFill.classList.toggle('is-low', ratio <= LOW_HP_THRESHOLD);
    this.hpText.textContent = `${enemy.hp} / ${enemy.maxHp}`;
  }

  destroy(): void {
    this.root.remove();
  }
}
