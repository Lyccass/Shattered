type EquipView = 'equipment' | 'stats';

const DUMMY_STATS: Array<{ label: string; value: string; group?: string }> = [
  { group: 'Combat',   label: 'Attack',        value: '10' },
  { label: 'Defence',     value: '5' },
  { label: 'Max HP',      value: '100' },
  { label: 'Hit Chance',  value: '75%' },
  { label: 'Dodge',       value: '10%' },
  { group: 'Body',    label: 'Carry Weight',  value: '0 / 20 kg' },
  { label: 'Move Speed',  value: 'Normal' },
  { label: 'Stamina',     value: '100' },
  { group: 'Crafting', label: 'Craft Speed',  value: 'Normal' },
  { label: 'Harvest Rate', value: '1×' },
];

const EQUIP_SLOTS: Array<{ key: string; label: string }> = [
  { key: 'head',     label: 'Head'     },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'chest',    label: 'Chest'    },
  { key: 'off',      label: 'Off Hand' },
  { key: 'belly',    label: 'Gloves'   },
  { key: 'ring',     label: 'Ring'     },
  { key: 'legs',     label: 'Legs'     },
  { key: 'ammo',     label: 'Ammo'     },
  { key: 'feet',     label: 'Feet'     },
  { key: 'weapon',   label: 'Weapon'   },
  { key: 'shield',   label: 'Shield'   },
];

export class EquipmentTabContent {
  readonly el: HTMLElement;
  private activeView: EquipView = 'equipment';
  private readonly viewBtns = new Map<EquipView, HTMLElement>();
  private readonly contentArea: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'equipment-tab';

    // View toggle bar
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
      const slot = document.createElement('div');
      slot.className = 'equip-slot';
      slot.dataset.slot = key;
      slot.innerHTML = `<span class="equip-slot-label">${label}</span>`;
      layout.appendChild(slot);
    }
    return layout;
  }

  private buildStatsView(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'equip-stats';

    let currentGroup: HTMLElement | null = null;

    for (const row of DUMMY_STATS) {
      if (row.group) {
        const groupEl = document.createElement('div');
        groupEl.className = 'equip-stats-group';
        groupEl.textContent = row.group;
        wrap.appendChild(groupEl);
        currentGroup = wrap;
      }

      const rowEl = document.createElement('div');
      rowEl.className = 'equip-stats-row';
      rowEl.innerHTML = `
        <span class="equip-stats-label">${row.label}</span>
        <span class="equip-stats-value">${row.value}</span>
      `;
      (currentGroup ?? wrap).appendChild(rowEl);
    }

    return wrap;
  }

  update(): void {
    // Equipment state not yet wired — placeholder
  }
}
