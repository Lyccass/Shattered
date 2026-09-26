# Source Falls

The main Wake map now includes Source Falls beside Source Bluffs, north of Old River Gate. Follow the dirt spur from `(62,18)` up the eastern slope to Spring Overlook at `(54,5)`.

`src/shared/editor/SourceFallsSection.ts` authors the relief, river outlet, clear ascent and overlapping scenery through the editor model. Rebuild using `node scripts/build-river-woodland.mjs`; this also rebakes the 2× ground images. The path is walkable and follows the existing smooth visual relief; no new gameplay elevation layer is introduced. Cliff faces and water remain blocked.

The new sprite is `public/assets/forest-painterly/natural-cliffs/waterfall.png` (1536×1024 with original alpha). The three existing natural cliff/shoulder placements soften its continuation into the hillside. No global cliff modules or old preview layouts were changed.
