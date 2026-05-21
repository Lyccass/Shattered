# World And Persistence

This document describes the current world data, map loading, terrain, chunk
rendering, and persistence model.

## Grid-First World Model

Shattered stays grid-first internally.

Maps store terrain families, not resolved sprite variants. Current terrain
families include:

- `grass`
- `dirt`
- `stone`
- `water`
- `sand`

`WorldGrid` stores logical terrain and walkability. `IsoTransform` converts
grid coordinates to Phaser world coordinates. Visual terrain is resolved later.

## Terrain Resolution

`TerrainResolver` converts a terrain family plus tile coordinate into a visual
tile definition. Resolution is deterministic, so a tile does not reshuffle when
chunks redraw.

`TerrainResolutionCache` owns one resolver per active map runtime. It avoids
duplicated terrain lookup work between `IsoTilemap` and chunk rendering and is
cleared on map unload.

Terrain transition rules:

- out-of-bounds neighbours resolve as water, so island edges read as shorelines
- shoreline transitions have higher priority than inland grass/dirt/stone blends
- shoreline art belongs to the water tile when water touches land
- missing transition art must not break rendering
- future hills, cliffs, and slopes should add an elevation layer to `WorldGrid`

Editor-authored exact terrain tiles can override both visual art and
walkability. When `metadata.editorTerrainTiles` exists on a map, runtime
rendering uses those exact sprite frames and `WorldGrid` uses their `walkable`
flag for terrain blocking.

## Map Definitions

Current prototype maps are whole-map `MapDefinition` data. They are still valid
for small handcrafted spaces and special-space travel.

Static map data includes:

- terrain families
- authored static objects
- zones
- spawn points
- interaction anchors
- transitions and visual anchors
- metadata
- optional editor-authored terrain and object definitions

Static map data does not include:

- player inventory
- skill XP
- contract state
- depleted resources
- temporary placed objects
- campfires
- active enemies
- open menus
- Phaser objects

Maps are registered lazily. The registry stores map ids and factory functions,
but a map factory only runs when that map id is requested.

The game can also load one published editor map from browser local storage for
fast iteration when opened with `?editorMap=1`. This is a prototype test path
between the editor and the game, not the final content packaging path.

Validation is explicit. Bad authoring data should fail validation loudly instead
of black-screening during app boot. Runtime and validation rules should match.

## Map Loading

Spawn points use grid coordinates. `MapLoader` resolves the active spawn and
converts it into world coordinates through `IsoTransform`.

Transitions are data. A transition defines:

- source tile or trigger footprint
- target map id
- target spawn id
- optional transition type such as `dock`, `door`, or `debug`
- optional visual anchor

Transition visual anchors must sit on the actual trigger footprint. Validation
should keep transition triggers clear of object footprints.

Map switching responsibilities:

- `MapLoader` loads and unloads active map runtime.
- `IsoTilemap` owns active terrain/world grid runtime.
- `ObjectPlacementSystem` validates, blocks, and renders placed objects.
- `WorldRuntimeCoordinator` coordinates map switching, spawn resolution, player/camera rebinding, and runtime systems.
- `GameScene` stays focused on Phaser lifecycle, input, and frame updates.

## Chunk Rendering

Terrain is chunked on the rendering side only. Gameplay remains grid-first.

Chunk indexing is tile-based. A chunk is identified by `chunkX, chunkY`, where
each chunk covers a fixed tile rectangle based on `terrainChunkSize`.

Each chunk tracks:

- logical tile bounds
- draw bounds with bleed margin
- precomputed world bounds for visibility tests

The bleed margin reduces border seams by letting ground drawing include extra
tiles around the logical chunk.

Rendering split:

- `TerrainChunkDrawSystem` draws materialized chunk ground, grid/debug overlays, transition debug overlays, and chunk outlines.
- `IsoTilemapChunkRenderer` decides which chunks exist, which are visible, and which are evicted.

Chunk lifecycle:

- visible chunks materialize on demand
- retained offscreen chunks keep ground cache
- offscreen debug/grid overlays are dropped
- chunks outside retain range are destroyed
- missing visible chunks are materialized with a per-frame budget

Future large-map streaming work:

- chunk pooling
- object streaming by region/chunk
- async region loading
- neighbouring region prefetch
- editor-authored chunk metadata
- server-driven runtime chunk state

## World Chunk Authoring

The long-term overworld should feel seamless to the player but be internally
authored and synchronized as regions and chunks.

Current direction:

- `WorldManifest` describes a seamless world.
- `RegionManifest` describes one region inside that world.
- `WorldChunkDefinition` describes static authored chunk data.
- `WorldChunkRuntimeState` describes sparse runtime changes.

Static chunks can include:

- terrain
- static objects
- resource node candidates
- zones
- connections
- habitats
- metadata

Static chunks must not include player state, depleted resources, killed enemies,
active enemies, temporary deployables, or other runtime state.

Runtime chunk state can later include:

- depleted resources with `respawnAt`
- creature group runtime state
- temporary world objects
- opened chests
- local event flags

If a resource node is absent from runtime depletion state, it is available. If
its `respawnAt` is in the past, depletion should be discarded.

## Persistence

Local persistence is prototype-only and uses browser `localStorage`.

Storage key:

- `shattered.prototype.save.v1`

Saved player-owned state:

- current world/map id
- player tile
- resources and items
- currency
- reputation
- skill XP
- accepted and completed contract state
- active effects with remaining time

Saved world state:

- sparse changed regions
- sparse changed chunks
- depleted resource ids
- resource `respawnAt` timestamps

Not saved:

- static authored content
- placed firestarter sets
- campfires
- placement previews
- action progress
- open menus
- toasts
- debug overlay state
- Phaser scenes, sprites, graphics, cameras, tweens, or other runtime objects

Temporary deployables are allowed by placement rules, but remain runtime-only in
the current prototype.

Restore safety:

- invalid JSON fails safely
- unsupported save versions fail safely
- malformed snapshots fail validation and are not applied
- invalid saved map ids fall back to the default prototype map
- invalid saved player tiles fall back to the map spawn

Manual controls:

- `Option/Alt + V` saves now
- `Option/Alt + L` loads save
- `Option/Alt + R` clears save

Current autosave:

- after successful contract completion
- after map transition

Later server persistence should separate account-owned player state,
server-owned overworld chunk state, personal island persistence, and temporary
runtime state.

## Scale Rules

Object footprint, visual size, depth anchor, and collision should remain
separate.

Rough current scale targets:

- player footprint: around 1 tile
- player visual height: around 1.5-2 tiles
- small house footprint: around 4x3 or 5x4 tiles
- small house visual height: around 2.5-3.5 player heights
- tree visual height: around 2-3 player heights
- rock visual height: around 0.5-1 player height
- dock footprint: at least 3x1 or 4x2 tiles

The player should not visually look taller than a usable house entrance.
