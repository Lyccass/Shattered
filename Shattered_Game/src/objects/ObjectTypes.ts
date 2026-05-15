// Object placement system — data types only. No Phaser, no runtime logic.
//
// Coordinate conventions:
// - tileX/tileY are GRID tiles. An object's tileX/tileY is its BACK-LEFT anchor tile
//   (smallest x and smallest y in its footprint).
// - GridFootprint offsets are added to the anchor to enumerate the tiles an object
//   occupies. A 2x2 footprint is [(0,0), (1,0), (0,1), (1,1)].
// - localOffsetX / localOffsetY are WORLD PIXELS relative to the anchor tile's
//   isometric centre. Negative Y is "up" on screen (canvas Y points down).
// - Collision is purely tile-based (footprint + WorldGrid). Visual size never
//   participates in collision.

export type ObjectCategory =
  | 'marker'
  | 'rock'
  | 'barrel'
  | 'log'
  | 'fence'
  | 'flora'
  | 'pebble'
  | 'tree';

export type GridFootprint = ReadonlyArray<{ x: number; y: number }>;

export type VisualShape = 'ellipse' | 'rect' | 'sprite';

type BaseVisualPart = {
  shape: VisualShape;
  localOffsetX: number;
  localOffsetY: number;
};

// A single drawn shape relative to an object's anchor tile centre.
// (localOffsetX, localOffsetY) is the CENTRE of the shape in world pixels.
export type ShapeVisualPart = BaseVisualPart & {
  shape: 'ellipse' | 'rect';
  width: number;
  height: number;
  color: number;
  alpha?: number;
  strokeColor?: number;
  strokeWidth?: number;
  strokeAlpha?: number;
};

// Sprite parts also use local object-space offsets, but originX/Y control which
// point of the sprite sits on that local anchor. For props that stand on a tile,
// originY: 1 means "bottom of sprite is the ground contact point".
export type SpriteVisualPart = BaseVisualPart & {
  shape: 'sprite';
  textureKey: string;
  scale: number;
  originX?: number;
  originY?: number;
  alpha?: number;
  flipX?: boolean;
};

export type VisualPart = ShapeVisualPart | SpriteVisualPart;

export type VisualDefinition = {
  parts: VisualPart[];
};

export type ShadowDefinition = {
  enabled: boolean;
  localOffsetX: number;
  localOffsetY: number;
  width: number;
  height: number;
  alpha: number;
};

export type DepthAnchorMode = 'centroid' | 'frontTileCenter' | 'frontEdge';

// Depth anchor is computed by ObjectDepth:
// - centroid is the safe default for compact props and solid footprints.
// - frontTileCenter/frontEdge are explicit data choices for thin barriers,
//   walls, cliffs or future art that needs later/earlier occlusion switching.
// localOffsetX/Y are fine world-pixel adjustments for the chosen anchor.
// depthOffset is the per-definition tie-breaker added to the final depth value.
export type DepthDefinition = {
  anchorMode: DepthAnchorMode;
  localOffsetX: number;
  localOffsetY: number;
  depthOffset: number;
};

export type DebugDefinition = {
  color: number;
  label?: string;
};

export type ObjectDefinition = {
  id: string;
  displayName: string;
  category: ObjectCategory;
  collisionFootprint: GridFootprint;
  blocksMovement: boolean;
  visual: VisualDefinition;
  shadow: ShadowDefinition;
  depth: DepthDefinition;
  debug: DebugDefinition;
};

export type ObjectInstance = {
  id: string;
  definitionId: string;
  tileX: number;
  tileY: number;
  createdAt: number;
};
