import type { GridFootprint, ObjectDefinition, ShadowDefinition } from './ObjectTypes';

const FOOTPRINT_1x1: GridFootprint = [{ x: 0, y: 0 }];

const DEFAULT_DEPTH = {
  anchorMode: 'centroid',
  localOffsetX: 0,
  localOffsetY: 0,
  depthOffset: 0.1,
} as const;

const noShadow = (): ShadowDefinition => ({
  enabled: false,
  localOffsetX: 0,
  localOffsetY: 0,
  width: 0,
  height: 0,
  alpha: 0,
});

const shadow = (
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 4,
  alpha = 0.28,
): ShadowDefinition => ({
  enabled: true,
  localOffsetX: offsetX,
  localOffsetY: offsetY,
  width,
  height,
  alpha,
});

export const INTERACTION_OBJECT_DEFINITIONS: ObjectDefinition[] = [
  {
    id: 'workbench_basic',
    displayName: 'Workbench',
    category: 'workbench',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'rect', width: 28, height: 8, localOffsetX: 0, localOffsetY: -18, color: 0x8b5a2b, strokeColor: 0x4b2e14, strokeWidth: 1, strokeAlpha: 1 },
        { shape: 'rect', width: 4, height: 18, localOffsetX: -9, localOffsetY: -9, color: 0x6b3f19 },
        { shape: 'rect', width: 4, height: 18, localOffsetX: 9, localOffsetY: -9, color: 0x6b3f19 },
        { shape: 'rect', width: 12, height: 4, localOffsetX: 7, localOffsetY: -22, color: 0xb45309 },
        { shape: 'rect', width: 6, height: 4, localOffsetX: -8, localOffsetY: -22, color: 0xd7f3ff },
      ],
    },
    shadow: shadow(30, 10, 0, 4),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444, label: 'bench' },
  },
  {
    id: 'notice_board',
    displayName: 'Notice Board',
    category: 'npc',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: true,
    visual: {
      parts: [
        { shape: 'rect', width: 6, height: 26, localOffsetX: 0, localOffsetY: -11, color: 0x6b3f19 },
        { shape: 'rect', width: 24, height: 18, localOffsetX: 0, localOffsetY: -26, color: 0xe7d8b1, strokeColor: 0x5b4632, strokeWidth: 1.5, strokeAlpha: 1 },
        { shape: 'rect', width: 18, height: 2, localOffsetX: 0, localOffsetY: -31, color: 0x7c5a3d },
        { shape: 'rect', width: 18, height: 2, localOffsetX: 0, localOffsetY: -25, color: 0x7c5a3d },
      ],
    },
    shadow: shadow(22, 8, 0, 3, 0.22),
    depth: DEFAULT_DEPTH,
    debug: { color: 0xef4444, label: 'board' },
  },
  {
    id: 'driftwood_node',
    displayName: 'Driftwood',
    category: 'resource',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: false,
    visual: {
      parts: [
        { shape: 'ellipse', width: 30, height: 10, localOffsetX: -2, localOffsetY: -1, color: 0x8b5a2b, strokeColor: 0x5a3418, strokeWidth: 1.2, strokeAlpha: 1 },
        { shape: 'ellipse', width: 12, height: 8, localOffsetX: -12, localOffsetY: -2, color: 0xc08457, strokeColor: 0x5a3418, strokeWidth: 1, strokeAlpha: 1 },
        { shape: 'ellipse', width: 10, height: 7, localOffsetX: 12, localOffsetY: 1, color: 0xb97745, strokeColor: 0x5a3418, strokeWidth: 1, strokeAlpha: 1 },
      ],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0x3b82f6, label: 'driftwood' },
  },
  {
    id: 'stone_pile_node',
    displayName: 'Stone Pile',
    category: 'resource',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: false,
    visual: {
      parts: [
        { shape: 'ellipse', width: 18, height: 10, localOffsetX: -8, localOffsetY: 0, color: 0x9ca3af, alpha: 0.95 },
        { shape: 'ellipse', width: 14, height: 9, localOffsetX: 6, localOffsetY: -2, color: 0x6b7280, alpha: 0.95 },
        { shape: 'ellipse', width: 10, height: 7, localOffsetX: 0, localOffsetY: 4, color: 0xd1d5db, alpha: 0.92 },
      ],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0x3b82f6, label: 'stone' },
  },
  {
    id: 'herb_patch_node',
    displayName: 'Herb Patch',
    category: 'resource',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: false,
    visual: {
      parts: [
        { shape: 'ellipse', width: 9, height: 14, localOffsetX: -10, localOffsetY: -4, color: 0x16a34a },
        { shape: 'ellipse', width: 9, height: 14, localOffsetX: 0, localOffsetY: -6, color: 0x22c55e },
        { shape: 'ellipse', width: 9, height: 14, localOffsetX: 10, localOffsetY: -3, color: 0x15803d },
        { shape: 'ellipse', width: 5, height: 5, localOffsetX: -3, localOffsetY: -9, color: 0xa3e635 },
        { shape: 'ellipse', width: 5, height: 5, localOffsetX: 7, localOffsetY: -8, color: 0xfde68a },
      ],
    },
    shadow: noShadow(),
    depth: DEFAULT_DEPTH,
    debug: { color: 0x3b82f6, label: 'herbs' },
  },
  {
    id: 'campfire_built',
    displayName: 'Campfire',
    category: 'crafted',
    collisionFootprint: FOOTPRINT_1x1,
    blocksMovement: false,
    visual: {
      parts: [
        { shape: 'ellipse', width: 24, height: 10, localOffsetX: 0, localOffsetY: 2, color: 0x6b3f19, alpha: 0.9 },
        { shape: 'rect', width: 4, height: 18, localOffsetX: -6, localOffsetY: -8, color: 0xb45309 },
        { shape: 'rect', width: 4, height: 18, localOffsetX: 6, localOffsetY: -8, color: 0xb45309 },
        { shape: 'ellipse', width: 10, height: 16, localOffsetX: 0, localOffsetY: -16, color: 0xf97316, alpha: 0.95 },
        { shape: 'ellipse', width: 6, height: 10, localOffsetX: 1, localOffsetY: -18, color: 0xfde047, alpha: 0.95 },
      ],
    },
    shadow: shadow(24, 8, 0, 4, 0.24),
    depth: DEFAULT_DEPTH,
    debug: { color: 0x3b82f6, label: 'campfire' },
  },
];
