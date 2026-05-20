export class EquipmentTabContent {
  readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'equipment-tab';

    const slots: Array<{ key: string; label: string; icon: string }> = [
      { key: 'head',     label: 'Head',    icon: '⛑️' },
      { key: 'shoulder', label: 'Shoulder',icon: '🛡️' },
      { key: 'chest',    label: 'Chest',   icon: '👕' },
      { key: 'off',      label: 'Off',     icon: '🤚' },
      { key: 'belly',    label: 'Belly',   icon: '🧤' },
      { key: 'ring',     label: 'Ring',    icon: '💍' },
      { key: 'legs',     label: 'Legs',    icon: '👖' },
      { key: 'ammo',     label: 'Ammo',    icon: '🏹' },
      { key: 'feet',     label: 'Feet',    icon: '👞' },
      { key: 'weapon',   label: 'Weapon',  icon: '⚔️' },
      { key: 'shield',   label: 'Shield',  icon: '🛡️' },
    ];

    const layout = document.createElement('div');
    layout.className = 'equipment-layout';

    slots.forEach(({ key, label, icon }) => {
      const slot = document.createElement('div');
      slot.className = 'equip-slot';
      slot.dataset.slot = key;
      slot.title = label;
      slot.innerHTML = `
        <span class="equip-slot-icon">${icon}</span>
        <span class="equip-slot-label">${label}</span>
      `;
      layout.appendChild(slot);
    });

    this.el.appendChild(layout);
  }

  update(): void {
    // Equipment state not yet wired — placeholder
  }
}
