# Craft + Place Slice v0

This slice extends the first interaction loop into a slightly fuller home cycle:

1. Travel from home to the harbor.
2. Reach the wild island.
3. Gather driftwood and stone.
4. Return home.
5. Use the workbench to craft a `firestarter_set`.
6. Use `Space` to enter placement mode and place the `firestarter_set` on a valid nearby tile.
7. Interact with the placed firestarter while carrying stone to turn it into a campfire.

## Inventory Split

The session inventory is intentionally tiny and split into two layers:

- Resource pouch:
  - `wood`
  - `stone`
  - `herb`
- Crafted/session item counts:
  - `firestarter_set`

There is no item grid, no equipment, no drag and drop, and no persistence yet.

## Workbench Recipe

The workbench no longer places a result directly into the world.

Current recipe:

- `1 wood -> 1 firestarter_set`

The workbench only crafts the item and adds it to the player's session inventory.

## Placeable Item Flow

The `firestarter_set` is the first placeable session item.

Flow:

1. Craft the item at the home workbench.
2. The item stays in the session inventory.
3. A preview appears one tile in front of the player.
4. `Space` enters placement mode when the player is ready.
5. `E` or `Space` confirms placement.
6. `Escape` cancels placement.

If the player cancels placement, `Space` can be used later to re-enter placement mode as long as a `firestarter_set` is still in inventory.

## Placement Mode

Placement mode is player-facing, not mouse-based.

- The target tile is chosen from the player's last non-zero facing direction.
- If the player has not moved yet, facing defaults to `down`.
- The preview updates as the player moves or turns.
- Valid placement shows a green preview.
- Invalid placement shows a red preview and a reason in the prompt UI.

Validation uses the same placement policy as runtime object placement:

- target tile must be inside the map
- target tile must not be water
- target tile must not overlap another object
- target footprint must remain fully in bounds

## Firestarter Activation

Placing the item creates a runtime-only `placed_firestarter_set` object.

Interacting with it:

- if the player has `1 stone`, the stone is consumed and the placed firestarter transforms into a `campfire`
- if the player does not have stone, feedback explains that it still needs a sparkstone/stone

## Campfire Result

The resulting `campfire` is also runtime-only state.

For now:

- it is non-blocking
- it uses a simple placeholder visual
- interacting with it can consume `1 herb` to produce `1 warm_tea`
- if the player has no herb, it only gives flavour text
- it despawns on a session timer even after being lit

## Session Timers

Resource respawn and temporary object despawn use absolute session timestamps.

That means:

- gathered nodes can respawn even if the player leaves the map
- placed firestarter sets can expire even if the player leaves the map
- campfires can expire even if the player leaves the map

The current behaviour is intentionally temporary:

- resource nodes respawn after a short prototype timer
- placed firestarter sets despawn after a short prototype timer
- campfires also despawn after a short prototype timer

This is runtime/session state only. Nothing is persisted yet.

## Runtime State

Placed firestarters and campfires are not stored in static map definitions.

They live in runtime/session state so the project can later split them into:

- player state
- world chunk state
- instance state where needed
- personal island state

without rewriting static map data.

## Intentionally Not Implemented Yet

- persistence
- full inventory UI
- multiple recipes
- base editing tools
- furniture rotation
- campfire buffs or cooking
- light/fire VFX
- shared multiplayer building state
