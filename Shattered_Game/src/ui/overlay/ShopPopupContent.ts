import type { CurrencySnapshot } from '../../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../../player/PlayerInventoryState';
import { requireItem } from '../../items/ItemRegistry';
import type { ShopItemSnapshot, ShopSnapshot } from '../../trading/TraderTypes';

export type ShopTransactionResult = { ok: boolean; message: string };

export type ShopPopupCallbacks = {
  onBuy: (itemId: string, qty: number) => ShopTransactionResult;
  onSell: (itemId: string, qty: number) => ShopTransactionResult;
  getRefreshedState: () => {
    shop: ShopSnapshot;
    inventory: PlayerInventorySnapshot;
    currency: CurrencySnapshot;
  };
  onMessage: (msg: string, ok: boolean) => void;
};

type Selected =
  | { source: 'shop'; item: ShopItemSnapshot }
  | { source: 'inventory'; itemId: string; count: number; sellPriceCopper: number };

const STORE_COLS = 4;
const STORE_MIN_ROWS = 3;
const INV_COLS = 4;
const INV_ROWS = 7;
const INV_CAPACITY = INV_COLS * INV_ROWS; // 28 slots

export class ShopPopupContent {
  readonly el: HTMLElement;

  private selected: Selected | null = null;

  private readonly storeGrid: HTMLElement;
  private readonly invGrid: HTMLElement;
  private readonly infoBar: HTMLElement;
  private invLabel!: HTMLElement;

  private shop: ShopSnapshot;
  private inventory: PlayerInventorySnapshot;
  private currency: CurrencySnapshot;

  constructor(
    shop: ShopSnapshot,
    inventory: PlayerInventorySnapshot,
    currency: CurrencySnapshot,
    private readonly callbacks: ShopPopupCallbacks,
  ) {
    this.shop = shop;
    this.inventory = inventory;
    this.currency = currency;

    this.el = document.createElement('div');
    this.el.className = 'shp-root';

    // Two-pane grid area
    const panes = document.createElement('div');
    panes.className = 'shp-panes';

    const storePane = document.createElement('div');
    storePane.className = 'shp-pane';
    const storeLabel = document.createElement('div');
    storeLabel.className = 'shp-pane-label';
    storeLabel.textContent = 'Store';
    this.storeGrid = document.createElement('div');
    this.storeGrid.className = 'shp-grid';
    storePane.appendChild(storeLabel);
    storePane.appendChild(this.storeGrid);

    const invPane = document.createElement('div');
    invPane.className = 'shp-pane';
    const invLabel = document.createElement('div');
    invLabel.className = 'shp-pane-label';
    invLabel.textContent = 'Inventory';
    this.invLabel = invLabel;
    this.invGrid = document.createElement('div');
    this.invGrid.className = 'shp-grid';
    invPane.appendChild(invLabel);
    invPane.appendChild(this.invGrid);

    panes.appendChild(storePane);
    panes.appendChild(invPane);
    this.el.appendChild(panes);

    // Info bar
    this.infoBar = document.createElement('div');
    this.infoBar.className = 'shp-info';
    this.el.appendChild(this.infoBar);

    this.render();
  }

  update(shop: ShopSnapshot, inventory: PlayerInventorySnapshot, currency: CurrencySnapshot): void {
    this.shop = shop;
    this.inventory = inventory;
    this.currency = currency;
    // Keep selected shop item in sync with fresh stock/price data
    if (this.selected?.source === 'shop') {
      const sel = this.selected as { source: 'shop'; item: ShopItemSnapshot };
      const fresh = shop.items.find((i) => i.itemId === sel.item.itemId);
      if (fresh) sel.item = fresh;
    }
    this.render();
  }

  private render(): void {
    this.renderStoreGrid();
    this.renderInvGrid();
    this.renderInfoBar();
  }

  // Store grid

  private renderStoreGrid(): void {
    this.storeGrid.innerHTML = '';
    const items = this.shop.items;
    const totalSlots = Math.max(items.length, STORE_COLS * STORE_MIN_ROWS);
    const rows = Math.ceil(totalSlots / STORE_COLS);
    this.storeGrid.style.gridTemplateColumns = `repeat(${STORE_COLS}, 1fr)`;

    for (let i = 0; i < rows * STORE_COLS; i++) {
      const item = items[i];
      const slot = this.makeSlot();
      if (item) {
        const sel = this.selected?.source === 'shop'
          && (this.selected as { source: 'shop'; item: ShopItemSnapshot }).item.itemId === item.itemId;
        if (sel) slot.classList.add('shp-slot--selected');
        if (item.stock <= 0) slot.classList.add('shp-slot--depleted');

        slot.appendChild(makeIcon(item.icon));
        if (item.stock > 0) slot.appendChild(makeCount(String(item.stock)));

        slot.addEventListener('click', () => {
          this.selected = { source: 'shop', item };
          this.render();
        });
      }
      this.storeGrid.appendChild(slot);
    }
  }

  // Inventory grid

  private renderInvGrid(): void {
    this.invGrid.innerHTML = '';
    this.invGrid.style.gridTemplateColumns = `repeat(${INV_COLS}, 1fr)`;

    const entries = buildInventoryEntries(this.inventory, this.shop);
    const usedSlots = computeUsedSlots(this.inventory);
    const isFull = usedSlots >= INV_CAPACITY;
    this.invLabel.textContent = `Inventory — ${usedSlots}/${INV_CAPACITY}`;
    if (isFull) this.invLabel.classList.add('shp-pane-label--full');
    else this.invLabel.classList.remove('shp-pane-label--full');

    const totalSlots = INV_COLS * INV_ROWS;

    for (let i = 0; i < totalSlots; i++) {
      const entry = entries[i];
      const slot = this.makeSlot();
      if (entry) {
        const def = requireItem(entry.itemId);
        const sel = this.selected?.source === 'inventory'
          && (this.selected as { source: 'inventory'; itemId: string }).itemId === entry.itemId;
        if (sel) slot.classList.add('shp-slot--selected');
        if (entry.sellPriceCopper <= 0) slot.classList.add('shp-slot--no-value');

        slot.appendChild(makeIcon(def.icon));
        if (entry.count > 1) slot.appendChild(makeCount(String(entry.count)));

        slot.addEventListener('click', () => {
          this.selected = { source: 'inventory', ...entry };
          this.render();
        });
      }
      this.invGrid.appendChild(slot);
    }
  }

  // Info bar

  private renderInfoBar(): void {
    this.infoBar.innerHTML = '';

    // Left: selected item info
    const itemInfo = document.createElement('div');
    itemInfo.className = 'shp-info-item';

    if (this.selected) {
      if (this.selected.source === 'shop') {
        const { item } = this.selected as { source: 'shop'; item: ShopItemSnapshot };
        itemInfo.innerHTML = `
          <span class="shp-info-icon">${item.icon}</span>
          <span class="shp-info-name">${item.name}</span>
          <span class="shp-info-price shp-info-price--buy">Buy: ${formatCopper(item.buyPriceCopper)}</span>
          <span class="shp-info-price shp-info-price--sell">Sell: ${formatCopper(item.sellPriceCopper)}</span>
          <span class="shp-info-stock">${item.stock}/${item.maxStock} in stock</span>
        `;
      } else {
        const sel = this.selected as { source: 'inventory'; itemId: string; count: number; sellPriceCopper: number };
        const def = requireItem(sel.itemId);
        const canSell = sel.sellPriceCopper > 0;
        itemInfo.innerHTML = `
          <span class="shp-info-icon">${def.icon}</span>
          <span class="shp-info-name">${def.name}</span>
          ${canSell
            ? `<span class="shp-info-price shp-info-price--sell">Sell: ${formatCopper(sel.sellPriceCopper)}</span>`
            : `<span class="shp-info-no-value">Not interested</span>`}
          <span class="shp-info-stock">Owned: ${sel.count}</span>
        `;
      }
    } else {
      itemInfo.innerHTML = '<span class="shp-info-hint">Click an item to select it</span>';
    }

    // Right: action buttons + purse
    const actions = document.createElement('div');
    actions.className = 'shp-info-actions';

    if (this.selected) {
      if (this.selected.source === 'shop') {
        const { item } = this.selected as { source: 'shop'; item: ShopItemSnapshot };
        const isFull = computeUsedSlots(this.inventory) >= INV_CAPACITY;
        actions.appendChild(this.makeTxBtn('Buy 1', item.stock > 0 && !isFull, () => this.executeBuy(item, 1)));
        if (item.stock > 1) {
          actions.appendChild(this.makeTxBtn('Buy 5', item.stock >= 5 && !isFull, () => this.executeBuy(item, 5)));
          actions.appendChild(this.makeTxBtn('Buy All', !isFull, () => this.executeBuy(item, item.stock)));
        }
      } else {
        const sel = this.selected as { source: 'inventory'; itemId: string; count: number; sellPriceCopper: number };
        const canSell = sel.sellPriceCopper > 0;
        actions.appendChild(this.makeTxBtn('Sell 1', canSell, () => this.executeSell(sel.itemId, 1)));
        if (sel.count > 1) {
          actions.appendChild(this.makeTxBtn('Sell 5', canSell && sel.count >= 5, () => this.executeSell(sel.itemId, 5)));
          actions.appendChild(this.makeTxBtn('Sell All', canSell, () => this.executeSell(sel.itemId, sel.count)));
        }
      }
    }

    const purse = document.createElement('div');
    purse.className = 'shp-info-purse';
    purse.innerHTML = formatCurrencyHtml(this.currency);

    actions.appendChild(purse);
    this.infoBar.appendChild(itemInfo);
    this.infoBar.appendChild(actions);
  }

  // Transactions

  private executeBuy(item: ShopItemSnapshot, qty: number): void {
    const actualQty = Math.min(qty, item.stock);
    const result = this.callbacks.onBuy(item.itemId, actualQty);
    this.callbacks.onMessage(result.message, result.ok);
    const fresh = this.callbacks.getRefreshedState();
    // Keep selection on the same shop item
    const freshItem = fresh.shop.items.find((i) => i.itemId === item.itemId);
    this.selected = freshItem ? { source: 'shop', item: freshItem } : null;
    this.update(fresh.shop, fresh.inventory, fresh.currency);
  }

  private executeSell(itemId: string, qty: number): void {
    const result = this.callbacks.onSell(itemId, qty);
    this.callbacks.onMessage(result.message, result.ok);
    const fresh = this.callbacks.getRefreshedState();
    const remaining = fresh.inventory.stacks[itemId] ?? 0;
    if (remaining > 0) {
      const entries = buildInventoryEntries(fresh.inventory, fresh.shop);
      const entry = entries.find((e) => e.itemId === itemId);
      this.selected = entry ? { source: 'inventory', ...entry } : null;
    } else {
      this.selected = null;
    }
    this.update(fresh.shop, fresh.inventory, fresh.currency);
  }

  // Helpers

  private makeSlot(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'shp-slot';
    return el;
  }

  private makeTxBtn(label: string, enabled: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'shp-btn';
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.addEventListener('click', onClick);
    return btn;
  }
}

// Helpers

function makeIcon(icon: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'shp-slot-icon';
  el.textContent = icon;
  return el;
}

function makeCount(text: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'shp-slot-count';
  el.textContent = text;
  return el;
}

function computeUsedSlots(inventory: PlayerInventorySnapshot): number {
  let count = 0;
  for (const [itemId, qty] of Object.entries(inventory.stacks)) {
    if (qty <= 0) continue;
    const def = requireItem(itemId);
    count += def.stackable ? 1 : qty;
  }
  return count;
}

function buildInventoryEntries(
  inventory: PlayerInventorySnapshot,
  shop: ShopSnapshot,
): Array<{ itemId: string; count: number; sellPriceCopper: number }> {
  const result: Array<{ itemId: string; count: number; sellPriceCopper: number }> = [];
  for (const [itemId, count] of Object.entries(inventory.stacks)) {
    if (count <= 0) continue;
    const def = requireItem(itemId);
    const shopEntry = shop.items.find((i) => i.itemId === itemId);
    const sellPriceCopper = shopEntry?.sellPriceCopper ?? Math.max(1, Math.floor(def.value * 0.5));
    result.push({ itemId, count, sellPriceCopper: def.value > 0 ? sellPriceCopper : 0 });
  }
  result.sort((a, b) => requireItem(a.itemId).name.localeCompare(requireItem(b.itemId).name));
  return result;
}

function formatCopper(copper: number): string {
  if (copper >= 10_000) {
    const gold = Math.floor(copper / 10_000);
    const rem = copper % 10_000;
    return `${gold}g ${Math.floor(rem / 100)}s ${rem % 100}c`;
  }
  if (copper >= 100) return `${Math.floor(copper / 100)}s ${copper % 100}c`;
  return `${copper}c`;
}

function formatCurrencyHtml(c: CurrencySnapshot): string {
  const parts: string[] = [];
  if (c.platinum > 0) parts.push(`<span class="shp-bal-plat">${c.platinum}p</span>`);
  if (c.gold > 0)     parts.push(`<span class="shp-bal-gold">${c.gold}g</span>`);
  if (c.silver > 0)   parts.push(`<span class="shp-bal-silver">${c.silver}s</span>`);
  parts.push(`<span class="shp-bal-copper">${c.copper}c</span>`);
  return `<span class="shp-bal-label">Purse</span> ${parts.join(' ')}`;
}
