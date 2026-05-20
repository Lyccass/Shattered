// Snap a world-space angle to the nearest of the 8 isometric grid directions.
// Returns [dgx, dgy] where each component is -1, 0, or +1.
export function snapToIsometricGridDirection(
  rotationRad: number,
  tileWidth: number,
  tileHeight: number,
): [number, number] {
  const hw = tileWidth / 2;
  const hh = tileHeight / 2;
  const tw = tileWidth;
  const th = tileHeight;

  const dirs: Array<[number, number, number, number]> = [
    [-1, -1, 0, -th],
    [0, -1, hw, -hh],
    [1, -1, tw, 0],
    [1, 0, hw, hh],
    [1, 1, 0, th],
    [0, 1, -hw, hh],
    [-1, 1, -tw, 0],
    [-1, 0, -hw, -hh],
  ];

  const dx = Math.cos(rotationRad);
  const dy = Math.sin(rotationRad);
  let bestDot = -Infinity;
  let bestDgx = 0;
  let bestDgy = -1;

  for (const [dgx, dgy, wx, wy] of dirs) {
    const len = Math.hypot(wx, wy);
    const dot = (dx * wx + dy * wy) / len;

    if (dot > bestDot) {
      bestDot = dot;
      bestDgx = dgx;
      bestDgy = dgy;
    }
  }

  return [bestDgx, bestDgy];
}
