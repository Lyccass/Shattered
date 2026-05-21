# Gameplay Systems

This document describes the current playable systems and protects the intended
scope of the prototype.

## Current Loop

The prototype proves a small home/harbor/wild-island loop:

1. Start on the home island.
2. Travel to the harbor.
3. Travel to the wild island.
4. Gather `wood`, `stone`, and `herb`.
5. Return home.
6. Craft placeable or useful items at the workbench.
7. Place and light a temporary campfire where allowed.
8. Brew `warm_tea`.
9. Accept and complete harbor contracts for copper, reputation, and Trade XP.

The loop is intentionally narrow. It proves static maps, runtime interaction
state, authored objects, lightweight player state, local persistence, and
readable combat can coexist without adding full MMO systems yet.

## Input And Movement

Shattered now treats mouse-directed movement as the primary control style.

Input modes:

- `normal`
- `menu`
- `placement`
- `action_progress`
- `combat`

Explore controls:

- left click ground: move to target
- left click interactable: use default/top action
- right click interactable: open context menu
- `E`: interact or confirm where appropriate
- `B`: enter placement mode for the selected placeable prototype item
- `R`: toggle control scheme

Combat controls:

- left click: reposition
- right click: player light attack
- `F`: temporary fallback light attack
- `Space`: dodge
- `Shift`: toggle sprint
- `Q`: hold guard

Menu controls:

- `W/S` or `Up/Down`: move selection
- `E` or `Enter`: confirm
- `Escape`: cancel

Placement controls:

- preview appears one tile in front of the player
- `E`: confirm placement
- `Escape`: cancel placement

Click interaction can approach out-of-range targets, walk to a valid approach
tile, then trigger the chosen action once in range.

## UI

Player-facing UI is separate from developer debug UI.

Player UI includes:

- interaction prompt
- HUD/resource summary
- inventory panel
- choice menu
- journal panel
- skill panel
- combat panel
- short feedback toasts

Developer debug UI is behind `Tab` and should not be required for normal play.

The current UI uses Phaser text panels rendered through a dedicated UI camera.
It is intentionally replaceable later by HTML/CSS or a more polished in-engine
UI layer.

Not final yet:

- visual design
- item icons
- drag-and-drop inventory
- equipment UI
- quest trees
- market browsing
- recipe category tabs
- multiplayer-aware shared UI

## Inventory, Items, Crafting, And Effects

The current session inventory is intentionally small.

Resources:

- `wood`
- `stone`
- `herb`

Items:

- `firestarter_set`
- `warm_tea`
- `wooden_marker`
- `camp_supplies`

Items define behavior through data, including category and use mode.

Supported categories:

- `resource`
- `placeable`
- `consumable`
- `crafted`

Supported use modes:

- `none`
- `place`
- `consume`

Workbench recipes:

- `1 wood -> 1 firestarter_set`
- `2 wood -> 1 wooden_marker`
- `1 wood + 1 stone -> 1 camp_supplies`

Campfire recipe:

- `1 herb -> 1 warm_tea`

Current consumable effect:

- `warm_tea_warmth`
- display name: `Warmth`
- duration: `60s`
- no gameplay modifier yet

## Placement And Campfires

The `firestarter_set` is the first placeable session item.

Current placement rules:

- allowed in `personal_build` and `wilderness_camp`
- forbidden in `town`, `harbor`, and `transition`
- must stay inside map bounds
- cannot be placed on water
- cannot overlap blocked or occupied tiles
- must stay a minimum distance from transition tiles
- stays temporary and uses a runtime despawn timer

Campfire lifecycle:

1. Craft `firestarter_set` at the workbench.
2. Place it to create a runtime `placed_firestarter_set`.
3. Interact with it while carrying `stone`.
4. Consume stone and transform it into a runtime `campfire`.
5. Use `herb` at the campfire to brew `warm_tea`.
6. Let temporary objects expire from runtime/session state.

Temporary objects are not stored in static map definitions.

## Contracts And Tasks

The harbor contract board is not a full market. It is a tiny demand loop that
gives crafted goods a reason to exist.

Current contracts:

- `warmth_for_the_dockhands`
  - requires `1 warm_tea`
  - rewards copper, harbor reputation, and Trade XP
- `camp_supplies`
  - requires `1 firestarter_set`
  - rewards copper, harbor reputation, and Trade XP

Contract rules:

- accepting and completing are separate steps
- active contracts appear in the journal
- completed repeatable contracts can be completed again according to their definition
- contract state belongs to player/runtime state, not static map data

Not included yet:

- full market
- dynamic pricing
- buy/sell listings
- player-to-player trade
- contract history
- town economy simulation

## Skills

The prototype tracks four visible skills:

- Gathering
- Crafting
- Survival
- Trade

Current XP sources:

- gathering resource nodes -> Gathering XP
- crafting at the workbench -> Crafting XP
- brewing warm tea -> Survival XP
- completing harbor contracts -> Trade XP

There are no unlocks, perks, or gameplay modifiers yet. XP is visible
progression only.

## Combat

The combat sandbox is a readability and feel test, not the finished combat
system.

Current combat loop:

- enemy notices the player
- enemy approaches or selects an attack
- windup telegraph appears
- player dodges, guards, repositions, or mistimes the response
- attack resolves into hit, dodge, block, guard break, or miss
- enemy enters recovery
- player retaliates with one light attack during the opening

Current enemy state machine:

- `idle`
- `aggro`
- `approach`
- `windup`
- `active`
- `recovery`
- `hurt`
- `dead`
- `reset`

Current enemy attack types:

- jump attack with oval landing telegraph
- cone attack with frontal wedge telegraph
- stab attack with narrow forward rectangle

Current player combat state:

- max HP: `10`
- stamina max: `100`
- dodge costs stamina and grants brief invulnerability
- sprint drains stamina and disables regeneration while sprinting
- guard is held on `Q`
- frontal guard blocks damage but consumes stamina
- low-stamina guard breaks and deals full incoming damage
- light attack costs stamina and has windup, active, and recovery phases

Intentionally not implemented yet:

- deflect/parry/perfect guard
- weapon inventory
- shields or armor
- loot
- combat XP
- death penalties
- multiple enemy types
- multiple enemy encounters
- final VFX and animation assets

Next combat steps:

- tune player attack spacing and recovery
- make enemy punish windows clearer
- evaluate partial chip damage for guard
- only then decide whether deflect/perfect guard adds value
