Shattered stays grid-first internally.

Maps store terrain families only, not resolved sprite variants. A map tile is `grass`, `dirt`, `sand`, `stone`, or `water`. `TerrainResolver` still decides which visual frame to render for that family.

Maps are registered lazily. The registry stores map ids plus factory functions, but it does not construct every map during import or scene boot. A map factory only runs when that specific map id is requested.

Map validation is explicit too. Importing map files should never black-screen the game by validating bad content at startup. Instead, validation runs only when `validateMapDefinition(...)`, `validateRegisteredMap(...)`, or `validateAllRegisteredMaps()` is called on purpose.

Map objects are plain data. A map entry says which object definition to place and which grid tile to anchor it on. `ObjectPlacementSystem` is still responsible for validating placement, blocking tiles, and rendering the object, but authored map placement now fails loudly instead of silently skipping invalid entries.

Spawn points use grid coordinates. The active spawn is resolved by `MapLoader`, then converted into Phaser world coordinates through `IsoTransform`.

Map transitions are data too. Each transition has a source tile or footprint, a target map id, a target spawn id, and an optional transition type like `dock`, `door`, or `debug`.
Transitions can also define a `visualAnchor` tile. That anchor is rendered as a simple in-world travel marker so the player can see where a map exit lives without opening debug mode. The anchor should sit on the actual trigger footprint, not somewhere nearby, so the visible marker and the real interaction tile stay aligned.

Transitions are detected through `MapTransitionSystem`. It checks the player's feet tile against the active map's transition footprints. For v0, transitions are manual: when the player is standing on a matching footprint, pressing `E` loads `targetMapId` and spawns the player at `targetSpawnId`.
Transition trigger footprints should stay clear of placed object tiles. Validation now enforces that both the trigger footprint and the visual anchor stay on clear trigger tiles so the visible travel marker and the real interaction tile never drift apart.

Map switching stays split cleanly:

- `MapLoader` loads and unloads the active map runtime
- `IsoTilemap` owns the active terrain/world grid runtime
- `ObjectPlacementSystem` clears old placed objects and blocks, then places the new map's objects
- `WorldRuntimeCoordinator` owns map runtime switching, static object placement, spawn resolution, and player/camera rebinding
- `GameScene` stays focused on Phaser lifecycle, input, and frame updates

To add a new transition to a map:

- add a `transitions` entry in the `MapDefinition`
- set `fromTile` to the anchor tile
- optionally add `triggerFootprint` offsets for multi-tile triggers
- optionally add `visualAnchor` if the visible travel marker should carry a short label or choose one specific tile inside a multi-tile trigger
- set `targetMapId` and `targetSpawnId`
- optionally set `transitionType` like `dock`, `door`, or `debug`

Handcrafted maps no longer need to live in one giant file. The intended structure is one file per map plus a small index file that exports the list of available test maps. That keeps transitions, objects, and spawn points local to the map they belong to, which will matter much more once the project grows or starts importing external editor data.

The static placement policy is intentionally strict for authored maps:

- objects must stay fully inside map bounds
- objects cannot be placed on water
- objects cannot overlap other map-authored objects
- transitions cannot overlap object footprints
- transition visual anchors must stay on actual trigger tiles

This is shared between validation and runtime placement so authored content cannot pass validation and then load differently in-game.

Procedural generation is still available for testing through `IslandGenerator`, but handcrafted `MapDefinition` files are now the preferred path.

This structure is meant to stay export-friendly for LDtk, Tiled, or a custom editor later:

- terrain layer = terrain families
- object layer = placed object data
- spawn layer = named spawn markers
- transition layer = named map links

Map authoring now has a separate editor app entrypoint. The playable game consumes validated map data; the editor produces compatible map data; shared code owns the plain map schema, terrain family ids, validation helpers, and pure isometric coordinate helpers. Editor behavior must stay in `src/editor/` and must not be merged into `GameScene` or other gameplay runtime systems.

For the main game, visible map transitions are still prototype scaffolding and special-space travel support. The long-term overworld direction remains one seamless player-facing world, with regions/chunks as internal scalability boundaries rather than player-facing rooms.
