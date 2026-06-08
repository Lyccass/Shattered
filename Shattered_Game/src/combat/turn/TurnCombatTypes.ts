export type TurnDamageType = 'slash' | 'pierce' | 'crush';

export type StatusEffectKind =
  | 'stunned'
  | 'slowed'
  | 'bleeding'
  | 'damage_over_time'
  | 'guarded'
  | 'fortified';

export type StatusEffect = {
  kind: StatusEffectKind;
  turnsRemaining: number;
  /** bleeding: HP lost per turn start; slowed: MP reduction; fortified: defence bonus */
  value: number;
};

export type TurnAttack = {
  id: string;
  displayName: string;
  apCost: number;
  minRangeTiles: number;
  maxRangeTiles: number;
  damage: number;
  damageType?: TurnDamageType;
  hitCount?: number;
  /** Prevents reusing this attack again until this actor's next turn. */
  oncePerTurn?: boolean;
  /** 0-100 percentage before target defence is applied. Defaults to 80. */
  hitChance?: number;
  statusEffect?: {
    kind: StatusEffectKind;
    turns: number;
    value: number;
  };
  /** Number of actor turns that must pass before this attack can be reused. */
  cooldownTurns?: number;
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
  secondaryActionMax?: number;
  secondaryActionRemaining?: number;
  /** Lower initiative acts first. Rolled once at combat start. */
  initiative: number;
  attackPower: number;
  /** 0-100 percentage before target defence is applied. Defaults to 80. */
  hitChance?: number;
  defensePower: number;
  slashDefence?: number;
  pierceDefence?: number;
  crushDefence?: number;
  attackRangeTiles: number;
  attacks?: TurnAttack[];
  attackCooldowns?: Record<string, number>;
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
  | { kind: 'attack';  targetId: string; attackId?: string }
  | { kind: 'guard' }
  | { kind: 'end_turn' }
  | { kind: 'flee' };

export type ActionOutcome =
  | { kind: 'moved';       actorId: string; fromTile: { x: number; y: number }; toTile: { x: number; y: number } }
  | { kind: 'attacked';    actorId: string; targetId: string; attackId: string; attackName: string; damage: number; hit: boolean; killed: boolean; statusApplied?: StatusEffect }
  | { kind: 'guarded';     actorId: string; statusApplied: StatusEffect }
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
  secondaryActionRemaining: number;
  secondaryActionMax: number;
  statusEffects: StatusEffect[];
  attacks: TurnAttackUiSnapshot[];
  attackCooldowns: Record<string, number>;
  isActive: boolean;
};

export type TurnAttackUiSnapshot = {
  id: string;
  displayName: string;
  apCost: number;
  minRangeTiles: number;
  maxRangeTiles: number;
  cooldownRemaining: number;
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
  selectedAttackId: string | null;
  activeParticipantId: string | null;
  turnOrder: TurnParticipantUiSnapshot[];
};
