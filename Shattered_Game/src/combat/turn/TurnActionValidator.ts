import type { TurnAttack, TurnCombatState, TurnParticipant } from './TurnCombatTypes';

export interface TurnTileContext {
  isTileWalkable(tileX: number, tileY: number): boolean;
  mapWidth: number;
  mapHeight: number;
}

const DIRS_8 = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
] as const;

/**
 * BFS flood-fill from participant's current tile up to mpRemaining steps.
 * Returns all tiles reachable without crossing occupied or unwalkable tiles.
 * Does not include the participant's own tile.
 */
export function getReachableTiles(
  participant: TurnParticipant,
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): { x: number; y: number }[] {
  if (participant.mpRemaining <= 0) return [];

  const occupied = new Set<string>(
    state.participants
      .filter((p) => p.id !== participant.id && p.hp > 0)
      .map((p) => `${p.tileX},${p.tileY}`),
  );

  const visited = new Set<string>([`${participant.tileX},${participant.tileY}`]);
  const reachable: { x: number; y: number }[] = [];
  const queue: { x: number; y: number; cost: number }[] = [
    { x: participant.tileX, y: participant.tileY, cost: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const [dx, dy] of DIRS_8) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      const newCost = current.cost + 1;

      if (newCost > participant.mpRemaining) continue;
      if (visited.has(key)) continue;
      if (nx < 0 || ny < 0 || nx >= tileCtx.mapWidth || ny >= tileCtx.mapHeight) continue;
      if (!tileCtx.isTileWalkable(nx, ny)) continue;
      if (occupied.has(key)) continue;

      visited.add(key);
      reachable.push({ x: nx, y: ny });
      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }

  return reachable;
}

/**
 * Returns all enemy participants attackable from the attacker's current tile.
 * Uses Chebyshev distance (max of |dx|, |dy|) to match isometric range feel.
 */
export function getAttackableTargets(
  attacker: TurnParticipant,
  state: TurnCombatState,
): TurnParticipant[] {
  if (attacker.apRemaining <= 0) return [];
  if (attacker.hp <= 0) return [];

  return state.participants.filter((p) => {
    if (p.id === attacker.id) return false;
    if (p.kind === attacker.kind) return false; // don't attack own side
    if (p.hp <= 0) return false;
    return getUsableAttacks(attacker, p).length > 0;
  });
}

export function getUsableAttacks(
  attacker: TurnParticipant,
  target: TurnParticipant,
): TurnAttack[] {
  if (attacker.apRemaining <= 0) return [];
  if (attacker.hp <= 0) return [];
  if (target.hp <= 0) return [];

  const dist = chebyshevDist(attacker.tileX, attacker.tileY, target.tileX, target.tileY);

  return getParticipantAttacks(attacker).filter((attack) => {
    if (attacker.apRemaining < attack.apCost) return false;
    if ((attacker.attackCooldowns?.[attack.id] ?? 0) > 0) return false;
    return dist >= attack.minRangeTiles && dist <= attack.maxRangeTiles;
  });
}

/** Returns true if a tile move is valid for this participant. */
export function isValidMove(
  participant: TurnParticipant,
  toTileX: number,
  toTileY: number,
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): boolean {
  const reachable = getReachableTiles(participant, state, tileCtx);
  return reachable.some((t) => t.x === toTileX && t.y === toTileY);
}

/** Returns true if the participant can attack the given target right now. */
export function isValidAttack(
  attacker: TurnParticipant,
  targetId: string,
  state: TurnCombatState,
  attackId?: string,
): boolean {
  const target = state.participants.find((p) => p.id === targetId);
  if (!target) return false;

  const attacks = getUsableAttacks(attacker, target);
  return attackId ? attacks.some((attack) => attack.id === attackId) : attacks.length > 0;
}

export function chebyshevDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(bx - ax), Math.abs(by - ay));
}

/**
 * Returns the step count (Chebyshev) to move from (ax,ay) to (bx,by).
 * Used by AI to pick closest approach tile.
 */
export function stepsBetween(ax: number, ay: number, bx: number, by: number): number {
  return chebyshevDist(ax, ay, bx, by);
}

export function getParticipantAttacks(participant: TurnParticipant): TurnAttack[] {
  if (participant.attacks && participant.attacks.length > 0) {
    return participant.attacks;
  }

  return [{
    id: 'basic_attack',
    displayName: 'Attack',
    apCost: 1,
    minRangeTiles: 0,
    maxRangeTiles: participant.attackRangeTiles,
    damage: participant.attackPower,
    hitChance: participant.hitChance,
    cooldownTurns: 0,
  }];
}

/**
 * Finds the best tile to move toward target within mpRemaining steps.
 * Picks the reachable tile closest to the target.
 * Returns null if no reachable tile brings the attacker closer.
 */
export function getBestApproachTile(
  mover: TurnParticipant,
  targetTileX: number,
  targetTileY: number,
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): { x: number; y: number } | null {
  const reachable = getReachableTiles(mover, state, tileCtx);
  if (reachable.length === 0) return null;

  let best: { x: number; y: number } | null = null;
  let bestDist = chebyshevDist(mover.tileX, mover.tileY, targetTileX, targetTileY);

  for (const tile of reachable) {
    const dist = chebyshevDist(tile.x, tile.y, targetTileX, targetTileY);
    if (dist < bestDist) {
      bestDist = dist;
      best = tile;
    }
  }

  return best;
}
