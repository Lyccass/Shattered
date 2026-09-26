# Natural cliff modules — v4

The current cliff preview (`forest-pack.html?sample=cliffs`) uses this revision, replacing the extruded wall/ramp demonstration.

Runtime art is in `public/assets/forest-painterly/natural-cliffs/`:
- `columns.png`: uneven tall columns with broken ledges and low end rocks.
- `shoulder.png`: lower curved rock shoulder for ends, overlaps and changing silhouettes.
- `ascent.png`: winding earthen ascent with rock and vegetation shoulders.

Original sprite alpha is preserved.

Search **Natural Cliff** in the editor: 18 placements (three art types, three uniform sizes, two mirrored facings). Sizes use 2×2, 3×3 and 4×4 footprints. These are organic overlapping scenery modules, not edge-welded terrain/autotile cells. Use low end rocks to conceal joins, stagger outlines, and mix shoulders with columns; do not stretch sprites vertically. Mirrored facings are convenient compositional variants, not separately relit art.

The assembly is authored in `src/shared/editor/NaturalCliffSample.ts`; `node scripts/export-cliff-kit-sample.mjs` exports it through the editor serializer to `art/forest-painterly/cliff-kit/assembly.json`.

These remain blocking scenery. Elevated navigation and arbitrary-height terrain stitching are not implemented. Existing world content and older kit IDs remain compatible; the preview no longer uses the old straight ramps.

The current assembly uses continuous terrain relief for its ascent, not the separate ascent sprite. Dirt relief brushes 9–18 share exactly the grass relief heights; the path rises from the lower trail to the upper clearing through a shared blended mesh. The painted ascent prop remains available separately in the editor. This adds visual terrain height, not a gameplay elevation engine.
