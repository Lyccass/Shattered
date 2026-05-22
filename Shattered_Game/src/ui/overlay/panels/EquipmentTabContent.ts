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
      ['Attack',      String(s.attack),                             'Maximum possible hit. Actual damage rolls between 1 and this value.'],
      ['Precision',   `${s.accuracy}%`,                            'Narrows the damage roll toward your max hit. Higher precision means most strikes land near maximum damage.'],
      ['Atk Speed',   `${(s.attackSpeedMs / 1000).toFixed(2)}s`,  'Full attack cycle time: wind-up, active frames, and recovery.'],
      ['Reach',       `${s.reachTiles.toFixed(1)} tiles`,          'How far your attack hitbox extends from your position.'],
      ['Stam. Cost',  String(s.attackStaminaCost),                 'Stamina consumed each time you attack.'],
    ]);

    this.appendGroup(wrap, 'Defence', [
      ['Phys. Def',      String(s.physicalDefence),    'Flat reduction applied to all incoming physical damage.'],
      ['Slash Res',      String(s.slashDefence),       'Damage reduction against slash-type physical attacks.'],
      ['Pierce Res',     String(s.pierceDefence),      'Damage reduction against pierce-type physical attacks.'],
      ['Crush Res',      String(s.crushDefence),       'Damage reduction against crush-type physical attacks.'],
      ['Poise',          String(s.poise),              'Reduces stagger points added by incoming hits.'],
      ['Stagger Thres.', String(s.staggerThreshold),  'Stagger accumulates from hits and dodgerolls. Reaching this limit staggers you briefly.'],
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
        row.addEventListener('mouseenter', () => {
          const tip = getStatTooltipEl();
          tip.textContent = tooltip;
          const rect = row.getBoundingClientRect();
          tip.style.left   = `${rect.left}px`;
          tip.style.width  = `${rect.width}px`;
          tip.style.top    = `${rect.top - 6}px`;
          tip.style.transform = 'translateY(-100%)';
          tip.classList.add('stat-tooltip--visible');
        });
        row.addEventListener('mouseleave', () => {
          getStatTooltipEl().classList.remove('stat-tooltip--visible');
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
