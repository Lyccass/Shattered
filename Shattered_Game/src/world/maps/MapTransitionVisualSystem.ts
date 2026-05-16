import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../../render/RenderLayers';
import { IsoTransform } from '../IsoTransform';
import { getMapDisplayName } from './MapDefinitions';
import type { MapTransition } from './MapTypes';

type AnchorEntry = {
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
};

const ACTIVE_COLOUR = 0xfacc15;
const IDLE_COLOUR = 0x38bdf8;

export class MapTransitionVisualSystem {
  private readonly anchors = new Map<string, AnchorEntry>();
  private activeTransitionId: string | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  setMapContext(transform: IsoTransform, transitions: MapTransition[]): void {
    this.clear();

    transitions.forEach((transition) => {
      const anchorTileX = transition.visualAnchor?.tileX ?? transition.fromTile.tileX;
      const anchorTileY = transition.visualAnchor?.tileY ?? transition.fromTile.tileY;
      const worldPoint = transform.getTileCenterWorld(anchorTileX, anchorTileY);
      const entry = this.createAnchorEntry(
        worldPoint.x,
        worldPoint.y - 18,
        transition.visualAnchor?.label ?? getMapDisplayName(transition.targetMapId),
      );

      this.anchors.set(transition.id, entry);
      this.applyAnchorState(transition.id, false);
    });
  }

  setActiveTransition(transitionId: string | null): void {
    if (this.activeTransitionId === transitionId) {
      return;
    }

    if (this.activeTransitionId) {
      this.applyAnchorState(this.activeTransitionId, false);
    }

    this.activeTransitionId = transitionId;

    if (this.activeTransitionId) {
      this.applyAnchorState(this.activeTransitionId, true);
    }
  }

  clear(): void {
    this.anchors.forEach((entry) => entry.container.destroy(true));
    this.anchors.clear();
    this.activeTransitionId = null;
  }

  private createAnchorEntry(worldX: number, worldY: number, labelText: string): AnchorEntry {
    const container = this.scene.add.container(worldX, worldY);
    container.setDepth(RENDER_DEPTHS.DEBUG - 100);

    const ring = this.scene.add.graphics();
    const label = this.scene.add.text(0, -20, labelText, {
      color: '#d7f3ff',
      fontFamily: 'monospace',
      fontSize: '12px',
      backgroundColor: '#07111fcc',
      padding: { x: 4, y: 2 },
    });

    label.setOrigin(0.5, 1);
    container.add([ring, label]);

    return {
      container,
      ring,
      label,
    };
  }

  private applyAnchorState(transitionId: string, isActive: boolean): void {
    const entry = this.anchors.get(transitionId);

    if (!entry) {
      return;
    }

    const colour = isActive ? ACTIVE_COLOUR : IDLE_COLOUR;
    const alpha = isActive ? 0.95 : 0.65;

    entry.ring.clear();
    entry.ring.lineStyle(2, colour, alpha);
    entry.ring.fillStyle(colour, isActive ? 0.18 : 0.1);
    entry.ring.fillCircle(0, 0, isActive ? 12 : 9);
    entry.ring.strokeCircle(0, 0, isActive ? 12 : 9);
    entry.ring.lineStyle(2, colour, alpha);
    entry.ring.strokePoints(
      [
        new Phaser.Math.Vector2(0, -16),
        new Phaser.Math.Vector2(10, 0),
        new Phaser.Math.Vector2(0, 16),
        new Phaser.Math.Vector2(-10, 0),
      ],
      true,
    );
    entry.label.setAlpha(isActive ? 1 : 0.82);
  }
}
