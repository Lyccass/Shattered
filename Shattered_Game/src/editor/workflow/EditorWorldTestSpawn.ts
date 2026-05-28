export type EditorTestSpawnMode = 'hover' | 'center';

export type EditorTestSpawnContext = {
  chunkSize: number;
  hoverTile: { x: number; y: number } | null;
  mapHeight: number;
  mapWidth: number;
  originChunkX: number;
  originChunkY: number;
};

export type EditorResolvedTestSpawn = {
  chunkX: number;
  chunkY: number;
  label: string;
  localTileX: number;
  localTileY: number;
  spawnId: string;
};

export function resolveEditorWorldTestSpawn(
  mode: EditorTestSpawnMode,
  context: EditorTestSpawnContext,
): EditorResolvedTestSpawn {
  const localTile = mode === 'hover' && context.hoverTile
    ? context.hoverTile
    : {
      x: Math.floor(context.mapWidth / 2),
      y: Math.floor(context.mapHeight / 2),
    };
  const clampedX = clampTile(localTile.x, context.mapWidth);
  const clampedY = clampTile(localTile.y, context.mapHeight);
  const globalTileX = context.originChunkX * context.chunkSize + clampedX;
  const globalTileY = context.originChunkY * context.chunkSize + clampedY;
  const chunkX = Math.floor(globalTileX / context.chunkSize);
  const chunkY = Math.floor(globalTileY / context.chunkSize);
  const localChunkTileX = positiveModulo(globalTileX, context.chunkSize);
  const localChunkTileY = positiveModulo(globalTileY, context.chunkSize);

  return {
    chunkX,
    chunkY,
    label: `Tile ${clampedX}, ${clampedY}`,
    localTileX: localChunkTileX,
    localTileY: localChunkTileY,
    spawnId: `chunk_${chunkX}_${chunkY}_tile_${localChunkTileX}_${localChunkTileY}`,
  };
}

function clampTile(tile: number, size: number): number {
  return Math.max(0, Math.min(size - 1, tile));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
