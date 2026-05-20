import Phaser from 'phaser';
import type { EditorMapDefinition, EditorPlacedObject } from '../../shared/editor/EditorMapModel';
import {
  getTileCenterWorld,
  getTileDiamondPoints,
  type IsoTransformConfig,
} from '../../shared/iso/IsoCoordinates';
import type { ObjectDefinition, VisualPart } from '../../objects/ObjectTypes';
import type { EditorObjectCatalog } from './EditorObjectCatalog';

const OBJECT_DEPTH_BASE = 5_000;

export class EditorObjectLayerRenderer {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly transform: IsoTransformConfig,
    private readonly catalog: EditorObjectCatalog,
  ) {}

  setUiCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.uiCamera = camera;
    this.uiCamera.ignore(this.objects);
  }

  renderAll(map: EditorMapDefinition): void {
    this.clear();

    for (const object of map.objects) {
      const definition = this.catalog.byId.get(object.definitionId);

      if (!definition) {
        continue;
      }

      this.objects.push(this.createObjectVisual(object, definition));
    }

    this.uiCamera?.ignore(this.objects);
  }

  getObjectAtTile(map: EditorMapDefinition, tileX: number, tileY: number): EditorPlacedObject | null {
    for (const object of [...map.objects].reverse()) {
      const definition = this.catalog.byId.get(object.definitionId);

      if (!definition) {
        continue;
      }

      const coversTile = definition.collisionFootprint.some((offset) =>
        object.tileX + offset.x === tileX && object.tileY + offset.y === tileY,
      );

      if (coversTile) {
        return object;
      }
    }

    return null;
  }

  clear(): void {
    while (this.objects.length > 0) {
      this.objects.pop()?.destroy();
    }
  }

  private createObjectVisual(
    object: EditorPlacedObject,
    definition: ObjectDefinition,
  ): Phaser.GameObjects.Container {
    const anchor = getTileCenterWorld(this.transform, object.tileX, object.tileY);
    const visual = this.scene.add.container(anchor.x, anchor.y);
    const graphics = this.scene.add.graphics();

    visual.setDepth(OBJECT_DEPTH_BASE + object.tileX + object.tileY + 0.5);
    visual.add(graphics);

    for (const part of definition.visual.parts) {
      drawPart(this.scene, visual, graphics, part);
    }

    this.drawFootprint(graphics, definition);
    return visual;
  }

  private drawFootprint(
    graphics: Phaser.GameObjects.Graphics,
    definition: ObjectDefinition,
  ): void {
    graphics.lineStyle(1, definition.blocksMovement ? 0xef4444 : 0x38bdf8, 0.65);

    for (const offset of definition.collisionFootprint) {
      const points = getTileDiamondPoints(this.transform, offset.x, offset.y)
        .map((point) => new Phaser.Geom.Point(
          point.x - this.transform.originX,
          point.y - this.transform.originY - this.transform.tileHeight / 2,
        ));

      graphics.strokePoints(points, true);
    }
  }
}

function drawPart(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  graphics: Phaser.GameObjects.Graphics,
  part: VisualPart,
): void {
  if (part.shape === 'sprite') {
    if (!scene.textures.exists(part.textureKey)) {
      return;
    }

    const image = scene.add.image(part.localOffsetX, part.localOffsetY, part.textureKey);
    image.setOrigin(part.originX ?? 0.5, part.originY ?? 0.5);
    image.setScale(part.scale);
    image.setAlpha(part.alpha ?? 1);
    image.setFlipX(part.flipX ?? false);
    container.add(image);
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
