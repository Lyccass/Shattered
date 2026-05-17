import type { AttackTimingDefinition } from './CombatTiming';

export type EnemyStateId =
  | 'idle'
  | 'aggro'
  | 'approach'
  | 'windup'
  | 'active'
  | 'recovery'
  | 'hurt'
  | 'dead'
  | 'reset';

export type EnemyTelegraphShapeDefinition =
  | { kind: 'circle'; radiusTiles: number }
  | { kind: 'rectangle'; widthTiles: number; heightTiles: number };

export type EnemyDefinition = {
  id: string;
  displayName: string;
  maxHealth: number;
  moveSpeed: number;
  collisionRadiusTiles: number;
  attackRangeTiles: number;
  aggroRangeTiles: number;
  leashRangeTiles: number;
  attackTiming: AttackTimingDefinition;
  telegraphShape: EnemyTelegraphShapeDefinition;
  attackCooldownMs: number;
};

export type EnemySpawnDefinition = {
  id: string;
  definitionId: string;
  mapId: string;
  tileX: number;
  tileY: number;
};

export type EnemyRuntimeState = {
  id: string;
  definitionId: string;
  mapId: string;
  originTileX: number;
  originTileY: number;
  originWorldX: number;
  originWorldY: number;
  worldX: number;
  worldY: number;
  currentState: EnemyStateId;
  health: number;
  cooldownEndsAtMs: number;
  phaseEndsAtMs: number | null;
  telegraphId: string | null;
};

export type EnemyUiSnapshot = {
  name: string;
  state: EnemyStateId;
  health: number;
  maxHealth: number;
};
