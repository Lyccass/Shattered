import type { RegionEnvironmentVariable } from '../../shared/world/RegionManifestTypes';

export type EnvironmentVars = Partial<Record<RegionEnvironmentVariable, number>>;

type Listener = (vars: EnvironmentVars) => void;

const AREA_CLEAR_PRESSURE_DROP = 5;
const AREA_CLEAR_SAFETY_GAIN = 3;

/**
 * Mutable runtime copy of a region's environment variables.
 * Separate from the authored manifest baseline — the manifest sets the
 * starting values; player actions (clearing areas, completing quests) move
 * these values over the course of a session.
 */
export class WorldEnvironmentState {
  private vars: EnvironmentVars = {};
  private readonly listeners: Listener[] = [];

  setInitial(raw: Record<string, unknown>): void {
    const next: EnvironmentVars = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number') {
        next[k as RegionEnvironmentVariable] = v;
      }
    }
    this.vars = next;
    this.notify();
  }

  get(key: RegionEnvironmentVariable): number {
    return this.vars[key] ?? 0;
  }

  getAll(): EnvironmentVars {
    return { ...this.vars };
  }

  onAreaCleared(clearedCount = 1): void {
    const pressure = this.get('monsterPressure');
    const safety = this.get('routeSafety');
    this.vars.monsterPressure = Math.max(0, pressure - AREA_CLEAR_PRESSURE_DROP * clearedCount);
    this.vars.routeSafety = Math.min(100, safety + AREA_CLEAR_SAFETY_GAIN * clearedCount);
    this.notify();
  }

  /**
   * Shop price multiplier: higher threat → higher prices.
   * At monsterPressure 0 → ×1.0; at 100 → ×1.5.
   */
  getShopPriceMultiplier(): number {
    return 1 + (this.get('monsterPressure') / 100) * 0.5;
  }

  /**
   * Enemy respawn multiplier: lower threat → longer respawn.
   * At monsterPressure 0 → 3× longer; at 100 → 0.5× (twice as fast).
   */
  getEnemyRespawnMultiplier(): number {
    return 3.0 - (this.get('monsterPressure') / 100) * 2.5;
  }

  /**
   * 0–100 threat level used by enemy AI:
   * - scales aggro range (up to ×1.5 at 100)
   * - turns passive enemies aggressive above the threshold
   */
  getThreatLevel(): number {
    return Math.max(0, Math.min(100, this.get('monsterPressure')));
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn(this.vars);
    }
  }
}
