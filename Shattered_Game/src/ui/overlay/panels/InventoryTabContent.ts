import type { CurrencySnapshot } from '../../../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../../../player/PlayerInventoryState';
import { UI_TOKENS } from '../UITokens';

interface SlotData {
  id: string;
  label: string;
  icon: string;
  count: number;
}

const RESOURCE_META: Record<string, { label: string; icon: string }> = {
  wood:  { label: 'Wood',  icon: '🪵' },
  stone: { label: 'Stone', icon: '🪨' },
  herb:  { label: 'Herb',  icon: '🌿' },
};

const ITEM_META: Record<string, { label: string; icon: string }> = {
  firestarter_set: { label: 'Firestarter', icon: '🔥' },
  wooden_marker:   { label: 'Marker',      icon: '📌' },
  camp_supplies:   { label: 'Supplies',    icon: '🎒' },
  warm_tea:        { label: 'Warm Tea',    icon: '🫖' },
};

function buildSlots(inventory: PlayerInventorySnapshot): SlotData[] {
  const slots: SlotData[] = [];

  for (const [key, count] of Object.entries(inventory.resources)) {
    if (count > 0) {
      const meta = RESOURCE_META[key] ?? { label: key, icon: '?' };
      slots.push({ id: key, label: meta.label, icon: meta.icon, count });
    }
  }

  for (const [key, count] of Object.entries(inventory.items)) {
    if (count > 0) {
      const meta = ITEM_META[key] ?? { label: key, icon: '?' };
      slots.push({ id: key, label: meta.label, icon: meta.icon, count });
    }
  }

  const total = UI_TOKENS.sizes.inventorySlots;
  while (slots.length < total) {
    slots.push({ id: '', label: '', icon: '', count: 0 });
  }

  return slots.slice(0, total);
}

export class InventoryTabContent {
  readonly el: HTMLElement;
  private readonly slotEls: HTMLElement[] = [];
  private readonly coinEls: Record<string, HTMLElement> = {};

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'inventory-wrapper';

    const grid = document.createElement('div');
    grid.className = 'inventory-grid';

    for (let i = 0; i < UI_TOKENS.sizes.inventorySlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.innerHTML = `
        <span class="inv-slot-icon"></span>
        <span class="inv-slot-label"></span>
        <span class="inv-slot-count"></span>
      `;
      this.slotEls.push(slot);
      grid.appendChild(slot);
    }

    const purse = document.createElement('div');
    purse.className = 'coin-purse';
    purse.innerHTML = `
      <div class="coin-entry coin-entry--plat">
        <span class="coin-symbol">💎</span>
        <span class="coin-value coin-plat">0</span>
      </div>
      <div class="coin-entry coin-entry--gold">
        <span class="coin-symbol">🟡</span>
        <span class="coin-value coin-gold">0</span>
      </div>
      <div class="coin-entry coin-entry--silver">
        <span class="coin-symbol">⚪</span>
        <span class="coin-value coin-silver">0</span>
      </div>
      <div class="coin-entry coin-entry--copper">
        <span class="coin-symbol">🟤</span>
        <span class="coin-value coin-copper">0</span>
      </div>
    `;

    this.coinEls.platinum = purse.querySelector('.coin-plat')!;
    this.coinEls.gold      = purse.querySelector('.coin-gold')!;
    this.coinEls.silver    = purse.querySelector('.coin-silver')!;
    this.coinEls.copper    = purse.querySelector('.coin-copper')!;

    this.el.appendChild(grid);
    this.el.appendChild(purse);
  }

  update(inventory: PlayerInventorySnapshot, currency: CurrencySnapshot): void {
    const slots = buildSlots(inventory);

    slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      if (!el) return;

      const iconEl  = el.querySelector('.inv-slot-icon')!;
      const labelEl = el.querySelector('.inv-slot-label')!;
      const countEl = el.querySelector('.inv-slot-count')!;

      if (slot.count > 0) {
        el.classList.add('has-item');
        iconEl.textContent  = slot.icon;
        labelEl.textContent = '';
        countEl.textContent = slot.count > 1 ? String(slot.count) : '';
        el.title = `${slot.label} (${slot.count})`;
      } else {
        el.classList.remove('has-item');
        iconEl.textContent  = '';
        labelEl.textContent = '';
        countEl.textContent = '';
        el.title = '';
      }
    });

    this.coinEls.platinum.textContent = String(currency.platinum);
    this.coinEls.gold.textContent     = String(currency.gold);
    this.coinEls.silver.textContent   = String(currency.silver);
    this.coinEls.copper.textContent   = String(currency.copper);
  }
}
