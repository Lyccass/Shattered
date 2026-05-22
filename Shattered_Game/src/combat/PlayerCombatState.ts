export type PlayerAttackPhase = 'idle' | 'windup' | 'active' | 'recovery';
export type GuardResolution = 'hit' | 'dodged' | 'blocked' | 'guard_broken';

export type PlayerCombatSnapshot = {
  combatModeActive: boolean;
  currentHp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  isDodging: boolean;
  isInvulnerable: boolean;
  isGuarding: boolean;
  isGuardBroken: boolean;
  isAttacking: boolean;
  lightAttackPhase: PlayerAttackPhase;
  isDowned: boolean;
};

export type PlayerDodgeResult =
  | { ok: true }
  | { ok: false; reason: string };

export type PlayerSprintToggleResult =
  | { ok: true; active: boolean }
  | { ok: false; active: boolean; reason: string };

export type PlayerLightAttackResult =
  | { ok: true }
  | { ok: false; reason: string };

export type IncomingAttackResolution = {
  kind: GuardResolution;
  damageApplied: number;
  blocked: boolean;
  guardBroken: boolean;
  wasDowned: boolean;
};

const MAX_STAMINA = 100;
export const BASE_MAX_HP = 10;
const WALK_DODGE_COST = 15;
const SPRINT_DODGE_COST = 25;
export const DODGE_DURATION_MS = 250;
const DODGE_INVULNERABILITY_MS = 250;
const DODGE_COOLDOWN_MS = 350;
const LIGHT_ATTACK_COST = 12;
export const LIGHT_ATTACK_WINDUP_MS = 160;
export const LIGHT_ATTACK_ACTIVE_MS = 200;
export const LIGHT_ATTACK_RECOVERY_MS = 640;
const GUARD_STAMINA_COST_PER_DAMAGE = 10;
const GUARD_BREAK_DURATION_MS = 650;
const DOWNED_RECOVERY_MS = 1_500;
const STAMINA_REGEN_DELAY_MS = 900;
const STAMINA_REGEN_OUT_OF_COMBAT_PER_SECOND = MAX_STAMINA / 3;
const STAMINA_REGEN_IN_COMBAT_PER_SECOND = MAX_STAMINA / 6;
const SPRINT_DRAIN_OUT_OF_COMBAT_PER_SECOND = 1;
const SPRINT_DRAIN_IN_COMBAT_PER_SECOND = 5;

type ActiveLightAttackState = {
  phase: Exclude<PlayerAttackPhase, 'idle'>;
  phaseStartedAtMs: number;
  phaseEndsAtMs: number;
  pendingActiveResolve: boolean;
};

export class PlayerCombatState {
  private combatModeActive = false;
  private currentHp = BASE_MAX_HP;

  constructor(private maxHp = BASE_MAX_HP) {
    this.currentHp = maxHp;
  }
  private stamina = MAX_STAMINA;
  private sprinting = false;
  private guardHeld = false;
  private guardBrokenUntilMs: number | null = null;
  private downedUntilMs: number | null = null;
  private dodgeEndsAtMs: number | null = null;
  private invulnerableUntilMs: number | null = null;
  private dodgeCooldownEndsAtMs = 0;
  private staminaRegenStartsAtMs = 0;
  private lightAttack: ActiveLightAttackState | null = null;
  private recoveryOverrideMs: number | null = null;
  private pendingRecoveredFromDowned = false;

  enterCombat(): void {
    this.combatModeActive = true;
  }

  leaveCombat(): void {
    this.combatModeActive = false;
  }

  update(nowMs: number, deltaMs: number, isMoving: boolean): void {
    this.settleDodgeState(nowMs);
    this.settleGuardBreak(nowMs);
    this.settleDownedRecovery(nowMs);
    this.advanceLightAttack(nowMs);

    if (this.sprinting && isMoving && !this.isDodging(nowMs) && !this.isGuarding(nowMs) && !this.isAttacking()) {
      const drainRate = this.combatModeActive
        ? SPRINT_DRAIN_IN_COMBAT_PER_SECOND
        : SPRINT_DRAIN_OUT_OF_COMBAT_PER_SECOND;
      this.stamina = Math.max(0, this.stamina - (drainRate * deltaMs) / 1000);
      this.staminaRegenStartsAtMs = nowMs + STAMINA_REGEN_DELAY_MS;

      if (this.stamina <= 0.0001) {
        this.stamina = 0;
        this.sprinting = false;
      }

      return;
    }

    if (
      nowMs < this.staminaRegenStartsAtMs
      || this.isDodging(nowMs)
      || this.isGuarding(nowMs)
      || this.isAttacking()
      || this.isDowned(nowMs)
    ) {
      return;
    }

    const regenRate = this.combatModeActive
      ? STAMINA_REGEN_IN_COMBAT_PER_SECOND
      : STAMINA_REGEN_OUT_OF_COMBAT_PER_SECOND;
    this.stamina = Math.min(
      MAX_STAMINA,
      this.stamina + (regenRate * deltaMs) / 1000,
    );
  }

  toggleSprint(): PlayerSprintToggleResult {
    if (this.sprinting) {
      this.sprinting = false;
      return { ok: true, active: false };
    }

    if (this.isDowned()) {
      return {
        ok: false,
        active: false,
        reason: 'You cannot sprint while downed.',
      };
    }

    if (this.stamina <= 0.0001) {
      return {
        ok: false,
        active: false,
        reason: 'Too exhausted to sprint.',
      };
    }

    this.sprinting = true;
    return { ok: true, active: true };
  }

  setGuardHeld(guardHeld: boolean): void {
    this.guardHeld = guardHeld;
  }

  tryStartDodge(nowMs: number): PlayerDodgeResult {
    if (this.isDowned(nowMs)) {
      return {
        ok: false,
        reason: 'You are downed.',
      };
    }

    if (this.isGuardBroken(nowMs)) {
      return {
        ok: false,
        reason: 'Guard broken.',
      };
    }

    // Dodge has highest priority — check cooldown and stamina before cancelling the attack
    if (nowMs < this.dodgeCooldownEndsAtMs) {
      return {
        ok: false,
        reason: 'Need a moment before dodging again.',
      };
    }

    const dodgeCost = this.sprinting ? SPRINT_DODGE_COST : WALK_DODGE_COST;

    if (this.stamina < dodgeCost) {
      return {
        ok: false,
        reason: 'Too exhausted to dodge.',
      };
    }

    // Cancel any in-progress attack (windup, active, or recovery) — dodge overrides all
    if (this.lightAttack !== null) {
      this.lightAttack = null;
      this.recoveryOverrideMs = null;
    }

    this.guardHeld = false;
    this.stamina -= dodgeCost;
    this.dodgeEndsAtMs = nowMs + DODGE_DURATION_MS;
    this.invulnerableUntilMs = nowMs + DODGE_INVULNERABILITY_MS;
    this.dodgeCooldownEndsAtMs = nowMs + DODGE_COOLDOWN_MS;
    this.staminaRegenStartsAtMs = nowMs + STAMINA_REGEN_DELAY_MS;
    return { ok: true };
  }

  tryStartLightAttack(nowMs: number): PlayerLightAttackResult {
    if (this.isDowned(nowMs)) {
      return {
        ok: false,
        reason: 'You are downed.',
      };
    }

    if (this.isGuardBroken(nowMs)) {
      return {
        ok: false,
        reason: 'Guard broken.',
      };
    }

    if (this.isAttacking()) {
      return {
        ok: false,
        reason: 'Still recovering.',
      };
    }

    if (this.isDodging(nowMs)) {
      return {
        ok: false,
        reason: 'Cannot attack while dodging.',
      };
    }

    if (this.isGuarding(nowMs)) {
      return {
        ok: false,
        reason: 'Cannot attack while guarding.',
      };
    }

    if (this.stamina < LIGHT_ATTACK_COST) {
      return {
        ok: false,
        reason: 'Too exhausted to attack.',
      };
    }

    this.stamina -= LIGHT_ATTACK_COST;
    this.staminaRegenStartsAtMs = nowMs + STAMINA_REGEN_DELAY_MS;
    this.lightAttack = {
      phase: 'windup',
      phaseStartedAtMs: nowMs,
      phaseEndsAtMs: nowMs + LIGHT_ATTACK_WINDUP_MS,
      pendingActiveResolve: false,
    };
    return { ok: true };
  }

  updateMaxHp(newMax: number): void {
    const clampedMax = Math.max(1, Math.round(newMax));
    if (clampedMax === this.maxHp) return;
    // Scale current HP proportionally when max changes
    const ratio = this.currentHp / this.maxHp;
    this.maxHp = clampedMax;
    this.currentHp = Math.max(1, Math.min(clampedMax, Math.round(ratio * clampedMax)));
  }

  refundLightAttackStamina(): void {
    this.stamina = Math.min(MAX_STAMINA, this.stamina + LIGHT_ATTACK_COST);
  }

  setNextRecoveryMs(ms: number): void {
    this.recoveryOverrideMs = ms;
  }

  resolveIncomingAttack(
    nowMs: number,
    damage: number,
    canBlockFromFront: boolean,
  ): IncomingAttackResolution {
    if (this.isInvulnerable(nowMs)) {
      return {
        kind: 'dodged',
        damageApplied: 0,
        blocked: false,
        guardBroken: false,
        wasDowned: false,
      };
    }

    if (this.isGuarding(nowMs) && canBlockFromFront) {
      const staminaCost = damage * GUARD_STAMINA_COST_PER_DAMAGE;

      if (this.stamina >= staminaCost) {
        this.stamina = Math.max(0, this.stamina - staminaCost);
        this.staminaRegenStartsAtMs = nowMs + STAMINA_REGEN_DELAY_MS;
        return {
          kind: 'blocked',
          damageApplied: 0,
          blocked: true,
          guardBroken: false,
          wasDowned: false,
        };
      }

      this.stamina = 0;
      this.guardBrokenUntilMs = nowMs + GUARD_BREAK_DURATION_MS;
      this.staminaRegenStartsAtMs = nowMs + STAMINA_REGEN_DELAY_MS;
      const wasDowned = this.applyHpDamage(nowMs, damage);
      return {
        kind: 'guard_broken',
        damageApplied: damage,
        blocked: false,
        guardBroken: true,
        wasDowned,
      };
    }

    const wasDowned = this.applyHpDamage(nowMs, damage);
    return {
      kind: 'hit',
      damageApplied: damage,
      blocked: false,
      guardBroken: false,
      wasDowned,
    };
  }

  consumePendingLightAttackActivation(): boolean {
    if (!this.lightAttack?.pendingActiveResolve) {
      return false;
    }

    this.lightAttack.pendingActiveResolve = false;
    return true;
  }

  consumeRecoveredFromDowned(): boolean {
    if (!this.pendingRecoveredFromDowned) {
      return false;
    }

    this.pendingRecoveredFromDowned = false;
    return true;
  }

  resetAfterDownedRecovery(): void {
    this.currentHp = this.maxHp;
    this.stamina = MAX_STAMINA;
    this.guardHeld = false;
    this.sprinting = false;
    this.dodgeEndsAtMs = null;
    this.invulnerableUntilMs = null;
    this.guardBrokenUntilMs = null;
    this.lightAttack = null;
  }

  isDodging(nowMs: number): boolean {
    return this.dodgeEndsAtMs !== null && nowMs < this.dodgeEndsAtMs;
  }

  isInvulnerable(nowMs: number): boolean {
    return this.invulnerableUntilMs !== null && nowMs < this.invulnerableUntilMs;
  }

  isGuarding(nowMs = Number.POSITIVE_INFINITY): boolean {
    return this.guardHeld && !this.isGuardBroken(nowMs) && !this.isDowned(nowMs);
  }

  isGuardBroken(nowMs = Number.POSITIVE_INFINITY): boolean {
    return this.guardBrokenUntilMs !== null && nowMs < this.guardBrokenUntilMs;
  }

  isAttacking(): boolean {
    return this.lightAttack !== null;
  }

  isDowned(nowMs = Number.POSITIVE_INFINITY): boolean {
    return this.downedUntilMs !== null && nowMs < this.downedUntilMs;
  }

  getSnapshot(nowMs: number): PlayerCombatSnapshot {
    return {
      combatModeActive: this.combatModeActive,
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      stamina: Math.round(this.stamina),
      maxStamina: MAX_STAMINA,
      isSprinting: this.sprinting,
      isDodging: this.isDodging(nowMs),
      isInvulnerable: this.isInvulnerable(nowMs),
      isGuarding: this.isGuarding(nowMs),
      isGuardBroken: this.isGuardBroken(nowMs),
      isAttacking: this.isAttacking(),
      lightAttackPhase: this.lightAttack?.phase ?? 'idle',
      isDowned: this.isDowned(nowMs),
    };
  }

  private settleDodgeState(nowMs: number): void {
    if (this.dodgeEndsAtMs !== null && nowMs >= this.dodgeEndsAtMs) {
      this.dodgeEndsAtMs = null;
    }

    if (this.invulnerableUntilMs !== null && nowMs >= this.invulnerableUntilMs) {
      this.invulnerableUntilMs = null;
    }
  }

  private settleGuardBreak(nowMs: number): void {
    if (this.guardBrokenUntilMs !== null && nowMs >= this.guardBrokenUntilMs) {
      this.guardBrokenUntilMs = null;
    }
  }

  private settleDownedRecovery(nowMs: number): void {
    if (this.downedUntilMs !== null && nowMs >= this.downedUntilMs) {
      this.downedUntilMs = null;
      this.resetAfterDownedRecovery();
      this.pendingRecoveredFromDowned = true;
    }
  }

  private advanceLightAttack(nowMs: number): void {
    if (!this.lightAttack) {
      return;
    }

    if (nowMs < this.lightAttack.phaseEndsAtMs) {
      return;
    }

    if (this.lightAttack.phase === 'windup') {
      this.lightAttack = {
        phase: 'active',
        phaseStartedAtMs: nowMs,
        phaseEndsAtMs: nowMs + LIGHT_ATTACK_ACTIVE_MS,
        pendingActiveResolve: true,
      };
      return;
    }

    if (this.lightAttack.phase === 'active') {
      const recoveryMs = this.recoveryOverrideMs ?? LIGHT_ATTACK_RECOVERY_MS;
      this.recoveryOverrideMs = null;
      this.lightAttack = {
        phase: 'recovery',
        phaseStartedAtMs: nowMs,
        phaseEndsAtMs: nowMs + recoveryMs,
        pendingActiveResolve: false,
      };
      return;
    }

    this.lightAttack = null;
  }

  private applyHpDamage(nowMs: number, damage: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - damage);

    if (this.currentHp > 0) {
      return false;
    }

    this.downedUntilMs = nowMs + DOWNED_RECOVERY_MS;
    this.guardHeld = false;
    this.sprinting = false;
    this.lightAttack = null;
    this.recoveryOverrideMs = null;
    this.dodgeEndsAtMs = null;
    this.invulnerableUntilMs = null;
    return true;
  }
}
