import type { EnemyTurnVisualState } from './EnemyVisualController';
import type { EnemyVisualId } from './EnemyTypes';

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
  animations: Record<EnemyTurnVisualState, EnemyVisualAnimationDefinition>;
};

const wolfIdle = animation('wolf', 'idle', ['Wolf', 'wolf-idle.png'], 64, 64, 0, 3, 6, -1);
const wolfRun = animation('wolf', 'run', ['Wolf', 'wolf-run.png'], 64, 64, 0, 7, 8, -1);
const wolfHowl = animation('wolf', 'windup', ['Wolf', 'wolf-howl.png'], 64, 64, 0, 8, 10, -1);
const wolfBite = animation('wolf', 'attack', ['Wolf', 'wolf-bite.png'], 64, 64, 0, 14, 14, 0);
const wolfDeath = animation('wolf', 'death', ['Wolf', 'wolf-death.png'], 64, 64, 0, 11, 10, 0);

const boarIdle = animation('boar', 'idle', ['boar', 'boar_NE_idle_strip.png'], 41, 30, 0, 6, 7, -1);
const boarRun = animation('boar', 'run', ['boar', 'boar_NE_run_strip.png'], 41, 30, 0, 3, 10, -1);

const badgerIdle = animation('badger', 'idle', ['badger', 'critter_badger_NE_idle.png'], 42, 32, 0, 21, 7, -1);
const badgerWalk = animation('badger', 'walk', ['badger', 'critter_badger_NE_walk.png'], 42, 32, 0, 8, 9, -1);
const badgerBurrow = animation('badger', 'burrow', ['badger', 'critter_badger_NE_burrow.png'], 42, 32, 0, 24, 14, 0);
const badgerTunnel = animation('badger', 'tunnel', ['badger', 'critter_badger_NE_tunnel.png'], 42, 32, 0, 4, 10, -1);

const stagIdle = animation('stag', 'idle', ['stag', 'critter_stag_NE_idle.png'], 32, 41, 0, 23, 7, -1);
const stagWalk = animation('stag', 'walk', ['stag', 'critter_stag_NE_walk.png'], 32, 41, 0, 10, 8, -1);
const stagRun = animation('stag', 'run', ['stag', 'critter_stag_NE_run.png'], 32, 41, 0, 9, 11, -1);

export const ENEMY_VISUAL_DEFINITIONS: Record<EnemyVisualId, EnemyVisualDefinition> = {
  wolf: {
    id: 'wolf',
    originX: 0.5,
    originY: 0.68,
    scale: 1.2,
    shadow: { offsetY: 0, radiusX: 22, radiusY: 9 },
    healthBarOffsetY: 38,
    animations: {
      idle: wolfIdle,
      moving: wolfRun,
      windup: wolfHowl,
      attacking: wolfBite,
      hurt: wolfIdle,
      dead: wolfDeath,
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
): string {
  return `enemy-${visualId}-${state}`;
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

function buildAssetPath(parts: string[]): string {
  return `/assets/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
}
