# Item Rules + Crafting + Effects v0

This slice tightens the first craft-and-place loop so it behaves more like an MMO-lite system and less like freeform survival placement.

Current playable flow:

1. Gather `wood`, `stone`, and `herb`.
2. Use the home workbench to craft a `firestarter_set`.
3. Keep the crafted item in the small session inventory.
4. Press `Space` to enter placement mode.
5. Place the `firestarter_set` only inside allowed build or camp zones.
6. Light it with `stone` to create a temporary `campfire`.
7. Use `herb` on the active campfire to brew `warm_tea`.
8. Press `T` to consume `warm_tea` and gain a temporary placeholder effect.

## Item Definitions

Items now define their own basic behaviour through data.

Supported categories:

- `resource`
- `placeable`
- `consumable`
- `crafted`

Supported use modes:

- `none`
- `place`
- `consume`

The current item list is:

- `wood`
- `stone`
- `herb`
- `firestarter_set`
- `warm_tea`

The important rule is that placement and consumption now come from item definitions, not from hardcoded scene logic.

## Placement Rules

Placeable items can define placement restrictions such as:

- allowed zone tags
- forbidden zone tags
- walkability requirement
- blocked-tile requirement
- optional active-count cap
- duration for temporary placed objects
- minimum distance from transition tiles

The current `firestarter_set` rule is:

- allowed in `personal_build` and `wilderness_camp`
- forbidden in `town`, `harbor`, and `transition`
- cannot be placed on water
- cannot be placed on blocked/occupied tiles
- stays temporary and uses a runtime despawn timer

This matters for Shattered because an MMO-lite cannot allow arbitrary item placement everywhere. Shared spaces need clear rules.

## Zone-Based Placement

Static maps now define authored zones.

Current zone usage:

- Home island:
  - `personal_build` near the workbench/home area
  - `transition` around the dock
- Harbor:
  - `town` + `harbor` across the harbor land area
  - `transition` around the travel points
- Wild island:
  - `wilderness_camp` in a small authored campable area
  - `transition` around the travel points

Placement validation checks both the map zone tags and the item rules.

## Recipes

Recipes are now defined separately from interaction code.

Current recipe list:

Workbench:

- `1 wood -> 1 firestarter_set`

Campfire:

- `1 herb -> 1 warm_tea`

There is still no recipe menu UI yet. If a station only has one relevant recipe, interaction crafts it directly.

## Consumable Effects

Consumables can now apply temporary effects.

Current effect:

- `warm_tea_warmth`
  - display name: `Warmth`
  - duration: `60s`
  - no gameplay modifier yet

Pressing `T` consumes one `warm_tea`, applies `Warmth`, and shows feedback.

## Runtime State Separation

The separation is now:

- `StaticMapDefinition`
  - terrain
  - static props
  - interaction anchors
  - transitions
  - authored zones
- `PlayerSessionState`
  - resource counts
  - crafted item counts
  - active consumable effects
- `WorldSessionState`
  - resource depletion / respawn timers
  - temporary placed firestarters
  - temporary campfires
  - despawn timers

Nothing in this slice persists yet.

## Intentionally Not Implemented Yet

- full inventory UI
- drag-and-drop item usage
- full crafting tree
- station recipe selection UI
- permanent building placement
- shared multiplayer placement permissions
- save/load persistence
- real gameplay modifiers from `Warmth`
