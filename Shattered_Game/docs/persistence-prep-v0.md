# Persistence Prep v0

This pass does **not** add `localStorage`, backend persistence, accounts, or multiplayer saves yet.

It prepares plain-JSON snapshot boundaries so the project can move toward save/load without treating the main world like one giant room blob.

## Seamless Overworld Direction

The player-facing goal is a seamless world called **The Wake**.

That means the player should eventually feel like they are moving through one continuous overworld, not hopping between unrelated rooms.

Internally, that seamless overworld still needs structure:

- `WorldMap`
- `WorldRegion`
- `WorldChunk` / `WorldCell`
- sparse changed chunk state
- streamed runtime entities and objects

The current visible map transitions remain valid as prototype scaffolding and may still be useful later for special spaces, but they are **not** the final model for moving through the main overworld.

## Snapshot Ownership

### StaticWorldDefinition / StaticMapDefinition

Authored content only:

- terrain families
- authored static objects
- zones
- anchors / service points
- transitions / exits
- metadata

Not saved:

- player inventory
- XP
- depleted resources
- active campfires
- temporary deployables
- runtime NPC state

### PlayerSaveState

Player/account-owned progress:

- current world id
- current map id during prototype
- player tile
- resources
- items
- currency
- reputation
- skill XP
- accepted contracts
- completed non-repeatable contracts
- contract completion counts
- active effect timers

This is the state that belongs to the player even if the world is reset or rematerialized.

### PersonalIslandSaveState

Persistent player-owned island state.

For now this is only a placeholder shape:

- island id
- persistent placed objects
- future terrain edits
- future buildings
- future storage

Important distinction:

- **placement permission** is about zones/rules
- **persistence** is about lifecycle

A temporary deployable does **not** become persistent just because it was placed on a personal island.

### WorldMapSnapshotState

Prototype stand-in for future server-owned worldmap state.

It contains:

- `worldId`
- sparse changed regions
- sparse changed chunks only

It does **not** contain:

- full terrain
- full world object dumps
- unchanged chunks

### WorldChunkSnapshotState

One sparse changed chunk of the overworld.

Current v0 usage:

- depleted resource node ids
- `respawnAt` timestamps

If nothing changed in a chunk, that chunk is omitted entirely.

### RuntimeOnlyState

Not saved in v0:

- placed firestarter sets
- campfires
- placement previews
- active action progress
- open menus
- toasts
- Phaser scene objects
- debug overlay state

Temporary deployables are allowed by placement rules, but they remain runtime-only everywhere:

- personal island
- wilderness
- harbor
- any other valid zone

## Current Snapshot Types

The code now uses:

- `SaveGameV1`
- `PlayerSaveState`
- `PersonalIslandSaveState`
- `WorldMapSnapshotState`
- `WorldRegionSnapshotState`
- `WorldChunkSnapshotState`

These live in [src/persistence/SaveTypes.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/persistence/SaveTypes.ts).

## Current Snapshot APIs

Player-owned state can now create and restore plain JSON snapshots through:

- [PlayerSessionState.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/player/PlayerSessionState.ts)
- [PlayerInventoryState.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/player/PlayerInventoryState.ts)
- [PlayerCurrencyState.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/player/PlayerCurrencyState.ts)
- [PlayerReputationState.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/player/PlayerReputationState.ts)
- [SkillProgressionSystem.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/skills/SkillProgressionSystem.ts)
- [TaskJournalState.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/tasks/TaskJournalState.ts)
- [ConsumableEffectSystem.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/effects/ConsumableEffectSystem.ts)

World-owned sparse resource depletion snapshots are created and restored through:

- [WorldSessionState.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/world/session/WorldSessionState.ts)
- [WorldChunkSnapshotUtils.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/persistence/WorldChunkSnapshotUtils.ts)

Top-level prototype save assembly and validation now live in:

- [PrototypeSaveV1.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/persistence/PrototypeSaveV1.ts)
- [SaveValidation.ts](/Users/luka/Documents/Work_Jobs/005%20-%20Shattered%20/Shattered_Game/src/persistence/SaveValidation.ts)

## Resource Respawn Representation

Resource depletion is saved as sparse world state:

- static map data says a node exists
- world snapshot says that node is depleted until `respawnAt`
- if `respawnAt` is already in the past, it is omitted from save output
- if a saved `respawnAt` is in the past during restore, it is discarded and the node is available again

This means resource depletion belongs to `WorldMapSnapshotState`, not `PlayerSaveState`.

## World Chunk Authoring Link

Player/local save state remains separate from authored world data. Large overworld maps should be authored as `WorldManifest -> RegionManifest -> WorldChunkDefinition`, while runtime changes such as depleted resources belong to sparse `WorldChunkRuntimeState` / `WorldMapSnapshotState` data.

This matters for MMO readiness: another player harvesting a node should change runtime chunk state, not the static authored chunk file and not the local player's inventory/state.

## Inventory Snapshot Direction

Runtime item/resource helpers are still typed for the current prototype ids, but save snapshots now use open records:

- `Record<string, number>` for resources
- `Record<string, number>` for items

That keeps the save shape ready for many future ids without forcing the save format to change every time a new item is added.

## What Is Intentionally Not Implemented Yet

- actual `localStorage` save/load
- backend persistence
- account saves
- multiplayer sync
- world streaming
- restoring temporary deployables
- persistent personal-island building logic
- save migration chains
- save UI

## Next Step

`Local Persistence v0` should build on this by:

1. wiring these snapshot builders into one explicit save/load service
2. choosing restore fallback behaviour for invalid map ids or tiles
3. deciding exactly when autosave/manual save happens
4. keeping temporary deployables runtime-only
