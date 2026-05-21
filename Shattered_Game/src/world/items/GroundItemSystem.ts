import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../../render/RenderLayers';
import { getInventoryItemMeta } from '../../ui/inventory/InventoryItemMeta';
import type { EnemyLootEntry } from '../../combat/EnemyTypes';
import type { GroundItemDrop } from './GroundItemTypes';
import type { GroundItemInteractionTarget } from '../../interactions/InteractionTypes';

type DropVisuals = {
  container: Phaser.GameObjects.Container;
};

let dropCounter = 0;

export class GroundItemSystem {
  private readonly drops = new Map<string, GroundItemDrop>();
  private readonly visuals = new Map<string, DropVisuals>();
  private dirty = false;
  private cachedTargets: GroundItemInteractionTarget[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  spawnDrop(itemId: string, count: number, worldX: number, worldY: number, nowMs: number, despawnAtMs: number): void {
    const id = `drop_${++dropCounter}`;
    this.drops.set(id, { id, itemId, count, worldX, worldY, spawnedAtMs: nowMs, despawnAtMs });
    this.createVisual(id, itemId, count, worldX, worldY);
    this.dirty = true;
  }

  spawnFromLootTable(
    lootTable: EnemyLootEntry[],
    worldX: number,
    worldY: number,
    nowMs: number,
  ): void {
    const despawnAtMs = nowMs + 300_000;
    for (const entry of lootTable) {
      if (Math.random() > entry.chance) continue;
      const count =
        entry.minCount +
        Math.floor(Math.random() * (entry.maxCount - entry.minCount + 1));
      if (count <= 0) continue;
      this.spawnDrop(entry.itemId, count, worldX, worldY, nowMs, despawnAtMs);
    }
  }

  tick(nowMs: number): void {
    for (const drop of [...this.drops.values()]) {
      if (nowMs >= drop.despawnAtMs) {
        this.removeDrop(drop.id);
        this.dirty = true;
      }
    }
  }

  /** Returns interaction targets for all current drops. Call each frame before updateActiveInteraction. */
  buildDynamicTargets(
    worldToTile: (wx: number, wy: number) => { x: number; y: number },
  ): GroundItemInteractionTarget[] {
    const targets: GroundItemInteractionTarget[] = [];
    for (const drop of this.drops.values()) {
      const tile = worldToTile(drop.worldX, drop.worldY);
      const meta = getInventoryItemMeta(drop.itemId);
      const countStr = drop.count > 1 ? ` ×${drop.count}` : '';
      targets.push({
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
    return targets;
  }

  /** Remove a drop and return its contents. Returns null if the drop no longer exists. */
  collectDrop(id: string): { itemId: string; count: number } | null {
    const drop = this.drops.get(id);
    if (!drop) return null;
    this.removeDrop(id);
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
  ): void {
    const meta = getInventoryItemMeta(itemId);
    const depth = RENDER_DEPTHS.GRID + 5;

    // Flat ground indicator — dark ellipse to suggest the item is lying on the tile
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x0a0500, 0.7);
    shadow.fillEllipse(0, 0, 28, 14);
    shadow.lineStyle(1, 0xffaa33, 0.55);
    shadow.strokeEllipse(0, 0, 28, 14);

    const iconText = this.scene.add.text(0, -1, meta.icon, {
      fontSize: '11px',
    }).setOrigin(0.5, 0.5);

    const label = count > 1 ? `${meta.label} ×${count}` : meta.label;
    const labelText = this.scene.add.text(0, -18, label, {
      fontSize: '7px',
      color: '#ffffcc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);

    const container = this.scene.add.container(worldX, worldY, [shadow, iconText, labelText]);
    container.setDepth(depth);

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
