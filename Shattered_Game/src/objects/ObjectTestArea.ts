import type { ObjectPlacementSystem } from './ObjectPlacementSystem';

type Placement = { definitionId: string; tileX: number; tileY: number };

type ObjectTestAreaConfig = {
  placement: ObjectPlacementSystem;
  mapWidth: number;
  mapHeight: number;
  spawnX: number;
  spawnY: number;
};

type PassConfig = {
  step: number;
  offsetX: number;
  offsetY: number;
  jitter: number;
  chance: number;
  clearance: number;
  salt: number;
  mapWidth: number;
  mapHeight: number;
  limit?: number;
  pick: (gx: number, gy: number) => string;
};

export class ObjectTestArea {
  private readonly placedIds: string[] = [];
  private removableId?: string;

  constructor(private readonly config: ObjectTestAreaConfig) {}

  build(): void {
    const { placement, mapWidth, mapHeight, spawnX, spawnY } = this.config;
    for (const p of generateForest(mapWidth, mapHeight, spawnX, spawnY)) {
      const instance = placement.placeObject(p.definitionId, p.tileX, p.tileY);
      if (!instance) continue;
      this.placedIds.push(instance.id);
      if (this.removableId === undefined && instance.definitionId === 'tree_test') {
        this.removableId = instance.id;
      }
    }
  }

  removeOneTestObject(): boolean {
    if (!this.removableId) return false;
    const removed = this.config.placement.removeObject(this.removableId);
    if (removed) this.removableId = undefined;
    return removed;
  }

  getPlacedInstanceIds(): string[] {
    return [...this.placedIds];
  }
}

// FNV-1a hash — deterministic, no RNG state. Same inputs always give same output.
function h(x: number, y: number, salt: number): number {
  let v = 2166136261;
  v ^= x & 0xff;           v = Math.imul(v, 16777619) >>> 0;
  v ^= (x >> 8) & 0xff;   v = Math.imul(v, 16777619) >>> 0;
  v ^= y & 0xff;           v = Math.imul(v, 16777619) >>> 0;
  v ^= (y >> 8) & 0xff;   v = Math.imul(v, 16777619) >>> 0;
  v ^= salt & 0xff;        v = Math.imul(v, 16777619) >>> 0;
  return v / 0x100000000;
}

function runPass(
  cfg: PassConfig,
  out: Placement[],
  spawnDist: (tx: number, ty: number) => number,
): void {
  const startCount = out.length;
  for (let gy = cfg.offsetY; gy < cfg.mapHeight; gy += cfg.step) {
    for (let gx = cfg.offsetX; gx < cfg.mapWidth; gx += cfg.step) {
      if (cfg.limit !== undefined && out.length - startCount >= cfg.limit) return;
      if (h(gx, gy, cfg.salt) > cfg.chance) continue;
      const jx = Math.floor(h(gx, gy, cfg.salt + 100) * (cfg.jitter * 2 + 1)) - cfg.jitter;
      const jy = Math.floor(h(gx, gy, cfg.salt + 200) * (cfg.jitter * 2 + 1)) - cfg.jitter;
      const tx = gx + jx;
      const ty = gy + jy;
      if (tx < 0 || tx >= cfg.mapWidth || ty < 0 || ty >= cfg.mapHeight) continue;
      if (cfg.clearance > 0 && spawnDist(tx, ty) < cfg.clearance) continue;
      out.push({ definitionId: cfg.pick(gx, gy), tileX: tx, tileY: ty });
    }
  }
}

function generateForest(
  mapWidth: number,
  mapHeight: number,
  spawnX: number,
  spawnY: number,
): Placement[] {
  const out: Placement[] = [];

  function spawnDist(tx: number, ty: number): number {
    const dx = tx - spawnX;
    const dy = ty - spawnY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Pass A — Huge trees (4× scale, 2×2 footprint): landmark canopy trees
  runPass({
    step: 24, offsetX: 0, offsetY: 0, jitter: 4, chance: 0.45, clearance: 14, salt: 1, mapWidth, mapHeight,
    pick: (gx, gy) => h(gx, gy, 10) < 0.5 ? 'tree_01_4x' : 'tree_02_4x',
  }, out, spawnDist);

  // Pass B — Large trees (2× scale, 1×1 footprint): mid-layer canopy
  runPass({
    step: 14, offsetX: 2, offsetY: 3, jitter: 2, chance: 0.60, clearance: 11, salt: 2, mapWidth, mapHeight,
    pick: (gx, gy) => {
      const r = h(gx, gy, 20);
      return r < 0.35 ? 'tree_01_2x' : r < 0.65 ? 'tree_02_2x' : 'tree_tall';
    },
  }, out, spawnDist);

  // Pass C — Small trees (1× scale): understory fill
  runPass({
    step: 10, offsetX: 1, offsetY: 2, jitter: 2, chance: 0.55, clearance: 8, salt: 3, mapWidth, mapHeight,
    pick: (gx, gy) => {
      const r = h(gx, gy, 30);
      return r < 0.4 ? 'tree_test' : r < 0.75 ? 'tree_dark' : 'tree_tall';
    },
  }, out, spawnDist);

  // Pass D — Rocks: scattered boulders through the forest
  runPass({
    step: 28, offsetX: 5, offsetY: 7, jitter: 5, chance: 0.65, clearance: 7, salt: 4, mapWidth, mapHeight,
    pick: (gx, gy) => {
      const r = h(gx, gy, 40);
      return r < 0.40 ? 'small_rock' : r < 0.72 ? 'medium_rock' : 'large_rock';
    },
  }, out, spawnDist);

  return out;
}
