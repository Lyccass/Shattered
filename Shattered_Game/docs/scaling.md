Additional scale requirement:
The current placeholder is too small compared to the player. Adjust placeholder object scale so the world feels coherent.

Use these rough scale rules:
- Player footprint: around 1 tile.
- Player visual height: around 1.5–2 tiles.
- Small house footprint: around 4x3 or 5x4 tiles.
- Small house visual height: around 2.5–3.5 player heights.
- Tree visual height: around 2–3 player heights.
- Rock visual height: around 0.5–1 player height.
- Dock footprint: at least 3x1 or 4x2 tiles.

The door of the house should be close to player height, not tiny.
The player should not visually look taller than the usable house entrance.
Separate object footprint from visual size:
- footprint controls occupied grid tiles and placement
- visual size controls how the object is drawn
- depth anchor controls sorting
- collision controls where the player is blocked