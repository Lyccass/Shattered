export type TurnDamageType = 'slash' | 'pierce' | 'crush' | 'lightning' | 'fire' | 'cold' | 'poison';
export type TurnAbilityKind = 'combat_spell' | 'devotion';
export type TurnAbilityTarget = 'enemy' | 'self';

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

export type TurnForcedMovement = {
  kind: 'push' | 'pull';
  distance: number;
};

export type TurnTelegraphConfig = {
  pattern: 'target' | 'target_plus_adjacent' | 'line' | 'cone' | 'ring';
  warningDamageMultiplier?: number;
  /** line: max tiles to extend past actor (defaults to actor→target distance) */
  length?: number;
  /** cone: full angle in degrees (default 90) */
  angleDeg?: number;
  /** ring: ring radius in tiles (default 2) */
  radius?: number;
};

export type TurnTelegraphTile = {
  x: number;
  y: number;
  intensity: 'danger' | 'warning';
  damageMultiplier: number;
};

export type PendingTurnTelegraph = {
  id: string;
  actorId: string;
  targetId: string;
  attackId: string;
  attackName: string;
  damage: number;
  damageType?: TurnDamageType;
  hitChance?: number;
  statusEffect?: {
    kind: StatusEffectKind;
    turns: number;
    value: number;
  };
  forcedMovement?: TurnForcedMovement;
  originTile: { x: number; y: number };
  targetTile: { x: number; y: number };
  tiles: TurnTelegraphTile[];
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
  /** Attack accuracy rating before target defence, position, and height. Defaults to 80. */
  hitChance?: number;
  statusEffect?: {
    kind: StatusEffectKind;
    turns: number;
    value: number;
  };
  /** Number of actor turns that must pass before this attack can be reused. */
  cooldownTurns?: number;
  /** If present, this attack marks ground now and resolves on the actor's next turn. */
  telegraph?: TurnTelegraphConfig;
  forcedMovement?: TurnForcedMovement;
  /** Adds to target stagger on hit. Crossing target threshold applies stunned. */
  staggerDamage?: number;
};

export type TurnCombatAbility = {
  id: string;
  displayName: string;
  kind: TurnAbilityKind;
  target: TurnAbilityTarget;
  apCost: number;
  minRangeTiles?: number;
  maxRangeTiles?: number;
  damage?: number;
  damageType?: TurnDamageType;
  healAmount?: number;
  magicCost?: number;
  devotionCost?: number;
  cooldownTurns?: number;
  hitChance?: number;
  statusEffect?: {
    kind: StatusEffectKind;
    turns: number;
    value: number;
  };
};

export type TurnParticipant = {
  id: string;
  kind: 'player' | 'enemy' | 'companion';
  name: string;
  tileX: number;
  tileY: number;
  facingX?: -1 | 0 | 1;
  facingY?: -1 | 0 | 1;
  hp: number;
  maxHp: number;
  apMax: number;
  mpMax: number;
  apRemaining: number;
  mpRemaining: number;
  magicResourceMax?: number;
  magicResourceRemaining?: number;
  devotionResourceMax?: number;
  devotionResourceRemaining?: number;
  reactionRemaining?: number;
  secondaryActionMax?: number;
  secondaryActionRemaining?: number;
  /** Lower initiative acts first. Rolled once at combat start. */
  initiative: number;
  attackPower: number;
  /** Weapon/attack accuracy before target defence, position, and height. */
  hitChance?: number;
  /** Poise — reduces stagger build-up per hit. */
  poise?: number;
  slashDefence: number;
  pierceDefence: number;
  crushDefence: number;
  lightningDefence: number;
  fireDefence: number;
  coldDefence: number;
  poisonDefence: number;
  attackRangeTiles: number;
  attacks?: TurnAttack[];
  attackCooldowns?: Record<string, number>;
  abilities?: TurnCombatAbility[];
  abilityCooldowns?: Record<string, number>;
  stagger?: number;
  staggerThreshold?: number;
  bleedMovementTiles?: number;
  /** Weapon archetype ID for player participants */
  weaponId?: string;
  /** Enemy definition ID for enemy participants */
  definitionId?: string;
  spawnId?: string;
  areaId?: string;
  lootTableId?: string;
  /** Which companion slot this participant occupies (companion kind only) */
  companionSlot?: 'companion_1' | 'companion_2' | 'companion_3';
  statusEffects: StatusEffect[];
};

export type TurnAction =
  | { kind: 'move';         toTileX: number; toTileY: number }
  | { kind: 'attack';       targetId: string; attackId?: string }
  | { kind: 'use_ability';  abilityId: string; targetId?: string }
  | { kind: 'guard' }
  | { kind: 'cleanse' }
  | { kind: 'consume_item'; itemId: string; healAmount: number }
  | { kind: 'end_turn' }
  | { kind: 'flee' };

export type TurnStatusTickOutcome = {
  kind: 'status_tick';
  targetId: string;
  effectKind: StatusEffectKind;
  damage: number;
  killed: boolean;
};

export type TurnAttackOutcome = {
  kind: 'attacked';
  actorId: string;
  targetId: string;
  attackId: string;
  attackName: string;
  damage: number;
  hit: boolean;
  killed: boolean;
  statusApplied?: StatusEffect;
  pushed?: TurnPushResult;
  reaction?: boolean;
  hitChance?: number;
  positionalModifier?: number;
  heightModifier?: number;
  positionalMultiplier?: number;
  heightMultiplier?: number;
};

export type ActionOutcome =
  | { kind: 'moved';       actorId: string; fromTile: { x: number; y: number }; toTile: { x: number; y: number }; path?: { x: number; y: number }[]; reactions?: TurnAttackOutcome[] }
  | TurnAttackOutcome
  | { kind: 'ability_used'; actorId: string; abilityId: string; abilityName: string; abilityKind: TurnAbilityKind; targetId: string; damage?: number; healAmount?: number; newHp?: number; hit?: boolean; killed?: boolean; statusApplied?: StatusEffect; hitChance?: number; positionalModifier?: number; heightModifier?: number; positionalMultiplier?: number; heightMultiplier?: number }
  | { kind: 'telegraph_prepared'; actorId: string; targetId: string; attackId: string; attackName: string; telegraphId: string; tiles: TurnTelegraphTile[] }
  | { kind: 'telegraph_resolved'; actorId: string; targetId: string; attackId: string; attackName: string; damage: number; hit: boolean; killed: boolean; targetWasInArea: boolean; statusApplied?: StatusEffect; pushed?: TurnPushResult; actorMoved?: TurnPushResult; hitChance?: number; positionalModifier?: number; heightModifier?: number; positionalMultiplier?: number; heightMultiplier?: number }
  | TurnStatusTickOutcome
  | { kind: 'guarded';      actorId: string; statusApplied: StatusEffect }
  | { kind: 'cleansed';     actorId: string; removedEffect: StatusEffect }
  | { kind: 'item_consumed'; actorId: string; itemId: string; healAmount: number; newHp: number }
  | { kind: 'turn_ended';  actorId: string; nextParticipantId: string | null; statusTicks?: TurnStatusTickOutcome[]; statusExpired?: Array<{ participantId: string; effectKind: StatusEffectKind }> }
  | { kind: 'fled';        actorId: string }
  | { kind: 'combat_ended'; reason: CombatEndReason; statusTicks?: TurnStatusTickOutcome[] }
  | { kind: 'invalid';     actorId: string; reason: string };

export type TurnPushResult = {
  targetId: string;
  fromTile: { x: number; y: number };
  toTile: { x: number; y: number };
};

export type TurnPhase = 'player_turn' | 'enemy_turn' | 'combat_ended';

export type CombatEndReason = 'victory' | 'player_died' | 'player_fled';

export type TurnCombatState = {
  participants: TurnParticipant[];
  pendingTelegraphs?: PendingTurnTelegraph[];
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
  kind: 'player' | 'enemy' | 'companion';
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
  stagger: number;
  staggerThreshold: number;
  bleedMovementTiles: number;
  attacks: TurnAttackUiSnapshot[];
  attackCooldowns: Record<string, number>;
  magicResourceRemaining: number;
  magicResourceMax: number;
  devotionResourceRemaining: number;
  devotionResourceMax: number;
  abilities: TurnCombatAbilityUiSnapshot[];
  abilityCooldowns: Record<string, number>;
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

export type TurnCombatAbilityUiSnapshot = {
  id: string;
  displayName: string;
  kind: TurnAbilityKind;
  target: TurnAbilityTarget;
  apCost: number;
  minRangeTiles: number;
  maxRangeTiles: number;
  cooldownRemaining: number;
  magicCost: number;
  devotionCost: number;
};

export type TurnCombatUiSnapshot = {
  active: boolean;
  phase: TurnPhase;
  round: number;
  player: TurnParticipantUiSnapshot | null;
  /**
   * The participant currently acting (player or companion on player_turn, null on enemy_turn).
   * Use this for the action bar — may differ from `player` during companion turns.
   */
  activeUnit: TurnParticipantUiSnapshot | null;
  /** Player HP always present (persists between combats). Null until first combat. */
  playerCurrentHp: number | null;
  playerMaxHp: number | null;
  playerMagicResourceCurrent: number | null;
  playerMagicResourceMax: number | null;
  playerDevotionResourceCurrent: number | null;
  playerDevotionResourceMax: number | null;
  isSprinting: boolean;
  /** True while player is in "pick-a-target" attack mode. */
  isAttackMode: boolean;
  selectedAttackId: string | null;
  selectedAbilityId: string | null;
  activeParticipantId: string | null;
  turnOrder: TurnParticipantUiSnapshot[];
};
