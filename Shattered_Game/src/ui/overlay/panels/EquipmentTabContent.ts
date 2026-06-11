import type { EquipmentSnapshot, EquipmentSlot } from '../../../equipment/EquipmentTypes';
import { emptyEquipmentSnapshot } from '../../../equipment/EquipmentTypes';
import type { CompanionDefinition, CompanionSlot, CompanionSnapshot, CompanionSlotSnapshot } from '../../../companions/CompanionTypes';
import { getCompanionDefinition } from '../../../companions/CompanionRegistry';

type EquipView = 'equipment' | 'stats' | 'companions';

// Slot definitions matching the paperdoll layout in the screenshot
const EQUIP_SLOTS: Array<{ key: EquipmentSlot; label: string }> = [
  { key: 'head',      label: 'Head'     },
  { key: 'back',      label: 'Back'     },
  { key: 'necklace',  label: 'Necklace' },
  { key: 'ammo',      label: 'Ammo'     },
  { key: 'gloves',    label: 'Gloves'   },
  { key: 'body',      label: 'Body'     },
  { key: 'ring',      label: 'Ring'     },
  { key: 'main_hand', label: 'Main'     },
  { key: 'legs',      label: 'Legs'     },
  { key: 'off_hand',  label: 'Offhand'  },
  { key: 'feet',      label: 'Feet'     },
];

export class EquipmentTabContent {
  readonly el: HTMLElement;
  private activeView: EquipView = 'equipment';
  private readonly viewBtns = new Map<EquipView, HTMLElement>();
  private readonly contentArea: HTMLElement;
  private snapshot: EquipmentSnapshot = emptyEquipmentSnapshot();
  private companionSnapshot: CompanionSnapshot = {};
  private openPickerSlot: CompanionSlot | null = null;
  private lastRenderKey = '';

  constructor(
    private readonly onUnequip: (slot: string) => void = () => {},
    _onCompanionEquip: (slot: string, definitionId: string) => void = () => {},
    private readonly onCompanionUnequip: (slot: string) => void = () => {},
  ) {
    this.el = document.createElement('div');
    this.el.className = 'equipment-tab';

    const toggleBar = document.createElement('div');
    toggleBar.className = 'equip-toggle-bar';

    const views: Array<{ id: EquipView; label: string }> = [
      { id: 'equipment',  label: 'Equipment'  },
      { id: 'stats',      label: 'Stats'      },
      { id: 'companions', label: 'Companions' },
    ];
    for (const { id, label } of views) {
      const btn = document.createElement('button');
      btn.className = 'equip-toggle-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => this.switchView(id));
      this.viewBtns.set(id, btn);
      toggleBar.appendChild(btn);
    }

    this.contentArea = document.createElement('div');
    this.contentArea.className = 'equip-content';

    this.el.appendChild(toggleBar);
    this.el.appendChild(this.contentArea);

    this.switchView('equipment');
  }

  update(
    snapshot: EquipmentSnapshot,
    companions: CompanionSnapshot = {},
  ): void {
    const key = JSON.stringify(snapshot.slots) + '|' + JSON.stringify(companions);
    if (key === this.lastRenderKey) return;
    this.lastRenderKey = key;
    this.snapshot = snapshot;
    this.companionSnapshot = companions;
    this.contentArea.innerHTML = '';
    this.contentArea.appendChild(this.buildActiveView());
  }

  private buildActiveView(): HTMLElement {
    switch (this.activeView) {
      case 'equipment':  return this.buildEquipmentView();
      case 'stats':      return this.buildStatsView();
      case 'companions': return this.buildCompanionsView();
    }
  }

  private switchView(view: EquipView): void {
    this.viewBtns.get(this.activeView)?.classList.remove('equip-toggle-btn--active');
    this.activeView = view;
    this.openPickerSlot = null;
    this.lastRenderKey = '';
    this.viewBtns.get(view)?.classList.add('equip-toggle-btn--active');
    this.contentArea.innerHTML = '';
    this.contentArea.appendChild(this.buildActiveView());
  }

  private buildEquipmentView(): HTMLElement {
    const layout = document.createElement('div');
    layout.className = 'equipment-layout';

    for (const { key, label } of EQUIP_SLOTS) {
      const entry = this.snapshot.slots[key];
      const slot = document.createElement('div');
      slot.className = 'equip-slot';
      slot.dataset.slot = key;

      if (entry) {
        slot.classList.add('equip-slot--filled');
        slot.title = `${entry.displayName} — right-click to unequip`;
        slot.innerHTML = `<span class="equip-slot-label">${entry.displayName}</span>`;
        slot.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.onUnequip(key);
        });
      } else {
        slot.innerHTML = `<span class="equip-slot-label equip-slot-label--empty">${label}</span>`;
      }

      layout.appendChild(slot);
    }
    return layout;
  }

  private buildStatsView(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'equip-stats';
    const s = this.snapshot.derivedStats;

    this.appendGroup(wrap, 'Offence', [
      ['Attack',      String(s.attack),                            'Maximum possible hit. Actual damage rolls between 1 and this value.'],
      ['Atk Speed',   `${(s.attackSpeedMs / 1000).toFixed(2)}s`, 'Full attack cycle time: wind-up, active frames, and recovery.'],
      ['Reach',       `${s.reachTiles.toFixed(1)} tiles`,         'How far your attack can reach from your position.'],
      ['Stam. Cost',  String(s.attackStaminaCost),                'Stamina consumed each time you attack.'],
    ]);

    this.appendGroup(wrap, 'Defence', [
      ['Slash Res',      String(s.slashDefence),      'Reduces incoming slash damage. High values let you roll the damage roll multiple times and take the lowest.'],
      ['Pierce Res',     String(s.pierceDefence),     'Reduces incoming pierce damage. High values let you roll the damage roll multiple times and take the lowest.'],
      ['Crush Res',      String(s.crushDefence),      'Reduces incoming crush damage. High values let you roll the damage roll multiple times and take the lowest.'],
      ['Poise',          String(s.poise),             'Reduces stagger points added by incoming hits.'],
      ['Stagger Thres.', String(s.staggerThreshold), 'Stagger accumulates from hits and dodgerolls. Reaching this limit staggers you briefly.'],
    ]);

    this.appendGroup(wrap, 'Resistances', [
      ['Poison', String(s.poisonResistance), 'Reduces damage and duration from poison effects.'],
      ['Fire',   String(s.fireResistance),   'Reduces damage from fire and burning effects.'],
      ['Cold',   String(s.coldResistance),   'Reduces damage and slow effects from cold sources.'],
    ]);

    this.appendGroup(wrap, 'Body', [
      ['Max HP',       String(s.maxHp),                                       'Health pool from hidden combat level. Capped at 100; no gear HP.'],
      ['Combat Lvl',   String(s.combatLevel),                                 'Hidden combat level from Melee, Ranged, Magic, and Devotion.'],
      ['Max Stamina',  String(s.maxStamina),                                  'Stamina pool for attacking, sprinting, and dodging.'],
      ['Carry Weight', `${s.carryWeight} / ${s.maxCarryWeight} kg`,           'Total equipment weight vs. your carry cap. Exceeding it reduces stamina regen.'],
      ['Stam. Regen',  formatRegenMultiplier(s.staminaRegenMultiplier),       'Stamina regeneration rate. Penalised when over your carry weight cap.'],
    ]);

    return wrap;
  }

  private buildCompanionsView(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'companion-slots';

    const grid = document.createElement('div');
    grid.className = 'companion-grid';

    const slotDefs: Array<{ key: CompanionSlot; label: string }> = [
      { key: 'companion_1', label: 'I'   },
      { key: 'companion_2', label: 'II'  },
      { key: 'companion_3', label: 'III' },
    ];

    for (const { key, label } of slotDefs) {
      const entry = this.companionSnapshot[key];
      const cell = document.createElement('div');
      cell.className = 'companion-slot' + (entry ? ' companion-slot--filled' : '');
      if (this.openPickerSlot === key) cell.classList.add('is-selected');
      cell.dataset.slot = key;

      if (entry) {
        const durFrac = entry.durability / entry.maxDurability;
        const durBar = document.createElement('div');
        durBar.className = 'companion-slot-durbar';
        const durFill = document.createElement('div');
        durFill.className = 'companion-slot-durbar-fill';
        durFill.style.width = `${Math.round(durFrac * 100)}%`;
        durFill.style.backgroundColor = durFrac > 0.5 ? '#22c55e' : durFrac > 0.25 ? '#f59e0b' : '#ef4444';
        durBar.appendChild(durFill);

        const nameEl = document.createElement('span');
        nameEl.className = 'companion-slot-label';
        nameEl.textContent = entry.displayName;

        cell.appendChild(durBar);
        cell.appendChild(nameEl);
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.onCompanionUnequip(key);
        });
      } else {
        const labelEl = document.createElement('span');
        labelEl.className = 'companion-slot-label';
        labelEl.textContent = label;
        cell.appendChild(labelEl);
      }

      if (entry) {
        cell.addEventListener('click', () => {
          this.openPickerSlot = this.openPickerSlot === key ? null : key;
          this.lastRenderKey = '';
          this.contentArea.innerHTML = '';
          this.contentArea.appendChild(this.buildCompanionsView());
        });
      }

      grid.appendChild(cell);
    }

    wrap.appendChild(grid);

    if (this.openPickerSlot !== null) {
      const entry = this.companionSnapshot[this.openPickerSlot];
      if (entry) {
        const def = getCompanionDefinition(entry.definitionId);
        if (def) wrap.appendChild(this.buildCompanionStatCard(def, entry));
      }
    }

    const hasAnyEmpty = slotDefs.some(({ key }) => !this.companionSnapshot[key]);
    if (hasAnyEmpty) {
      const hint = document.createElement('div');
      hint.className = 'companion-slot-hint';
      hint.textContent = 'Use a companion item from inventory to equip';
      wrap.appendChild(hint);
    }

    return wrap;
  }

  private buildCompanionStatCard(def: CompanionDefinition, entry: CompanionSlotSnapshot): HTMLElement {
    const card = document.createElement('div');
    card.className = 'companion-stat-card';

    const statDefs: Array<[string, string]> = [
      ['HP',      String(def.maxHp)],
      ['Init',    String(def.initiative)],
      ['Def',     String(def.defensePower)],
      ['AP/turn', String(def.apPerTurn)],
      ['MP/turn', String(def.mpPerTurn)],
      ['Stagger', String(def.staggerThreshold)],
    ];
    const statGrid = document.createElement('div');
    statGrid.className = 'companion-stat-grid';
    for (const [lbl, val] of statDefs) {
      const cell = document.createElement('div');
      cell.className = 'companion-stat-cell';
      cell.innerHTML = `<span class="companion-stat-val">${val}</span><span class="companion-stat-lbl">${lbl}</span>`;
      statGrid.appendChild(cell);
    }
    card.appendChild(statGrid);

    const attacksEl = document.createElement('div');
    attacksEl.className = 'companion-stat-attacks';
    for (const atk of def.attacks) {
      const row = document.createElement('div');
      row.className = 'companion-stat-attack';
      const statusStr = atk.statusEffect ? ` · ${atk.statusEffect.kind} ${atk.statusEffect.turns}t` : '';
      const staggerStr = atk.staggerDamage ? ` · ${atk.staggerDamage} stagger` : '';
      const typeStr = atk.damageType ? ` ${atk.damageType}` : '';
      const hitStr = atk.hitChance !== undefined ? `${atk.hitChance}%` : '80%';
      row.innerHTML = `
        <span class="companion-atk-name">${atk.displayName}</span>
        <span class="companion-atk-detail">${atk.damage}${typeStr} dmg · range ${atk.maxRangeTiles} · ${hitStr} hit${staggerStr}${statusStr}</span>
      `;
      attacksEl.appendChild(row);
    }
    card.appendChild(attacksEl);

    const durFrac = entry.durability / entry.maxDurability;
    const durRow = document.createElement('div');
    durRow.className = 'companion-stat-dur';
    durRow.innerHTML = `
      <span class="companion-stat-lbl">Durability</span>
      <div class="companion-slot-durbar companion-stat-durbar">
        <div class="companion-slot-durbar-fill" style="width:${Math.round(durFrac * 100)}%;background:${durFrac > 0.5 ? '#22c55e' : durFrac > 0.25 ? '#f59e0b' : '#ef4444'}"></div>
      </div>
      <span class="companion-stat-lbl">${entry.durability}/${entry.maxDurability}</span>
    `;
    card.appendChild(durRow);

    return card;
  }


  private appendGroup(
    wrap: HTMLElement,
    title: string,
    rows: [string, string, string?][],
  ): void {
    const groupEl = document.createElement('div');
    groupEl.className = 'equip-stats-group';
    groupEl.textContent = title;
    wrap.appendChild(groupEl);

    for (const [label, value, tooltip] of rows) {
      const row = document.createElement('div');
      row.className = 'equip-stats-row';
      row.innerHTML = `
        <span class="equip-stats-label">${label}</span>
        <span class="equip-stats-value">${value}</span>
      `;
      if (tooltip) {
        let hoverTimer: ReturnType<typeof setTimeout> | null = null;
        row.addEventListener('mouseenter', () => {
          hoverTimer = setTimeout(() => {
            const tip = getStatTooltipEl();
            tip.textContent = tooltip;
            const rect = row.getBoundingClientRect();
            tip.style.left      = `${rect.left}px`;
            tip.style.width     = `${rect.width}px`;
            tip.style.top       = `${rect.top - 6}px`;
            tip.style.transform = 'translateY(-100%)';
            tip.classList.add('stat-tooltip--visible');
          }, 500);
        });
        row.addEventListener('mouseleave', () => {
          if (hoverTimer !== null) { clearTimeout(hoverTimer); hoverTimer = null; }
          const tip = getStatTooltipEl();
          tip.classList.remove('stat-tooltip--visible');
        });
      }
      wrap.appendChild(row);
    }
  }
}

function formatRegenMultiplier(multiplier: number): string {
  if (multiplier >= 1) return 'Full';
  if (multiplier <= 0) return 'None';
  return `${Math.round(multiplier * 100)}%`;
}

function getStatTooltipEl(): HTMLElement {
  const id = 'equip-stat-tooltip';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'stat-tooltip';
    document.body.appendChild(el);
  }
  return el;
}
