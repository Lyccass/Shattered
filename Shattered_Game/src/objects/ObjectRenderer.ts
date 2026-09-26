import { forestLedgeTexture } from './ForestLedgeBlend';
import { getForestVisualVariation, type ForestVisualVariation } from './ForestVisualVariation';
import Phaser from 'phaser';
import { animateForestProp } from '../world/terrain/ForestAmbientAnimation';
import { getDynamicDepth, RENDER_DEPTHS } from '../render/RenderLayers';
import { createObjectGroundShadow } from './ObjectGroundShadow';
import { IsoTransform } from '../world/IsoTransform';
import { getObjectDepthAnchorWorld } from './ObjectDepth';
import type { ObjectDefinition, ObjectInstance, VisualPart } from './ObjectTypes';

export type ObjectOcclusionTarget = {
  instanceId: string;
  definition: ObjectDefinition;
  visual: Phaser.GameObjects.Container;
  shadow?: Phaser.GameObjects.Graphics;
};

// ObjectRenderer draws static object visuals from
// ObjectInstance + ObjectDefinition. It is the only place that turns object
// data into Phaser GameObjects. All positions come from IsoTransform so they
// align exactly with terrain tile diamonds. Visual size never participates
// in collision — collision is purely the WorldGrid footprint.
export class ObjectRenderer {
  private readonly rendered = new Map<string, ObjectOcclusionTarget>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransform,
    private readonly surfaceOffset: (x: number, y: number) => number = () => 0,
  ) {}

  render(instance: ObjectInstance, definition: ObjectDefinition): void {
    if (this.rendered.has(instance.id)) {
      this.remove(instance.id);
    }

    const anchor = this.transform.getTileCenterWorld(instance.tileX, instance.tileY);
    anchor.y -= definition.fixedElevation ?? this.surfaceOffset(instance.tileX,instance.tileY);
    const depthAnchor = getObjectDepthAnchorWorld(this.transform, instance, definition);
    const depth = getDynamicDepth(depthAnchor.y, definition.depth.depthOffset);

    const visual = this.scene.add.container(anchor.x, anchor.y);
    visual.setDepth(depth);
    const graphics = this.scene.add.graphics();
    visual.add(graphics);

    for (const part of definition.visual.parts) {
      drawPart(this.scene, visual, graphics, part, getForestVisualVariation(instance.id,definition));
    }

    const shadow=createObjectGroundShadow(this.scene,definition,anchor.x,anchor.y,RENDER_DEPTHS.SHADOW,getForestVisualVariation(instance.id,definition));
    this.rendered.set(instance.id, { instanceId: instance.id, definition, visual, shadow });
  }

  remove(instanceId: string): void {
    const entry = this.rendered.get(instanceId);
    if (!entry) return;
    entry.visual.destroy(true);
    entry.shadow?.destroy();
    this.rendered.delete(instanceId);
  }

  destroyAll(): void {
    for (const entry of this.rendered.values()) {
      entry.visual.destroy(true);
      entry.shadow?.destroy();
    }

    this.rendered.clear();
  }

  getOcclusionTargets(): IterableIterator<ObjectOcclusionTarget> {
    return this.rendered.values();
  }
}

function drawPart(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  graphics: Phaser.GameObjects.Graphics,
  part: VisualPart,
  variation: ForestVisualVariation,
): void {
  if (part.shape === 'sprite') {
    const image = scene.add.image(part.localOffsetX, part.localOffsetY, forestLedgeTexture(scene,part.textureKey));
    image.setOrigin(variation.flipX ? 1-(part.originX ?? .5) : (part.originX ?? .5), part.originY ?? .5);
    image.setScale(part.scale * variation.width, part.scale * variation.height);
    image.setAlpha(part.alpha ?? 1);
    image.setFlipX((part.flipX ?? false) !== variation.flipX);
    container.add(image);
    animateForestProp(scene, image);
    return;
  }

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
