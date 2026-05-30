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

// ── Cones — 120° total arc, hollow (body/haft excluded via minRangeTiles) ─────
export const CONE_1T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 1,   angleDeg: 120, minRangeTiles: 0.4 };
export const CONE_3T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 3,   angleDeg: 120, minRangeTiles: 0.5 };
export const CONE_5T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 5,   angleDeg: 120, minRangeTiles: 0.5 };
export const CONE_7T: EnemyAttackTelegraphDefinition = { kind: 'cone', rangeTiles: 7,   angleDeg: 120, minRangeTiles: 0.5 };

// ── Jump ovals — isometric ellipses (2:1 X:Y matches tile aspect ratio) ──────
export const CIRCLE_SM: EnemyAttackTelegraphDefinition = { kind: 'ellipse', radiusXTiles: 1.5, radiusYTiles: 0.75 };
export const CIRCLE_MD: EnemyAttackTelegraphDefinition = { kind: 'ellipse', radiusXTiles: 2.0, radiusYTiles: 1.0 };
export const CIRCLE_LG: EnemyAttackTelegraphDefinition = { kind: 'ellipse', radiusXTiles: 2.5, radiusYTiles: 1.25 };
export const CIRCLE_XL: EnemyAttackTelegraphDefinition = { kind: 'ellipse', radiusXTiles: 3.0, radiusYTiles: 1.5 };

// ── Stabs — narrow forward thrust, offset so the attacker body is excluded ───
export const STAB_1T: EnemyAttackTelegraphDefinition  = { kind: 'rectangle', lengthTiles: 1.5, widthTiles: 1.0, minOffsetTiles: 0.3 };
export const STAB_2T: EnemyAttackTelegraphDefinition  = { kind: 'rectangle', lengthTiles: 2.0, widthTiles: 1.2, minOffsetTiles: 0.4 };
export const STAB_3T: EnemyAttackTelegraphDefinition  = { kind: 'rectangle', lengthTiles: 3.0, widthTiles: 1.5, minOffsetTiles: 0.5 };

// ── Slashes — wide sweeping arc ───────────────────────────────────────────────
export const SLASH_2T: EnemyAttackTelegraphDefinition = { kind: 'rectangle', lengthTiles: 2.0, widthTiles: 2.0 };
export const SLASH_3T: EnemyAttackTelegraphDefinition = { kind: 'rectangle', lengthTiles: 3.0, widthTiles: 2.5 };
export const SLASH_4T: EnemyAttackTelegraphDefinition = { kind: 'rectangle', lengthTiles: 4.0, widthTiles: 3.0 };

// ── Lines — thin piercing beams ───────────────────────────────────────────────
export const LINE_5T: EnemyAttackTelegraphDefinition  = { kind: 'line', lengthTiles: 5, widthTiles: 0.8 };
export const LINE_7T: EnemyAttackTelegraphDefinition  = { kind: 'line', lengthTiles: 7, widthTiles: 0.8 };
