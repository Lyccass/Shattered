import type { WeaponArchetype } from '../equipment/EquipmentTypes';
import type { IsoTilemap } from '../world/IsoTilemap';
import { snapToIsometricGridDirection } from './CombatGridDirection';

export type TilePos = { x: number; y: number };
export type WorldPoint = { x: number; y: number };

export type AttackHitTiles = {
  primaryTiles: TilePos[];
  secondaryTiles?: TilePos[];
  secondaryDamageMultiplier?: number;
};

type DirVecs = { fwd: TilePos; rht: TilePos };

// Right-of-facing for each of the 8 iso grid tile directions.
// "right" = 90° clockwise from fwd in screen space (Y-down).
const FWD_RHT: Map<string, DirVecs> = new Map([
  ['0,-1',   { fwd: { x:  0, y: -1 }, rht: { x:  1, y:  0 } }], // NE screen
  ['1,0',    { fwd: { x:  1, y:  0 }, rht: { x:  0, y:  1 } }], // SE screen
  ['0,1',    { fwd: { x:  0, y:  1 }, rht: { x: -1, y:  0 } }], // SW screen
  ['-1,0',   { fwd: { x: -1, y:  0 }, rht: { x:  0, y: -1 } }], // NW screen
  ['-1,-1',  { fwd: { x: -1, y: -1 }, rht: { x:  1, y: -1 } }], // N screen
  ['1,-1',   { fwd: { x:  1, y: -1 }, rht: { x:  1, y:  1 } }], // E screen
  ['1,1',    { fwd: { x:  1, y:  1 }, rht: { x: -1, y:  1 } }], // S screen
  ['-1,1',   { fwd: { x: -1, y:  1 }, rht: { x: -1, y: -1 } }], // W screen
]);

// Diagonal screen directions decompose into two tile-axis components (a1 + a2 = diagonal).
// N(-1,-1) = NW(-1,0) + NE(0,-1), etc.
const DIAGONAL_AXES: Map<string, readonly [TilePos, TilePos]> = new Map([
  ['-1,-1', [{ x: -1, y:  0 }, { x:  0, y: -1 }]],  // N = NW + NE
  ['1,-1',  [{ x:  0, y: -1 }, { x:  1, y:  0 }]],  // E = NE + SE
  ['1,1',   [{ x:  1, y:  0 }, { x:  0, y:  1 }]],  // S = SE + SW
  ['-1,1',  [{ x:  0, y:  1 }, { x: -1, y:  0 }]],  // W = SW + NW
]);

function dirVecs(dgx: number, dgy: number): DirVecs {
  return FWD_RHT.get(`${dgx},${dgy}`) ?? FWD_RHT.get('0,-1')!;
}

function local(origin: TilePos, fwd: TilePos, rht: TilePos, f: number, r: number): TilePos {
  return {
    x: origin.x + fwd.x * f + rht.x * r,
    y: origin.y + fwd.y * f + rht.y * r,
  };
}

function add(origin: TilePos, ...offsets: TilePos[]): TilePos {
  let x = origin.x, y = origin.y;
  for (const o of offsets) { x += o.x; y += o.y; }
  return { x, y };
}

function scale(v: TilePos, s: number): TilePos {
  return { x: v.x * s, y: v.y * s };
}

// Resolves the single tile the player is aiming at, clamped to maxReach.
function resolveAimTile(
  tilemap: IsoTilemap,
  playerFeet: WorldPoint,
  playerTile: TilePos,
  targetWorldX: number | null,
  targetWorldY: number | null,
  aimRad: number,
  maxReach: number,
): TilePos {
  let rawTile: TilePos;
  if (targetWorldX !== null && targetWorldY !== null) {
    rawTile = tilemap.transform.worldToTile(targetWorldX, targetWorldY);
  } else {
    const projX = playerFeet.x + Math.cos(aimRad) * tilemap.tileWidth * 2;
    const projY = playerFeet.y + Math.sin(aimRad) * tilemap.tileWidth * 2;
    rawTile = tilemap.transform.worldToTile(projX, projY);
  }

  let dx = rawTile.x - playerTile.x;
  let dy = rawTile.y - playerTile.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) === 0) {
    const projX = playerFeet.x + Math.cos(aimRad) * tilemap.tileWidth;
    const projY = playerFeet.y + Math.sin(aimRad) * tilemap.tileWidth;
    const projected = tilemap.transform.worldToTile(projX, projY);
    dx = projected.x - playerTile.x;
    dy = projected.y - playerTile.y;
  }

  const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));
  if (chebyshev > maxReach) {
    const s = maxReach / chebyshev;
    dx = Math.round(dx * s);
    dy = Math.round(dy * s);
  }

  return { x: playerTile.x + dx, y: playerTile.y + dy };
}

/**
 * Resolves the attack hit tiles for the current weapon archetype.
 *
 * All 8 iso directions are supported. Tile-axis directions (NE/SE/SW/NW screen)
 * use forward+right local coords. Diagonal directions (N/E/S/W screen) decompose
 * into two constituent tile-axis vectors for symmetric, correct patterns.
 *
 * Sword  — 7-tile arc. Cardinal: L grid. Diagonal: symmetric fan (a1, a2, diag, 2× each).
 * Axe    — 3-tile sweep. Cardinal: L(1,-1..1). Diagonal: a1, diag, a2.
 * Hammer — 2×2 block. Cardinal: L(1..2, 0..1). Diagonal: 2×2 via axes (a1+a2 etc).
 * Dagger — 1 tile aimed at reach 1, hits twice (50% second roll).
 * Spear  — 1 tile aimed, clamped to reachTiles.
 */
export function resolveAttackTarget(params: {
  tilemap: IsoTilemap;
  playerFeet: WorldPoint;
  aimRad: number;
  archetype: WeaponArchetype;
  targetWorldX: number | null;
  targetWorldY: number | null;
  reachTiles: number;
}): { targetWorld: WorldPoint; hitTiles: AttackHitTiles } {
  const { tilemap, playerFeet, aimRad, archetype, targetWorldX, targetWorldY, reachTiles } = params;

  const P = tilemap.transform.worldToTile(playerFeet.x, playerFeet.y);
  const [dgx, dgy] = snapToIsometricGridDirection(aimRad, tilemap.tileWidth, tilemap.tileHeight);
  const key = `${dgx},${dgy}`;

  const axes = DIAGONAL_AXES.get(key);
  const isDiag = axes !== undefined;

  const { fwd, rht } = dirVecs(dgx, dgy);
  const L = (f: number, r: number) => local(P, fwd, rht, f, r);
  const tc = (t: TilePos) => tilemap.getTileCenterWorld(t.x, t.y);

  switch (archetype) {
    case 'sword': {
      let tiles: TilePos[];
      let center: WorldPoint;

      if (isDiag && axes) {
        // 7-tile fan: player + mid pair (diag+a1, diag+a2) + far pair (2*a1, 2*a2) + center (diag, 2*diag).
        // Using diag+a1 instead of bare a1 moves the flanking tiles forward so they're
        // clearly in front of the player rather than barely to the side (y=-16 vs y=-48).
        const [a1, a2] = axes;
        const diag = { x: a1.x + a2.x, y: a1.y + a2.y };
        tiles = [
          P,
          add(P, diag, a1), add(P, diag, a2),
          add(P, scale(a1, 2)), add(P, scale(a2, 2)),
          add(P, diag), add(P, scale(diag, 2)),
        ];
        center = tc(add(P, diag));
      } else {
        // Cardinal: 7-tile arc — left arm, centre line, right arm
        tiles = [P, L(1,-1), L(2,-1), L(1,0), L(2,0), L(1,1), L(2,1)];
        center = tc(L(1, 0));
      }

      return { targetWorld: center, hitTiles: { primaryTiles: tiles } };
    }

    case 'axe': {
      // 3-tile sweep one tile in front: left, centre, right of facing.
      let tiles: TilePos[];

      if (isDiag && axes) {
        const [a1, a2] = axes;
        const diag = { x: a1.x + a2.x, y: a1.y + a2.y };
        // a1 (NW), diagonal (N), a2 (NE) — symmetric arc
        tiles = [add(P, a1), add(P, diag), add(P, a2)];
      } else {
        tiles = [L(1,-1), L(1,0), L(1,1)];
      }

      const axCenter = isDiag && axes
        ? tc(add(P, { x: axes[0].x + axes[1].x, y: axes[0].y + axes[1].y }))
        : tc(L(1, 0));

      return { targetWorld: axCenter, hitTiles: { primaryTiles: tiles } };
    }

    case 'hammer': {
      // 2×2 block directly in front.
      // Cardinal: L(1..2, 0..1).
      // Diagonal: natural tile-space 2×2 block — a1+a2, 2*a1+a2, a1+2*a2, 2*(a1+a2).
      let tiles: TilePos[];

      if (isDiag && axes) {
        const [a1, a2] = axes;
        const diag = { x: a1.x + a2.x, y: a1.y + a2.y };
        tiles = [
          add(P, diag),
          add(P, scale(a1, 2), a2),
          add(P, a1, scale(a2, 2)),
          add(P, scale(diag, 2)),
        ];
      } else {
        tiles = [L(1,0), L(2,0), L(1,1), L(2,1)];
      }

      const hmCenter = isDiag && axes
        ? tc(add(P, { x: axes[0].x + axes[1].x, y: axes[0].y + axes[1].y }))
        : tc(L(1, 0));

      return { targetWorld: hmCenter, hitTiles: { primaryTiles: tiles } };
    }

    case 'dagger': {
      // Single tile at reach 1; hits twice (second roll at 50%).
      const aimTile = resolveAimTile(tilemap, playerFeet, P, targetWorldX, targetWorldY, aimRad, 1);
      return {
        targetWorld: tc(aimTile),
        hitTiles: {
          primaryTiles: [aimTile],
          secondaryTiles: [aimTile],
          secondaryDamageMultiplier: 0.5,
        },
      };
    }

    case 'spear':
    default: {
      // Single aimed tile, clamped to reachTiles.
      const aimTile = resolveAimTile(tilemap, playerFeet, P, targetWorldX, targetWorldY, aimRad, reachTiles);
      return { targetWorld: tc(aimTile), hitTiles: { primaryTiles: [aimTile] } };
    }
  }
}
