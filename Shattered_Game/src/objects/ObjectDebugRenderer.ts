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
  anchor: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

// ObjectDebugRenderer draws collision footprint diamonds, base/depth anchor
// dots, and labels for placed objects. Diamonds use IsoTransform.getTileDiamondPoints
// so they align EXACTLY with the terrain tile diamonds drawn by IsoTilemapChunkRenderer.
// Toggle visibility with setVisible(); overlays render above the world but below
// any screen-fixed UI.
export class ObjectDebugRenderer {
  private readonly entries = new Map<string, DebugEntry>();
  private visible = true;

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

    // Anchor dot uses the same shared depth helper as ObjectRenderer, so it
    // marks the actual sort point selected by the object's depth definition.
    const anchorPoint = getObjectDepthAnchorWorld(this.transform, instance, definition);
    const anchor = this.scene.add.circle(anchorPoint.x, anchorPoint.y, 4, ANCHOR_COLOUR, 1);
    anchor.setStrokeStyle(1.5, 0x111111, 0.9);
    anchor.setDepth(RENDER_DEPTHS.DEBUG + 1);

    const labelText = definition.debug.label ?? definition.id;
    const anchorCentre = this.transform.getTileCenterWorld(instance.tileX, instance.tileY);
    const label = this.scene.add.text(anchorCentre.x, anchorCentre.y - 36, labelText, {
      color: LABEL_COLOUR,
      fontFamily: 'monospace',
      fontSize: '11px',
      backgroundColor: '#07111fcc',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5, 1);
    label.setDepth(RENDER_DEPTHS.DEBUG + 2);

    const entry: DebugEntry = { diamonds, anchor, label };
    this.applyVisibility(entry);
    this.entries.set(instance.id, entry);
  }

  remove(instanceId: string): void {
    const entry = this.entries.get(instanceId);
    if (!entry) return;
    entry.diamonds.destroy();
    entry.anchor.destroy();
    entry.label.destroy();
    this.entries.delete(instanceId);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const entry of this.entries.values()) {
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

  private applyVisibility(entry: DebugEntry): void {
    entry.diamonds.setVisible(this.visible);
    entry.anchor.setVisible(this.visible);
    entry.label.setVisible(this.visible);
  }
}
