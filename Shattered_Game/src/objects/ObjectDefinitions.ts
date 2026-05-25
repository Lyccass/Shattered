import { PROTOTYPE_SCALE } from '../config/prototypeScale';
import { OBJECT_TEXTURES } from './ObjectAssets';
import { INTERACTION_OBJECT_DEFINITIONS } from './InteractionObjectDefinitions';
import type { GridFootprint, ObjectDefinition, ShadowDefinition } from './ObjectTypes';

const TH = PROTOTYPE_SCALE.tileHeight;

// Standard footprints. Anchor (0,0) is the back-left tile.
const FOOTPRINT_1x1: GridFootprint = [{ x: 0, y: 0 }];
const FOOTPRINT_2x2: GridFootprint = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

// World-pixel offset of the geometric centre of each footprint relative to the
// anchor tile centre. Used to position visuals that should span multiple tiles.
const CENTRE_2x2   = { x: 0,      y: TH / 2 };   // (0, 16) with default scale

// Tree PNGs include extra transparent/low-alpha pixels below the trunk. If we
// use originY: 1, Phaser anchors the bottom of the file instead of the trunk
// base, which makes large trees float above the tile they block. These origins
// mark the actual trunk/ground contact point inside each source image.
const TREE_01_BASE_ORIGIN = { x: 208 / 428, y: 523 / 589 };
const TREE_02_BASE_ORIGIN = { x: 245 / 474, y: 496 / 545 };

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

export const OBJECT_DEFINITIONS: ObjectDefinition[] = [
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
