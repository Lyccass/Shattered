# Local Persistence v0

Local persistence is prototype-only and uses browser `localStorage`.

The storage key is:

- `shattered.prototype.save.v1`

## What Is Saved

The save uses the existing plain-JSON snapshot types from Persistence Prep v0:

- `SaveGameV1`
- `PlayerSaveState`
- `PersonalIslandSaveState`
- `WorldMapSnapshotState`
- `WorldRegionSnapshotState`
- `WorldChunkSnapshotState`

Saved player state includes:

- current world/map id
- player tile
- resources
- items
- currency
- reputation
- skill XP
- accepted/completed contract state
- active effects with remaining time

Saved world state includes sparse changed chunk data only:

- depleted resource node ids
- `respawnAt` timestamps for those depleted nodes

## What Is Not Saved

Static authored content is never saved:

- terrain
- authored objects
- zones
- anchors
- transitions
- map definitions

Temporary runtime state is also not saved:

- placed firestarter sets
- campfires
- placement previews
- action progress
- open menus
- toasts
- debug overlay state
- Phaser scenes, sprites, graphics, cameras, tweens, or other runtime objects

Temporary deployables are allowed by placement rules, but they are still runtime-only in v0.

## Sparse World Chunk State

The main overworld is treated as one seamless world in the save architecture.
Prototype maps still stand in for regions, but saved world changes are stored as sparse chunk data:

- only changed regions appear
- only changed chunks appear inside those regions
- unchanged chunks are omitted

For resource depletion:

- static content says the node exists
- saved chunk state only says that a specific node is depleted until `respawnAt`
- if `respawnAt` is already in the past during restore, the node is restored as available

## Restore Safety

Restore is defensive:

- invalid JSON fails safely
- unsupported save versions fail safely
- malformed snapshots fail validation and are not applied
- invalid saved map ids fall back to the default prototype map
- invalid saved player tiles fall back to the map spawn

Load failure should not crash the prototype or corrupt the active runtime.

## Controls

Manual local persistence controls:

- `Option/Alt + V` save now
- `Option/Alt + L` load save
- `Option/Alt + R` clear save

Current prototype autosave is conservative:

- after successful contract completion
- after map transition

## Later Direction

This localStorage layer is only a prototype bridge.

Later server-backed persistence should replace it with:

- account-owned player save state
- server-owned seamless overworld chunk state
- explicit personal island persistence
- runtime-only temporary world state held separately from persistent state
