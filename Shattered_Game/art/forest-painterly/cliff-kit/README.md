# Rounded painted cliff kit

130 transparent PNG modules at 4× world resolution, plus 56 raised climb configurations in the editor (186 entries total). The mesh exporter supplies matching isometric joins and rounded geometry.

Open `/forest-pack.html?sample=cliffs` for the assembly scene, or import `assembly.json` into the map editor. Search objects for **Cliff Kit**. The active woodland is intentionally unchanged.

## Assembly

- Grid is 64×32 isometric. Wall/top pieces occupy one tile; stone approaches occupy 2×2 and soft grass banks occupy 4×4.
- `bank` supplies a broad grassy climb with eased landings, a level upper edge and feathered lower landing in all four directions. The preview’s **Soft climb** button shows an assembled approach. These remain visual scenery, like the other kit pieces.
- Height tiers: 32, 64, 96, 128, 160 world pixels. Choose matching heights along a contour.
- `outer` is a rounded convex corner, `inner` a rounded concave corner, `edge` a connecting side, `fill` the grassy interior, `summit` a rocky interior.
- Directions rotate grid geometry rather than arbitrarily rotating a painted sprite. All four rotations are supplied, with consistent lighting.
- The high corner of outer rotation 0 is NW; rotations progress NW → NE → SE → SW. Inner pieces remove that corner. Edge rotation 0 keeps the NW and NE corners high. Each side crossing meets the exact midpoint of the tile edge. Match occupied corners of neighbouring pieces.
- Fill the complete plateau interior. These are terrain-volume assembly pieces, not individually capped freestanding boulders. Back-facing walls are correctly hidden by their top surface in the fixed camera perspective.
- Use a ramp/stair whose rise equals the height difference; raised configurations list both landing heights (e.g. 32→64px). Do not rescale modules independently or stretch their height: that breaks connections.
- Pieces use a shared zero-height datum. They do not independently follow the procedural hills; connected walls therefore stay aligned. The current ground's rolling surface can intersect the lowest part of a wall. For authored sites, prepare a level footprint. Arbitrary sloping-ground blending is not automatic.
- Raised climb variants share the original PNG and adjust its vertical anchor; manifest origins refer to each module's base plane.

## Gameplay status

This is an art/placement kit. All pieces are blocking scenery. Stairs/ramps do **not** grant elevated traversal. There is no height painting/autotiling tool yet; assembly is by choosing the matching pieces in the existing object palette.

## Export

`node scripts/export-cliff-kit.mjs` exports PNGs and the typed asset manifest.
`node scripts/export-cliff-kit-sample.mjs` exports the editor assembly.
Runtime assets: `public/assets/forest-painterly/cliff-kit/`.
Source: `art/forest-painterly/source/cliff-kit-v3/rock-master.png`.

Visible cliff faces include ground-level painted bush, fern and stone clusters through `CliffKitGrounding.ts`. The included `assets/forest_*.png` files are their sprite dependencies. Climb entrances and interior tiles do not receive this foliage.

Grass banks include tapered rock flanks down to the ground, so exposed approach sides are solid rather than open sheets.
