export type TileType = 'water' | 'sand' | 'grass';

export type GridMode = 'off' | 'subtle' | 'build';

export type TileStyleMap = Record<TileType, { fill: number }>;
