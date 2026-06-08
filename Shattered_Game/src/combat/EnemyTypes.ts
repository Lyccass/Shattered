import type { StatusEffectKind } from './turn/TurnCombatTypes';

export type EnemyBehavior = 'aggressive' | 'passive';

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
  /** Max hit; damage is rolled 0–damage (OSRS-style). */
  damage: number;
  /** 0–100 percentage. Defaults to 80 when omitted. */
  hitChance?: number;
  /** Optional status effect applied on hit. */
  statusEffect?: {
    kind: StatusEffectKind;
    turns: number;
    value: number;
  };
  /** Turns the enemy must wait before using this attack again (0 = no cooldown). */
  cooldownTurns?: number;
};

export type EnemyDefinition = {
  id: string;
  displayName: string;
  /** 1–10 matching skill rank scale. */
  tier: number;
  maxHealth: number;
  /** Lower initiative acts first. Used as base before the 1–6 random roll. */
  initiative: number;
  /** Movement points per turn. */
  mpPerTurn: number;
  /** Action points per turn. */
  apPerTurn: number;
  /** Base defence (each point reduces enemy hit chance by 5%, min 10%). */
  defense: number;
  /** Pixel speed used for visual move tweens. */
  moveSpeed: number;
  collisionRadiusTiles: number;
  /** Tile radius at which this enemy will enter combat when walking past. */
  aggroRangeTiles: number;
  /** Max tiles the enemy can be from its spawn before the encounter ends. */
  leashRangeTiles: number;
  /** 'aggressive' attacks on sight; 'passive' only reacts when combat is triggered. */
  behavior?: EnemyBehavior;
  attacks: TurnAttackDefinition[];
  lootTables?: EnemyLootTable[];
};

// ─── Spawn / runtime types ────────────────────────────────────────────────────

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
  /** Current tile position (may differ from spawn while in combat). */
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
};

export type EnemyUiSnapshot = {
  name: string;
  tier: number;
  hp: number;
  maxHp: number;
};
