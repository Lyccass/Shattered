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
  | { kind: 'ellipse'; radiusXTiles: number; radiusYTiles: number }
  | { kind: 'rectangle'; widthTiles: number; heightTiles: number };

export type EnemyAttackTelegraphDefinition =
  | { kind: 'ellipse'; radiusXTiles: number; radiusYTiles: number }
  | { kind: 'cone'; rangeTiles: number; angleDeg: number }
  | { kind: 'rectangle'; widthTiles: number; lengthTiles: number };

export type EnemyAttackDefinition = {
  id: string;
  displayName: string;
  kind: 'jump' | 'cone' | 'stab' | 'pulse';
  minRangeTiles: number;
  maxRangeTiles: number;
  damage: number;
  timing: AttackTimingDefinition;
  telegraph: EnemyAttackTelegraphDefinition;
  cooldownMs: number;
};

export type EnemyDefinition = {
  id: string;
  displayName: string;
  maxHealth: number;
  moveSpeed: number;
  collisionRadiusTiles: number;
  aggroRangeTiles: number;
  leashRangeTiles: number;
  attacks: EnemyAttackDefinition[];
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
  facingRad: number;
  currentAttackId: string | null;
  attackTargetWorldX: number | null;
  attackTargetWorldY: number | null;
  attackRotationRad: number | null;
  attackCooldownEndsAtMs: Record<string, number>;
  phaseStartedAtMs: number | null;
  phaseEndsAtMs: number | null;
  telegraphId: string | null;
};

export type EnemyUiSnapshot = {
  name: string;
  state: EnemyStateId;
  health: number;
  maxHealth: number;
  activeAttackName: string | null;
};
