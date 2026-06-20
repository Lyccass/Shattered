import type { EnemyTurnVisualState } from './EnemyVisualController';
import type { EnemyVisualId } from './EnemyTypes';

export type EnemyVisualDirection = 'NE' | 'NW' | 'SE' | 'SW';

export type EnemyVisualAnimationDefinition = {
  sheetKey: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  start: number;
  end: number;
  frameRate: number;
  repeat: number;
};

export type EnemyVisualAnimationSet =
  | { kind: 'single'; animation: EnemyVisualAnimationDefinition }
  | { kind: 'directional'; animations: Record<EnemyVisualDirection, EnemyVisualAnimationDefinition> };

type DirectionalFrameSize =
  | { width: number; height: number }
  | Record<EnemyVisualDirection, { width: number; height: number }>;

const DIRECTIONS: EnemyVisualDirection[] = ['NE', 'NW', 'SE', 'SW'];

export type EnemyVisualDefinition = {
  id: EnemyVisualId;
  originX: number;
  originY: number;
  scale: number;
  shadow: {
    offsetY: number;
    radiusX: number;
    radiusY: number;
  };
  healthBarOffsetY: number;
  animations: Record<EnemyTurnVisualState, EnemyVisualAnimationSet>;
};

const wolfIdle = animation('wolf', 'idle', ['Wolf', 'wolf-idle.png'], 64, 64, 0, 3, 6, -1);
const wolfRun = animation('wolf', 'run', ['Wolf', 'wolf-run.png'], 64, 64, 0, 7, 8, -1);
const wolfHowl = animation('wolf', 'windup', ['Wolf', 'wolf-howl.png'], 64, 64, 0, 8, 10, -1);
const wolfBite = animation('wolf', 'attack', ['Wolf', 'wolf-bite.png'], 64, 64, 0, 14, 14, 0);
const wolfDeath = animation('wolf', 'death', ['Wolf', 'wolf-death.png'], 64, 64, 0, 11, 10, 0);

const boarIdle = directional('boar', 'idle', 'boar_{dir}_idle_strip.png', {
  NE: { width: 41, height: 30 },
  NW: { width: 40, height: 30 },
  SE: { width: 41, height: 25 },
  SW: { width: 41, height: 25 },
}, 0, 6, 7, -1);
const boarRun = directional('boar', 'run', 'boar_{dir}_run_strip.png', {
  NE: { width: 41, height: 30 },
  NW: { width: 40, height: 30 },
  SE: { width: 41, height: 25 },
  SW: { width: 41, height: 25 },
}, 0, 3, 10, -1);

const badgerIdle = directional('badger', 'idle', 'critter_badger_{dir}_idle.png', { width: 42, height: 32 }, 0, 21, 7, -1);
const badgerWalk = directional('badger', 'walk', 'critter_badger_{dir}_walk.png', { width: 42, height: 32 }, 0, 8, 9, -1);
const badgerBurrow = directional('badger', 'burrow', 'critter_badger_{dir}_burrow.png', { width: 42, height: 32 }, 0, 24, 14, 0);
const badgerTunnel = directional('badger', 'tunnel', 'critter_badger_{dir}_tunnel.png', { width: 42, height: 32 }, 0, 4, 10, -1);

const stagIdle = directional('stag', 'idle', 'critter_stag_{dir}_idle.png', { width: 32, height: 41 }, 0, 23, 7, -1);
const stagWalk = directional('stag', 'walk', 'critter_stag_{dir}_walk.png', { width: 32, height: 41 }, 0, 10, 8, -1);
const stagRun = directional('stag', 'run', 'critter_stag_{dir}_run.png', { width: 32, height: 41 }, 0, 9, 11, -1);

export const ENEMY_VISUAL_DEFINITIONS: Record<EnemyVisualId, EnemyVisualDefinition> = {
  wolf: {
    id: 'wolf',
    originX: 0.5,
    originY: 0.68,
    scale: 1.2,
    shadow: { offsetY: 0, radiusX: 22, radiusY: 9 },
    healthBarOffsetY: 38,
    animations: {
      idle: single(wolfIdle),
      moving: single(wolfRun),
      windup: single(wolfHowl),
      attacking: single(wolfBite),
      hurt: single(wolfIdle),
      dead: single(wolfDeath),
    },
  },
  boar: {
    id: 'boar',
    originX: 0.5,
    originY: 0.74,
    scale: 1.35,
    shadow: { offsetY: 1, radiusX: 18, radiusY: 8 },
    healthBarOffsetY: 28,
    animations: {
      idle: boarIdle,
      moving: boarRun,
      windup: boarIdle,
      attacking: boarRun,
      hurt: boarIdle,
      dead: boarIdle,
    },
  },
  badger: {
    id: 'badger',
    originX: 0.5,
    originY: 0.75,
    scale: 1.28,
    shadow: { offsetY: 1, radiusX: 16, radiusY: 7 },
    healthBarOffsetY: 28,
    animations: {
      idle: badgerIdle,
      moving: badgerWalk,
      windup: badgerBurrow,
      attacking: badgerTunnel,
      hurt: badgerIdle,
      dead: badgerIdle,
    },
  },
  stag: {
    id: 'stag',
    originX: 0.5,
    originY: 0.76,
    scale: 1.35,
    shadow: { offsetY: 1, radiusX: 18, radiusY: 8 },
    healthBarOffsetY: 36,
    animations: {
      idle: stagIdle,
      moving: stagWalk,
      windup: stagIdle,
      attacking: stagRun,
      hurt: stagIdle,
      dead: stagIdle,
    },
  },
};

export function getEnemyVisualDefinition(id: EnemyVisualId): EnemyVisualDefinition {
  return ENEMY_VISUAL_DEFINITIONS[id];
}

export function getEnemyAnimationKey(
  visualId: EnemyVisualId,
  state: EnemyTurnVisualState,
  direction?: EnemyVisualDirection,
): string {
  return direction ? `enemy-${visualId}-${state}-${direction}` : `enemy-${visualId}-${state}`;
}

export function resolveEnemyAnimation(
  visual: EnemyVisualDefinition,
  state: EnemyTurnVisualState,
  direction: EnemyVisualDirection,
): { key: string; animation: EnemyVisualAnimationDefinition; directional: boolean } {
  const set = visual.animations[state];
  if (set.kind === 'single') {
    return {
      key: getEnemyAnimationKey(visual.id, state),
      animation: set.animation,
      directional: false,
    };
  }

  return {
    key: getEnemyAnimationKey(visual.id, state, direction),
    animation: set.animations[direction],
    directional: true,
  };
}

export function listEnemyVisualAnimations(
  visual: EnemyVisualDefinition,
): Array<{ key: string; animation: EnemyVisualAnimationDefinition }> {
  const results: Array<{ key: string; animation: EnemyVisualAnimationDefinition }> = [];
  for (const [state, set] of Object.entries(visual.animations) as Array<[EnemyTurnVisualState, EnemyVisualAnimationSet]>) {
    if (set.kind === 'single') {
      results.push({ key: getEnemyAnimationKey(visual.id, state), animation: set.animation });
      continue;
    }

    for (const [direction, animationDefinition] of Object.entries(set.animations) as Array<[EnemyVisualDirection, EnemyVisualAnimationDefinition]>) {
      results.push({
        key: getEnemyAnimationKey(visual.id, state, direction),
        animation: animationDefinition,
      });
    }
  }
  return results;
}

function animation(
  visualId: EnemyVisualId,
  id: string,
  pathParts: string[],
  frameWidth: number,
  frameHeight: number,
  start: number,
  end: number,
  frameRate: number,
  repeat: number,
): EnemyVisualAnimationDefinition {
  return {
    sheetKey: `enemy-${visualId}-${id}-sheet`,
    path: buildAssetPath(pathParts),
    frameWidth,
    frameHeight,
    start,
    end,
    frameRate,
    repeat,
  };
}

function single(animationDefinition: EnemyVisualAnimationDefinition): EnemyVisualAnimationSet {
  return { kind: 'single', animation: animationDefinition };
}

function directional(
  visualId: EnemyVisualId,
  id: string,
  filenamePattern: string,
  frameSize: DirectionalFrameSize,
  start: number,
  end: number,
  frameRate: number,
  repeat: number,
): EnemyVisualAnimationSet {
  const animations = DIRECTIONS.reduce((acc, direction) => {
    const size = isPerDirectionSize(frameSize) ? frameSize[direction] : frameSize;
    acc[direction] = animation(
      visualId,
      `${id}-${direction}`,
      [visualId, filenamePattern.replace('{dir}', direction)],
      size.width,
      size.height,
      start,
      end,
      frameRate,
      repeat,
    );
    return acc;
  }, {} as Record<EnemyVisualDirection, EnemyVisualAnimationDefinition>);

  return { kind: 'directional', animations };
}

function isPerDirectionSize(frameSize: DirectionalFrameSize): frameSize is Record<EnemyVisualDirection, { width: number; height: number }> {
  return 'NE' in frameSize;
}

function buildAssetPath(parts: string[]): string {
  return `/assets/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
}
