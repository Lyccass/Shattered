# Campfire Utility v0

This slice extends the first craft-and-place loop without turning it into a full crafting or building system.

Current loop:

1. Gather `wood`, `stone`, and `herb`.
2. Use the home workbench to craft a `firestarter_set`.
3. Keep the crafted item in the small session inventory.
4. Press `Space` to enter placement mode when ready.
5. Place the `firestarter_set` on a valid nearby tile.
6. Interact with the placed firestarter while carrying `stone` to light it.
7. Interact with the active `campfire` while carrying `herb` to brew `warm_tea`.

## Runtime State vs Static Map Data

Static map files still define authored space only:

- terrain
- authored objects
- authored interaction anchors
- transitions

Session changes live in runtime state instead. `WorldSessionState` now owns:

- resource respawn timers
- depleted resource node state
- runtime-placed firestarters
- runtime campfires
- despawn timers for temporary placed objects

Nothing in this slice writes campfire placement or gathered-node depletion back into static map definitions.

## Resource Pouch and Item Inventory

The tiny session inventory remains split into two layers:

- resources:
  - `wood`
  - `stone`
  - `herb`
- crafted/session items:
  - `firestarter_set`
  - `warm_tea`

There is still no item grid, no drag and drop, no storage, and no persistence.

## Workbench Recipe

The workbench recipe stays intentionally small:

- `1 wood -> 1 firestarter_set`

Crafting no longer forces placement mode immediately. The item goes into the session inventory first, and the player can choose when to place it by pressing `Space`.

## Placement Flow

Placement is still player-facing rather than mouse-based:

- the preview appears one tile in front of the player
- facing comes from the last non-zero movement direction
- `E` or `Space` confirms placement
- `Escape` cancels placement

Placement only consumes the item after a valid placement succeeds.

## Campfire Lifecycle

The temporary object flow is now:

- `firestarter_set` is crafted at the workbench
- placing it creates a runtime `placed_firestarter_set`
- using `stone` on that object transforms it into a runtime `campfire`
- the `campfire` keeps its own despawn timer even after being lit
- when the timer expires, the runtime object and its interaction target are removed

This keeps temporary utility objects separate from the static map layout.

## Herb to Warm Tea

An active campfire now has a simple utility interaction:

- if the player has at least `1 herb`, the campfire consumes `1 herb` and adds `1 warm_tea`
- feedback: `You brew warm tea.`
- if the player has no herb, feedback falls back to: `The fire crackles.`

No buffs, healing, stamina, cooking, or status effects are implemented yet.

## Intentionally Not Implemented Yet

- persistence
- full inventory UI
- multiple campfire recipes
- buffs from tea
- cooking
- light or fire VFX
- permanent buildables
- shared world chunk runtime state or multiplayer sync
