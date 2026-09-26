# Painted Forest pack

The current direction follows the coastal reference in `source/coastal-v2/reference-2026-09-15.jpg`: painterly olive/lime grass, warm ochre paths, soft hills, cool grey mossy column cliffs, and turquoise water. Earlier masters remain available, but the active coastal materials and selected tree/detail sprites now use the new reference.

## Contents and integration

- `../../public/assets/forest-painterly/`: 35 high-resolution 2:1 diamond terrain entries, 40 directional terrain overlays, a water light layer, 50 transparent scenery sprites, square material masters, and a manifest.
- `forest-pack-sample.json`: an authored sample exported through the editor serializer, suitable for the repository's map-loading APIs. It does not replace a working draft or published world.
- `source/`: generated artwork and Photoshop sources. The active input names are in `scripts/export-forest-pack.cjs`. Discarded iterations have been removed; current editable masters and export inputs remain.
- `/forest-pack.html`: the pack rendered with the game's terrain and object renderers, with sample-map export.

The editor exposes the `forest_*` terrain entries in its Grass, Dirt, Stone, Water, and Sand palette tabs, and registers the scenery in its normal object catalog. Existing procedural worlds keep their original artwork because these terrain definitions have zero procedural weight. The runtime already preloads the pack and resolves its transitions when a map explicitly selects it.

Terrain PNGs are 256×128, displayed on 64×32 world tiles. Sprite PNGs are exported at twice their intended world width and rendered at scale 0.5. Their anchors and footprints are defined in `src/objects/ForestObjectDefinitions.ts`. The Y wall is oriented during export.

Grass uses `source/grass-detailed.png`; dirt, beach sand, and paving use the three swatches in `source/ground-detail.png`. Their detail is restrained and all exported variants share welded borders.

The renderer caches material pixels, bakes a small lit mesh, and blends a continuous material field for rounded path and shore corners. Terrain builds yield after a short time budget. The renderer bends material tiles and their transitions together over a continuous shallow surface. Raised-tile textures include vertical padding, and their cache references are released when chunks or editor images are destroyed. Runtime-generated relief is not baked into the material PNGs: other engines need an equivalent surface renderer.

Four Beach Sand variants use a warm muted beige palette with grass, path, and water transitions. The sample coastline demonstrates their shallow rounded surface.

Moss Carpet, Fallen Leaves, Woodland Twigs, and Pebbled Grass preserve the original grass border pixels and feather their details into the interior. Six terrain brushes—Hill Foot, Lower Slope, Hill Shoulder, Hill Crest, Shallow Hollow, and Gentle Rise—blend height through shared vertices, including mixed brush and material joins. Their PNGs reuse grass; the manifest records the height offsets that require the relief renderer. The older standalone hills are labeled Legacy for existing maps; the sample uses continuous terrain brushes with separate matching stones and ferns instead. Cliff objects remain scenery, not seamless terrain brushes.

Fallen branches, twigs, pebble scatter, leaf litter, cream flowers, and lavender flowers are separate nonblocking props. Trees, ferns, and flowers have subtle pivot sway; water lighting uses synchronized timing to avoid pulsing tile squares. Reduced-motion preference disables animation. Tree and rock shadows are separate ground visuals.

**Limit:** this is visual relief. It does not add elevated navigation, change movement elevation, or make scenery hills and ramps walkable. Player and NPC artwork follows the surface, but movement, collision, and front/back sorting retain logical ground coordinates. This is not a completed elevation engine.

## Re-export

The exporter requires `sharp` and `pngjs` available to Node. On this workstation:

```sh
node scripts/export-forest-pack.cjs
node scripts/verify-forest-pack.cjs
node scripts/export-forest-sample.mjs
npm test
npm run build
```

On another workstation, set `NODE_PATH` to the directory containing those packages. The verification checks transparent sprite backgrounds, diamond dimensions, and matching material/variant borders. Geometry continuity is tested in `src/world/__tests__/forest-terrain.test.ts`.

Silhouettes and layered artwork sources are stored in `source/`.

## Player-relative tree scale

The actual idle player body occupies 23 source pixels, or 46 world pixels at the configured 2× scale. Tall oak, birch, beech, and ancient oak export at 260, 320, 300, and 360 world pixels respectively (about 6–8 visible player heights). The preview includes the real animated player sprite at gameplay scale for comparison. Tall trees retain narrow trunk collision footprints despite canopy overhang.

## Autumn trees and mushrooms

Golden Birch (320 world pixels), Copper Beech (300), and Burgundy Oak (280) match the tall-tree scale. Redcap, golden chanterelle, and lavender mushroom clusters are nonblocking props, 22–24 world pixels wide. Editable silhouettes are in `source/autumn-mushrooms.psd`. Tree sway is a runtime animation around the root contact with varied periods; PNG exports are static. Reduced-motion settings disable sway.

## Painted walls

`source/walls-calm.png` supplies both straight isometric wall directions and the corner. These replace the earlier detailed wall sprites under the same asset IDs, using broad grey stone faces and subdued olive moss without grass tile bases. Cliffs and the ramp now use `source/cliffs-calm-cutout.png`, with an editable `cliffs-calm.psd` master. Broad stone faces and olive caps replace the older detailed patches under the same asset IDs.

## Authored world

The nine authored Wake chunks now select the pack explicitly, including woodland, paths, hills, ruins, and a southern beach. Resource, NPC, and encounter layers are preserved. `node scripts/expand-painted-world.mjs` authors these through the editor adapter and validator; rerunning intentionally rebuilds the generated scenery. The game adds a bounded ambient butterfly/mote layer, cleaned up with the scene and disabled for reduced motion.

## Placement variation and understory

Forest trees receive a deterministic 0.5–1.5× height multiplier and 0.8–1.2× width multiplier from their stable placement ID. Trees, rocks, and foliage may mirror horizontally. Directional walls and cliffs remain unchanged. Root contacts, collision footprints, and logical depth anchors stay fixed; shadow dimensions follow size while retaining the shared light direction. The editor and game use the same variation helper, so reloading does not reshuffle the forest.

Six new placeable arrangements—Low Fern Bed, Woodland Litter, Wildflower Patch, Mushroom Bed, Mossy Pebble Bed, and Fallen Branch Bed—are in the object catalog. They reuse the approved sprites in small nonblocking clusters; their exported composition data is `ground-detail-prefabs.json`. These are six composite assets, not six additional raster textures. The authored world now has 635 generated scenery placements, including understory around open routes. Existing resource/NPC/encounter layers are preserved.

## River Woodland map

`river-woodland-map.json` is the current 96×96 preview/export: a source pool, winding river with three crossings, ruined gatehouse, birch hollow, elder-oak court, eastern camp and ruins, southern meadows, river mouth, and coastal cove. Six tree species mix with smoothly changing local proportions. The nine corresponding Wake chunks are rebuilt through the editor adapter by `node scripts/build-river-woodland.mjs`; original gameplay layers remain intact and the world bounds cover these nine chunks. The earlier compact art sample remains in `forest-pack-sample.json`.

## Woodland settlement and large bushes

Ten additional transparent sprites use the current muted painted palette: moss-roof shack, lantern post, direction sign, fence and closed gate in both isometric directions, bench, supplies, and a broad bush. The bush is 110 world pixels wide before deterministic foliage variation, has a 2×2 nonblocking footprint, and sways gently at its ground anchor. Buildings and directional props retain fixed orientation and size. The shack and closed gates are scenery; interiors and opening interactions are not implemented.

PNG masters and export cutouts live in `source/`. Directional Y exports mirror the X masters.

`export-forest-pack.cjs` now also invokes `export-settlement-props.cjs`, which removes neutral preview mattes, trims transparent bounds, and exports at 2× world resolution. Run the settlement exporter alone to rebuild only these ten sprites. The complete manifest contains 42 sprite images and 34 terrain tiles. `build-river-woodland.mjs` places them in the nine world chunks while preserving gameplay layers; the preview's Woodland Shack button visits the new clearing.

## Higher ground and yard alignment

Four additional grass relief brushes (15–18) provide 30, 42, 56, and 72 world pixels of height offset, retaining the existing welded material edges and cubic height blending. River Woodland uses them for broad uplands at the Western Overlook, Source Bluffs, and northern ridge, with high and low cliff outcrops. Existing low hill profiles remain unchanged. Elevation remains visual; cliff footprints block movement, and tested routes connect the landmarks.

Fence sections now export at 80 world pixels wide to match the gate post spacing. The shack yard places a closed gate between two fence sections, removes the isolated side gate, and moves the bench beside the shack.

## Reference coast — 2026-09-15

`forest-pack.html?sample=coast` assembles the new assets in the actual game renderer. Export the 24×24 scene through its Export coast map button or use `coastal-forest-sample.json`. All new objects are registered in the editor catalog. The woodland world consumes the updated textures under its existing IDs; its gameplay layers are unchanged by this art export.

The coastal masters cover terrain, cliffs, stairs, trees, flowers, rocks, and cattails. Export trims alpha, removes translucent halos, scales cutouts, and rectifies the cliff face.

New modular cliff X/Y/corner sprites use exact 2:1 footprints (2×1, 1×2, 2×2), 72 world pixels of wall height, and a horizontally welded rock material. Place modules on the same base elevation to join them; arbitrary slopes or different base heights require additional transition geometry. The top material matches the grass family. Stairs X/Y are separate scenery assets. Their presence does not add elevated traversal.

Material squares have welded opposite borders and matching variant borders. The game blends height/material fields continuously for rounded corners. Its coastline finish adds shallow aqua tones and a thin foam contour sampled in world coordinates; the water texture spans four tiles to avoid tiny repetitive patterns. For another engine, use the included square materials, diamond tiles, overlay PNGs, height metadata and prefab JSON, and reproduce the continuous terrain/shore rendering. A relief brush PNG alone does not contain the rendered hill geometry or animated shoreline.

Rebuild with the usual `export-forest-pack.cjs` command; it awaits settlement export and then `export-coastal-props.cjs`. `verify-forest-pack.cjs` checks 35 material tiles, 50 transparent sprites, cliff module dimensions, and exact cliff-face horizontal seam pixels. Original artwork is retained in `source/`; selected runtime images are in `public/assets/forest-painterly/`.

Connected woodland ridges use `forest_coast_ledge`, an 8×2 painted ledge sprite. It uses a single terrain-height anchor, so rolling terrain cannot separate their seams. Use this prefab for a continuous ledge; the older high/low outcrop sprites remain standalone rocks.

The map audit checks every free walkable tile belongs to one component across all nine chunks, plus landmark/crossing access and chunk-contained footprints. `forest_coast_ledge_stairs` keeps stairs and cliff in one height frame. Tree placement reserves space around ledges, walls and fences to avoid roots intersecting their silhouettes. Stairs remain blocking scenery, not an elevated route.

The clean ledge artwork is `source/cliff-clean/ledge.png`. Export uses the original alpha, removes low-alpha halo, trims and fits the 640×464 runtime sprite. This is one complete ledge, not an arbitrarily repeatable cliff material.

`ForestLedgeBlend.ts` composites the painted ledge's rear turf edge into the ground at render time in both game and editor. A cached grass-only alpha ramp preserves opaque rock faces. External engines using the raw PNG need the same compositing step; this is not baked into the source sprite.

## Modular terrain reset

River Woodland no longer places cliff or stair objects. Four authored groups use individual `forest_grass_19` terrain tiles. Their top is one shared 96-world-pixel plane; only exposed X/Y front edges draw rock faces, including both faces at corners. Adjacent modules have no internal walls. The same renderer runs in game and editor. These plateau tiles are blocked until elevated navigation is implemented. Existing smooth hills retain their earlier brushes.

Floor material processing now keeps the native 256×128 samples, and ground render textures cache at 2× world resolution (four times the pixel count). Grass flat-color mixing is reduced from 45% to 20%; other materials from 25% to 15%. Texture caching and per-frame baking budgets remain active. The higher cache resolution increases GPU memory use.

Current River Woodland placement: plateau/cliff tiles were removed from the current composition. Keep the world composition free of cliff scenery and `forest_grass_19` tiles; preserve smooth hills and the improved floor resolution. The unused plateau brush remains available in the catalog only.

Grass now uses `grass-world-hd.png`, a welded 1024×1024 square sampled continuously over 8×8 tiles. `scripts/export-forest-ground-hd.cjs` builds it from the painted master and is invoked by the full exporter. This preserves readable painted blades instead of squeezing the whole master into each tile. Detail brushes 5–8 retain their specialized materials.
