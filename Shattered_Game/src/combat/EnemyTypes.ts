import type {
  StatusEffectKind,
  TurnDamageType,
  TurnEnemyAiProfile,
  TurnEnrageConfig,
  TurnEarthPillarPhaseConfig,
  TurnForcedMovement,
  TurnTelegraphConfig,
} from './turn/TurnCombatTypes';

export type EnemyBehavior = 'aggressive' | 'passive';
export type EnemyVisualId = 'wolf' | 'boar' | 'badger' | 'stag';
export type EnemyAiProfile = TurnEnemyAiProfile;

export type EnemyLootTableEntry = {
  itemId: string;
  count?: number;
  weight: number;
};

export type EnemyLootTable = {
  oneIn: number;
  entries: EnemyLootTableEntry[];
};

export type TurnAttackDefinition = {
  id: string;
  displayName: string;
  /** AP cost to use this attack (typically 1). */
  apCost: number;
  minRangeTiles: number;
  maxRangeTiles: number;
  /** Max hit; landed damage is rolled 1–damage. Misses display as 0. */
  damage: number;
  damageType?: TurnDamageType;
  /** Attack accuracy rating before target defence, position, and height. */
  hitChance?: number;
  /** Optional status effect applied on hit. */
  statusEffect?: {
    kind: StatusEffectKind;
    turns: number;
    value: number;
  };
  /** Turns the enemy must wait before using this attack again (0 = no cooldown). */
  cooldownTurns?: number;
  telegraph?: TurnTelegraphConfig;
  forcedMovement?: TurnForcedMovement;
  staggerDamage?: number;
};

export type EnemyDefinition = {
  id: string;
  displayName: string;
  description?: string;
  visualId: EnemyVisualId;
  visualTint?: number;
  visualScaleMultiplier?: number;
  footprintSize?: 1 | 2;
  /** 1–10 display/power band. This is descriptive; combat values come from explicit stats. */
  tier: number;
  maxHealth: number;
  /** Lower initiative acts first. Used as base before the 1–6 random roll. */
  initiative: number;
  /** Movement points per turn. */
  mpPerTurn: number;
  /** Action points per turn. */
  apPerTurn: number;
  /** Typed defences used directly by hit chance resolution. Lower values are weaknesses. */
  slashDefence: number;
  pierceDefence: number;
  crushDefence: number;
  lightningDefence: number;
  fireDefence: number;
  coldDefence: number;
  poisonDefence: number;
  /** Pixel speed used for visual move tweens. */
  moveSpeed: number;
  collisionRadiusTiles: number;
  /** Tile radius at which this enemy will enter combat when walking past. */
  aggroRangeTiles: number;
  /** Max tiles the enemy can be from its spawn before the encounter ends. */
  leashRangeTiles: number;
  /** 'aggressive' attacks on sight; 'passive' only reacts when combat is triggered. */
  behavior?: EnemyBehavior;
  aiProfile?: EnemyAiProfile;
  enrage?: TurnEnrageConfig;
  earthPillarPhase?: TurnEarthPillarPhaseConfig;
  attacks: TurnAttackDefinition[];
  lootTables?: EnemyLootTable[];
};

// Spawn / runtime types

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

/** Minimal runtime record kept by EnemySystem for visual + combat tracking. */
export type EnemyRuntimeRecord = {
  id: string;
  definitionId: string;
  mapId: string;
  spawnTileX: number;
  spawnTileY: number;
  /** Current tile position (may differ from spawn while wandering or in combat). */
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  hp: number;
  maxHp: number;
  /** Whether this enemy is currently participating in a turn combat session. */
  inCombat: boolean;
  /** Wall-clock time this enemy died (null = alive). */
  diedAtMs: number | null;
  respawnMs: number;
  /** Encounter area this spawn belongs to — used for population tracking. */
  areaId?: string;
  /** Wander target tile when idle roaming (null = waiting at current position). */
  wanderTarget: { tileX: number; tileY: number } | null;
  /** Wall-clock time to pick the next wander target. */
  nextWanderMs: number;
};

export type EnemyUiSnapshot = {
  name: string;
  tier: number;
  hp: number;
  maxHp: number;
};
