Shattered keeps terrain chunked on the rendering side only. Gameplay is still grid-first:

- `WorldGrid` stores terrain families and walkability
- `IsoTransform` converts grid coordinates to Phaser world coordinates
- `TerrainResolutionCache` resolves deterministic terrain visuals per tile
- `IsoTilemapChunkRenderer` manages chunk lifecycle and visibility

Chunk indexing is tile-based. A chunk is identified by `chunkX,chunkY`, where each chunk covers a fixed tile rectangle based on `terrainChunkSize`.

Each chunk stores:

- logical tile bounds (`startX/startY/endX/endY`)
- draw bounds with a small bleed margin (`drawStartX/.../drawEndY`)
- precomputed world bounds for visibility tests

The bleed margin exists to reduce seams at chunk borders. Ground drawing can include one extra tile around the logical chunk so transition art and edge pixels are not clipped at the chunk boundary.

Chunk rendering is split into two responsibilities:

- `TerrainChunkDrawSystem` draws a materialized chunk's ground, grid overlay, terrain-transition debug overlay, and chunk debug outline
- `IsoTilemapChunkRenderer` decides which chunks should exist, which should be visible, and which should be evicted

Chunk visibility works like this:

- the camera `worldView` is converted back into grid space
- that grid area becomes a chunk range
- a small `visibleChunkRadius` expands the range so nearby chunks are already ready
- a larger `retainChunkRadius` keeps recently nearby chunks cached

Chunk lifecycle is simple for now:

- visible chunks are materialized on demand
- retained but non-visible chunks stay cached
- chunks outside the retain range are destroyed and counted as evicted

Chunk builds are also budgeted. The renderer only materializes a small number of missing visible chunks per frame instead of trying to create every newly visible chunk at once. That keeps exploration spikes smoother on larger maps.

Ground chunk builds and grid/debug overlay builds are budgeted separately:

- ground chunks are created first so terrain appears as soon as possible
- grid/debug overlays are queued independently
- only visible chunks receive grid/debug overlay work
- retained offscreen chunks keep their ground cache but drop grid/debug overlay state

This keeps chunk memory bounded without introducing full streaming-world architecture yet.

Terrain resolution is cached per map runtime through `TerrainResolutionCache`.

- the cache owns one `TerrainResolver`
- the same tile coordinate resolves once and is reused
- the cache clears on map unload
- if terrain mutation is added later, individual tiles can be invalidated

This keeps deterministic terrain visuals while removing duplicate resolver work between `IsoTilemap` and the chunk renderer.

Map unload should clear:

- terrain chunks
- chunk debug graphics
- materialized chunk cache
- terrain resolution cache
- transition visuals
- object visuals and debug overlays

Chunk debug mode is grid-native:

- the logical chunk footprint is drawn on the actual isometric tile grid
- the bleed footprint is drawn separately
- debug should communicate "this is the gameplay-aligned chunk rectangle" versus "this is the extra art padding used by the render texture"

The chunk debug overlay should not use axis-aligned render-texture rectangles as the primary signal, because those are implementation bounds, not the logical chunk tiling.

Future work for true large-map streaming:

- chunk pooling instead of destroy/recreate
- object streaming by region/chunk
- async region loading
- map section boundaries and neighbouring region prefetch
- editor-authored chunk metadata
- server-driven world-region/chunk runtime state
