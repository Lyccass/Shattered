import Phaser from 'phaser';
import { CAMERA_CONFIG } from '../config/cameraConfig';

type CameraSystemConfig = {
  scene: Phaser.Scene;
  camera: Phaser.Cameras.Scene2D.Camera;
  bounds: Phaser.Geom.Rectangle;
  followTarget: Phaser.GameObjects.GameObject;
};

export class CameraSystem {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly zoomSteps = CAMERA_CONFIG.zoomSteps;

  private lastWheelAt = 0;
  private zoomIndex = 0;
  private zoomTween?: Phaser.Tweens.Tween;

  private readonly handlePostUpdate = (): void => {
    this.snapCameraToPixelGrid();
  };

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.camera.setViewport(0, 0, gameSize.width, gameSize.height);
    this.clampCameraScroll();
    this.snapCameraToPixelGrid();
  };

  private readonly handleWheel = (
    _pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    const now = this.scene.time.now;

    if (now - this.lastWheelAt < CAMERA_CONFIG.wheelCooldownMs) {
      return;
    }

    this.lastWheelAt = now;

    if (deltaY < 0) {
      this.zoomIn();
      return;
    }

    if (deltaY > 0) {
      this.zoomOut();
    }
  };

  constructor({ scene, camera, bounds, followTarget }: CameraSystemConfig) {
    this.scene = scene;
    this.camera = camera;

    this.camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.camera.startFollow(followTarget, true, CAMERA_CONFIG.followLerp, CAMERA_CONFIG.followLerp);
    this.camera.setRoundPixels(true);

    this.registerWheelZoom();
    this.registerPixelSnap();

    this.setZoom(CAMERA_CONFIG.defaultZoom, false);
  }

  destroy(): void {
    this.zoomTween?.stop();
    this.scene.input.off('wheel', this.handleWheel);
    this.scene.scale.off('resize', this.handleResize);
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.handlePostUpdate);
  }

  getZoom(): number {
    return this.camera.zoom;
  }

  setBounds(bounds: Phaser.Geom.Rectangle): void {
    this.camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.camera.scrollX = this.camera.clampX(this.camera.scrollX);
    this.camera.scrollY = this.camera.clampY(this.camera.scrollY);
  }

  cycleZoom(): void {
    this.zoomIndex = (this.zoomIndex + 1) % this.zoomSteps.length;
    this.setZoom(this.zoomSteps[this.zoomIndex]);
  }

  zoomIn(): void {
    this.zoomIndex = Math.min(this.zoomIndex + 1, this.zoomSteps.length - 1);
    this.setZoom(this.zoomSteps[this.zoomIndex]);
  }

  zoomOut(): void {
    this.zoomIndex = Math.max(this.zoomIndex - 1, 0);
    this.setZoom(this.zoomSteps[this.zoomIndex]);
  }

  private setZoom(zoom: number, smooth = true): void {
    const clampedZoom = Phaser.Math.Clamp(zoom, CAMERA_CONFIG.minZoom, CAMERA_CONFIG.maxZoom);
    this.zoomIndex = this.findClosestZoomIndex(clampedZoom);

    this.zoomTween?.stop();

    if (!smooth) {
      this.camera.setZoom(clampedZoom);
      this.snapCameraToPixelGrid();
      this.clampCameraScroll();
      return;
    }

    this.zoomTween = this.scene.tweens.add({
      targets: this.camera,
      zoom: clampedZoom,
      duration: CAMERA_CONFIG.zoomTweenMs,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.snapCameraToPixelGrid();
        this.clampCameraScroll();
      },
      onComplete: () => {
        this.camera.setZoom(clampedZoom);
        this.snapCameraToPixelGrid();
        this.clampCameraScroll();
        this.zoomTween = undefined;
      },
    });
  }

  private registerPixelSnap(): void {
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.handlePostUpdate);
    this.scene.scale.on('resize', this.handleResize);
  }

  private registerWheelZoom(): void {
    this.scene.input.on('wheel', this.handleWheel);
  }

  private snapCameraToPixelGrid(): void {
    const zoom = this.camera.zoom;

    this.camera.scrollX = Math.round(this.camera.scrollX * zoom) / zoom;
    this.camera.scrollY = Math.round(this.camera.scrollY * zoom) / zoom;
  }

  private clampCameraScroll(): void {
    this.camera.scrollX = this.camera.clampX(this.camera.scrollX);
    this.camera.scrollY = this.camera.clampY(this.camera.scrollY);
  }

  private findClosestZoomIndex(zoom: number): number {
    return this.zoomSteps.reduce((closestIndex, candidateZoom, candidateIndex) => {
      const closestDistance = Math.abs(this.zoomSteps[closestIndex] - zoom);
      const candidateDistance = Math.abs(candidateZoom - zoom);

      return candidateDistance < closestDistance ? candidateIndex : closestIndex;
    }, 0);
  }
}
