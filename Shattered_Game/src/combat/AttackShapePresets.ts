import type { EnemyAttackTelegraphDefinition } from './EnemyTypes';

// ─── Canonical attack shape presets ──────────────────────────────────────────
// All enemy attack telegraphs must use these constants.
// Shape geometry is fixed per preset; range / size tier is encoded in the name.
//
// Convention
//   CONE_nT   — forward-facing 120° cone, n = range in tiles
//   CIRCLE_*  — perfect circle landing zone (jump attacks, pulse)
//   STAB_nT   — narrow forward thrust (length >> width)
//   SLASH_nT  — wide sweeping arc approximated as rectangle (length ≈ width)
//   LINE_nT   — thin piercing beam

// ── Cones — 120° total arc (60° each side from facing direction) ──────────────
export const CONE_1T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 1, angleDeg: 120 };
export const CONE_3T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 3, angleDeg: 120 };
export const CONE_5T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 5, angleDeg: 120 };
export const CONE_7T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 7, angleDeg: 120 };

// ── Jump circles — perfect circle landing zones ───────────────────────────────
export const CIRCLE_SM: EnemyAttackTelegraphDefinition = { kind: 'circle', radiusTiles: 1.5 };
export const CIRCLE_MD: EnemyAttackTelegraphDefinition = { kind: 'circle', radiusTiles: 2.0 };
export const CIRCLE_LG: EnemyAttackTelegraphDefinition = { kind: 'circle', radiusTiles: 2.5 };
export const CIRCLE_XL: EnemyAttackTelegraphDefinition = { kind: 'circle', radiusTiles: 3.0 };

// ── Stabs — narrow forward thrust ────────────────────────────────────────────
export const STAB_1T: EnemyAttackTelegraphDefinition  = { kind: 'rectangle', lengthTiles: 1.5, widthTiles: 1.0 };
export const STAB_2T: EnemyAttackTelegraphDefinition  = { kind: 'rectangle', lengthTiles: 2.0, widthTiles: 1.2 };
export const STAB_3T: EnemyAttackTelegraphDefinition  = { kind: 'rectangle', lengthTiles: 3.0, widthTiles: 1.5 };

// ── Slashes — wide sweeping arc ───────────────────────────────────────────────
export const SLASH_2T: EnemyAttackTelegraphDefinition = { kind: 'rectangle', lengthTiles: 2.0, widthTiles: 2.0 };
export const SLASH_3T: EnemyAttackTelegraphDefinition = { kind: 'rectangle', lengthTiles: 3.0, widthTiles: 2.5 };
export const SLASH_4T: EnemyAttackTelegraphDefinition = { kind: 'rectangle', lengthTiles: 4.0, widthTiles: 3.0 };

// ── Lines — thin piercing beams ───────────────────────────────────────────────
export const LINE_5T: EnemyAttackTelegraphDefinition  = { kind: 'line', lengthTiles: 5, widthTiles: 0.8 };
export const LINE_7T: EnemyAttackTelegraphDefinition  = { kind: 'line', lengthTiles: 7, widthTiles: 0.8 };
