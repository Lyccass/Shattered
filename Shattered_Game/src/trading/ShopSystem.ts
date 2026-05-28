import { requireItem } from '../items/ItemRegistry';
import type { PlayerSessionState } from '../player/PlayerSessionState';
import type { ShopDefinition, ShopItemSnapshot, ShopSnapshot } from './TraderTypes';
import { SHOP_DEFINITIONS } from './TraderDefinitions';

type ShopRuntimeEntry = {
  itemId: string;
  stock: number;
  maxStock: number;
  restockRatePerMin: number;
  lastRestockMs: number;
};

type ShopRuntime = {
  def: ShopDefinition;
  entries: Map<string, ShopRuntimeEntry>;
};

export class ShopSystem {
  private readonly shops = new Map<string, ShopRuntime>();

  constructor() {
    for (const def of SHOP_DEFINITIONS) {
      const entries = new Map<string, ShopRuntimeEntry>();
      for (const e of def.entries) {
        entries.set(e.itemId, {
          itemId: e.itemId,
          stock: e.stock,
          maxStock: e.maxStock,
          restockRatePerMin: e.restockRatePerMin ?? 0,
          lastRestockMs: 0,
        });
      }
      this.shops.set(def.id, { def, entries });
    }
  }

  update(nowMs: number): void {
    for (const { entries } of this.shops.values()) {
      for (const entry of entries.values()) {
        if (entry.restockRatePerMin <= 0 || entry.stock >= entry.maxStock) continue;
        const elapsedMin = (nowMs - entry.lastRestockMs) / 60_000;
        const restockAmount = Math.floor(elapsedMin * entry.restockRatePerMin);
        if (restockAmount > 0) {
          entry.stock = Math.min(entry.stock + restockAmount, entry.maxStock);
          entry.lastRestockMs = nowMs;
        }
      }
    }
  }

  has(shopId: string): boolean {
    return this.shops.has(shopId);
  }

  getSnapshot(shopId: string): ShopSnapshot | null {
    const shop = this.shops.get(shopId);
    if (!shop) return null;
    const items: ShopItemSnapshot[] = [];
    for (const entry of shop.entries.values()) {
      const def = requireItem(entry.itemId);
      items.push({
        itemId: entry.itemId,
        name: def.name,
        icon: def.icon,
        stock: entry.stock,
        maxStock: entry.maxStock,
        buyPriceCopper: this.calcBuyPrice(shop.def, entry),
        sellPriceCopper: this.calcSellPriceForValue(shop.def, def.value),
      });
    }
    return { shopId, displayName: shop.def.displayName, items };
  }

  tryBuy(shopId: string, itemId: string, playerState: PlayerSessionState, qty = 1): { ok: boolean; message: string } {
    const shop = this.shops.get(shopId);
    if (!shop) return { ok: false, message: 'Shop not found.' };
    const entry = shop.entries.get(itemId);
    if (!entry) return { ok: false, message: 'Item not stocked here.' };
    if (entry.stock <= 0) return { ok: false, message: 'Out of stock.' };

    const actualQty = Math.min(qty, entry.stock);
    const priceEach = this.calcBuyPrice(shop.def, entry);
    const totalPrice = priceEach * actualQty;

    const inv = playerState.getInventoryState();
    const isStackable = (id: string) => requireItem(id).stackable ?? false;
    if (!inv.canAdd(itemId, actualQty, isStackable, 28)) {
      return { ok: false, message: 'Not enough space in your inventory.' };
    }

    if (!playerState.getCurrencyState().spendCopper(totalPrice)) {
      return { ok: false, message: `Not enough copper. Costs ${formatCopper(totalPrice)}.` };
    }

    entry.stock -= actualQty;
    inv.add(itemId, actualQty);
    const itemDef = requireItem(itemId);
    const label = actualQty > 1 ? `${actualQty}× ${itemDef.name}` : itemDef.name;
    return { ok: true, message: `Bought ${label} for ${formatCopper(totalPrice)}.` };
  }

  trySell(shopId: string, itemId: string, playerState: PlayerSessionState, qty = 1): { ok: boolean; message: string } {
    const shop = this.shops.get(shopId);
    if (!shop) return { ok: false, message: 'Shop not found.' };

    const inv = playerState.getInventoryState();
    const itemDef = requireItem(itemId);
    if (itemDef.value <= 0) return { ok: false, message: 'That has no trade value.' };

    const actualQty = Math.min(qty, inv.getCount(itemId));
    if (actualQty <= 0) return { ok: false, message: "You don't have that." };

    const priceEach = this.calcSellPriceForValue(shop.def, itemDef.value);
    if (priceEach <= 0) return { ok: false, message: "Trader isn't interested in that." };

    const totalGain = priceEach * actualQty;
    for (let i = 0; i < actualQty; i++) inv.consume(itemId, 1);
    playerState.getCurrencyState().addCopper(totalGain);

    // Selling back increases the trader's stock (capped at 2× maxStock)
    const entry = shop.entries.get(itemId);
    if (entry) {
      entry.stock = Math.min(entry.stock + actualQty, entry.maxStock * 2);
    }

    const label = actualQty > 1 ? `${actualQty}× ${itemDef.name}` : itemDef.name;
    return { ok: true, message: `Sold ${label} for ${formatCopper(totalGain)}.` };
  }

  // ─── Price calculations ───────────────────────────────────────────────────────

  private calcBuyPrice(def: ShopDefinition, entry: ShopRuntimeEntry): number {
    const stockFraction = entry.maxStock > 0 ? Math.min(entry.stock / entry.maxStock, 1) : 0;
    // Full stock → base markup; empty stock → markup + 0.5
    const markup = def.buyMarkupBase + (1 - stockFraction) * 0.5;
    const itemDef = requireItem(entry.itemId);
    return Math.max(1, Math.ceil(itemDef.value * markup));
  }

  private calcSellPriceForValue(def: ShopDefinition, baseValue: number): number {
    return Math.max(1, Math.floor(baseValue * def.sellMarkdownBase));
  }
}

function formatCopper(copper: number): string {
  if (copper >= 10_000) {
    const gold = Math.floor(copper / 10_000);
    const rem = copper % 10_000;
    const silver = Math.floor(rem / 100);
    const c = rem % 100;
    return `${gold}g ${silver}s ${c}c`;
  }
  if (copper >= 100) {
    const silver = Math.floor(copper / 100);
    const c = copper % 100;
    return `${silver}s ${c}c`;
  }
  return `${copper}c`;
}
