Shattered stays grid-first internally.

Maps store terrain families only, not resolved sprite variants. A map tile is `grass`, `dirt`, `sand`, `stone`, or `water`. `TerrainResolver` still decides which visual frame to render for that family.

Map objects are also plain data. A map entry says which object definition to place and which grid tile to anchor it on. `ObjectPlacementSystem` is still responsible for validating placement, blocking tiles, and rendering the object.

Spawn points use grid coordinates. The active spawn is resolved by `MapLoader`, then converted into Phaser world coordinates through `IsoTransform`.

Map transitions are data too. Each transition has a source tile or footprint, a target map id, a target spawn id, and an optional transition type like `dock`, `door`, or `debug`.
Transitions can also define a `visualAnchor` tile. That anchor is rendered as a simple in-world travel marker so the player can see where a map exit lives without opening debug mode. The anchor should sit on the actual trigger footprint, not somewhere nearby, so the visible marker and the real interaction tile stay aligned.

Transitions are detected through `MapTransitionSystem`. It checks the player's feet tile against the active map's transition footprints. For v0, transitions are manual: when the player is standing on a matching footprint, pressing `E` loads `targetMapId` and spawns the player at `targetSpawnId`.
Transition trigger footprints should stay clear of placed object tiles. `MapDefinitions` now validates that a transition trigger does not overlap any map object footprint, while `visualAnchor` is free to sit on a dock, doorway, or other visible landmark.

Map switching stays split cleanly:

- `MapLoader` loads and unloads the active map runtime
- `IsoTilemap` owns the active terrain/world grid runtime
- `ObjectPlacementSystem` clears old placed objects and blocks, then places the new map's objects
- `PlayerController` keeps the same player object, but rebinds collision to the new map and moves to the resolved spawn point

To add a new transition to a map:

- add a `transitions` entry in the `MapDefinition`
- set `fromTile` to the anchor tile
- optionally add `triggerFootprint` offsets for multi-tile triggers
- optionally add `visualAnchor` if the visible travel marker should sit on a different tile or carry a short label
- set `targetMapId` and `targetSpawnId`
- optionally set `transitionType` like `dock`, `door`, or `debug`

Handcrafted maps no longer need to live in one giant file. The intended structure is one file per map plus a small index file that exports the list of available test maps. That keeps transitions, objects, and spawn points local to the map they belong to, which will matter much more once the project grows or starts importing external editor data.

Procedural generation is still available for testing through `IslandGenerator`, but handcrafted `MapDefinition` files are now the preferred path.

This structure is meant to stay export-friendly for LDtk, Tiled, or a custom editor later:

- terrain layer = terrain families
- object layer = placed object data
- spawn layer = named spawn markers
- transition layer = named map links
