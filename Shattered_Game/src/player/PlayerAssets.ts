import Phaser from 'phaser';

export const PLAYER_TEXTURE_KEY = 'player-sheet-idle-down';
export const PLAYER_IDLE_ANIMATION_KEY = 'player-idle';
export const PLAYER_WALK_ANIMATION_KEY = 'player-walk';
export const PLAYER_WALK_UP_ANIMATION_KEY = 'player-walk-up';
export const PLAYER_SPRINT_ANIMATION_KEY = 'player-sprint';
export const PLAYER_SPRINT_UP_ANIMATION_KEY = 'player-sprint-up';
export const PLAYER_ATTACK_ANIMATION_KEY = 'player-attack';
export const PLAYER_DASH_ANIMATION_KEY = 'player-dash';
export const PLAYER_HURT_ANIMATION_KEY = 'player-hurt';
export const PLAYER_DEAD_ANIMATION_KEY = 'player-dead';

export type PlayerAnimationDirection =
  | 'down'
  | 'up'
  | 'left_down'
  | 'left_up'
  | 'right_down'
  | 'right_up';

type DirectionalAssetGroup = Record<PlayerAnimationDirection, string>;

type DirectionalAnimationDefinition = {
  baseAnimationKey: string;
  sheetKeys: DirectionalAssetGroup;
  frameRate: number;
  repeat: number;
  frames?: number[];
};

const FRAME_WIDTH = 48;
const FRAME_HEIGHT = 64;
const PLAYER_PATHS = new Map<string, string>();

const PLAYER_SHEETS = {
  idle: createDirectionalSheets('player-sheet-idle', 'Idle', {
    down: 'Idle_Down.png',
    up: 'Idle_Up.png',
    left_down: 'Idle_Left_Down.png',
    left_up: 'Idle_Left_Up.png',
    right_down: 'Idle_Right_Down.png',
    right_up: 'Idle_Right_Up.png',
  }),
  walk: createDirectionalSheets('player-sheet-walk', 'Walk', {
    down: 'walk_Down.png',
    up: 'walk_Up.png',
    left_down: 'walk_Left_Down.png',
    left_up: 'walk_Left_Up.png',
    right_down: 'walk_Right_Down.png',
    right_up: 'walk_Right_Up.png',
  }),
  dash: createDirectionalSheets('player-sheet-dash', 'Dash', {
    down: 'Dash_Down.png',
    up: 'Dash_Up.png',
    left_down: 'Dash_Left_Down.png',
    left_up: 'Dash_Left_Up.png',
    right_down: 'Dash_Right_Down.png',
    right_up: 'Dash_Right_Up.png',
  }),
  death: createDirectionalSheets('player-sheet-death', 'Death', {
    down: 'death_Down.png',
    up: 'death_Up.png',
    left_down: 'death_Left_Down.png',
    left_up: 'death_Left_Up.png',
    right_down: 'death_Right_Down.png',
    right_up: 'death_Right_Up.png',
  }),
} as const;

const PLAYER_ANIMATIONS: DirectionalAnimationDefinition[] = [
  {
    baseAnimationKey: PLAYER_IDLE_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.idle,
    frameRate: 8,
    repeat: -1,
  },
  {
    baseAnimationKey: PLAYER_WALK_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.walk,
    frameRate: 7,
    repeat: -1,
  },
  {
    baseAnimationKey: PLAYER_WALK_UP_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.walk,
    frameRate: 7,
    repeat: -1,
  },
  {
    baseAnimationKey: PLAYER_SPRINT_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.walk,
    frameRate: 10,
    repeat: -1,
  },
  {
    baseAnimationKey: PLAYER_SPRINT_UP_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.walk,
    frameRate: 10,
    repeat: -1,
  },
  {
    baseAnimationKey: PLAYER_ATTACK_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.dash,
    frameRate: 12,
    repeat: 0,
    frames: [0, 1, 2, 3, 4],
  },
  {
    baseAnimationKey: PLAYER_DASH_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.dash,
    frameRate: 18,
    repeat: 0,
  },
  {
    baseAnimationKey: PLAYER_HURT_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.idle,
    frameRate: 1,
    repeat: 0,
    frames: [0],
  },
  {
    baseAnimationKey: PLAYER_DEAD_ANIMATION_KEY,
    sheetKeys: PLAYER_SHEETS.death,
    frameRate: 10,
    repeat: 0,
  },
];

export function preloadPlayerAssets(scene: Phaser.Scene): void {
  for (const sheetKey of Object.values(PLAYER_SHEETS).flatMap((group) => Object.values(group))) {
    if (scene.textures.exists(sheetKey)) {
      continue;
    }

    scene.load.spritesheet(sheetKey, textureKeyToPath(sheetKey), {
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    });
  }
}

export function createPlayerAnimations(scene: Phaser.Scene): void {
  PLAYER_ANIMATIONS.forEach((definition) => {
    for (const direction of Object.keys(definition.sheetKeys) as PlayerAnimationDirection[]) {
      const animationKey = getPlayerDirectionalAnimationKey(definition.baseAnimationKey, direction);

      if (scene.anims.exists(animationKey)) {
        continue;
      }

      const frames = (definition.frames ?? [...Array(8).keys()]).map((frame) => ({
        key: definition.sheetKeys[direction],
        frame,
      }));

      scene.anims.create({
        key: animationKey,
        frames,
        frameRate: definition.frameRate,
        repeat: definition.repeat,
      });
    }
  });
}

export function getPlayerDirectionalAnimationKey(
  baseAnimationKey: string,
  direction: PlayerAnimationDirection,
): string {
  return `${baseAnimationKey}-${direction}`;
}

function createDirectionalSheets(
  keyPrefix: string,
  folder: string,
  filenames: Record<PlayerAnimationDirection, string>,
): DirectionalAssetGroup {
  return {
    down: registerSheet(`${keyPrefix}-down`, folder, filenames.down),
    up: registerSheet(`${keyPrefix}-up`, folder, filenames.up),
    left_down: registerSheet(`${keyPrefix}-left-down`, folder, filenames.left_down),
    left_up: registerSheet(`${keyPrefix}-left-up`, folder, filenames.left_up),
    right_down: registerSheet(`${keyPrefix}-right-down`, folder, filenames.right_down),
    right_up: registerSheet(`${keyPrefix}-right-up`, folder, filenames.right_up),
  };
}

function registerSheet(textureKey: string, folder: string, filename: string): string {
  PLAYER_PATHS.set(
    textureKey,
    buildAssetPath(['The Female Adventurer - Free', folder, filename]),
  );
  return textureKey;
}

function buildAssetPath(parts: string[]): string {
  return `/assets/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
}

function textureKeyToPath(textureKey: string): string {
  const path = PLAYER_PATHS.get(textureKey);

  if (!path) {
    throw new Error(`Unknown player texture key: ${textureKey}`);
  }

  return path;
}
