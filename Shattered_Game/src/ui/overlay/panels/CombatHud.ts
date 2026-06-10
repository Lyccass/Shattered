import type { TurnCombatUiSnapshot } from '../../../combat/CombatUiTypes';

/**
 * BG3-style combat HUD.
 * - Initiative bar (top centre): one card per participant, active card raised.
 * - Action bar (bottom centre): AP/MP pip tracks + Attack + End Turn buttons.
 *
 * Mounted into #ui-overlay. Styled by /public/css/ui-combat.css.
 */
export class CombatHud {
  private readonly initBar: HTMLElement;
  private readonly actionBar: HTMLElement;

  private readonly apPipsEl: HTMLElement;
  private readonly secondaryPipsEl: HTMLElement;
  private readonly mpPipsEl: HTMLElement;
  private readonly lightAttackBtn: HTMLButtonElement;
  private readonly heavyAttackBtn: HTMLButtonElement;
  private readonly guardBtn: HTMLButtonElement;
  private readonly cleanseBtn: HTMLButtonElement;
  private readonly endTurnBtn: HTMLButtonElement;
  private readonly roundLabel: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly onEndTurn: () => void,
    private readonly onAttackMode: (attackId?: string) => void,
    private readonly onGuard: () => void,
    private readonly onCleanse: () => void,
  ) {
    // ── Initiative bar ────────────────────────────────────────────────────
    this.initBar = document.createElement('div');
    this.initBar.id = 'ui-combat-init';

    // ── Action bar ────────────────────────────────────────────────────────
    this.actionBar = document.createElement('div');
    this.actionBar.id = 'ui-combat-actions';

    // Resources row (AP + MP pips)
    const resources = document.createElement('div');
    resources.className = 'combat-resources';

    const apGroup = document.createElement('div');
    apGroup.className = 'combat-pips';
    const apLabel = document.createElement('span');
    apLabel.className = 'combat-pip-label';
    apLabel.textContent = 'Main';
    this.apPipsEl = document.createElement('div');
    this.apPipsEl.className = 'combat-pips';
    apGroup.appendChild(apLabel);
    apGroup.appendChild(this.apPipsEl);

    const secondaryGroup = document.createElement('div');
    secondaryGroup.className = 'combat-pips';
    const secondaryLabel = document.createElement('span');
    secondaryLabel.className = 'combat-pip-label';
    secondaryLabel.textContent = 'Sec';
    this.secondaryPipsEl = document.createElement('div');
    this.secondaryPipsEl.className = 'combat-pips';
    secondaryGroup.appendChild(secondaryLabel);
    secondaryGroup.appendChild(this.secondaryPipsEl);

    const mpGroup = document.createElement('div');
    mpGroup.className = 'combat-pips';
    const mpLabel = document.createElement('span');
    mpLabel.className = 'combat-pip-label';
    mpLabel.textContent = 'MP';
    this.mpPipsEl = document.createElement('div');
    this.mpPipsEl.className = 'combat-pips';
    mpGroup.appendChild(mpLabel);
    mpGroup.appendChild(this.mpPipsEl);

    resources.appendChild(apGroup);
    resources.appendChild(secondaryGroup);
    resources.appendChild(mpGroup);

    // Buttons row
    const buttons = document.createElement('div');
    buttons.className = 'combat-buttons';

    this.lightAttackBtn = document.createElement('button');
    this.lightAttackBtn.className = 'combat-btn attack-btn light-attack-btn';
    this.lightAttackBtn.textContent = 'Light';

    this.heavyAttackBtn = document.createElement('button');
    this.heavyAttackBtn.className = 'combat-btn attack-btn heavy-attack-btn';
    this.heavyAttackBtn.textContent = 'Style';

    this.guardBtn = document.createElement('button');
    this.guardBtn.className = 'combat-btn guard-btn';
    this.guardBtn.textContent = 'Guard';
    this.guardBtn.addEventListener('click', () => this.onGuard());

    this.cleanseBtn = document.createElement('button');
    this.cleanseBtn.className = 'combat-btn secondary-btn cleanse-btn';
    this.cleanseBtn.textContent = 'Cleanse';
    this.cleanseBtn.addEventListener('click', () => this.onCleanse());

    this.endTurnBtn = document.createElement('button');
    this.endTurnBtn.className = 'combat-btn end-turn-btn';
    this.endTurnBtn.textContent = 'End Turn';
    this.endTurnBtn.addEventListener('click', () => this.onEndTurn());

    buttons.appendChild(this.lightAttackBtn);
    buttons.appendChild(this.heavyAttackBtn);
    buttons.appendChild(this.guardBtn);
    buttons.appendChild(this.cleanseBtn);
    buttons.appendChild(this.endTurnBtn);

    // Round indicator
    this.roundLabel = document.createElement('div');
    this.roundLabel.className = 'combat-round';
    this.roundLabel.textContent = '';

    this.actionBar.appendChild(this.roundLabel);
    this.actionBar.appendChild(resources);
    this.actionBar.appendChild(buttons);

    container.appendChild(this.initBar);
    container.appendChild(this.actionBar);
  }

  update(combat: TurnCombatUiSnapshot | null): void {
    if (!combat || !combat.active) {
      this.initBar.classList.remove('active');
      this.actionBar.classList.remove('active');
      return;
    }

    this.initBar.classList.add('active');
    this.actionBar.classList.add('active');

    // ── Initiative bar ────────────────────────────────────────────────────
    const activeId     = combat.activeParticipantId;
    const participants = combat.turnOrder;

    // Reconcile DOM cards: reuse existing, add or remove as needed
    const neededCount = participants.length;

    while (this.initBar.children.length > neededCount) {
      this.initBar.lastElementChild?.remove();
    }
    while (this.initBar.children.length < neededCount) {
      this.initBar.appendChild(this.makeInitCard());
    }

    participants.forEach((p, i) => {
      const card = this.initBar.children[i] as HTMLElement;
      card.className = [
        'combat-init-card',
        p.kind === 'player'    ? 'is-player'    : '',
        p.kind === 'companion' ? 'is-companion'  : '',
        p.id === activeId      ? 'is-active'     : '',
      ].filter(Boolean).join(' ');

      const nameEl = card.querySelector('.combat-init-name') as HTMLElement;

      if (nameEl) nameEl.textContent = p.name;
    });

    // ── Action bar ────────────────────────────────────────────────────────
    const isPlayerTurn = combat.phase === 'player_turn';
    // Use the active unit's stats (may be a companion during their turn)
    const player = combat.activeUnit ?? combat.player;

    const activeKind = combat.activeUnit?.kind;
    const turnLabel = activeKind === 'companion'
      ? `${combat.activeUnit?.name ?? 'Companion'}'s Turn — Round ${combat.round}`
      : `Round ${combat.round}`;
    this.roundLabel.textContent = turnLabel;
    this.actionBar.classList.toggle('enemy-turn', !isPlayerTurn);
    this.actionBar.classList.toggle('companion-turn', isPlayerTurn && activeKind === 'companion');

    // AP pips
    if (player) {
      this.buildPips(this.apPipsEl, player.apMax, player.apRemaining, 'ap-pip');
      this.buildPips(this.secondaryPipsEl, player.secondaryActionMax, player.secondaryActionRemaining, 'secondary-pip');
      this.buildPips(this.mpPipsEl, player.mpMax, player.mpRemaining, 'mp-pip');
    } else {
      this.apPipsEl.innerHTML = '';
      this.secondaryPipsEl.innerHTML = '';
      this.mpPipsEl.innerHTML = '';
    }

    const attacks = player?.attacks ?? [];
    const lightAttack = attacks[0] ?? null;
    const heavyAttack = attacks[1] ?? null;
    const canMove   = isPlayerTurn && (player?.mpRemaining ?? 0) > 0;
    const canAct    = isPlayerTurn;
    const secondaryRemaining = player?.secondaryActionRemaining ?? 0;
    const hasCleanseTarget = (player?.statusEffects ?? []).some((effect) =>
      effect.kind === 'bleeding' ||
      effect.kind === 'damage_over_time' ||
      effect.kind === 'slowed',
    );

    this.configureAttackButton(this.lightAttackBtn, lightAttack, player?.apRemaining ?? 0, isPlayerTurn, combat.selectedAttackId);
    this.configureAttackButton(this.heavyAttackBtn, heavyAttack, player?.apRemaining ?? 0, isPlayerTurn, combat.selectedAttackId);
    this.guardBtn.disabled = !isPlayerTurn || secondaryRemaining <= 0;
    this.guardBtn.title = this.guardBtn.disabled ? 'Needs Secondary Action' : 'Guard until your next turn (Secondary Action)';
    this.cleanseBtn.disabled = !isPlayerTurn || secondaryRemaining <= 0 || !hasCleanseTarget;
    this.cleanseBtn.title = !isPlayerTurn
      ? "It's not your turn"
      : secondaryRemaining <= 0
        ? 'Needs Secondary Action'
        : hasCleanseTarget
          ? 'Remove one bleed, poison, or slow effect (Secondary Action)'
          : 'No removable status effect';
    this.endTurnBtn.disabled = !canAct;

    // Tooltip cues
    this.endTurnBtn.title = canAct     ? 'End your turn (Space)' : "It's not your turn";

    void canMove; // no explicit move button — clicking a tile moves
  }

  destroy(): void {
    this.initBar.remove();
    this.actionBar.remove();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private makeInitCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'combat-init-card';

    const name = document.createElement('div');
    name.className = 'combat-init-name';

    card.appendChild(name);
    return card;
  }

  private buildPips(container: HTMLElement, max: number, remaining: number, cls: string): void {
    // Reconcile pip count
    while (container.children.length > max) container.lastElementChild?.remove();
    while (container.children.length < max) {
      const pip = document.createElement('div');
      pip.className = `combat-pip ${cls}`;
      container.appendChild(pip);
    }
    Array.from(container.children).forEach((pip, i) => {
      pip.classList.toggle('filled', i < remaining);
    });
  }

  private configureAttackButton(
    button: HTMLButtonElement,
    attack: { id: string; displayName: string; apCost: number; cooldownRemaining: number } | null,
    apRemaining: number,
    isPlayerTurn: boolean,
    selectedAttackId: string | null,
  ): void {
    button.onclick = null;

    if (!attack) {
      button.textContent = 'Attack';
      button.disabled = true;
      button.classList.remove('active');
      button.title = 'No attack available';
      return;
    }

    button.textContent = `${attack.displayName}`;
    const lacksAp = apRemaining < attack.apCost;
    const coolingDown = attack.cooldownRemaining > 0;
    button.disabled = !isPlayerTurn || lacksAp || coolingDown;
    button.classList.toggle('active', selectedAttackId === attack.id);
    button.title = coolingDown
      ? `${attack.displayName} cooling down: ${attack.cooldownRemaining} turn(s)`
      : lacksAp
        ? 'Needs Main Action'
        : `Pick a target for ${attack.displayName} (Main Action)`;
    button.onclick = () => this.onAttackMode(attack.id);
  }
}
