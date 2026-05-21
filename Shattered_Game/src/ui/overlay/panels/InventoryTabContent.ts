import type { CurrencySnapshot } from '../../../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../../../player/PlayerInventoryState';
import { getInventoryItemMeta } from '../../inventory/InventoryItemMeta';
import { ItemContextMenu } from '../../inventory/ItemContextMenu';
import { UI_TOKENS } from '../UITokens';

export type InventoryCallbacks = {
  onItemUse: (itemId: string) => void;
  onItemDrop: (itemId: string) => void;
  onItemInspect: (itemId: string) => void;
  onItemCombine: (sourceId: string, targetId: string) => void;
};

type SlotData = {
  itemId: string;
  count: number;
};

function getAllActiveItems(snapshot: PlayerInventorySnapshot): Map<string, number> {
  const result = new Map<string, number>();
  const resources = snapshot.resources as Record<string, number>;
  const items = snapshot.items as Record<string, number>;
  for (const [id, count] of Object.entries(resources)) {
    if (count > 0) result.set(id, count);
  }
  for (const [id, count] of Object.entries(items)) {
    if (count > 0) result.set(id, count);
  }
  return result;
}

function getSlotCount(snapshot: PlayerInventorySnapshot, itemId: string): number {
  const resources = snapshot.resources as Record<string, number>;
  const items = snapshot.items as Record<string, number>;
  return resources[itemId] ?? items[itemId] ?? 0;
}

export class InventoryTabContent {
  readonly el: HTMLElement;
  private readonly slotEls: HTMLElement[] = [];
  private readonly coinEls: Record<string, HTMLElement> = {};
  private readonly contextMenu: ItemContextMenu;

  private slotOrder: string[]; // itemId per slot, '' = empty
  private selectedSlot: number | null = null;

  constructor(private readonly callbacks: InventoryCallbacks) {
    const total = UI_TOKENS.sizes.inventorySlots;
    this.slotOrder = new Array<string>(total).fill('');
    this.contextMenu = new ItemContextMenu();

    this.el = document.createElement('div');
    this.el.className = 'inventory-wrapper';

    const grid = document.createElement('div');
    grid.className = 'inventory-grid';

    for (let i = 0; i < total; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.setAttribute('draggable', 'false');
      slot.innerHTML = `
        <span class="inv-slot-icon"></span>
        <span class="inv-slot-count"></span>
      `;

      slot.addEventListener('click', (e) => this.handleLeftClick(e, i));
      slot.addEventListener('contextmenu', (e) => this.handleRightClick(e, i));
      slot.addEventListener('dragstart', (e) => this.handleDragStart(e, i));
      slot.addEventListener('dragover', (e) => this.handleDragOver(e));
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', (e) => this.handleDrop(e, i));
      slot.addEventListener('dragend', () => this.handleDragEnd());

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
    this.syncSlotOrder(inventory);
    this.renderSlots(inventory);

    this.coinEls.platinum.textContent = String(currency.platinum);
    this.coinEls.gold.textContent     = String(currency.gold);
    this.coinEls.silver.textContent   = String(currency.silver);
    this.coinEls.copper.textContent   = String(currency.copper);
  }

  destroy(): void {
    this.contextMenu.destroy();
  }

  // ─── Slot order sync ──────────────────────────────────────────────────────

  private syncSlotOrder(snapshot: PlayerInventorySnapshot): void {
    const active = getAllActiveItems(snapshot);

    // Remove stale entries
    for (let i = 0; i < this.slotOrder.length; i++) {
      const id = this.slotOrder[i];
      if (id && !active.has(id)) {
        this.slotOrder[i] = '';
      }
    }

    // Add new items to first empty slot
    const placed = new Set(this.slotOrder.filter((id) => id !== ''));
    for (const id of active.keys()) {
      if (!placed.has(id)) {
        const emptyIdx = this.slotOrder.indexOf('');
        if (emptyIdx !== -1) {
          this.slotOrder[emptyIdx] = id;
          placed.add(id);
        }
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderSlots(snapshot: PlayerInventorySnapshot): void {
    this.slotEls.forEach((el, i) => {
      const itemId = this.slotOrder[i] ?? '';
      const count = itemId ? getSlotCount(snapshot, itemId) : 0;
      const isSelected = this.selectedSlot === i;

      const iconEl  = el.querySelector<HTMLElement>('.inv-slot-icon')!;
      const countEl = el.querySelector<HTMLElement>('.inv-slot-count')!;

      if (count > 0 && itemId) {
        const meta = getInventoryItemMeta(itemId);
        el.classList.add('has-item');
        el.classList.toggle('is-selected', isSelected);
        el.setAttribute('draggable', 'true');
        iconEl.textContent  = meta.icon;
        countEl.textContent = count > 1 ? String(count) : '';
        el.title = meta.label + (count > 1 ? ` (${count})` : '');
      } else {
        el.classList.remove('has-item', 'is-selected');
        el.setAttribute('draggable', 'false');
        iconEl.textContent  = '';
        countEl.textContent = '';
        el.title = '';
      }
    });
  }

  // ─── Left-click → context menu ───────────────────────────────────────────

  private handleLeftClick(e: MouseEvent, index: number): void {
    const itemId = this.slotOrder[index];
    if (!itemId) {
      this.clearSelection();
      return;
    }

    // If another slot is already selected, clicking a different item triggers a combine attempt
    if (this.selectedSlot !== null && this.selectedSlot !== index) {
      const sourceId = this.slotOrder[this.selectedSlot];
      if (sourceId) {
        this.clearSelection();
        this.callbacks.onItemCombine(sourceId, itemId);
        return;
      }
    }

    e.stopPropagation();
    const meta = getInventoryItemMeta(itemId);
    const opts = [];

    if (meta.useMode !== 'none') {
      opts.push({ label: `Use ${meta.label}`, action: () => this.callbacks.onItemUse(itemId) });
    } else {
      // Non-useable items: "Use" selects for combining
      const isSelected = this.selectedSlot === index;
      opts.push({
        label: isSelected ? `Deselect ${meta.label}` : `Use ${meta.label}`,
        action: () => {
          this.selectedSlot = isSelected ? null : index;
        },
      });
    }
    opts.push({ label: 'Inspect', action: () => this.callbacks.onItemInspect(itemId) });
    opts.push({ label: 'Drop', action: () => this.callbacks.onItemDrop(itemId), danger: true });

    this.contextMenu.show(e.clientX, e.clientY, opts);
  }

  // ─── Right-click → quick use or select ───────────────────────────────────

  private handleRightClick(e: MouseEvent, index: number): void {
    e.preventDefault();
    const itemId = this.slotOrder[index];
    if (!itemId) return;

    const meta = getInventoryItemMeta(itemId);

    if (meta.useMode !== 'none') {
      this.clearSelection();
      this.callbacks.onItemUse(itemId);
    } else {
      // Toggle selection for "use on"
      this.selectedSlot = this.selectedSlot === index ? null : index;
      this.slotEls[index]?.classList.toggle('is-selected', this.selectedSlot === index);
    }
  }

  // ─── Drag & drop ─────────────────────────────────────────────────────────

  private handleDragStart(e: DragEvent, index: number): void {
    const itemId = this.slotOrder[index];
    if (!itemId) {
      e.preventDefault();
      return;
    }
    this.contextMenu.hide();
    e.dataTransfer?.setData('text/plain', String(index));
    this.slotEls[index]?.classList.add('dragging');
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  }

  private handleDrop(e: DragEvent, targetIndex: number): void {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');

    const srcStr = e.dataTransfer?.getData('text/plain');
    if (!srcStr) return;
    const srcIndex = parseInt(srcStr, 10);
    if (isNaN(srcIndex) || srcIndex === targetIndex) return;

    // Swap
    const tmp = this.slotOrder[srcIndex];
    this.slotOrder[srcIndex] = this.slotOrder[targetIndex] ?? '';
    this.slotOrder[targetIndex] = tmp ?? '';

    // Move selection along with the dragged item
    if (this.selectedSlot === srcIndex) this.selectedSlot = targetIndex;
    else if (this.selectedSlot === targetIndex) this.selectedSlot = srcIndex;
  }

  private handleDragEnd(): void {
    this.slotEls.forEach((el) => el.classList.remove('dragging', 'drag-over'));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private clearSelection(): void {
    this.selectedSlot = null;
  }

  // Kept for external callers that previously used the old single-callback form
  getSlotData(): SlotData[] {
    return this.slotOrder.map((id) => ({ itemId: id, count: 0 }));
  }
}
