import type { TurnAttack, TurnCombatState, TurnParticipant } from './TurnCombatTypes';

export interface TurnTileContext {
  isTileWalkable(tileX: number, tileY: number): boolean;
  getTerrainElevation?(tileX: number, tileY: number): number | null;
  mapWidth: number;
  mapHeight: number;
}

const DIRS_8 = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
] as const;

type TilePoint = { x: number; y: number };
type BfsBounds = { mapWidth: number; mapHeight: number };
export type TurnMovementStep = { from: TilePoint; to: TilePoint };
type BfsCanTraverse = (
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
) => boolean;

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseTileKey(key: string): TilePoint {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function getParticipantFootprintSize(participant: TurnParticipant): 1 | 2 {
  return participant.footprintSize ?? 1;
}

export function getParticipantFootprintTiles(
  participant: TurnParticipant,
  origin: TilePoint = { x: participant.tileX, y: participant.tileY },
): TilePoint[] {
  const size = getParticipantFootprintSize(participant);
  const tiles: TilePoint[] = [];
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
      tiles.push({ x: origin.x + dx, y: origin.y + dy });
    }
  }
  return tiles;
}

export function getParticipantDistance(a: TurnParticipant, b: TurnParticipant): number {
  return getFootprintDistance(
    { x: a.tileX, y: a.tileY, size: getParticipantFootprintSize(a) },
    { x: b.tileX, y: b.tileY, size: getParticipantFootprintSize(b) },
  );
}

export function getFootprintDistance(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number },
): number {
  const aMaxX = a.x + a.size - 1;
  const aMaxY = a.y + a.size - 1;
  const bMaxX = b.x + b.size - 1;
  const bMaxY = b.y + b.size - 1;
  const dx = b.x > aMaxX ? b.x - aMaxX : a.x > bMaxX ? a.x - bMaxX : 0;
  const dy = b.y > aMaxY ? b.y - aMaxY : a.y > bMaxY ? a.y - bMaxY : 0;
  return Math.max(dx, dy);
}

export function isParticipantOnTile(participant: TurnParticipant, tileX: number, tileY: number): boolean {
  return getParticipantFootprintTiles(participant).some((tile) => tile.x === tileX && tile.y === tileY);
}

export function isFootprintInBounds(
  participant: TurnParticipant,
  origin: TilePoint,
  tileCtx: TurnTileContext,
): boolean {
  return getParticipantFootprintTiles(participant, origin).every((tile) =>
    tile.x >= 0 && tile.y >= 0 && tile.x < tileCtx.mapWidth && tile.y < tileCtx.mapHeight,
  );
}

export function isFootprintWalkable(
  participant: TurnParticipant,
  origin: TilePoint,
  tileCtx: TurnTileContext,
): boolean {
  return isFootprintInBounds(participant, origin, tileCtx) &&
    getParticipantFootprintTiles(participant, origin).every((tile) => tileCtx.isTileWalkable(tile.x, tile.y));
}

export function getOccupiedTileSet(
  participants: TurnParticipant[],
  movingParticipantId?: string,
): Set<string> {
  const occupied = new Set<string>();
  for (const participant of participants) {
    if (participant.id === movingParticipantId || participant.hp <= 0) continue;
    for (const tile of getParticipantFootprintTiles(participant)) {
      occupied.add(tileKey(tile.x, tile.y));
    }
  }
  return occupied;
}

export function bfsFlood(
  origin: TilePoint,
  maxCost: number,
  blocked: (tileX: number, tileY: number) => boolean,
  bounds: BfsBounds,
  canTraverse?: BfsCanTraverse,
): Map<string, number> {
  const costs = new Map<string, number>([[tileKey(origin.x, origin.y), 0]]);
  const queue: Array<TilePoint & { cost: number }> = [{ ...origin, cost: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const [dx, dy] of DIRS_8) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = tileKey(nx, ny);
      const newCost = current.cost + 1;

      if (newCost > maxCost) continue;
      if (costs.has(key)) continue;
      if (nx < 0 || ny < 0 || nx >= bounds.mapWidth || ny >= bounds.mapHeight) continue;
      if (blocked(nx, ny)) continue;
      if (canTraverse && !canTraverse(current.x, current.y, dx, dy)) continue;

      costs.set(key, newCost);
      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }

  return costs;
}

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

  const occupied = getOccupiedTileSet(state.participants, participant.id);
  const origin = { x: participant.tileX, y: participant.tileY };
  const blocked = (x: number, y: number) => {
    const candidate = { x, y };
    return !isFootprintWalkable(participant, candidate, tileCtx) ||
      getParticipantFootprintTiles(participant, candidate).some((tile) => occupied.has(tileKey(tile.x, tile.y)));
  };
  const costs = bfsFlood(
    origin,
    participant.mpRemaining,
    blocked,
    tileCtx,
    canTraverseCombatNeighbour(blocked),
  );

  return [...costs.keys()]
    .filter((key) => key !== tileKey(origin.x, origin.y))
    .map(parseTileKey);
}

/**
 * Returns all enemy participants attackable from the attacker's current tile.
 * Uses Chebyshev distance (max of |dx|, |dy|) to match isometric range feel.
 */
export function getAttackableTargets(
  attacker: TurnParticipant,
  state: TurnCombatState,
  tileCtx?: TurnTileContext,
): TurnParticipant[] {
  if (attacker.apRemaining <= 0) return [];
  if (attacker.hp <= 0) return [];

  const attackerIsEnemy = isEnemySide(attacker);
  return state.participants.filter((p) => {
    if (p.id === attacker.id) return false;
    // player and companion are on the same side
    if (attackerIsEnemy === isEnemySide(p)) return false;
    if (p.hp <= 0) return false;
    return getUsableAttacks(attacker, p, tileCtx).length > 0;
  });
}

export function getUsableAttacks(
  attacker: TurnParticipant,
  target: TurnParticipant,
  tileCtx?: TurnTileContext,
): TurnAttack[] {
  if (attacker.apRemaining <= 0) return [];
  if (attacker.hp <= 0) return [];
  if (target.hp <= 0) return [];

  const dist = getParticipantDistance(attacker, target);

  return getParticipantAttacks(attacker).filter((attack) => {
    if (attacker.apRemaining < attack.apCost) return false;
    if ((attacker.attackCooldowns?.[attack.id] ?? 0) > 0) return false;
    return dist >= attack.minRangeTiles && dist <= getEffectiveAttackMaxRange(attacker, target, attack, tileCtx);
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

export function getMovePath(
  participant: TurnParticipant,
  toTileX: number,
  toTileY: number,
  state: TurnCombatState,
  tileCtx: TurnTileContext,
): { x: number; y: number }[] | null {
  if (participant.mpRemaining <= 0) return null;

  const targetKey = `${toTileX},${toTileY}`;
  const occupied = getOccupiedTileSet(state.participants, participant.id);
  const startKey = tileKey(participant.tileX, participant.tileY);
  const blocked = (x: number, y: number) => {
    const candidate = { x, y };
    return !isFootprintWalkable(participant, candidate, tileCtx) ||
      getParticipantFootprintTiles(participant, candidate).some((tile) => occupied.has(tileKey(tile.x, tile.y)));
  };
  const costs = bfsFlood(
    { x: participant.tileX, y: participant.tileY },
    participant.mpRemaining,
    blocked,
    tileCtx,
    canTraverseCombatNeighbour(blocked),
  );
  if (!costs.has(targetKey)) return null;
  return rebuildPathFromCosts(costs, startKey, targetKey, canTraverseCombatNeighbour(blocked));
}

/** Returns true if the participant can attack the given target right now. */
export function isValidAttack(
  attacker: TurnParticipant,
  targetId: string,
  state: TurnCombatState,
  attackId?: string,
  tileCtx?: TurnTileContext,
): boolean {
  const target = state.participants.find((p) => p.id === targetId);
  if (!target) return false;

  const attacks = getUsableAttacks(attacker, target, tileCtx);
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

export function getTileElevation(tileCtx: TurnTileContext | undefined, tileX: number, tileY: number): number {
  const elevation = tileCtx?.getTerrainElevation?.(tileX, tileY);
  return Number.isFinite(elevation) ? elevation ?? 0 : 0;
}

export function getElevationDelta(
  attacker: TurnParticipant,
  target: TurnParticipant,
  tileCtx?: TurnTileContext,
): number {
  return getTileElevation(tileCtx, attacker.tileX, attacker.tileY) -
    getTileElevation(tileCtx, target.tileX, target.tileY);
}

export function getEffectiveAttackMaxRange(
  attacker: TurnParticipant,
  target: TurnParticipant,
  attack: TurnAttack,
  tileCtx?: TurnTileContext,
): number {
  if (!isRangedAttack(attacker, attack)) {
    return attack.maxRangeTiles;
  }

  const heightAdvantage = Math.max(0, Math.floor(getElevationDelta(attacker, target, tileCtx)));
  return attack.maxRangeTiles + heightAdvantage;
}

export function isRangedAttack(attacker: TurnParticipant, attack: TurnAttack): boolean {
  return attacker.weaponId === 'bow' || attack.minRangeTiles >= 2;
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

  const target = state.participants.find((p) => isParticipantOnTile(p, targetTileX, targetTileY));
  let best: { x: number; y: number } | null = null;
  let bestDist = target
    ? getParticipantDistance(mover, target)
    : chebyshevDist(mover.tileX, mover.tileY, targetTileX, targetTileY);

  for (const tile of reachable) {
    const dist = target
      ? getFootprintDistance(
          { x: tile.x, y: tile.y, size: getParticipantFootprintSize(mover) },
          { x: target.tileX, y: target.tileY, size: getParticipantFootprintSize(target) },
        )
      : chebyshevDist(tile.x, tile.y, targetTileX, targetTileY);
    if (dist < bestDist) {
      bestDist = dist;
      best = tile;
    }
  }

  return best;
}

export function buildMovementSteps(
  fromTile: TilePoint,
  path: TilePoint[],
): TurnMovementStep[] {
  const steps: TurnMovementStep[] = [];
  let current = fromTile;
  for (const to of path) {
    steps.push({ from: current, to });
    current = to;
  }
  return steps;
}

export function findReactionStep(
  reactor: TurnParticipant,
  steps: TurnMovementStep[],
): (TurnMovementStep & { fromDist: number }) | null {
  for (const step of steps) {
    const reaction = doesStepProvokeReaction(reactor, step.from, step.to);
    if (reaction) return { ...step, fromDist: reaction.fromDist };
  }
  return null;
}

export function doesStepProvokeReaction(
  reactor: TurnParticipant,
  from: TilePoint,
  to: TilePoint,
): { fromDist: number } | null {
  const fromDist = chebyshevDist(reactor.tileX, reactor.tileY, from.x, from.y);
  if (fromDist > 1) return null;

  const toDist = chebyshevDist(reactor.tileX, reactor.tileY, to.x, to.y);
  if (toDist < fromDist) return null;

  return { fromDist };
}

export function selectReactionAttack(actor: TurnParticipant, distance: number): TurnAttack | null {
  if (actor.kind === 'player' && actor.weaponId === 'bow') return null;
  return getParticipantAttacks(actor).find((attack) => {
    if (attack.telegraph) return false;
    if ((actor.attackCooldowns?.[attack.id] ?? 0) > 0) return false;
    return distance >= attack.minRangeTiles && distance <= Math.min(1, attack.maxRangeTiles);
  }) ?? null;
}

export function isSameSide(a: TurnParticipant, b: TurnParticipant): boolean {
  return isEnemySide(a) === isEnemySide(b);
}

export function isEnemySide(participant: TurnParticipant): boolean {
  return participant.kind === 'enemy' || participant.kind === 'object';
}

function rebuildPathFromCosts(
  costs: Map<string, number>,
  startKey: string,
  targetKey: string,
  canTraverse?: BfsCanTraverse,
): { x: number; y: number }[] {
  const reversed: { x: number; y: number }[] = [];
  let currentKey = targetKey;

  while (currentKey !== startKey) {
    const currentCost = costs.get(currentKey);
    if (currentCost === undefined || currentCost <= 0) break;
    const current = parseTileKey(currentKey);
    reversed.push(current);
    const previous = DIRS_8.find(([dx, dy]) => {
      const previousX = current.x - dx;
      const previousY = current.y - dy;
      return costs.get(tileKey(previousX, previousY)) === currentCost - 1
        && (!canTraverse || canTraverse(previousX, previousY, dx, dy));
    });
    if (!previous) break;
    currentKey = tileKey(current.x - previous[0], current.y - previous[1]);
  }

  return reversed.reverse();
}

function canTraverseCombatNeighbour(
  blocked: (tileX: number, tileY: number) => boolean,
): BfsCanTraverse {
  return (fromX, fromY, dx, dy) => {
    if (dx === 0 || dy === 0) {
      return true;
    }

    return !blocked(fromX + dx, fromY) && !blocked(fromX, fromY + dy);
  };
}
