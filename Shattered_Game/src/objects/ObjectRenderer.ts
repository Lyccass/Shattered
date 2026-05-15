import Phaser from 'phaser';
import { getDynamicDepth, RENDER_DEPTHS } from '../render/RenderLayers';
import { IsoTransform } from '../world/IsoTransform';
import { getObjectDepthAnchorWorld } from './ObjectDepth';
import type { ObjectDefinition, ObjectInstance, VisualPart } from './ObjectTypes';

type RenderedObject = {
  visual: Phaser.GameObjects.Graphics;
  shadow?: Phaser.GameObjects.Ellipse;
};

// ObjectRenderer draws static object visuals (and optional shadows) from
// ObjectInstance + ObjectDefinition. It is the only place that turns object
// data into Phaser GameObjects. All positions come from IsoTransform so they
// align exactly with terrain tile diamonds. Visual size never participates
// in collision — collision is purely the WorldGrid footprint.
export class ObjectRenderer {
  private readonly rendered = new Map<string, RenderedObject>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransform,
  ) {}

  render(instance: ObjectInstance, definition: ObjectDefinition): void {
    if (this.rendered.has(instance.id)) {
      this.remove(instance.id);
    }

    const anchor = this.transform.getTileCenterWorld(instance.tileX, instance.tileY);
    const depthAnchor = getObjectDepthAnchorWorld(this.transform, instance, definition);
    const depth = getDynamicDepth(depthAnchor.y, definition.depth.depthOffset);

    const shadow = this.createShadow(instance, definition, anchor);

    const visual = this.scene.add.graphics({ x: anchor.x, y: anchor.y });
    visual.setDepth(depth);
    for (const part of definition.visual.parts) {
      drawPart(visual, part);
    }

    this.rendered.set(instance.id, { visual, shadow });
  }

  remove(instanceId: string): void {
    const entry = this.rendered.get(instanceId);
    if (!entry) return;
    entry.visual.destroy();
    entry.shadow?.destroy();
    this.rendered.delete(instanceId);
  }

  private createShadow(
    instance: ObjectInstance,
    definition: ObjectDefinition,
    anchor: Phaser.Math.Vector2,
  ): Phaser.GameObjects.Ellipse | undefined {
    const { shadow } = definition;
    if (!shadow.enabled) return undefined;

    const ellipse = this.scene.add.ellipse(
      anchor.x + shadow.localOffsetX,
      anchor.y + shadow.localOffsetY,
      shadow.width,
      shadow.height,
      0x020617,
      shadow.alpha,
    );
    // Shadows live below dynamic actors so they never affect depth-sorting between objects/players.
    ellipse.setDepth(RENDER_DEPTHS.SHADOW + (instance.createdAt % 1000) * 0.001);
    return ellipse;
  }

}

function drawPart(graphics: Phaser.GameObjects.Graphics, part: VisualPart): void {
  graphics.fillStyle(part.color, part.alpha ?? 1);

  if (part.shape === 'ellipse') {
    graphics.fillEllipse(part.localOffsetX, part.localOffsetY, part.width, part.height);
  } else {
    graphics.fillRect(
      part.localOffsetX - part.width / 2,
      part.localOffsetY - part.height / 2,
      part.width,
      part.height,
    );
  }

  if (part.strokeColor !== undefined && part.strokeWidth) {
    graphics.lineStyle(part.strokeWidth, part.strokeColor, part.strokeAlpha ?? 1);

    if (part.shape === 'ellipse') {
      graphics.strokeEllipse(part.localOffsetX, part.localOffsetY, part.width, part.height);
    } else {
      graphics.strokeRect(
        part.localOffsetX - part.width / 2,
        part.localOffsetY - part.height / 2,
        part.width,
        part.height,
      );
    }
  }
}
