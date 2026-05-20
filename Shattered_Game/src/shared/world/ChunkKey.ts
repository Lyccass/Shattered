export type ChunkCoordinate = {
  chunkX: number;
  chunkY: number;
};

export type ChunkKey = `${number},${number}`;

export function createChunkKey({ chunkX, chunkY }: ChunkCoordinate): ChunkKey {
  return `${chunkX},${chunkY}`;
}

export function parseChunkKey(key: string): ChunkCoordinate | null {
  const [chunkXText, chunkYText] = key.split(',');
  const chunkX = Number.parseInt(chunkXText ?? '', 10);
  const chunkY = Number.parseInt(chunkYText ?? '', 10);

  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
    return null;
  }

  return { chunkX, chunkY };
}

export function createWorldChunkId(
  worldId: string,
  regionId: string,
  coordinate: ChunkCoordinate,
): string {
  return `${worldId}:${regionId}:${createChunkKey(coordinate)}`;
}
