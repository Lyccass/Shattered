export type PlayerCombatSnapshot = {
  combatModeActive: boolean;
  hitCount: number;
  maxHitCount: number;
  stamina: number;
  maxStamina: number;
  isDodging: boolean;
  isInvulnerable: boolean;
};

export type PlayerDodgeResult =
  | { ok: true }
  | { ok: false; reason: string };

const MAX_STAMINA = 100;
const DODGE_COST = 25;
const DODGE_DURATION_MS = 250;
const DODGE_INVULNERABILITY_MS = 250;
const DODGE_COOLDOWN_MS = 450;
const STAMINA_REGEN_DELAY_MS = 900;
const STAMINA_REGEN_PER_SECOND = 32;
const MAX_HIT_COUNT = 3;

export class PlayerCombatState {
  private combatModeActive = false;
  private hitCount = 0;
  private stamina = MAX_STAMINA;
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

  update(nowMs: number, deltaMs: number): void {
    if (this.dodgeEndsAtMs !== null && nowMs >= this.dodgeEndsAtMs) {
      this.dodgeEndsAtMs = null;
    }

    if (this.invulnerableUntilMs !== null && nowMs >= this.invulnerableUntilMs) {
      this.invulnerableUntilMs = null;
    }

    if (nowMs < this.staminaRegenStartsAtMs || this.isDodging(nowMs)) {
      return;
    }

    this.stamina = Math.min(
      MAX_STAMINA,
      this.stamina + (STAMINA_REGEN_PER_SECOND * deltaMs) / 1000,
    );
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
      isDodging: this.isDodging(nowMs),
      isInvulnerable: this.isInvulnerable(nowMs),
    };
  }
}
