import Phaser from 'phaser';

export const ENEMY_WOLF_IDLE_SHEET_KEY = 'enemy-wolf-idle-sheet';
export const ENEMY_WOLF_RUN_SHEET_KEY = 'enemy-wolf-run-sheet';
export const ENEMY_WOLF_HOWL_SHEET_KEY = 'enemy-wolf-howl-sheet';
export const ENEMY_WOLF_BITE_SHEET_KEY = 'enemy-wolf-bite-sheet';
export const ENEMY_WOLF_DEATH_SHEET_KEY = 'enemy-wolf-death-sheet';

export const ENEMY_WOLF_IDLE_ANIMATION_KEY = 'enemy-wolf-idle';
export const ENEMY_WOLF_RUN_ANIMATION_KEY = 'enemy-wolf-run';
export const ENEMY_WOLF_WINDUP_ANIMATION_KEY = 'enemy-wolf-windup';
export const ENEMY_WOLF_ATTACK_ANIMATION_KEY = 'enemy-wolf-attack';
export const ENEMY_WOLF_DEATH_ANIMATION_KEY = 'enemy-wolf-death';

const WOLF_FRAME_WIDTH = 64;
const WOLF_FRAME_HEIGHT = 64;

export function preloadEnemyAssets(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ENEMY_WOLF_IDLE_SHEET_KEY)) {
    scene.load.spritesheet(ENEMY_WOLF_IDLE_SHEET_KEY, '/assets/Wolf/wolf-idle.png', {
      frameWidth: WOLF_FRAME_WIDTH,
      frameHeight: WOLF_FRAME_HEIGHT,
    });
  }

  if (!scene.textures.exists(ENEMY_WOLF_RUN_SHEET_KEY)) {
    scene.load.spritesheet(ENEMY_WOLF_RUN_SHEET_KEY, '/assets/Wolf/wolf-run.png', {
      frameWidth: WOLF_FRAME_WIDTH,
      frameHeight: WOLF_FRAME_HEIGHT,
    });
  }

  if (!scene.textures.exists(ENEMY_WOLF_HOWL_SHEET_KEY)) {
    scene.load.spritesheet(ENEMY_WOLF_HOWL_SHEET_KEY, '/assets/Wolf/wolf-howl.png', {
      frameWidth: WOLF_FRAME_WIDTH,
      frameHeight: WOLF_FRAME_HEIGHT,
    });
  }

  if (!scene.textures.exists(ENEMY_WOLF_BITE_SHEET_KEY)) {
    scene.load.spritesheet(ENEMY_WOLF_BITE_SHEET_KEY, '/assets/Wolf/wolf-bite.png', {
      frameWidth: WOLF_FRAME_WIDTH,
      frameHeight: WOLF_FRAME_HEIGHT,
    });
  }

  if (!scene.textures.exists(ENEMY_WOLF_DEATH_SHEET_KEY)) {
    scene.load.spritesheet(ENEMY_WOLF_DEATH_SHEET_KEY, '/assets/Wolf/wolf-death.png', {
      frameWidth: WOLF_FRAME_WIDTH,
      frameHeight: WOLF_FRAME_HEIGHT,
    });
  }
}

export function createEnemyAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, ENEMY_WOLF_IDLE_ANIMATION_KEY, ENEMY_WOLF_IDLE_SHEET_KEY, 0, 3, 6, -1);
  createAnimation(scene, ENEMY_WOLF_RUN_ANIMATION_KEY, ENEMY_WOLF_RUN_SHEET_KEY, 0, 7, 8, -1);
  createAnimation(scene, ENEMY_WOLF_WINDUP_ANIMATION_KEY, ENEMY_WOLF_HOWL_SHEET_KEY, 0, 8, 10, -1);
  createAnimation(scene, ENEMY_WOLF_ATTACK_ANIMATION_KEY, ENEMY_WOLF_BITE_SHEET_KEY, 0, 14, 14, 0);
  createAnimation(scene, ENEMY_WOLF_DEATH_ANIMATION_KEY, ENEMY_WOLF_DEATH_SHEET_KEY, 0, 11, 10, 0);
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
