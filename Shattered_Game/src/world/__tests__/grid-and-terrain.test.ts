import { describe, it, expect } from 'vitest';
import { WorldGrid } from '../WorldGrid';
import { generateOrganicIsland } from '../IslandGenerator';
import { sampleTerrainNeighbours } from '../terrain/TerrainNeighbourSampler';
import { TerrainResolver } from '../terrain/TerrainResolver';
import {
  getSeededUnitFloat,
  selectWeightedTerrainVariant,
  selectTerrainTransform,
} from '../terrain/TerrainVariantSelector';
import type {
  TerrainFamily,
  TerrainNeighbourFamilies,
  TerrainTileDefinition,
} from '../terrain/TerrainTypes';
import { createUniformTerrainEdges } from '../terrain/TerrainTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGrid(tiles: string[][]): WorldGrid {
  return new WorldGrid(tiles[0].length, tiles.length, tiles as any);
}

function uniformNeighbours(family: TerrainFamily): TerrainNeighbourFamilies {
  return {
    edges: { xPlus: family, xMinus: family, yPlus: family, yMinus: family },
    corners: {
      xPlusYPlus: family,
      xPlusYMinus: family,
      xMinusYPlus: family,
      xMinusYMinus: family,
    },
  };
}

function makeNeighbours(
  edges: Partial<TerrainNeighbourFamilies['edges']> = {},
  corners: Partial<TerrainNeighbourFamilies['corners']> = {},
  defaultFamily: TerrainFamily = 'grass',
): TerrainNeighbourFamilies {
  return {
    edges: {
      xPlus: defaultFamily,
      xMinus: defaultFamily,
      yPlus: defaultFamily,
      yMinus: defaultFamily,
      ...edges,
    },
    corners: {
      xPlusYPlus: defaultFamily,
      xPlusYMinus: defaultFamily,
      xMinusYPlus: defaultFamily,
      xMinusYMinus: defaultFamily,
      ...corners,
    },
  };
}

function minimalTileDef(
  id: string,
  family: TerrainTileDefinition['family'],
  weight = 1,
): TerrainTileDefinition {
  return {
    id,
    family,
    role: 'full',
    spriteFrame: `terrain-${id}`,
    weight,
    walkable: true,
    edges: createUniformTerrainEdges(family as any),
    allowFlipX: false,
    allowFlipY: false,
    allowRotation: false,
  };
}

// ---------------------------------------------------------------------------
// WorldGrid
// ---------------------------------------------------------------------------

describe('WorldGrid', () => {
  describe('construction', () => {
    it('exposes correct width and height', () => {
      const grid = makeGrid([
        ['grass', 'grass', 'grass'],
        ['grass', 'grass', 'grass'],
      ]);
      expect(grid.width).toBe(3);
      expect(grid.height).toBe(2);
    });

    it('counts initial water tiles', () => {
      const grid = makeGrid([
        ['grass', 'water', 'water'],
        ['grass', 'grass', 'water'],
      ]);
      expect(grid.getTerrainBlockedTileCount()).toBe(3);
    });

    it('honors editor-authored terrain walkability overrides', () => {
      const grid = new WorldGrid(2, 1, [['grass', 'water']] as any, {
        '0,0': false,
        '1,0': true,
      });

      expect(grid.isTerrainBlocked(0, 0)).toBe(true);
      expect(grid.isTerrainBlocked(1, 0)).toBe(false);
      expect(grid.getTerrainBlockedTileCount()).toBe(1);
    });

    it('can use sparse terrain storage for large streamed worlds', () => {
      const grid = WorldGrid.createSparse(32_000, 32_000, 'grass');

      expect(grid.getTile(20_000, 20_000)).toBe('grass');
      expect(grid.getTerrainBlockedTileCount()).toBe(0);

      grid.setTile(20_000, 20_000, 'water');

      expect(grid.getTile(20_000, 20_000)).toBe('water');
      expect(grid.isTerrainBlocked(20_000, 20_000)).toBe(true);
      expect(grid.getTerrainBlockedTileCount()).toBe(1);
    });

    it('supports sparse walkability overrides', () => {
      const grid = WorldGrid.createSparse(100, 100, 'water');

      expect(grid.isTerrainBlocked(10, 10)).toBe(true);

      grid.setTerrainWalkabilityOverride(10, 10, true);

      expect(grid.isTerrainBlocked(10, 10)).toBe(false);
    });
  });

  describe('getTile', () => {
    it('returns the correct terrain family', () => {
      const grid = makeGrid([
        ['grass', 'water'],
        ['dirt', 'sand'],
      ]);
      expect(grid.getTile(0, 0)).toBe('grass');
      expect(grid.getTile(1, 0)).toBe('water');
      expect(grid.getTile(0, 1)).toBe('dirt');
      expect(grid.getTile(1, 1)).toBe('sand');
    });

    it('returns null for out-of-bounds coordinates', () => {
      const grid = makeGrid([['grass']]);
      expect(grid.getTile(-1, 0)).toBeNull();
      expect(grid.getTile(0, -1)).toBeNull();
      expect(grid.getTile(1, 0)).toBeNull();
      expect(grid.getTile(0, 1)).toBeNull();
    });

    it('returns null for non-integer coordinates', () => {
      const grid = makeGrid([['grass', 'grass']]);
      expect(grid.getTile(0.5, 0)).toBeNull();
    });
  });

  describe('setTile', () => {
    it('updates the tile value', () => {
      const grid = makeGrid([['grass', 'grass']]);
      grid.setTile(1, 0, 'water');
      expect(grid.getTile(1, 0)).toBe('water');
    });

    it('updates terrainBlockedCount when changing to water', () => {
      const grid = makeGrid([['grass', 'grass']]);
      expect(grid.getTerrainBlockedTileCount()).toBe(0);
      grid.setTile(0, 0, 'water');
      expect(grid.getTerrainBlockedTileCount()).toBe(1);
    });

    it('updates terrainBlockedCount when changing away from water', () => {
      const grid = makeGrid([['water', 'grass']]);
      expect(grid.getTerrainBlockedTileCount()).toBe(1);
      grid.setTile(0, 0, 'grass');
      expect(grid.getTerrainBlockedTileCount()).toBe(0);
    });

    it('ignores out-of-bounds coordinates', () => {
      const grid = makeGrid([['grass']]);
      grid.setTile(5, 5, 'water');
      expect(grid.getTerrainBlockedTileCount()).toBe(0);
    });
  });

  describe('terrain blocking', () => {
    it('water tiles are terrain-blocked', () => {
      const grid = makeGrid([['water', 'grass']]);
      expect(grid.isTerrainBlocked(0, 0)).toBe(true);
      expect(grid.isTerrainBlocked(1, 0)).toBe(false);
    });

    it('out-of-bounds tiles are terrain-blocked', () => {
      const grid = makeGrid([['grass']]);
      expect(grid.isTerrainBlocked(-1, 0)).toBe(true);
      expect(grid.isTerrainBlocked(0, 99)).toBe(true);
    });

    it('non-water tiles are not terrain-blocked', () => {
      const grid = makeGrid([['grass', 'dirt', 'stone', 'sand']]);
      for (let x = 0; x < 4; x++) {
        expect(grid.isTerrainBlocked(x, 0)).toBe(false);
      }
    });
  });

  describe('object blocking', () => {
    it('tile is not object-blocked by default', () => {
      const grid = makeGrid([['grass']]);
      expect(grid.isObjectBlocked(0, 0)).toBe(false);
    });

    it('blockTile marks tile as object-blocked', () => {
      const grid = makeGrid([['grass']]);
      grid.blockTile(0, 0, 'tree:1');
      expect(grid.isObjectBlocked(0, 0)).toBe(true);
    });

    it('unblockTile removes the block when last source is removed', () => {
      const grid = makeGrid([['grass']]);
      grid.blockTile(0, 0, 'tree:1');
      grid.unblockTile(0, 0, 'tree:1');
      expect(grid.isObjectBlocked(0, 0)).toBe(false);
    });

    it('tile stays blocked if another source still holds it', () => {
      const grid = makeGrid([['grass']]);
      grid.blockTile(0, 0, 'tree:1');
      grid.blockTile(0, 0, 'tree:2');
      grid.unblockTile(0, 0, 'tree:1');
      expect(grid.isObjectBlocked(0, 0)).toBe(true);
    });

    it('getObjectBlockedTileCount counts distinct tiles', () => {
      const grid = makeGrid([['grass', 'grass', 'grass']]);
      grid.blockTile(0, 0, 'a');
      grid.blockTile(0, 0, 'b');
      grid.blockTile(1, 0, 'c');
      expect(grid.getObjectBlockedTileCount()).toBe(2);
    });
  });

  describe('isTileWalkable', () => {
    it('walkable for non-water, non-object-blocked tile', () => {
      const grid = makeGrid([['grass']]);
      expect(grid.isTileWalkable(0, 0)).toBe(true);
    });

    it('not walkable for water tile', () => {
      const grid = makeGrid([['water']]);
      expect(grid.isTileWalkable(0, 0)).toBe(false);
    });

    it('not walkable for object-blocked tile', () => {
      const grid = makeGrid([['grass']]);
      grid.blockTile(0, 0, 'rock:1');
      expect(grid.isTileWalkable(0, 0)).toBe(false);
    });

    it('not walkable out-of-bounds', () => {
      const grid = makeGrid([['grass']]);
      expect(grid.isTileWalkable(-1, 0)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// IslandGenerator
// ---------------------------------------------------------------------------

describe('generateOrganicIsland', () => {
  it('returns a grid with the correct number of rows and columns', () => {
    const grid = generateOrganicIsland(20, 15);
    expect(grid.length).toBe(15);
    for (const row of grid) {
      expect(row.length).toBe(20);
    }
  });

  it('contains only valid terrain families', () => {
    const valid = new Set(['grass', 'dirt', 'sand', 'water']);
    const grid = generateOrganicIsland(30, 30);
    for (const row of grid) {
      for (const tile of row) {
        expect(valid.has(tile)).toBe(true);
      }
    }
  });

  it('places dirt at the very center', () => {
    // centreDistance formula is size-independent for pixels very close to centre
    const grid = generateOrganicIsland(180, 180);
    // The absolute center pixel is always within centreDistance < 1.05
    expect(grid[89][89]).toBe('dirt');
    expect(grid[90][90]).toBe('dirt');
  });

  it('places water at corners for a reasonably sized map', () => {
    const grid = generateOrganicIsland(60, 60);
    // Corners are far from center → always water regardless of noise
    expect(grid[0][0]).toBe('water');
    expect(grid[0][59]).toBe('water');
    expect(grid[59][0]).toBe('water');
    expect(grid[59][59]).toBe('water');
  });

  it('contains all four terrain families on a 180x180 map', () => {
    const grid = generateOrganicIsland(180, 180);
    const found = new Set<string>();
    for (const row of grid) {
      for (const tile of row) found.add(tile);
    }
    expect(found.has('dirt')).toBe(true);
    expect(found.has('grass')).toBe(true);
    expect(found.has('sand')).toBe(true);
    expect(found.has('water')).toBe(true);
  });

  it('is deterministic — same dimensions produce identical grids', () => {
    const a = generateOrganicIsland(40, 40);
    const b = generateOrganicIsland(40, 40);
    expect(a).toEqual(b);
  });

  it('island is mostly water (ocean surrounding a land mass)', () => {
    const grid = generateOrganicIsland(180, 180);
    let waterCount = 0;
    for (const row of grid) {
      for (const tile of row) {
        if (tile === 'water') waterCount++;
      }
    }
    const total = 180 * 180;
    expect(waterCount / total).toBeGreaterThan(0.3);
  });
});

// ---------------------------------------------------------------------------
// TerrainNeighbourSampler
// ---------------------------------------------------------------------------

describe('sampleTerrainNeighbours', () => {
  it('reads all four edge neighbours correctly', () => {
    const grid = makeGrid([
      ['water', 'grass', 'water'],
      ['dirt',  'stone', 'sand' ],
      ['water', 'grass', 'water'],
    ]);
    const neighbours = sampleTerrainNeighbours(grid, 1, 1); // center tile = stone
    expect(neighbours.edges.xPlus).toBe('sand');
    expect(neighbours.edges.xMinus).toBe('dirt');
    expect(neighbours.edges.yPlus).toBe('grass');
    expect(neighbours.edges.yMinus).toBe('grass');
  });

  it('reads all four corner neighbours correctly', () => {
    const grid = makeGrid([
      ['grass', 'water', 'dirt' ],
      ['sand',  'stone', 'grass'],
      ['water', 'dirt',  'sand' ],
    ]);
    const neighbours = sampleTerrainNeighbours(grid, 1, 1);
    expect(neighbours.corners.xPlusYPlus).toBe('sand');
    expect(neighbours.corners.xPlusYMinus).toBe('dirt');
    expect(neighbours.corners.xMinusYPlus).toBe('water');
    expect(neighbours.corners.xMinusYMinus).toBe('grass');
  });

  it('returns water for out-of-bounds edge neighbours', () => {
    const grid = makeGrid([
      ['grass', 'grass'],
      ['grass', 'grass'],
    ]);
    const topLeft = sampleTerrainNeighbours(grid, 0, 0);
    expect(topLeft.edges.xMinus).toBe('water');
    expect(topLeft.edges.yMinus).toBe('water');

    const bottomRight = sampleTerrainNeighbours(grid, 1, 1);
    expect(bottomRight.edges.xPlus).toBe('water');
    expect(bottomRight.edges.yPlus).toBe('water');
  });

  it('returns water for out-of-bounds corner neighbours', () => {
    const grid = makeGrid([['grass']]);
    const neighbours = sampleTerrainNeighbours(grid, 0, 0);
    expect(neighbours.corners.xPlusYPlus).toBe('water');
    expect(neighbours.corners.xPlusYMinus).toBe('water');
    expect(neighbours.corners.xMinusYPlus).toBe('water');
    expect(neighbours.corners.xMinusYMinus).toBe('water');
  });
});

// ---------------------------------------------------------------------------
// TerrainResolver
// ---------------------------------------------------------------------------

describe('TerrainResolver', () => {
  const resolver = new TerrainResolver();

  describe('base tile resolution', () => {
    it('resolves grass to a grass tile definition', () => {
      const result = resolver.resolve({ family: 'grass', gridX: 0, gridY: 0 });
      expect(result.baseTileDefinition.family).toBe('grass');
    });

    it('resolves sand to a dirt tile definition (sand maps to dirt visually)', () => {
      const result = resolver.resolve({ family: 'sand', gridX: 0, gridY: 0 });
      expect(result.baseTileDefinition.family).toBe('dirt');
    });

    it('is deterministic — same coordinates always yield the same tile', () => {
      const a = resolver.resolve({ family: 'grass', gridX: 7, gridY: 13 });
      const b = resolver.resolve({ family: 'grass', gridX: 7, gridY: 13 });
      expect(a.baseTileDefinition.id).toBe(b.baseTileDefinition.id);
    });

    it('can produce different tiles for different coordinates', () => {
      const ids = new Set<string>();
      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          const r = resolver.resolve({ family: 'grass', gridX: x, gridY: y });
          ids.add(r.baseTileDefinition.id);
        }
      }
      expect(ids.size).toBeGreaterThan(1);
    });
  });

  describe('transition detection', () => {
    it('produces no transition overlays when all neighbours are the same family', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 5,
        gridY: 5,
        neighbours: uniformNeighbours('grass'),
      });
      expect(result.transitionOverlays).toHaveLength(0);
    });

    it('produces no transition overlays for water surrounded by water', () => {
      const result = resolver.resolve({
        family: 'water',
        gridX: 0,
        gridY: 0,
        neighbours: uniformNeighbours('water'),
      });
      expect(result.transitionOverlays).toHaveLength(0);
    });

    it('detects shoreline edge transitions on a grass tile surrounded by water', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 5,
        gridY: 5,
        neighbours: uniformNeighbours('water'),
      });
      const shorelineEdges = result.transitionOverlays.filter(
        (o) => o.definition.kind === 'shorelineEdge',
      );
      expect(shorelineEdges).toHaveLength(4);
    });

    it('detects shoreline corner transitions on a grass tile surrounded by water', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 5,
        gridY: 5,
        neighbours: uniformNeighbours('water'),
      });
      const shorelineCorners = result.transitionOverlays.filter(
        (o) => o.definition.kind === 'shorelineCorner',
      );
      expect(shorelineCorners).toHaveLength(4);
    });

    it('detects only the affected edge when a single water neighbour is present', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 5,
        gridY: 5,
        neighbours: makeNeighbours({ xPlus: 'water' }),
      });
      const edgeKinds = result.transitionOverlays.map((o) => o.definition.kind);
      expect(edgeKinds).toContain('shorelineEdge');
      expect(edgeKinds.filter((k) => k === 'shorelineEdge')).toHaveLength(1);
    });

    it('assigns the correct direction for a single water edge', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({ xPlus: 'water' }),
      });
      const edgeTransition = result.transitionOverlays.find(
        (o) => o.definition.kind === 'shorelineEdge',
      );
      expect(edgeTransition?.definition.direction).toBe('xPlus');
    });

    it('detects a land edge transition when grass meets dirt', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({ xPlus: 'dirt' }),
      });
      const edge = result.transitionOverlays.find((o) => o.definition.kind === 'edge');
      expect(edge).toBeDefined();
      expect(edge?.definition.fromFamily).toBe('grass');
      expect(edge?.definition.toFamily).toBe('dirt');
      expect(edge?.definition.direction).toBe('xPlus');
    });

    it('detects outer corner transitions when two adjacent edges differ', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({ xPlus: 'dirt', yPlus: 'dirt' }),
      });
      const outerCorner = result.transitionOverlays.find(
        (o) => o.definition.kind === 'outerCorner' && o.definition.direction === 'xPlusYPlus',
      );
      expect(outerCorner).toBeDefined();
    });

    it('detects inner corner transitions when only the diagonal differs', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({}, { xPlusYPlus: 'dirt' }),
      });
      const innerCorner = result.transitionOverlays.find(
        (o) => o.definition.kind === 'innerCorner' && o.definition.direction === 'xPlusYPlus',
      );
      expect(innerCorner).toBeDefined();
    });

    it('renders shoreline transitions on water tiles when water touches land', () => {
      // Shoreline art belongs to the water tile so visuals match the blocked water tile.
      const result = resolver.resolve({
        family: 'water',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({ xPlus: 'grass' }, {}, 'water'),
      });
      const shorelines = result.transitionOverlays.filter(
        (o) => o.definition.kind === 'shorelineEdge' || o.definition.kind === 'shorelineCorner',
      );

      expect(shorelines.length).toBeGreaterThan(0);
      expect(shorelines.every((o) => o.definition.fromFamily === 'water')).toBe(true);
      expect(shorelines.every((o) => o.definition.toFamily === 'grass')).toBe(true);
    });

    it('does not render transitions when lower-priority tile looks at higher-priority neighbour (dirt looking at grass)', () => {
      // Dirt (priority 2) with grass (priority 1) neighbour: 1 < 2, so no transition on dirt tile
      const result = resolver.resolve({
        family: 'dirt',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({ xPlus: 'grass' }, {}, 'dirt'),
      });
      const grassTransitions = result.transitionOverlays.filter(
        (o) => o.definition.toFamily === 'grass',
      );
      expect(grassTransitions).toHaveLength(0);
    });

    it('shoreline transitions take higher priority than land transitions in the overlay list', () => {
      // A grass tile touching water: shorelineEdge (priority 100) > edge (priority 60)
      const result = resolver.resolve({
        family: 'grass',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({ xPlus: 'water', yPlus: 'dirt' }),
      });
      const priorities = result.transitionOverlays.map((o) => o.definition.priority);
      // Results should be sorted descending
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
      }
      const shorelineIdx = result.transitionOverlays.findIndex(
        (o) => o.definition.kind === 'shorelineEdge',
      );
      const landEdgeIdx = result.transitionOverlays.findIndex(
        (o) => o.definition.kind === 'edge',
      );
      if (shorelineIdx !== -1 && landEdgeIdx !== -1) {
        expect(shorelineIdx).toBeLessThan(landEdgeIdx);
      }
    });

    it('transition definitions with available sprite frames have renderMode replaceBase', () => {
      const result = resolver.resolve({
        family: 'grass',
        gridX: 0,
        gridY: 0,
        neighbours: makeNeighbours({ xPlus: 'dirt' }),
      });
      const edge = result.transitionOverlays.find(
        (o) => o.definition.kind === 'edge' && o.definition.direction === 'xPlus',
      );
      expect(edge?.definition.renderMode).toBe('replaceBase');
    });
  });

  describe('custom definitions', () => {
    it('throws when no tile candidates exist for the requested family', () => {
      const resolverNoTiles = new TerrainResolver([], []);
      expect(() =>
        resolverNoTiles.resolve({ family: 'grass', gridX: 0, gridY: 0 }),
      ).toThrow();
    });

    it('uses injected definitions instead of defaults', () => {
      const customTiles = [minimalTileDef('custom-grass', 'grass', 1)];
      const customResolver = new TerrainResolver(customTiles, []);
      const result = customResolver.resolve({ family: 'grass', gridX: 0, gridY: 0 });
      expect(result.baseTileDefinition.id).toBe('custom-grass');
    });
  });
});

// ---------------------------------------------------------------------------
// TerrainVariantSelector
// ---------------------------------------------------------------------------

describe('TerrainVariantSelector', () => {
  describe('getSeededUnitFloat', () => {
    it('returns a value in [0, 1)', () => {
      for (const seed of ['0:0:grass:variant', '99:7:dirt:flipX', 'arbitrary-seed']) {
        const val = getSeededUnitFloat(seed);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('is deterministic — same seed returns same value', () => {
      const seed = '42:17:grass:variant';
      expect(getSeededUnitFloat(seed)).toBe(getSeededUnitFloat(seed));
    });

    it('produces different values for different seeds', () => {
      const values = new Set(
        ['a:b', 'c:d', 'e:f', 'g:h', '0:0', '1:1'].map(getSeededUnitFloat),
      );
      expect(values.size).toBeGreaterThan(1);
    });
  });

  describe('selectWeightedTerrainVariant', () => {
    it('throws when candidates list is empty', () => {
      expect(() => selectWeightedTerrainVariant([], 0, 0, 'grass')).toThrow();
    });

    it('always returns the only candidate when there is exactly one', () => {
      const tile = minimalTileDef('solo', 'grass');
      expect(selectWeightedTerrainVariant([tile], 3, 7, 'grass')).toBe(tile);
    });

    it('always returns from the candidates list', () => {
      const tiles = [
        minimalTileDef('a', 'grass', 5),
        minimalTileDef('b', 'grass', 3),
        minimalTileDef('c', 'grass', 2),
      ];
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          const result = selectWeightedTerrainVariant(tiles, x, y, 'grass');
          expect(tiles).toContain(result);
        }
      }
    });

    it('is deterministic — same inputs yield same tile', () => {
      const tiles = [
        minimalTileDef('a', 'grass', 5),
        minimalTileDef('b', 'grass', 3),
      ];
      const first = selectWeightedTerrainVariant(tiles, 12, 34, 'grass');
      const second = selectWeightedTerrainVariant(tiles, 12, 34, 'grass');
      expect(first.id).toBe(second.id);
    });

    it('respects weight distribution across a sample of coordinates', () => {
      // A tile with weight 10 vs one with weight 0 — only the heavy one should appear
      const heavy = minimalTileDef('heavy', 'grass', 10);
      const zero = minimalTileDef('zero', 'grass', 0);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const result = selectWeightedTerrainVariant([heavy, zero], x, y, 'grass');
          expect(result.id).toBe('heavy');
        }
      }
    });
  });

  describe('selectTerrainTransform', () => {
    it('always returns rotation 0', () => {
      const tile = minimalTileDef('t', 'grass');
      const transform = selectTerrainTransform(tile, 0, 0, 'grass');
      expect(transform.rotation).toBe(0);
    });

    it('never flips when allowFlipX and allowFlipY are both false', () => {
      const tile = minimalTileDef('t', 'grass'); // allowFlipX=false, allowFlipY=false
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const transform = selectTerrainTransform(tile, x, y, 'grass');
          expect(transform.flipX).toBe(false);
          expect(transform.flipY).toBe(false);
        }
      }
    });

    it('is deterministic — same inputs yield same transform', () => {
      const tile: TerrainTileDefinition = { ...minimalTileDef('t', 'grass'), allowFlipX: true };
      const a = selectTerrainTransform(tile, 7, 3, 'grass');
      const b = selectTerrainTransform(tile, 7, 3, 'grass');
      expect(a.flipX).toBe(b.flipX);
      expect(a.flipY).toBe(b.flipY);
    });
  });
});
