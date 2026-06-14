import Phaser from 'phaser';
import { getDynamicDepth } from '../../render/RenderLayers';
import { getInventoryItemMeta } from '../../ui/inventory/InventoryItemMeta';
import type { EnemyLootTable, EnemyLootTableEntry } from '../../combat/EnemyTypes';
import type { GroundItemDrop } from './GroundItemTypes';
import type { GroundItemInteractionTarget } from '../../interactions/InteractionTypes';

type DropVisuals = {
  container: Phaser.GameObjects.Container;
};

export type SpawnedLootDrop = {
  itemId: string;
  count: number;
  label: string;
};

let dropCounter = 0;

export class GroundItemSystem {
  private readonly drops = new Map<string, GroundItemDrop>();
  private readonly visuals = new Map<string, DropVisuals>();
  private dirty = false;
  private cachedTargets: GroundItemInteractionTarget[] = [];
  private activeMapId = '';

  constructor(private readonly scene: Phaser.Scene) {}

  setActiveMap(mapId: string): void {
    if (this.activeMapId === mapId) return;
    this.activeMapId = mapId;
    this.dirty = true;
    // Hide visuals for drops on other maps; show for the current map
    for (const [id, drop] of this.drops) {
      const vis = this.visuals.get(id);
      if (vis) vis.container.setVisible(drop.mapId === mapId);
    }
  }

  spawnDrop(mapId: string, itemId: string, count: number, worldX: number, worldY: number, nowMs: number, despawnAtMs: number): void {
    const id = `drop_${++dropCounter}`;
    this.drops.set(id, { id, mapId, itemId, count, worldX, worldY, spawnedAtMs: nowMs, despawnAtMs });
    this.createVisual(id, itemId, count, worldX, worldY, mapId === this.activeMapId);
    this.dirty = true;
  }

  spawnFromLootTable(
    mapId: string,
    lootTables: EnemyLootTable[],
    worldX: number,
    worldY: number,
    nowMs: number,
  ): SpawnedLootDrop[] {
    const spawned: SpawnedLootDrop[] = [];
    const despawnAtMs = nowMs + 300_000;
    for (const table of lootTables) {
      if (Math.random() >= 1 / table.oneIn) continue;
      const entry = pickWeighted(table.entries);
      if (!entry) continue;
      const count = entry.count ?? 1;
      if (count > 0) {
        this.spawnDrop(mapId, entry.itemId, count, worldX, worldY, nowMs, despawnAtMs);
        spawned.push({
          itemId: entry.itemId,
          count,
          label: getInventoryItemMeta(entry.itemId).label,
        });
      }
    }
    return spawned;
  }

  tick(nowMs: number): void {
    for (const drop of [...this.drops.values()]) {
      if (nowMs >= drop.despawnAtMs) {
        this.removeDrop(drop.id);
        this.dirty = true;
      }
    }
  }

  /** Returns interaction targets for drops on the active map only. Rebuilds when drops change. */
  buildDynamicTargets(
    worldToTile: (wx: number, wy: number) => { x: number; y: number },
  ): GroundItemInteractionTarget[] {
    if (!this.dirty) return this.cachedTargets;
    this.dirty = false;
    this.cachedTargets = [];
    for (const drop of this.drops.values()) {
      if (drop.mapId !== this.activeMapId) continue;
      const tile = worldToTile(drop.worldX, drop.worldY);
      const meta = getInventoryItemMeta(drop.itemId);
      const countStr = drop.count > 1 ? ` ×${drop.count}` : '';
      this.cachedTargets.push({
        definition: {
          id: drop.id,
          interactionType: 'ground_item',
          promptText: `Pick up: ${meta.label}${countStr}`,
          interactionRangeTiles: 0,
          priority: 60,
        },
        tiles: [{ x: tile.x, y: tile.y }],
        dropId: drop.id,
        itemId: drop.itemId,
        count: drop.count,
      });
    }
    return this.cachedTargets;
  }

  /** Remove a drop and return its contents. Returns null if the drop no longer exists. */
  collectDrop(id: string): { itemId: string; count: number } | null {
    const drop = this.drops.get(id);
    if (!drop) return null;
    this.removeDrop(id);
    this.dirty = true;
    return { itemId: drop.itemId, count: drop.count };
  }

  destroy(): void {
    for (const id of [...this.drops.keys()]) {
      this.removeDrop(id);
    }
  }

  private createVisual(
    id: string,
    itemId: string,
    count: number,
    worldX: number,
    worldY: number,
    visible = true,
  ): void {
    const meta = getInventoryItemMeta(itemId);
    const depth = getDynamicDepth(worldY, 100);

    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillEllipse(0, 6, 26, 10);

    const iconText = this.scene.add.text(0, -13, meta.icon, {
      fontSize: '11px',
    }).setOrigin(0.5, 0.5);

    const label = count > 1 ? `${meta.label} ×${count}` : meta.label;
    const labelText = this.scene.add.text(0, -28, label, {
      fontSize: '7px',
      color: '#ffffcc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);

    const container = this.scene.add.container(worldX, worldY, [shadow, iconText, labelText]);
    container.setDepth(depth);
    container.setVisible(visible);

    this.visuals.set(id, { container });
  }

  private removeDrop(id: string): void {
    this.drops.delete(id);
    const vis = this.visuals.get(id);
    if (vis) {
      vis.container.destroy(true);
      this.visuals.delete(id);
    }
  }
}

function pickWeighted(entries: EnemyLootTableEntry[]): EnemyLootTableEntry | null {
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of entries) {
    r -= entry.weight;
    if (r <= 0) return entry;
  }
  return entries[entries.length - 1] ?? null;
}
