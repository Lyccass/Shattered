# Map Editor

The map editor is a separate app, not a gameplay feature inside `GameScene`.

The game consumes validated map data. The editor produces compatible map and
chunk data. Shared code owns schemas, terrain family ids, validation helpers,
and pure coordinate helpers.

## Entrypoint

Run the editor with:

```bash
npm run dev:editor
```

Runtime page:

- `editor.html` boots `src/apps/editor/main.ts`.

The regular game runs with:

```bash
npm run dev
```

## Ownership Rules

`src/editor` may import shared schemas, shared editor helpers, terrain assets,
and pure coordinate helpers.

`src/editor` must not import gameplay runtime systems such as:

- combat
- player controllers
- persistence
- contracts
- game UI
- `GameScene`

The dependency boundary test should keep this relationship explicit.

## Current Editor Features

The editor currently supports:

- terrain painting
- exact terrain tile selection
- terrain flip flags
- object placement
- object deletion
- chunked terrain redraws
- chunk outlines
- map resize prompt
- camera pan, zoom, and centering
- HUD and selected/hovered previews
- import/export of compatible map JSON
- import/export of compatible world chunk JSON
- dirty chunk tracking
- dirty chunk bundle import/export
- chunk naming overlay
- save/open through browser file APIs when available
- publishing the current editor map to the game through browser local storage
- cloning the selected terrain tile into a custom tile with its own walkability
- cloning the selected object into a custom object with its own movement blocking

Current shortcuts:

- `1`-`5`: select terrain family brush
- `Q/E` or `[`/`]`: cycle tile or object selection
- left drag in terrain mode: paint
- `WASD` or arrows: pan camera
- right or middle mouse drag: pan camera
- mouse wheel: zoom
- `+` / `-`: zoom
- `F`: flip brush left/right
- `V`: flip brush up/down
- `T`: terrain mode
- `O`: object mode
- left click in object mode: place selected object
- `Shift + left click`, `D`, `Delete`, or `Backspace`: remove object
- `R`: open the resize / extend panel
- `C`: center camera
- `U`: save dirty chunks to the editor chunk library
- `J`: open the editor chunk library
- `I`: open the editor map library

Visible sidebar actions:

- `Create Custom Tile`: clone the selected tile or drop an image into the in-editor fitting form, set its category, image scale, image offset, and walkability. The import preview draws a real 64x32 isometric guide; dropped tile images preserve their source canvas by default and can be dragged/nudged into place. Optional cleanup/cropping can be enabled in the form.
- `Delete Custom Tile`: remove the selected custom tile; painted instances are replaced with the default tile for that terrain family
- `Create Custom Object`: clone the selected object or drop an image into the in-editor fitting form, set its category, footprint size up to 16x16 tiles, image scale/offset, and whether it blocks movement. Dropped object images preserve their source canvas by default and are centered on the footprint ground plane; optional cleanup/cropping can be enabled in the form.
- `Delete Custom Object`: remove the selected custom object and its placed instances

Top-right map/chunk actions:

- `Save Map`: save the current map into the project map library with a preview
- `Open Map`: open the project map library and load a saved map from preview cards
- `Open Window`: load a selected chunk and configurable surrounding chunks from a saved map
- `Extend Map`: resize/extend the current loaded map or chunk window in whole chunks
- `Save Changed Chunks`: save dirty chunks into the project chunk bundle library with a preview
- `Apply Chunk Bundle`: open the saved chunk bundle preview library and apply a bundle to the current map/window
- `Test Game`: publish the current editor map and open the game with `?editorMap=1`

The normal save/load path is native to the editor UI. During development the
library is backed by project JSON files under `data/editor-library/maps` and
`data/editor-library/chunks`, with browser storage used as a fast cache. The UI
shows visual previews instead of asking for OS file picker locations or pasted
JSON blobs.

When a chunk window is loaded from a larger saved map, resize/extend operations
are guarded against overwriting known chunks that were not loaded. Load a larger
window first when you need to edit adjacent existing chunks.

## Terrain Authoring

The editor stores both:

- gameplay terrain family
- exact editor-authored terrain tile metadata
- per-tile walkability for exact editor-authored tiles
- editor-authored walkability overrides
- editor-authored tile height/elevation values
- custom tile categories
- custom object categories and rectangular footprint sizes

Gameplay now consumes exact `editorTerrainTiles` when present. That means an
editor-painted tile can keep its specific sprite frame and walkability instead
of being re-resolved from the terrain family at runtime.

The editor does not auto-pick random variants, auto-transition neighbours, or
mutate neighbouring art when one tile is painted. If a transition tile is
needed, select it from the tile catalog and paint it manually.

## Export Format

Map export produces a shared `MapDefinition` shape with:

- id
- display name
- space type
- width and height
- terrain
- default spawn point
- explicit object ids
- transition, zone, and interaction layers
- source metadata
- editor terrain metadata
- custom editor terrain brush metadata
- custom editor object definition metadata
- future enemy spawn metadata

World chunk export produces a compatible `WorldChunkDefinition`.

Import supports both `MapDefinition` and `WorldChunkDefinition` JSON. Invalid
imports fail before replacing the current editor map.

## Editor To Game Pipeline

Current fast iteration path:

1. Build or open a map in the editor.
2. Use `Create Custom Tile` when a tile needs different walkability than its
   family default.
3. Use `Create Custom Object` when an object should have a different blocking
   rule, custom image, category, or footprint.
4. Paint/place those custom definitions normally.
5. Press `Test` to publish the map and open the game in editor-map test mode.

The published map is stored under the browser key
`shattered.editor.published_map.v1`.

The game only uses the published editor map when opened with `?editorMap=1`.
Normal game reloads use registered game maps, so a work-in-progress editor map
cannot break the default game boot.

The game supports custom definitions cloned from already-loaded textures and
custom images embedded by the editor. Imported tile and object images keep
their aspect ratio and source canvas by default; the editor stores the manual
display scale, image offset, and ground-plane anchor data so the game renders
the same result.

## Target Content Pipeline

The editor should grow toward a project-based workflow, not clipboard exports.

Target concepts:

- **Map project**: a saved editor document containing map metadata, custom tile
  definitions, custom object definitions, authored layers, and links to source
  assets.
- **Instance map**: a bounded authored map for interiors, dungeons, personal
  islands, encounter spaces, and other spaces that should load as a whole.
- **World map region**: a large seamless area split into many chunks.
- **Chunk working set**: the selected chunk plus a configurable surrounding
  radius, loaded for editing without opening the entire world.
- **Connection layer**: authored links between maps, instances, regions, chunks,
  spawns, doors, docks, portals, and debug travel points.

The practical workflow should become:

1. Open a map project or world region from a file/browser project picker.
2. Choose either instance-map editing or world-chunk editing.
3. For world chunks, choose a chunk coordinate and load radius.
4. Edit only the loaded working set.
5. Save changed chunks and map metadata back to project files.
6. Test the current working set in game through an explicit `Test` action.

For a large world, the editor must never require loading a 1000-chunk map into
one scene. It should materialize only the selected chunk window, track dirty
chunks, and save only changed chunk files.

## Next Editor Layers

Next editor passes should add separate tools and renderers for:

- resource node authoring
- named spawn points
- enemy spawn or habitat authoring
- transition trigger footprints and visual anchors
- zone painting
- placement validation and footprint previews
- region/chunk loading instead of whole-map editing

These should not be mixed into the terrain brush.
