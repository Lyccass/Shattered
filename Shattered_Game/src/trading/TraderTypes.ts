export type ShopStockEntry = {
  itemId: string;
  stock: number;
  maxStock: number;
  /** Items restocked per real-world minute. 0 = no passive restock. */
  restockRatePerMin?: number;
};

export type ShopDefinition = {
  id: string;
  displayName: string;
  /**
   * Multiplier applied to item base value for buy price.
   * Scales up as stock runs low (low stock = scarce = more expensive).
   * e.g. 1.5 = 50% markup at full stock, rising to 2.0 at 0 stock.
   */
  buyMarkupBase: number;
  /** Multiplier applied to item base value for sell price (fixed). e.g. 0.5 = half value. */
  sellMarkdownBase: number;
  entries: ShopStockEntry[];
};

export type ShopItemSnapshot = {
  itemId: string;
  name: string;
  icon: string;
  stock: number;
  maxStock: number;
  buyPriceCopper: number;
  sellPriceCopper: number;
};

export type ShopSnapshot = {
  shopId: string;
  displayName: string;
  items: ShopItemSnapshot[];
};
