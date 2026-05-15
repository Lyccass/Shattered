import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import type { GridFootprint, ObjectDefinition, ShadowDefinition } from './ObjectTypes';

const TW = PROTOTYPE_SCALE.tileWidth;
const TH = PROTOTYPE_SCALE.tileHeight;

// Standard footprints. Anchor (0,0) is the back-left tile.
const FOOTPRINT_1x1: GridFootprint = [{ x: 0, y: 0 }];
const FOOTPRINT_2x1_H: GridFootprint = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
const FOOTPRINT_2x2: GridFootprint = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

// World-pixel offset of the geometric centre of each footprint relative to the
// anchor tile centre. Used to position visuals that should span multiple tiles.
const CENTRE_2x1_H = { x: TW / 4, y: TH / 4 };   // (16, 8) with default scale
const CENTRE_2x2   = { x: 0,      y: TH / 2 };   // (0, 16) with default scale

const noShadow = (): ShadowDefinition => ({
  enabled: false, localOffsetX: 0, localOffsetY: 0, width: 0, height: 0, alpha: 0,
});

const shadow = (
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 4,
  alpha = 0.32,
): ShadowDefinition => ({ enabled: true, localOffsetX: offsetX, localOffsetY: offsetY, width, height, alpha });

const DEFAULT_DEPTH = {
  anchorMode: 'centroid',
  localOffsetX: 0,
  localOffsetY: 0,
  depthOffset: 0.1,
} as const;

// Test/foundation registry. Visuals are intentionally placeholder shapes —
// final art will replace them, but the placement/collision contract stays the same.
export const OBJECT_DEFINITIONS: ObjectDefinition[] = [
  // ---- Markers (debug shapes that exactly fill their footprint) ----
  {
    id: 'marker_1x1',
    displayName: 'Marker 1×1',
    category: 'marker',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [{
        shape: 'ellipse',
        width: 40, height: 20,
        localOffsetX: 0, localOffsetY: -2,
        color: 0xef4444, alpha: 0.9,
        strokeColor: 0x7f1d1d, strokeWidth: 2, strokeAlpha: 1,
      }],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444, label: '1×1' },
  },
  {
    id: 'marker_2x1',
    displayName: 'Marker 2×1',
    category: 'marker',
    collisionFootprint: FOOTPRINT_2x1_H,
    blocksMovement: true,
    visual: {
      parts: [{
        shape: 'ellipse',
        width: 72, height: 26,
        localOffsetX: CENTRE_2x1_H.x, localOffsetY: CENTRE_2x1_H.y - 4,
        color: 0xf97316, alpha: 0.9,
        strokeColor: 0x9a3412, strokeWidth: 2, strokeAlpha: 1,
      }],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444, label: '2×1' },
  },
  {
    id: 'marker_2x2',
    displayName: 'Marker 2×2',
    category: 'marker',
    collisionFootprint: FOOTPRINT_2x2,
    blocksMovement: true,
    visual: {
      parts: [{
        shape: 'ellipse',
        width: 84, height: 42,
        localOffsetX: CENTRE_2x2.x, localOffsetY: CENTRE_2x2.y - 4,
        color: 0xfacc15, alpha: 0.9,
        strokeColor: 0x854d0e, strokeWidth: 2, strokeAlpha: 1,
      }],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444, label: '2×2' },
  },

  // ---- Rocks ----
  {
    id: 'small_rock',
    displayName: 'Small Rock',
    category: 'rock',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'ellipse', width: 30, height: 18, localOffsetX: 0, localOffsetY: -4, color: 0x78716c, strokeColor: 0x44403c, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'ellipse', width: 14, height: 6,  localOffsetX: -6, localOffsetY: -8, color: 0xa8a29e, alpha: 0.85 },
      ],
    },
    shadow: shadow(28, 10, 0, 4),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
  {
    id: 'large_rock',
    displayName: 'Large Rock',
    category: 'rock',
    collisionFootprint: FOOTPRINT_2x2,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'ellipse', width: 76, height: 42, localOffsetX: CENTRE_2x2.x, localOffsetY: CENTRE_2x2.y - 8, color: 0x78716c, strokeColor: 0x44403c, strokeWidth: 2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 34, height: 14, localOffsetX: CENTRE_2x2.x - 14, localOffsetY: CENTRE_2x2.y - 18, color: 0xa8a29e, alpha: 0.85 },
        { shape: 'ellipse', width: 20, height: 10, localOffsetX: CENTRE_2x2.x + 12, localOffsetY: CENTRE_2x2.y - 22, color: 0xa8a29e, alpha: 0.6 },
      ],
    },
    shadow: shadow(72, 24, CENTRE_2x2.x, CENTRE_2x2.y + 6),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },

  // ---- Barrel ----
  {
    id: 'barrel',
    displayName: 'Barrel',
    category: 'barrel',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'rect',    width: 22, height: 30, localOffsetX: 0, localOffsetY: -13, color: 0x92400e, strokeColor: 0x451a03, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'rect',    width: 22, height: 3,  localOffsetX: 0, localOffsetY: -22, color: 0x451a03 },
        { shape: 'rect',    width: 22, height: 3,  localOffsetX: 0, localOffsetY: -10, color: 0x451a03 },
        { shape: 'ellipse', width: 22, height: 6,  localOffsetX: 0, localOffsetY: -27, color: 0xb45309 },
      ],
    },
    shadow: shadow(22, 10, 0, 4),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },

  // ---- Log (2×1 horizontal) ----
  {
    id: 'log',
    displayName: 'Log',
    category: 'log',
    collisionFootprint: FOOTPRINT_2x1_H,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'ellipse', width: 76, height: 22, localOffsetX: CENTRE_2x1_H.x, localOffsetY: CENTRE_2x1_H.y - 8, color: 0x92400e, strokeColor: 0x451a03, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'ellipse', width: 18, height: 20, localOffsetX: CENTRE_2x1_H.x - 30, localOffsetY: CENTRE_2x1_H.y - 8, color: 0xb45309, strokeColor: 0x451a03, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'ellipse', width: 18, height: 20, localOffsetX: CENTRE_2x1_H.x + 30, localOffsetY: CENTRE_2x1_H.y - 8, color: 0xb45309, strokeColor: 0x451a03, strokeWidth: 1.5, strokeAlpha: 1 },
      ],
    },
    shadow: shadow(70, 16, CENTRE_2x1_H.x, CENTRE_2x1_H.y + 4),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },

  // ---- Fence segment (1×1) ----
  {
    id: 'fence_segment',
    displayName: 'Fence Segment',
    category: 'fence',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'rect', width: 4,  height: 24, localOffsetX: -10, localOffsetY: -12, color: 0x57534e },
        { shape: 'rect', width: 4,  height: 24, localOffsetX:  10, localOffsetY: -12, color: 0x57534e },
        { shape: 'rect', width: 26, height: 3,  localOffsetX:   0, localOffsetY: -19, color: 0x44403c },
        { shape: 'rect', width: 26, height: 3,  localOffsetX:   0, localOffsetY:  -7, color: 0x44403c },
      ],
    },
    shadow: shadow(24, 6, 0, 2, 0.22),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },

  // ---- Flower patch (non-blocking) ----
  {
    id: 'flower_patch',
    displayName: 'Flower Patch',
    category: 'flora',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: false,
    visual: {
      parts: [
        { shape: 'ellipse', width: 8, height: 6, localOffsetX: -10, localOffsetY: -2, color: 0xfb7185 },
        { shape: 'ellipse', width: 8, height: 6, localOffsetX:   8, localOffsetY: -4, color: 0xfde047 },
        { shape: 'ellipse', width: 8, height: 6, localOffsetX:  -3, localOffsetY:  4, color: 0xf472b6 },
        { shape: 'ellipse', width: 8, height: 6, localOffsetX:  12, localOffsetY:  5, color: 0xe879f9 },
        { shape: 'ellipse', width: 6, height: 4, localOffsetX:   2, localOffsetY: -6, color: 0xa3e635 },
      ],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0x3b82f6 },
  },

  // ---- Passable ground detail ----
  {
    id: 'pebble_patch',
    displayName: 'Pebbles',
    category: 'pebble',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: false,
    visual: {
      parts: [
        { shape: 'ellipse', width: 9, height: 5, localOffsetX: -12, localOffsetY: 0, color: 0x94a3b8, alpha: 0.75 },
        { shape: 'ellipse', width: 6, height: 4, localOffsetX: -2,  localOffsetY: 5, color: 0x64748b, alpha: 0.7 },
        { shape: 'ellipse', width: 7, height: 4, localOffsetX: 10,  localOffsetY: 1, color: 0xa8a29e, alpha: 0.72 },
        { shape: 'ellipse', width: 4, height: 3, localOffsetX: 4,   localOffsetY: -5, color: 0x475569, alpha: 0.55 },
      ],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0x3b82f6, label: 'pebbles' },
  },
  {
    id: 'wild_grass',
    displayName: 'Wild Grass',
    category: 'grass',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: false,
    visual: {
      parts: [
        { shape: 'rect', width: 3, height: 14, localOffsetX: -12, localOffsetY: -5, color: 0x166534, alpha: 0.8 },
        { shape: 'rect', width: 3, height: 18, localOffsetX: -4,  localOffsetY: -7, color: 0x15803d, alpha: 0.85 },
        { shape: 'rect', width: 3, height: 12, localOffsetX: 5,   localOffsetY: -4, color: 0x22c55e, alpha: 0.75 },
        { shape: 'rect', width: 3, height: 16, localOffsetX: 13,  localOffsetY: -6, color: 0x166534, alpha: 0.78 },
      ],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0x3b82f6, label: 'grass' },
  },

  // ---- Tree (1×1 trunk, canopy extends visually beyond footprint) ----
  {
    id: 'tree_test',
    displayName: 'Tree',
    category: 'tree',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'rect',    width: 18, height: 70, localOffsetX: 0,   localOffsetY: -35,  color: 0x713f12, strokeColor: 0x422006, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'ellipse', width: 104, height: 78, localOffsetX: -16, localOffsetY: -92,  color: 0x15803d, strokeColor: 0x14532d, strokeWidth: 2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 112, height: 82, localOffsetX: 22,  localOffsetY: -104, color: 0x16a34a, strokeColor: 0x14532d, strokeWidth: 2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 66,  height: 48, localOffsetX: 4,   localOffsetY: -136, color: 0x22c55e, alpha: 0.82 },
        { shape: 'ellipse', width: 42,  height: 34, localOffsetX: 36,  localOffsetY: -126, color: 0x4ade80, alpha: 0.68 },
      ],
    },
    shadow: shadow(58, 18, 0, 4),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
  {
    id: 'tree_dark',
    displayName: 'Dark Tree',
    category: 'tree',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'rect',    width: 20,  height: 76, localOffsetX: 0,   localOffsetY: -38,  color: 0x5f3510, strokeColor: 0x422006, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'ellipse', width: 116, height: 86, localOffsetX: -20, localOffsetY: -100, color: 0x14532d, strokeColor: 0x052e16, strokeWidth: 2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 104, height: 80, localOffsetX: 24,  localOffsetY: -112, color: 0x166534, strokeColor: 0x052e16, strokeWidth: 2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 58,  height: 42, localOffsetX: 4,   localOffsetY: -146, color: 0x15803d, alpha: 0.75 },
      ],
    },
    shadow: shadow(64, 20, 0, 5),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
  {
    id: 'tree_tall',
    displayName: 'Tall Tree',
    category: 'tree',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'rect',    width: 16, height: 88, localOffsetX: 0,   localOffsetY: -44,  color: 0x854d0e, strokeColor: 0x422006, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'ellipse', width: 86, height: 74, localOffsetX: -8,  localOffsetY: -114, color: 0x16a34a, strokeColor: 0x14532d, strokeWidth: 2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 92, height: 78, localOffsetX: 16,  localOffsetY: -134, color: 0x22c55e, strokeColor: 0x14532d, strokeWidth: 2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 50, height: 40, localOffsetX: 0,   localOffsetY: -166, color: 0x4ade80, alpha: 0.7 },
      ],
    },
    shadow: shadow(52, 18, 0, 4),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
];
