import type { CurrencySnapshot } from '../../../player/PlayerCurrencyState';
import { snapshotActiveEntries, snapshotGetCount } from '../../../player/PlayerInventoryState';
import type { PlayerInventorySnapshot } from '../../../player/PlayerInventoryState';
import { getItem } from '../../../items/ItemRegistry';
import { getInventoryItemMeta } from '../../inventory/InventoryItemMeta';
import { ItemContextMenu } from '../../inventory/ItemContextMenu';
import { UI_TOKENS } from '../UITokens';
import { requireElement } from '../../domUtils';

export type InventoryCallbacks = {
  onItemUse: (itemId: string) => void;
  onItemDrop: (itemId: string) => void;
  onItemInspect: (itemId: string) => void;
  onItemCombine: (sourceId: string, targetId: string) => void;
};


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

    this.coinEls.platinum = requireElement(purse, '.coin-plat');
    this.coinEls.gold      = requireElement(purse, '.coin-gold');
    this.coinEls.silver    = requireElement(purse, '.coin-silver');
    this.coinEls.copper    = requireElement(purse, '.coin-copper');

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
    const active = snapshotActiveEntries(snapshot);

    // For stackable items: 1 slot. For non-stackable items: 1 slot per unit.
    const neededSlots = new Map<string, number>();
    for (const [id, count] of active) {
      const def = getItem(id);
      neededSlots.set(id, (def?.stackable ?? false) ? 1 : count);
    }

    // Count current occupied slots per id
    const currentSlots = new Map<string, number>();
    for (const id of this.slotOrder) {
      if (id) currentSlots.set(id, (currentSlots.get(id) ?? 0) + 1);
    }

    // Trim excess slots (iterate from end to preserve visual stability)
    for (let i = this.slotOrder.length - 1; i >= 0; i--) {
      const id = this.slotOrder[i];
      if (!id) continue;
      const needed = neededSlots.get(id) ?? 0;
      const current = currentSlots.get(id) ?? 0;
      if (current > needed) {
        this.slotOrder[i] = '';
        currentSlots.set(id, current - 1);
        // If selection was pointing to a removed slot, clear it
        if (this.selectedSlot === i) this.selectedSlot = null;
      }
    }

    // Fill in missing slots
    for (const [id, needed] of neededSlots) {
      const current = currentSlots.get(id) ?? 0;
      for (let n = current; n < needed; n++) {
        const emptyIdx = this.slotOrder.indexOf('');
        if (emptyIdx !== -1) this.slotOrder[emptyIdx] = id;
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderSlots(snapshot: PlayerInventorySnapshot): void {
    this.slotEls.forEach((el, i) => {
      const itemId = this.slotOrder[i] ?? '';
      const totalCount = itemId ? snapshotGetCount(snapshot, itemId) : 0;
      const isSelected = this.selectedSlot === i;

      const iconEl  = el.querySelector<HTMLElement>('.inv-slot-icon')!;
      const countEl = el.querySelector<HTMLElement>('.inv-slot-count')!;

      if (totalCount > 0 && itemId) {
        const meta = getInventoryItemMeta(itemId);
        const def = getItem(itemId);
        const stackable = def?.stackable ?? false;

        el.classList.add('has-item');
        el.classList.toggle('is-selected', isSelected);
        el.setAttribute('draggable', 'true');
        iconEl.textContent = meta.icon;
        // Only show count badge for stackable items
        countEl.textContent = (stackable && totalCount > 1) ? String(totalCount) : '';
        el.title = meta.label + (stackable && totalCount > 1 ? ` (${totalCount})` : '');
      } else {
        el.classList.remove('has-item', 'is-selected');
        el.setAttribute('draggable', 'false');
        iconEl.textContent  = '';
        countEl.textContent = '';
        el.title = '';
      }
    });
  }

  // ─── Left-click: primary action ──────────────────────────────────────────
  // • Another slot selected + different item → combine
  // • Consumable / placeable → immediately use
  // • Anything else → toggle selection (for combining)

  private handleLeftClick(e: MouseEvent, index: number): void {
    e.stopPropagation();
    this.contextMenu.hide();

    const itemId = this.slotOrder[index];
    if (!itemId) {
      this.clearSelection();
      return;
    }

    // Combine: a different slot is already selected
    if (this.selectedSlot !== null && this.selectedSlot !== index) {
      const sourceId = this.slotOrder[this.selectedSlot];
      if (sourceId && sourceId !== itemId) {
        this.clearSelection();
        this.callbacks.onItemCombine(sourceId, itemId);
        return;
      }
      // Same item type in a different slot — just reselect
      this.clearSelection();
    }

    const meta = getInventoryItemMeta(itemId);

    if (meta.useMode !== 'none') {
      // Direct use for consumables / placeables
      this.callbacks.onItemUse(itemId);
      return;
    }

    // Toggle selection for non-useable items (materials, tools…)
    const isSelected = this.selectedSlot === index;
    this.selectedSlot = isSelected ? null : index;
    this.slotEls[index]?.classList.toggle('is-selected', !isSelected);
  }

  // ─── Right-click: context menu ───────────────────────────────────────────

  private handleRightClick(e: MouseEvent, index: number): void {
    e.preventDefault();
    const itemId = this.slotOrder[index];
    if (!itemId) return;

    const meta = getInventoryItemMeta(itemId);
    const opts = [];

    if (meta.useMode !== 'none') {
      opts.push({ label: `Use ${meta.label}`, action: () => this.callbacks.onItemUse(itemId) });
    } else {
      const isSelected = this.selectedSlot === index;
      opts.push({
        label: isSelected ? `Deselect ${meta.label}` : `Select ${meta.label}`,
        action: () => {
          const nowSelected = this.selectedSlot === index;
          this.selectedSlot = nowSelected ? null : index;
          this.slotEls[index]?.classList.toggle('is-selected', !nowSelected);
          this.contextMenu.hide();
        },
      });
    }
    opts.push({ label: 'Inspect', action: () => this.callbacks.onItemInspect(itemId) });
    opts.push({ label: 'Drop', action: () => this.callbacks.onItemDrop(itemId), danger: true });

    this.contextMenu.show(e.clientX, e.clientY, opts);
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
    if (this.selectedSlot !== null) {
      this.slotEls[this.selectedSlot]?.classList.remove('is-selected');
      this.selectedSlot = null;
    }
  }

}
