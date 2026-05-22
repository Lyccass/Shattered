import type { EquipmentSnapshot, EquipmentSlot } from '../../../equipment/EquipmentTypes';
import { emptyEquipmentSnapshot } from '../../../equipment/EquipmentTypes';

type EquipView = 'equipment' | 'stats';

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

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'equipment-tab';

    const toggleBar = document.createElement('div');
    toggleBar.className = 'equip-toggle-bar';

    const views: Array<{ id: EquipView; label: string }> = [
      { id: 'equipment', label: 'Equipment' },
      { id: 'stats',     label: 'Stats'     },
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

  update(snapshot: EquipmentSnapshot): void {
    this.snapshot = snapshot;
    this.contentArea.innerHTML = '';
    this.contentArea.appendChild(
      this.activeView === 'equipment'
        ? this.buildEquipmentView()
        : this.buildStatsView(),
    );
  }

  private switchView(view: EquipView): void {
    this.viewBtns.get(this.activeView)?.classList.remove('equip-toggle-btn--active');
    this.activeView = view;
    this.viewBtns.get(view)?.classList.add('equip-toggle-btn--active');
    this.contentArea.innerHTML = '';
    this.contentArea.appendChild(
      view === 'equipment' ? this.buildEquipmentView() : this.buildStatsView(),
    );
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
        slot.title = entry.displayName;
      }
      slot.innerHTML = `<span class="equip-slot-label">${entry?.displayName ?? label}</span>`;
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
      ['Max HP',       String(s.maxHp),                                       'Health pool. Scales with your Defence level.'],
      ['Max Stamina',  String(s.maxStamina),                                  'Stamina pool for attacking, sprinting, and dodging.'],
      ['Carry Weight', `${s.carryWeight} / ${s.maxCarryWeight} kg`,           'Total equipment weight vs. your carry cap. Exceeding it reduces stamina regen.'],
      ['Stam. Regen',  formatRegenMultiplier(s.staminaRegenMultiplier),       'Stamina regeneration rate. Penalised when over your carry weight cap.'],
    ]);

    return wrap;
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
