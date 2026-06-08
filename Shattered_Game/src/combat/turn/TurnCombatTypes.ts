export type StatusEffectKind = 'stunned' | 'slowed' | 'bleeding' | 'fortified';

export type StatusEffect = {
  kind: StatusEffectKind;
  turnsRemaining: number;
  /** bleeding: HP lost per turn start; slowed: MP reduction; fortified: defence bonus */
  value: number;
};

export type TurnParticipant = {
  id: string;
  kind: 'player' | 'enemy';
  name: string;
  tileX: number;
  tileY: number;
  hp: number;
  maxHp: number;
  apMax: number;
  mpMax: number;
  apRemaining: number;
  mpRemaining: number;
  /** Lower initiative acts first. Rolled once at combat start. */
  initiative: number;
  attackPower: number;
  /** 0-100 percentage before target defence is applied. Defaults to 80. */
  hitChance?: number;
  defensePower: number;
  attackRangeTiles: number;
  /** Weapon archetype ID for player participants */
  weaponId?: string;
  /** Enemy definition ID for enemy participants */
  definitionId?: string;
  spawnId?: string;
  areaId?: string;
  lootTableId?: string;
  statusEffects: StatusEffect[];
};

export type TurnAction =
  | { kind: 'move';    toTileX: number; toTileY: number }
  | { kind: 'attack';  targetId: string }
  | { kind: 'end_turn' }
  | { kind: 'flee' };

export type ActionOutcome =
  | { kind: 'moved';       actorId: string; fromTile: { x: number; y: number }; toTile: { x: number; y: number } }
  | { kind: 'attacked';    actorId: string; targetId: string; damage: number; hit: boolean; killed: boolean; statusApplied?: StatusEffect }
  | { kind: 'turn_ended';  actorId: string; nextParticipantId: string | null }
  | { kind: 'fled';        actorId: string }
  | { kind: 'combat_ended'; reason: CombatEndReason }
  | { kind: 'invalid';     actorId: string; reason: string };

export type TurnPhase = 'player_turn' | 'enemy_turn' | 'combat_ended';

export type CombatEndReason = 'victory' | 'player_died' | 'player_fled';

export type TurnCombatState = {
  participants: TurnParticipant[];
  /** IDs sorted by initiative ascending (fastest first). */
  turnOrderIds: string[];
  activeIndex: number;
  round: number;
  phase: TurnPhase;
  endReason?: CombatEndReason;
};

// ─── UI snapshot types ────────────────────────────────────────────────────────

export type TurnParticipantUiSnapshot = {
  id: string;
  kind: 'player' | 'enemy';
  name: string;
  hp: number;
  maxHp: number;
  apRemaining: number;
  apMax: number;
  mpRemaining: number;
  mpMax: number;
  statusEffects: StatusEffect[];
  isActive: boolean;
};

export type TurnCombatUiSnapshot = {
  active: boolean;
  phase: TurnPhase;
  round: number;
  player: TurnParticipantUiSnapshot | null;
  /** Player HP always present (persists between combats). Null until first combat. */
  playerCurrentHp: number | null;
  playerMaxHp: number | null;
  isSprinting: boolean;
  /** True while player is in "pick-a-target" attack mode. */
  isAttackMode: boolean;
  activeParticipantId: string | null;
  turnOrder: TurnParticipantUiSnapshot[];
};
