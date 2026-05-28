import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from './EnemyDefinitions';
import { advanceEnemyStateMachine, createEnemyRuntimeState } from './EnemyStateMachine';

const wolfAggressive = ENEMY_DEFINITIONS.find((d) => d.id === 'wolf_aggressive')!;
const wolfPassive    = ENEMY_DEFINITIONS.find((d) => d.id === 'wolf_passive')!;

const TILE_W = 32;
const TILE_H = 16;

const tileCtx = {
  tileWidth:  TILE_W,
  tileHeight: TILE_H,
  mapWidth:   64,
  mapHeight:  64,
  worldToTile:        (x: number, y: number) => ({ x: Math.round(x / TILE_W), y: Math.round(y / TILE_H) }),
  getTileCenterWorld: (tx: number, ty: number) => ({ x: tx * TILE_W, y: ty * TILE_H }),
  getTileDiamondPoints: (tx: number, ty: number) => {
    const cx = tx * TILE_W;
    const cy = ty * TILE_H;
    return [
      { x: cx,            y: cy - TILE_H / 2 },
      { x: cx + TILE_W / 2, y: cy },
      { x: cx,            y: cy + TILE_H / 2 },
      { x: cx - TILE_W / 2, y: cy },
    ];
  },
  isTileWalkable: () => true,
};

function ctx(
  nowMs: number,
  playerX: number,
  playerY: number,
  opts: { playerTier?: number; engagedWithId?: string | null } = {},
) {
  const playerTier = opts.playerTier ?? 1;
  const playerEngagedWithEnemyId = opts.engagedWithId ?? null;
  return {
    ...tileCtx,
    nowMs,
    deltaMs: 16,
    playerWorldX: playerX,
    playerWorldY: playerY,
    playerInvulnerable: false,
    playerHitPoints: [{ x: playerX, y: playerY }],
    playerOccupiedTiles: [{ x: Math.round(playerX / TILE_W), y: Math.round(playerY / TILE_H) }],
    playerEngagedWithEnemyId,
    playerTier,
  };
}

function idleAt(def: typeof wolfAggressive, id: string, worldX = 0, worldY = 0) {
  return createEnemyRuntimeState(
    def,
    { id, definitionId: def.id, mapId: 'test', tileX: 0, tileY: 0 },
    worldX,
    worldY,
  );
}

// ─── idle → aggro transitions ─────────────────────────────────────────────

describe('idle → aggro transitions', () => {
  it('aggressive wolf aggros when player enters aggro range', () => {
    // aggroRangeTiles=8, tileWidth=32 -> aggroRange = 256 world units
    const state  = idleAt(wolfAggressive, 'wa-01');
    const result = advanceEnemyStateMachine(wolfAggressive, state, ctx(100, 100, 0));
    expect(result.state.currentState).toBe('aggro');
  });

  it('aggressive wolf stays idle when player is beyond aggro range', () => {
    const state  = idleAt(wolfAggressive, 'wa-02');
    const result = advanceEnemyStateMachine(wolfAggressive, state, ctx(100, 300, 0));
    expect(result.state.currentState).toBe('idle');
  });

  it('passive wolf stays idle even when player is inside range', () => {
    const state  = idleAt(wolfPassive, 'wp-01');
    const result = advanceEnemyStateMachine(wolfPassive, state, ctx(100, 50, 0));
    expect(result.state.currentState).toBe('idle');
  });

  it('passive wolf aggros when reactiveAggro is set', () => {
    const state = idleAt(wolfPassive, 'wp-02');
    state.reactiveAggro = true;
    const result = advanceEnemyStateMachine(wolfPassive, state, ctx(100, 50, 0));
    expect(result.state.currentState).toBe('aggro');
  });

  it('aggressive wolf stays idle when player is already engaged with another enemy', () => {
    // 1v1 lock: enemy not the engaged target should not aggro
    const state  = idleAt(wolfAggressive, 'wa-03');
    const result = advanceEnemyStateMachine(
      wolfAggressive,
      state,
      ctx(100, 100, 0, { engagedWithId: 'some_other_enemy' }),
    );
    expect(result.state.currentState).toBe('idle');
  });
});

// ─── tier suppression ─────────────────────────────────────────────────────

describe('tier suppression', () => {
  it('enemy with tier 1 stays idle when player tier is 3 (outlevels by ≥2)', () => {
    // tooWeak = (tier <= playerTier - 2) → (1 <= 1) = true → suppressed
    const state  = idleAt(wolfAggressive, 'tier-01');
    const result = advanceEnemyStateMachine(wolfAggressive, state, ctx(100, 100, 0, { playerTier: 3 }));
    expect(result.state.currentState).toBe('idle');
  });

  it('enemy with tier 1 still aggros when player tier is 2 (gap is only 1)', () => {
    // tooWeak = (1 <= 2-2=0) = false → normal aggro
    const state  = idleAt(wolfAggressive, 'tier-02');
    const result = advanceEnemyStateMachine(wolfAggressive, state, ctx(100, 100, 0, { playerTier: 2 }));
    expect(result.state.currentState).toBe('aggro');
  });
});

// ─── leash and reset ──────────────────────────────────────────────────────

describe('leash and reset', () => {
  it('enemy in approach resets when player runs beyond deAggro range', () => {
    // deAggroRangeTiles=20, tileWidth=32 -> deAggroRange = 640 world units from enemy
    // enemy at (0,0), player at (700,0) -> distance 700 > 640 -> reset
    const state = idleAt(wolfAggressive, 'leash-01');
    state.currentState = 'approach';
    const result = advanceEnemyStateMachine(wolfAggressive, state, ctx(100, 700, 0));
    expect(result.state.currentState).toBe('reset');
  });

  it('enemy in approach resets when it has strayed beyond leash range and player retreated', () => {
    // leashRangeTiles=14, tileWidth=32 -> leashRange = 448 world units from leashAnchor (0,0)
    // aggroRange = 256; enemy at (500,0) -> leashAnchorDist=500>448; player at (800,0) -> distToPlayer=300>256
    const state = idleAt(wolfAggressive, 'leash-02');
    state.currentState = 'approach';
    state.worldX = 500;
    const result = advanceEnemyStateMachine(wolfAggressive, state, ctx(100, 800, 0));
    expect(result.state.currentState).toBe('reset');
  });

  it('passive wolf clears reactiveAggro when it finishes resetting to origin', () => {
    const state = idleAt(wolfPassive, 'leash-03');
    state.currentState = 'reset';
    state.reactiveAggro = true;
    // enemy is already at origin (0,0) → distance to origin = 0 ≤ 2 → snaps to idle
    const result = advanceEnemyStateMachine(wolfPassive, state, ctx(100, 400, 0));
    expect(result.state.currentState).toBe('idle');
    expect(result.state.reactiveAggro).toBe(false);
  });
});
