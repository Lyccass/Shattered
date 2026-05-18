export type PlayerCombatSnapshot = {
  combatModeActive: boolean;
  hitCount: number;
  maxHitCount: number;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  isDodging: boolean;
  isInvulnerable: boolean;
};

export type PlayerDodgeResult =
  | { ok: true }
  | { ok: false; reason: string };

export type PlayerSprintToggleResult =
  | { ok: true; active: boolean }
  | { ok: false; active: boolean; reason: string };

const MAX_STAMINA = 100;
const DODGE_COST = 25;
const DODGE_DURATION_MS = 250;
const DODGE_INVULNERABILITY_MS = 250;
const DODGE_COOLDOWN_MS = 450;
const STAMINA_REGEN_DELAY_MS = 900;
const STAMINA_REGEN_OUT_OF_COMBAT_PER_SECOND = MAX_STAMINA / 3;
const STAMINA_REGEN_IN_COMBAT_PER_SECOND = MAX_STAMINA / 6;
const SPRINT_DRAIN_OUT_OF_COMBAT_PER_SECOND = 1;
const SPRINT_DRAIN_IN_COMBAT_PER_SECOND = 5;
const MAX_HIT_COUNT = 3;

export class PlayerCombatState {
  private combatModeActive = false;
  private hitCount = 0;
  private stamina = MAX_STAMINA;
  private sprinting = false;
  private dodgeEndsAtMs: number | null = null;
  private invulnerableUntilMs: number | null = null;
  private dodgeCooldownEndsAtMs = 0;
  private staminaRegenStartsAtMs = 0;

  enterCombat(): void {
    this.combatModeActive = true;
  }

  leaveCombat(): void {
    this.combatModeActive = false;
  }

  update(nowMs: number, deltaMs: number, isMoving: boolean): void {
    if (this.dodgeEndsAtMs !== null && nowMs >= this.dodgeEndsAtMs) {
      this.dodgeEndsAtMs = null;
    }

    if (this.invulnerableUntilMs !== null && nowMs >= this.invulnerableUntilMs) {
      this.invulnerableUntilMs = null;
    }

    if (this.sprinting && isMoving && !this.isDodging(nowMs)) {
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

    if (nowMs < this.staminaRegenStartsAtMs || this.isDodging(nowMs)) {
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

  tryStartDodge(nowMs: number): PlayerDodgeResult {
    if (nowMs < this.dodgeCooldownEndsAtMs) {
      return {
        ok: false,
        reason: 'Need a moment before dodging again.',
      };
    }

    if (this.stamina < DODGE_COST) {
      return {
        ok: false,
        reason: 'Too exhausted to dodge.',
      };
    }

    this.stamina -= DODGE_COST;
    this.dodgeEndsAtMs = nowMs + DODGE_DURATION_MS;
    this.invulnerableUntilMs = nowMs + DODGE_INVULNERABILITY_MS;
    this.dodgeCooldownEndsAtMs = nowMs + DODGE_COOLDOWN_MS;
    this.staminaRegenStartsAtMs = nowMs + STAMINA_REGEN_DELAY_MS;
    return { ok: true };
  }

  registerHit(nowMs: number): boolean {
    if (this.isInvulnerable(nowMs)) {
      return false;
    }

    this.hitCount = Math.min(MAX_HIT_COUNT, this.hitCount + 1);
    return true;
  }

  isDodging(nowMs: number): boolean {
    return this.dodgeEndsAtMs !== null && nowMs < this.dodgeEndsAtMs;
  }

  isInvulnerable(nowMs: number): boolean {
    return this.invulnerableUntilMs !== null && nowMs < this.invulnerableUntilMs;
  }

  getSnapshot(nowMs: number): PlayerCombatSnapshot {
    return {
      combatModeActive: this.combatModeActive,
      hitCount: this.hitCount,
      maxHitCount: MAX_HIT_COUNT,
      stamina: Math.round(this.stamina),
      maxStamina: MAX_STAMINA,
      isSprinting: this.sprinting,
      isDodging: this.isDodging(nowMs),
      isInvulnerable: this.isInvulnerable(nowMs),
    };
  }
}
