// Clamps a value from save data to a non-negative integer.
// Corrupted or NaN saves produce 0 rather than propagating bad state.
export function sanitizeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}
