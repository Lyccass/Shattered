import type { TurnCombatUiSnapshot } from '../../../combat/CombatUiTypes';
import type { SfxEventId } from '../../../audio/SfxTypes';
import { renderStatusIcons } from './EnemyPanel';

type HudAttack = {
  id: string;
  displayName: string;
  apCost: number;
  cooldownRemaining: number;
  minRangeTiles: number;
  maxRangeTiles: number;
};

type HudAbility = {
  id: string;
  displayName: string;
  kind: 'combat_spell' | 'devotion';
  target: 'enemy' | 'self';
  apCost: number;
  cooldownRemaining: number;
  magicCost: number;
  devotionCost: number;
  minRangeTiles: number;
  maxRangeTiles: number;
};

export class CombatHud {
  private readonly initBar: HTMLElement;
  private readonly actionBar: HTMLElement;
  private readonly apPipsEl: HTMLElement;
  private readonly movePipsEl: HTMLElement;
  private readonly secondaryPipsEl: HTMLElement;
  private readonly statusIconsEl: HTMLElement;
  private readonly moveBtn: HTMLButtonElement;
  private readonly attackBtn: HTMLButtonElement;
  private readonly specialBtn: HTMLButtonElement;
  private readonly spellBtns: HTMLButtonElement[];
  private readonly devotionBtns: HTMLButtonElement[];
  private readonly endTurnBtn: HTMLButtonElement;
  private readonly roundLabel: HTMLElement;
  private readonly actorLabel: HTMLElement;
  private readonly actionHint: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly onEndTurn: () => void,
    private readonly onMoveMode: () => void,
    private readonly onAttackMode: (attackId?: string) => void,
    private readonly onAbility: (abilityId: string) => void,
    private readonly onUiSfx: (id: SfxEventId) => void,
  ) {
    this.initBar = document.createElement('div');
    this.initBar.id = 'ui-combat-init';

    this.actionBar = document.createElement('div');
    this.actionBar.id = 'ui-combat-actions';
    this.actionBar.addEventListener('pointerdown', stopOverlayInput);
    this.actionBar.addEventListener('mousedown', stopOverlayInput);
    this.actionBar.addEventListener('click', stopOverlayInput);

    const header = document.createElement('div');
    header.className = 'combat-action-header';
    this.roundLabel = document.createElement('div');
    this.roundLabel.className = 'combat-round';
    this.actorLabel = document.createElement('div');
    this.actorLabel.className = 'combat-actor';
    header.appendChild(this.roundLabel);
    header.appendChild(this.actorLabel);

    const body = document.createElement('div');
    body.className = 'combat-action-body';

    const resources = document.createElement('div');
    resources.className = 'combat-resources';

    this.apPipsEl = document.createElement('div');
    this.movePipsEl = document.createElement('div');
    this.secondaryPipsEl = document.createElement('div');

    resources.appendChild(this.makeResourceGroup('Main', this.apPipsEl));
    resources.appendChild(this.makeResourceGroup('Move', this.movePipsEl));
    resources.appendChild(this.makeResourceGroup('Sec', this.secondaryPipsEl));

    this.statusIconsEl = document.createElement('div');
    this.statusIconsEl.className = 'combat-status-icons';

    const actionGrid = document.createElement('div');
    actionGrid.className = 'combat-action-grid';

    this.moveBtn = this.makeActionButton('move');
    this.attackBtn = this.makeActionButton('weapon');
    this.specialBtn = this.makeActionButton('special');
    this.spellBtns = [this.makeActionButton('spell'), this.makeActionButton('spell')];
    this.devotionBtns = [this.makeActionButton('devotion'), this.makeActionButton('devotion')];
    this.endTurnBtn = this.makeActionButton('end');
    this.bindButton(this.moveBtn, () => this.onMoveMode());
    this.bindButton(this.endTurnBtn, () => this.onEndTurn());

    actionGrid.appendChild(this.moveBtn);
    actionGrid.appendChild(this.attackBtn);
    actionGrid.appendChild(this.specialBtn);
    this.spellBtns.forEach((btn) => actionGrid.appendChild(btn));
    this.devotionBtns.forEach((btn) => actionGrid.appendChild(btn));
    actionGrid.appendChild(this.endTurnBtn);

    body.appendChild(resources);
    body.appendChild(this.statusIconsEl);
    body.appendChild(actionGrid);

    this.actionHint = document.createElement('div');
    this.actionHint.className = 'combat-action-hint';

    this.actionBar.appendChild(header);
    this.actionBar.appendChild(body);
    this.actionBar.appendChild(this.actionHint);

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

    this.updateInitiative(combat);

    const activeUnit = combat.activeUnit;
    const actor = activeUnit ?? combat.player;
    const canAct = combat.phase === 'player_turn' && !!activeUnit;
    const activeKind = activeUnit?.kind;

    this.roundLabel.textContent = `Round ${combat.round}`;
    this.actorLabel.textContent = activeUnit
      ? activeKind === 'companion'
        ? activeUnit.name
        : 'Your turn'
      : 'Enemy turn';
    this.actionBar.classList.toggle('enemy-turn', !canAct);
    this.actionBar.classList.toggle('companion-turn', canAct && activeKind === 'companion');

    if (actor) {
      this.buildPips(this.apPipsEl, actor.apMax, actor.apRemaining, 'ap-pip');
      this.buildPips(this.movePipsEl, actor.mpMax, actor.mpRemaining, 'move-pip');
      this.buildPips(this.secondaryPipsEl, actor.secondaryActionMax, actor.secondaryActionRemaining, 'secondary-pip');
    }

    // Always show the player's (or active companion's) status icons
    const statusSource = combat.activeUnit ?? combat.player;
    renderStatusIcons(
      this.statusIconsEl,
      statusSource?.statusEffects ?? [],
      statusSource?.bleedMovementTiles ?? 0,
    );

    this.moveBtn.textContent = 'Move';
    this.moveBtn.disabled = !canAct || (actor?.mpRemaining ?? 0) <= 0;
    this.moveBtn.classList.toggle('is-selected', canAct && !combat.isAttackMode);
    this.moveBtn.title = this.moveBtn.disabled ? 'No movement points available' : 'Move: click a tile';

    const attacks = actor?.attacks ?? [];
    this.configureAttackButton(
      this.attackBtn,
      attacks[0] ?? null,
      actor?.apRemaining ?? 0,
      canAct,
      combat.selectedAttackId,
    );
    this.configureAttackButton(
      this.specialBtn,
      attacks[1] ?? null,
      actor?.apRemaining ?? 0,
      canAct,
      combat.selectedAttackId,
    );

    const spells = (actor?.abilities ?? []).filter((ability) => ability.kind === 'combat_spell');
    const devotions = (actor?.abilities ?? []).filter((ability) => ability.kind === 'devotion');
    this.spellBtns.forEach((btn, index) => {
      this.configureAbilityButton(btn, spells[index] ?? null, actor, canAct, combat.selectedAbilityId);
    });
    this.devotionBtns.forEach((btn, index) => {
      this.configureAbilityButton(btn, devotions[index] ?? null, actor, canAct, combat.selectedAbilityId);
    });

    this.endTurnBtn.textContent = 'End Turn';
    this.endTurnBtn.disabled = !canAct;
    this.endTurnBtn.title = canAct ? 'End your turn (Space)' : "It's not your turn";

    this.updateHint(combat, attacks, [...spells, ...devotions]);
  }

  destroy(): void {
    this.initBar.remove();
    this.actionBar.remove();
  }

  private updateInitiative(combat: TurnCombatUiSnapshot): void {
    const activeId = combat.activeParticipantId;
    const participants = combat.turnOrder;

    while (this.initBar.children.length > participants.length) {
      this.initBar.lastElementChild?.remove();
    }
    while (this.initBar.children.length < participants.length) {
      this.initBar.appendChild(this.makeInitCard());
    }

    participants.forEach((p, i) => {
      const card = this.initBar.children[i] as HTMLElement;
      card.className = [
        'combat-init-card',
        p.kind === 'player' ? 'is-player' : '',
        p.kind === 'enemy' ? 'is-enemy' : '',
        p.kind === 'companion' ? 'is-companion' : '',
        p.id === activeId ? 'is-active' : '',
      ].filter(Boolean).join(' ');

      const nameEl = card.querySelector('.combat-init-name') as HTMLElement;
      if (nameEl) nameEl.textContent = p.name;
    });
  }

  private makeInitCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'combat-init-card';
    const name = document.createElement('div');
    name.className = 'combat-init-name';
    card.appendChild(name);
    return card;
  }

  private makeResourceGroup(label: string, pipEl: HTMLElement): HTMLElement {
    const group = document.createElement('div');
    group.className = 'combat-resource-group';
    const labelEl = document.createElement('span');
    labelEl.className = 'combat-pip-label';
    labelEl.textContent = label;
    pipEl.className = 'combat-pips';
    group.appendChild(labelEl);
    group.appendChild(pipEl);
    return group;
  }

  private makeActionButton(kind: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `combat-btn combat-btn--${kind}`;
    button.type = 'button';
    return button;
  }

  private bindButton(button: HTMLButtonElement, handler: () => void): void {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!button.disabled) {
        this.onUiSfx('ui_button');
        handler();
      }
    });
    button.addEventListener('click', stopOverlayInput);
  }

  private buildPips(container: HTMLElement, max: number, remaining: number, cls: string): void {
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
    attack: HudAttack | null,
    apRemaining: number,
    canAct: boolean,
    selectedAttackId: string | null,
  ): void {
    if (!attack) {
      this.setUnavailable(button, 'Empty', 'No weapon action available');
      return;
    }

    this.bindButtonOnce(button, () => this.onAttackMode(attack.id));
    const coolingDown = attack.cooldownRemaining > 0;
    const lacksAp = apRemaining < attack.apCost;
    button.textContent = coolingDown ? `${attack.displayName} ${attack.cooldownRemaining}` : attack.displayName;
    button.disabled = !canAct || lacksAp || coolingDown;
    button.classList.toggle('is-selected', selectedAttackId === attack.id);
    button.title = coolingDown
      ? `${attack.displayName} cooldown: ${attack.cooldownRemaining} turn(s)`
      : lacksAp
        ? 'Needs Main Action'
        : `Pick a target for ${attack.displayName} (${formatRange(attack.minRangeTiles, attack.maxRangeTiles)})`;
  }

  private configureAbilityButton(
    button: HTMLButtonElement,
    ability: HudAbility | null,
    actor: TurnCombatUiSnapshot['activeUnit'] | TurnCombatUiSnapshot['player'],
    canAct: boolean,
    selectedAbilityId: string | null,
  ): void {
    if (!ability || !actor) {
      this.setUnavailable(button, 'Empty', 'No ability slotted');
      return;
    }

    this.bindButtonOnce(button, () => this.onAbility(ability.id));
    const coolingDown = ability.cooldownRemaining > 0;
    const lacksAp = actor.apRemaining < ability.apCost;
    const lacksMagic = actor.magicResourceRemaining < ability.magicCost;
    const lacksDevotion = actor.devotionResourceRemaining < ability.devotionCost;
    button.textContent = coolingDown ? `${ability.displayName} ${ability.cooldownRemaining}` : ability.displayName;
    button.disabled = !canAct || lacksAp || lacksMagic || lacksDevotion || coolingDown;
    button.classList.toggle('is-selected', selectedAbilityId === ability.id);
    button.title = coolingDown
      ? `${ability.displayName} cooldown: ${ability.cooldownRemaining} turn(s)`
      : lacksAp
        ? 'Needs Main Action'
        : lacksMagic
          ? 'Needs Magic resource'
          : lacksDevotion
            ? 'Needs Devotion resource'
            : ability.target === 'enemy'
              ? `Pick a target for ${ability.displayName} (${formatRange(ability.minRangeTiles, ability.maxRangeTiles)})`
              : `Use ${ability.displayName}`;
  }

  private bindButtonOnce(button: HTMLButtonElement, handler: () => void): void {
    const oldHandler = (button as HTMLButtonElement & { _combatHandler?: () => void })._combatHandler;
    if (oldHandler === handler) return;
    (button as HTMLButtonElement & { _combatHandler?: () => void })._combatHandler = handler;
    button.onpointerdown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!button.disabled) {
        this.onUiSfx('ui_button');
        handler();
      }
    };
    button.onclick = stopOverlayInput;
  }

  private setUnavailable(button: HTMLButtonElement, label: string, title: string): void {
    button.textContent = label;
    button.disabled = true;
    button.title = title;
    button.classList.remove('is-selected');
    button.onpointerdown = null;
    button.onclick = stopOverlayInput;
  }

  private updateHint(
    combat: TurnCombatUiSnapshot,
    attacks: HudAttack[],
    abilities: HudAbility[],
  ): void {
    if (!combat.isAttackMode) {
      this.actionHint.textContent = 'Move: click a highlighted tile';
      return;
    }

    if (combat.selectedAbilityId) {
      const selected = abilities.find((ability) => ability.id === combat.selectedAbilityId);
      this.actionHint.textContent = selected
        ? `${selected.displayName}: click an enemy in ${formatRange(selected.minRangeTiles, selected.maxRangeTiles)}`
        : 'Click an enemy target';
      return;
    }

    if (combat.selectedAttackId) {
      const selected = attacks.find((attack) => attack.id === combat.selectedAttackId);
      this.actionHint.textContent = selected
        ? `${selected.displayName}: click an enemy in ${formatRange(selected.minRangeTiles, selected.maxRangeTiles)}`
        : 'Click an enemy target';
      return;
    }

    this.actionHint.textContent = 'Click an enemy target';
  }
}

function stopOverlayInput(event: Event): void {
  event.stopPropagation();
}

function formatRange(minRange: number, maxRange: number): string {
  const min = Math.max(0, Math.floor(minRange));
  const max = Math.max(min, Math.floor(maxRange));
  return min === max ? `range ${max}` : `range ${min}-${max}`;
}
