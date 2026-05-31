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
  | { kind: 'circle'; radiusTiles: number }
  | { kind: 'ellipse'; radiusXTiles: number; radiusYTiles: number }
  | { kind: 'cone'; rangeTiles: number; angleDeg: number; minRangeTiles?: number }
  | { kind: 'rectangle'; widthTiles: number; lengthTiles: number; minOffsetTiles?: number }
  | { kind: 'line'; lengthTiles: number; widthTiles: number; minOffsetTiles?: number };

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
  globalCooldownMs: number;
  knockback?: { forceTiles: number };
};

export type EnemyLootTableEntry = {
  itemId: string;
  count?: number; // how many to give; default 1
  weight: number; // relative probability weight within the table
};

// A loot table fires with 1/oneIn probability (oneIn:1 = always),
// then picks exactly one entry by weighted random.
export type EnemyLootTable = {
  oneIn: number;
  entries: EnemyLootTableEntry[];
};

export type EnemyBehavior = 'aggressive' | 'passive';

export type EnemyDefinition = {
  id: string;
  displayName: string;
  tier: number; // 1–10 matching skill rank scale
  maxHealth: number;
  moveSpeed: number;
  collisionRadiusTiles: number;
  aggroRangeTiles: number;
  leashRangeTiles: number;
  deAggroRangeTiles?: number; // max chase distance from player; defaults to 15 tiles
  outOfCombatRegenIntervalMs?: number; // ms between +1 HP ticks when idle; defaults to 15000
  behavior?: EnemyBehavior; // default 'aggressive' when omitted
  retreatRangeTiles?: number; // if set, wolf retreats to this distance (in attack-range tile units) after each attack
  attacks: EnemyAttackDefinition[];
  lootTables?: EnemyLootTable[];
};

export type EnemySpawnDefinition = {
  id: string;
  definitionId: string;
  mapId: string;
  tileX: number;
  tileY: number;
  respawnMs?: number;
  areaId?: string;
  lootTableId?: string;
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
  attackTargetTiles: Array<{ x: number; y: number }>;
  orbitDirection: -1 | 1;
  settleUntilMs: number;
  attackCooldownEndsAtMs: Record<string, number>;
  globalCooldownEndsAtMs: number;
  phaseStartedAtMs: number | null;
  phaseEndsAtMs: number | null;
  telegraphId: string | null;
  attackResolved: boolean;
  jumpOriginWorldX: number | null;
  jumpOriginWorldY: number | null;
  jumpLandingWorldX: number | null;
  jumpLandingWorldY: number | null;
  reactiveAggro: boolean; // passive enemies set this when hit; cleared on reset
  leashAnchorWorldX: number; // updated on hit; leash check uses this instead of origin
  leashAnchorWorldY: number;
  wanderTargetWorldX: number | null;
  wanderTargetWorldY: number | null;
  nextWanderMs: number;
  nextRegenMs: number;
};

export type EnemyUiSnapshot = {
  name: string;
  tier: number;
  state: EnemyStateId;
  health: number;
  maxHealth: number;
  activeAttackName: string | null;
};
