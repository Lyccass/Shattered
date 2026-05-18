import Phaser from 'phaser';

export const PLAYER_TEXTURE_KEY = 'player-idle-1';
export const PLAYER_IDLE_ANIMATION_KEY = 'player-idle';
export const PLAYER_WALK_ANIMATION_KEY = 'player-walk';
export const PLAYER_WALK_UP_ANIMATION_KEY = 'player-walk-up';
export const PLAYER_SPRINT_ANIMATION_KEY = 'player-sprint';
export const PLAYER_SPRINT_UP_ANIMATION_KEY = 'player-sprint-up';
export const PLAYER_ATTACK_ANIMATION_KEY = 'player-attack';
export const PLAYER_DASH_ANIMATION_KEY = 'player-dash';
export const PLAYER_HURT_ANIMATION_KEY = 'player-hurt';
export const PLAYER_DEAD_ANIMATION_KEY = 'player-dead';

const PLAYER_PATHS = new Map<string, string>();

type PlayerAnimationDefinition = {
  animationKey: string;
  textureKeys: string[];
  frameRate: number;
  repeat: number;
};

const PLAYER_FRAME_GROUPS = {
  idle: createFrameKeys('player-idle', 'idle', 'Warrior_Idle_', 6),
  walk: createFrameKeys('player-walk', 'Crouch', 'Warrior_Crouch_', 6),
  walkUp: createFrameKeys('player-walk-up', 'Ladder-Grab', 'Warrior-Ladder-Grab_', 8),
  run: createFrameKeys('player-run', 'Run', 'Warrior_Run_', 8),
  attack: createFrameKeys('player-attack', 'Dash-Attack_noDust', 'Warrior_Dash-Attack_', 10),
  dash: createFrameKeys('player-dash', 'Dash_NoDust', 'Warrior_Dash_', 7),
  hurt: createFrameKeys('player-hurt', 'HurtnoEffect', 'Warrior_hurt_', 4),
  dead: createFrameKeys('player-dead', 'DeathnoEffect', 'Warrior_Death_', 11),
} as const;

const PLAYER_ANIMATIONS: PlayerAnimationDefinition[] = [
  {
    animationKey: PLAYER_IDLE_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.idle,
    frameRate: 8,
    repeat: -1,
  },
  {
    animationKey: PLAYER_WALK_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.run,
    frameRate: 7,
    repeat: -1,
  },
  {
    animationKey: PLAYER_WALK_UP_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.walkUp,
    frameRate: 10,
    repeat: -1,
  },
  {
    animationKey: PLAYER_SPRINT_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.run,
    frameRate: 9,
    repeat: -1,
  },
  {
    animationKey: PLAYER_SPRINT_UP_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.walkUp,
    frameRate: 14,
    repeat: -1,
  },
  {
    animationKey: PLAYER_ATTACK_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.attack.slice(0, 6),
    frameRate: 22,
    repeat: 0,
  },
  {
    animationKey: PLAYER_DASH_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.dash,
    frameRate: 24,
    repeat: 0,
  },
  {
    animationKey: PLAYER_HURT_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.hurt,
    frameRate: 14,
    repeat: 0,
  },
  {
    animationKey: PLAYER_DEAD_ANIMATION_KEY,
    textureKeys: PLAYER_FRAME_GROUPS.dead,
    frameRate: 10,
    repeat: 0,
  },
];

export function preloadPlayerAssets(scene: Phaser.Scene): void {
  for (const textureKey of Object.values(PLAYER_FRAME_GROUPS).flat()) {
    if (scene.textures.exists(textureKey)) {
      continue;
    }

    scene.load.image(textureKey, textureKeyToPath(textureKey));
  }
}

export function createPlayerAnimations(scene: Phaser.Scene): void {
  PLAYER_ANIMATIONS.forEach((definition) => {
    if (scene.anims.exists(definition.animationKey)) {
      return;
    }

    scene.anims.create({
      key: definition.animationKey,
      frames: definition.textureKeys.map((textureKey) => ({ key: textureKey })),
      frameRate: definition.frameRate,
      repeat: definition.repeat,
    });
  });
}

function createFrameKeys(
  keyPrefix: string,
  folder: string,
  filePrefix: string,
  frameCount: number,
): string[] {
  return Array.from({ length: frameCount }, (_value, index) => {
    const frameNumber = index + 1;
    return `${keyPrefix}-${frameNumber}`;
  }).map((textureKey, index) => {
    const frameNumber = index + 1;
    PLAYER_PATHS.set(
      textureKey,
      `/assets/Warrior/Individual%20Sprite/${encodeURIComponent(folder)}/${filePrefix}${frameNumber}.png`,
    );
    return textureKey;
  });
}

function textureKeyToPath(textureKey: string): string {
  const path = PLAYER_PATHS.get(textureKey);

  if (!path) {
    throw new Error(`Unknown player texture key: ${textureKey}`);
  }

  return path;
}
