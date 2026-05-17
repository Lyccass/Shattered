import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import { IsoTransform } from '../world/IsoTransform';
import { getObjectDepthAnchorWorld } from './ObjectDepth';
import type { ObjectDefinition, ObjectInstance } from './ObjectTypes';

const BLOCKING_COLOUR = 0xef4444;     // red
const NON_BLOCKING_COLOUR = 0x3b82f6; // blue
const ANCHOR_COLOUR = 0xfacc15;       // yellow
const LABEL_COLOUR = '#d7f3ff';       // cyan-white

type DebugEntry = {
  diamonds: Phaser.GameObjects.Graphics;
  anchor: Phaser.GameObjects.Arc | null;
  label: Phaser.GameObjects.Text | null;
  anchorX: number;
  anchorY: number;
  labelText: string;
  labelX: number;
  labelY: number;
};

// ObjectDebugRenderer draws collision footprint diamonds, base/depth anchor
// dots, and labels for placed objects. Diamonds use IsoTransform.getTileDiamondPoints
// so they align EXACTLY with the terrain tile diamonds drawn by IsoTilemapChunkRenderer.
// Toggle visibility with setVisible(); overlays render above the world but below
// any screen-fixed UI. Anchor dots and text labels are created lazily on first
// setVisible(true) to avoid canvas allocations while debug is unused.
export class ObjectDebugRenderer {
  private readonly entries = new Map<string, DebugEntry>();
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransform,
  ) {}

  render(instance: ObjectInstance, definition: ObjectDefinition): void {
    if (this.entries.has(instance.id)) {
      this.remove(instance.id);
    }

    const diamondColour = definition.blocksMovement ? BLOCKING_COLOUR : NON_BLOCKING_COLOUR;
    const footprint = definition.collisionFootprint.length > 0
      ? definition.collisionFootprint
      : [{ x: 0, y: 0 }];

    const diamonds = this.scene.add.graphics();
    diamonds.setDepth(RENDER_DEPTHS.DEBUG);
    diamonds.lineStyle(2, diamondColour, 0.85);
    diamonds.fillStyle(diamondColour, 0.16);

    for (const offset of footprint) {
      const points = this.transform.getTileDiamondPoints(
        instance.tileX + offset.x,
        instance.tileY + offset.y,
      );
      diamonds.fillPoints(points, true);
      diamonds.strokePoints(points, true);
    }

    const anchorPoint = getObjectDepthAnchorWorld(this.transform, instance, definition);
    const anchorCentre = this.transform.getTileCenterWorld(instance.tileX, instance.tileY);

    const entry: DebugEntry = {
      diamonds,
      anchor: null,
      label: null,
      anchorX: anchorPoint.x,
      anchorY: anchorPoint.y,
      labelText: definition.debug.label ?? definition.id,
      labelX: anchorCentre.x,
      labelY: anchorCentre.y - 36,
    };

    if (this.visible) {
      entry.anchor = this.createAnchor(entry);
      entry.label = this.createLabel(entry);
    }

    diamonds.setVisible(this.visible);
    this.entries.set(instance.id, entry);
  }

  remove(instanceId: string): void {
    const entry = this.entries.get(instanceId);
    if (!entry) return;
    entry.diamonds.destroy();
    entry.anchor?.destroy();
    entry.label?.destroy();
    this.entries.delete(instanceId);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const entry of this.entries.values()) {
      if (visible) {
        if (!entry.anchor) entry.anchor = this.createAnchor(entry);
        if (!entry.label) entry.label = this.createLabel(entry);
      }
      this.applyVisibility(entry);
    }
  }

  toggle(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroyAll(): void {
    for (const instanceId of Array.from(this.entries.keys())) {
      this.remove(instanceId);
    }
  }

  private createAnchor(entry: DebugEntry): Phaser.GameObjects.Arc {
    const anchor = this.scene.add.circle(entry.anchorX, entry.anchorY, 4, ANCHOR_COLOUR, 1);
    anchor.setStrokeStyle(1.5, 0x111111, 0.9);
    anchor.setDepth(RENDER_DEPTHS.DEBUG + 1);
    return anchor;
  }

  private createLabel(entry: DebugEntry): Phaser.GameObjects.Text {
    const label = this.scene.add.text(entry.labelX, entry.labelY, entry.labelText, {
      color: LABEL_COLOUR,
      fontFamily: 'monospace',
      fontSize: '11px',
      backgroundColor: '#07111fcc',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5, 1);
    label.setDepth(RENDER_DEPTHS.DEBUG + 2);
    return label;
  }

  private applyVisibility(entry: DebugEntry): void {
    entry.diamonds.setVisible(this.visible);
    entry.anchor?.setVisible(this.visible);
    entry.label?.setVisible(this.visible);
  }
}
