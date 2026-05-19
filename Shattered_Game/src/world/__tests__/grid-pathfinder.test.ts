import { describe, expect, it } from 'vitest';
import { findGridPath } from '../GridPathfinder';

describe('GridPathfinder', () => {
  it('prefers a straighter smoothed path around blocked tiles', () => {
    const blocked = new Set(['1,0', '1,1']);
    const path = findGridPath({
      width: 4,
      height: 4,
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 0 },
      isWalkable: (x, y) => !blocked.has(`${x},${y}`),
    });

    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 3, y: 0 });
    expect(path).toHaveLength(4);

    path?.forEach((tile) => {
      expect(blocked.has(`${tile.x},${tile.y}`)).toBe(false);
    });

    expect(path?.some((tile) => tile.x === 0 && tile.y === 2)).toBe(true);
    expect(path?.some((tile) => tile.x === 2 && tile.y === 2)).toBe(true);
  });

  it('returns null when the goal tile is unreachable', () => {
    const blocked = new Set(['0,1', '1,0', '1,1']);
    const path = findGridPath({
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 2 },
      isWalkable: (x, y) => !blocked.has(`${x},${y}`),
    });

    expect(path).toBeNull();
  });

  it('returns a single-node path when already on the goal tile', () => {
    const path = findGridPath({
      width: 2,
      height: 2,
      start: { x: 1, y: 1 },
      goal: { x: 1, y: 1 },
      isWalkable: () => true,
    });

    expect(path).toEqual([{ x: 1, y: 1 }]);
  });

  it('takes a direct diagonal when the line is clear', () => {
    const path = findGridPath({
      width: 4,
      height: 4,
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 3 },
      isWalkable: () => true,
    });

    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 3 },
    ]);
  });
});
