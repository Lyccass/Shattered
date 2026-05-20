# World Chunk Authoring v0

The Wake should feel like one seamless OSRS-style overworld, but it should not be authored or saved as one giant map file.

Current prototype maps are whole-map TypeScript `MapDefinition` data. That is fine for small test maps, but it does not scale to large handcrafted regions, streaming, MMO resource depletion, or world-state-driven creature populations.

World Chunk Authoring v0 introduces static world authoring structures without replacing current gameplay loading yet.

## Ownership Model

- `WorldManifest` describes the seamless world as a whole.
- `RegionManifest` describes one authored region inside that world.
- `WorldChunkDefinition` describes static authored content for one chunk/cell.
- `WorldChunkRuntimeState` describes sparse runtime changes for one chunk.
- Current prototype `MapDefinition` maps still load as before.

Static authored data describes what can exist. Runtime chunk state describes what currently exists, what was harvested, what matured, what migrated, and what changed.

## World Manifest

`WorldManifest` includes `worldId`, `displayName`, `defaultRegionId`, default spawn metadata, region ids, terrain palette or asset catalog references, and global metadata.

The sample world is `the_wake`.

## Region Manifest

`RegionManifest` includes world/region ids, chunk coordinate bounds, chunk size, authored chunk list, biome/theme tags, and optional environment variables.

Environment variables are only data placeholders for now. Examples include `corruption`, `prosperity`, `monsterPressure`, `resourceAbundance`, `routeSafety`, `weather`, and `season`.

## Chunk Definition

`WorldChunkDefinition` is static authored chunk data. It includes world/region ids, chunk coordinate, dimensions, terrain, static object, resource, zone, connection, habitat, and metadata layers.

Static chunks do not store depleted resources, killed enemies, active enemies, harvested resource state, temporary deployables, or player state.

## Palette Terrain

Chunks can use palette encoded terrain:

```json
{
  "terrainPalette": {
    "0": "grass",
    "1": "dirt",
    "2": "water"
  },
  "terrain": {
    "encoding": "palette",
    "tiles": [
      [0, 0, 1],
      [0, 2, 2]
    ]
  }
}
```

This avoids repeating long terrain strings for every tile. Shared helpers can encode/decode between numeric tile ids and terrain families.

The terrain layer stores abstract terrain families only. Exact editor-authored visual tile choices can live in editor metadata until runtime rendering is ready to consume them.

## Layer Separation

Terrain layer:
Abstract terrain families or palette ids.

Static object layer:
Placed static rocks, trees, ruins, signs, buildings, and similar authored objects.

Resource layer:
Authored resource nodes or candidate positions. This says a resource can exist here; it does not say whether it is currently available.

Zone layer:
Town, safe, wilderness, combat, build, transition, shore, and other authored zone bounds.

Connection layer:
Prototype map transitions or future world/instance connections.

Habitat layer:
Creature-producing areas and spawn/maturity rules. The overworld should not rely on fixed permanent enemy spawns long-term.

## Runtime State

`WorldChunkRuntimeState` is separate and sparse. It may include depleted resources with `respawnAt`, creature group runtime placeholders, temporary world objects later, opened chests later, and local event flags later.

If a resource node is absent from `depletedResources`, it is available. If it has a future `respawnAt`, it is unavailable. If `respawnAt` is in the past, the depletion state should be discarded.

This is the shape future multiplayer/server sync can use when another player harvests a resource.

## Habitats And Maturity

Static habitat data can describe creature family, population/density hints, initial and max maturity level, maturity tick duration, migration threshold, migration target tags, and world-state requirements.

Runtime creature state can later track group id, creature family, maturity level, spawned time, last maturity tick, current chunk, migration target, and alive/dead/despawned/migrating status.

No simulation is implemented in v0. This pass only defines the data boundary.

## Editor Connection

The editor can now export:

- `X`: current game-compatible `MapDefinition`
- `Y`: `WorldChunkDefinition`

It can import both compatible `MapDefinition` JSON and `WorldChunkDefinition` JSON through the existing paste import. This keeps maps re-editable while preparing the future chunk workflow.

Future editor passes should load a region, materialize visible chunks, edit dirty chunks, and save only changed chunk files.

## Compatibility

Current prototype maps remain whole-map `MapDefinition` factories/data.

Adapters exist for:

- `MapDefinition -> WorldChunkDefinition`
- `WorldChunkDefinition -> MapDefinition`

This lets us test the new data model without breaking current game loading.

## Not Implemented Yet

This pass does not implement world streaming, backend sync, database persistence, real enemy migration, ecosystem simulation, dirty chunk editor saves, procedural world generation, or gameplay content changes.
