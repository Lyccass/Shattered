import type { TileType } from './IsoTilemapTypes';

// Generates a TileType grid for one organic island. Pure function — no scene,
// no Phaser, no side effects. The noise offsets are hand-tuned for 180x180 maps;
// they still work at other sizes but the coastline character will differ.
export function generateOrganicIsland(width: number, height: number): TileType[][] {
  const centreX = (width - 1) / 2;
  const centreY = (height - 1) / 2;

  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const normalisedX = (x - centreX) / (width / 2);
      const normalisedY = (y - centreY) / (height / 2);
      const distance = Math.sqrt(normalisedX * normalisedX + normalisedY * normalisedY);
      const edgeNoise =
        Math.sin(x * 1.7 + y * 0.4) * 0.06 +
        Math.cos(y * 1.3 - x * 0.35) * 0.05 +
        Math.sin((x + y) * 0.8) * 0.035;
      const islandDistance = distance + edgeNoise;

      if (islandDistance < 0.52) return 'grass';
      if (islandDistance < 0.73) return 'sand';
      return 'water';
    }),
  );
}
