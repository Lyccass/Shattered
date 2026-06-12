import type { TurnCombatUiSnapshot } from '../../../combat/CombatUiTypes';
import type { StatusEffect } from '../../../combat/turn/TurnCombatTypes';
import { requireElement } from '../../domUtils';

const LOW_HP_THRESHOLD = 0.25;

export class EnemyPanel {
  private readonly root: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly tierEl: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly staggerFill: HTMLElement;
  private readonly staggerWrap: HTMLElement;
  private readonly statusIconsEl: HTMLElement;
  private readonly turnOrderEl: HTMLElement;

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
        <div class="enemy-stagger-wrap">
          <div class="enemy-stagger-track">
            <div class="enemy-stagger-fill"></div>
          </div>
        </div>
        <div class="enemy-hp-text"></div>
        <div class="enemy-status-icons"></div>
        <div class="enemy-turn-order"></div>
      </div>
    `;

    this.nameEl      = requireElement(this.root, '.enemy-name');
    this.tierEl      = requireElement(this.root, '.enemy-tier');
    this.hpFill      = requireElement(this.root, '.enemy-hp-fill');
    this.hpText      = requireElement(this.root, '.enemy-hp-text');
    this.staggerFill = requireElement(this.root, '.enemy-stagger-fill');
    this.staggerWrap = requireElement(this.root, '.enemy-stagger-wrap');
    this.statusIconsEl = requireElement(this.root, '.enemy-status-icons');
    this.turnOrderEl = requireElement(this.root, '.enemy-turn-order');

    overlay.appendChild(this.root);
  }

  update(combat: TurnCombatUiSnapshot | null): void {
    if (!combat?.active) {
      this.root.classList.add('ui-hidden');
      return;
    }

    const enemy = combat.turnOrder.find((p) => p.kind === 'enemy') ?? null;

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

    // Stagger bar
    const stagger = enemy.stagger ?? 0;
    const staggerThreshold = Math.max(1, enemy.staggerThreshold ?? 10);
    const staggerRatio = Math.min(1, stagger / staggerThreshold);
    this.staggerFill.style.width = `${staggerRatio * 100}%`;
    this.staggerWrap.style.display = stagger > 0 ? '' : 'none';

    // Status icons
    renderStatusIcons(this.statusIconsEl, enemy.statusEffects, 0);

    this.renderTurnOrder(combat);
  }

  destroy(): void {
    this.root.remove();
  }

  private renderTurnOrder(combat: TurnCombatUiSnapshot): void {
    const activeId = combat.activeParticipantId;
    this.turnOrderEl.innerHTML = '';

    for (const participant of combat.turnOrder) {
      const chip = document.createElement('div');
      chip.className = [
        'enemy-turn-chip',
        participant.kind === 'player' ? 'is-player' : '',
        participant.kind === 'companion' ? 'is-companion' : '',
        participant.kind === 'enemy' ? 'is-enemy' : '',
        participant.id === activeId ? 'is-active' : '',
      ].filter(Boolean).join(' ');
      chip.textContent = participant.kind === 'player'
        ? 'You'
        : participant.name;
      this.turnOrderEl.appendChild(chip);
    }
  }
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  stunned:          { label: 'Stun',  cls: 'csi--debuff' },
  slowed:           { label: 'Slow',  cls: 'csi--debuff' },
  bleeding:         { label: 'Bleed', cls: 'csi--debuff' },
  damage_over_time: { label: 'DoT',   cls: 'csi--debuff' },
  guarded:          { label: 'Guard', cls: 'csi--guard'  },
  fortified:        { label: 'Fort',  cls: 'csi--buff'   },
};

export function renderStatusIcons(container: HTMLElement, effects: StatusEffect[], bleedMoveTiles: number): void {
  container.innerHTML = '';
  for (const effect of effects) {
    const meta = STATUS_META[effect.kind];
    if (!meta) continue;
    const chip = document.createElement('span');
    chip.className = `csi ${meta.cls}`;
    const isBleed = effect.kind === 'bleeding' && bleedMoveTiles > 0;
    chip.textContent = isBleed
      ? `${meta.label}(${bleedMoveTiles})`
      : meta.label;
    const turns = document.createElement('span');
    turns.className = 'csi__turns';
    turns.textContent = ` ${effect.turnsRemaining}`;
    chip.appendChild(turns);
    container.appendChild(chip);
  }
}
