import Phaser from 'phaser';
import { OBJECT_OCCLUSION_CONFIG } from './ObjectOcclusionConfig';
import type { ObjectOcclusionTarget, ObjectRenderer } from './ObjectRenderer';

// ObjectOcclusionSystem keeps the player readable when dynamic depth sorting
// correctly puts foreground objects over them. It does not change depth,
// collision, placement, or object logic; it only applies a smooth visual fade
// to foreground object containers whose rendered bounds overlap the player.
export class ObjectOcclusionSystem {
  private readonly playerBounds = new Phaser.Geom.Rectangle();
  private readonly objectBounds = new Phaser.Geom.Rectangle();
  private readonly overlapBounds = new Phaser.Geom.Rectangle();

  constructor(
    private readonly renderer: ObjectRenderer,
    private readonly player: Phaser.GameObjects.Sprite,
  ) {}

  update(delta: number): void {
    const deltaSeconds = delta / 1000;
    this.player.getBounds(this.playerBounds);

    for (const target of this.renderer.getOcclusionTargets()) {
      const targetAlpha = this.getTargetAlpha(target);
      const speed = targetAlpha < target.visual.alpha
        ? OBJECT_OCCLUSION_CONFIG.fadeInSpeed
        : OBJECT_OCCLUSION_CONFIG.fadeOutSpeed;
      const blend = 1 - Math.exp(-speed * deltaSeconds);
      const nextAlpha = Phaser.Math.Linear(target.visual.alpha, targetAlpha, blend);

      target.visual.setAlpha(Math.abs(nextAlpha - targetAlpha) < 0.01 ? targetAlpha : nextAlpha);
    }
  }

  private getTargetAlpha(target: ObjectOcclusionTarget): number {
    if (!target.definition.blocksMovement || !this.isInFrontOfPlayer(target.visual)) {
      return OBJECT_OCCLUSION_CONFIG.normalAlpha;
    }

    target.visual.getBounds(this.objectBounds);

    if (!Phaser.Geom.Intersects.RectangleToRectangle(this.playerBounds, this.objectBounds)) {
      return OBJECT_OCCLUSION_CONFIG.normalAlpha;
    }

    Phaser.Geom.Rectangle.Intersection(this.playerBounds, this.objectBounds, this.overlapBounds);
    const playerArea = Math.max(1, this.playerBounds.width * this.playerBounds.height);
    const overlapArea = this.overlapBounds.width * this.overlapBounds.height;
    const overlapRatio = Phaser.Math.Clamp(
      (overlapArea / playerArea) * OBJECT_OCCLUSION_CONFIG.overlapStrength,
      0,
      1,
    );

    return Phaser.Math.Linear(
      OBJECT_OCCLUSION_CONFIG.normalAlpha,
      OBJECT_OCCLUSION_CONFIG.minimumAlpha,
      overlapRatio,
    );
  }

  private isInFrontOfPlayer(visual: Phaser.GameObjects.Container): boolean {
    return visual.depth > this.player.depth + OBJECT_OCCLUSION_CONFIG.foregroundDepthMargin;
  }
}
