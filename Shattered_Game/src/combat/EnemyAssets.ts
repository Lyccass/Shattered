import Phaser from 'phaser';
import {
  ENEMY_VISUAL_DEFINITIONS,
  listEnemyVisualAnimations,
} from './EnemyVisualDefinitions';

export const ENEMY_WOLF_IDLE_SHEET_KEY = 'enemy-wolf-idle-sheet';
export const ENEMY_WOLF_RUN_SHEET_KEY = 'enemy-wolf-run-sheet';
export const ENEMY_WOLF_HOWL_SHEET_KEY = 'enemy-wolf-windup-sheet';
export const ENEMY_WOLF_BITE_SHEET_KEY = 'enemy-wolf-attack-sheet';
export const ENEMY_WOLF_DEATH_SHEET_KEY = 'enemy-wolf-death-sheet';

export const ENEMY_WOLF_IDLE_ANIMATION_KEY = 'enemy-wolf-idle';
export const ENEMY_WOLF_RUN_ANIMATION_KEY = 'enemy-wolf-run';
export const ENEMY_WOLF_WINDUP_ANIMATION_KEY = 'enemy-wolf-windup';
export const ENEMY_WOLF_ATTACK_ANIMATION_KEY = 'enemy-wolf-attack';
export const ENEMY_WOLF_DEATH_ANIMATION_KEY = 'enemy-wolf-death';

export function preloadEnemyAssets(scene: Phaser.Scene): void {
  const loadedSheets = new Set<string>();

  for (const visual of Object.values(ENEMY_VISUAL_DEFINITIONS)) {
    for (const { animation } of listEnemyVisualAnimations(visual)) {
      if (loadedSheets.has(animation.sheetKey) || scene.textures.exists(animation.sheetKey)) {
        continue;
      }

      loadedSheets.add(animation.sheetKey);
      scene.load.spritesheet(animation.sheetKey, animation.path, {
        frameWidth: animation.frameWidth,
        frameHeight: animation.frameHeight,
      });
    }
  }
}

export function createEnemyAnimations(scene: Phaser.Scene): void {
  for (const visual of Object.values(ENEMY_VISUAL_DEFINITIONS)) {
    for (const { key, animation } of listEnemyVisualAnimations(visual)) {
      createAnimation(
        scene,
        key,
        animation.sheetKey,
        animation.start,
        animation.end,
        animation.frameRate,
        animation.repeat,
      );
    }
  }
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  textureKey: string,
  start: number,
  end: number,
  frameRate: number,
  repeat: number,
): void {
  if (scene.anims.exists(key)) {
    return;
  }

  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(textureKey, { start, end }),
    frameRate,
    repeat,
  });
}
