import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { OBJECT_TEXTURES } from './ObjectAssets';
import { INTERACTION_OBJECT_DEFINITIONS } from './InteractionObjectDefinitions';
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

// Tree PNGs include extra transparent/low-alpha pixels below the trunk. If we
// use originY: 1, Phaser anchors the bottom of the file instead of the trunk
// base, which makes large trees float above the tile they block. These origins
// mark the actual trunk/ground contact point inside each source image.
const TREE_01_BASE_ORIGIN = { x: 208 / 428, y: 523 / 589 };
const TREE_02_BASE_ORIGIN = { x: 245 / 474, y: 496 / 545 };

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
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.stone07, scale: 0.46, originX: 0.5, originY: 1, localOffsetX: 0, localOffsetY: 8 },
      ],
    },
    shadow: shadow(36, 12, 0, 5),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
  {
    id: 'medium_rock',
    displayName: 'Medium Rock',
    category: 'rock',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.stone04, scale: 0.52, originX: 0.5, originY: 1, localOffsetX: 0, localOffsetY: 9 },
      ],
    },
    shadow: shadow(54, 16, 0, 6),
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
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.stone01, scale: 0.42, originX: 0.5, originY: 1, localOffsetX: CENTRE_2x2.x, localOffsetY: CENTRE_2x2.y + 10 },
      ],
    },
    shadow: shadow(76, 24, CENTRE_2x2.x, CENTRE_2x2.y + 8),
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
  // ---- Tree (1×1 trunk, canopy extends visually beyond footprint) ----
  {
    id: 'tree_test',
    displayName: 'Tree',
    category: 'tree',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.tree01, scale: 0.3, originX: TREE_01_BASE_ORIGIN.x, originY: TREE_01_BASE_ORIGIN.y, localOffsetX: 0, localOffsetY: 0 },
      ],
    },
    shadow: shadow(58, 18, 0, 6),
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
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.tree02, scale: 0.31, originX: TREE_02_BASE_ORIGIN.x, originY: TREE_02_BASE_ORIGIN.y, localOffsetX: 0, localOffsetY: 0 },
      ],
    },
    shadow: shadow(62, 20, 0, 6),
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
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.tree01, scale: 0.34, originX: TREE_01_BASE_ORIGIN.x, originY: TREE_01_BASE_ORIGIN.y, localOffsetX: 0, localOffsetY: 0, flipX: true },
      ],
    },
    shadow: shadow(66, 20, 0, 6),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },

  // ---- Trees — 2× size (1×1 footprint, scale doubled) ----
  {
    id: 'tree_01_2x',
    displayName: 'Tree (Large)',
    category: 'tree',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.tree01, scale: 0.6, originX: TREE_01_BASE_ORIGIN.x, originY: TREE_01_BASE_ORIGIN.y, localOffsetX: 0, localOffsetY: 0 },
      ],
    },
    shadow: shadow(116, 36, 0, 6),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
  {
    id: 'tree_02_2x',
    displayName: 'Dark Tree (Large)',
    category: 'tree',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.tree02, scale: 0.62, originX: TREE_02_BASE_ORIGIN.x, originY: TREE_02_BASE_ORIGIN.y, localOffsetX: 0, localOffsetY: 0 },
      ],
    },
    shadow: shadow(124, 40, 0, 6),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },

  // ---- Trees — 4× size (2×2 footprint, visual centred on 2×2 centroid) ----
  {
    id: 'tree_01_4x',
    displayName: 'Tree (Huge)',
    category: 'tree',
    collisionFootprint: FOOTPRINT_2x2,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.tree01, scale: 1.2, originX: TREE_01_BASE_ORIGIN.x, originY: TREE_01_BASE_ORIGIN.y, localOffsetX: CENTRE_2x2.x, localOffsetY: CENTRE_2x2.y },
      ],
    },
    shadow: shadow(232, 72, CENTRE_2x2.x, CENTRE_2x2.y + 6),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
  {
    id: 'tree_02_4x',
    displayName: 'Dark Tree (Huge)',
    category: 'tree',
    collisionFootprint: FOOTPRINT_2x2,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'sprite', textureKey: OBJECT_TEXTURES.tree02, scale: 1.24, originX: TREE_02_BASE_ORIGIN.x, originY: TREE_02_BASE_ORIGIN.y, localOffsetX: CENTRE_2x2.x, localOffsetY: CENTRE_2x2.y },
      ],
    },
    shadow: shadow(248, 80, CENTRE_2x2.x, CENTRE_2x2.y + 6),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444 },
  },
  ...INTERACTION_OBJECT_DEFINITIONS,
];
