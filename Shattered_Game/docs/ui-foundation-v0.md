## UI Foundation v0

This pass separates player-facing UI from developer debug UI.

The goal is not final presentation. The goal is to make the current gameplay loop readable without relying on giant debug text blocks.

## Player UI vs Debug UI

Player UI now covers:

- active interaction prompt
- pouch / resource summary
- recipe and contract choice menu
- journal panel
- skill panel
- short feedback toasts

Developer debug UI still exists separately behind the debug toggle.

- `Tab` toggles the developer debug overlay
- the debug overlay still shows world, terrain, chunk, and object diagnostics
- none of that information is required for normal play

## Current Panels

### Prompt panel

Small prompt near the bottom of the screen.

Used for:

- `Press E: Gather Driftwood`
- `Press E: Use Workbench`
- placement prompts and invalid placement reasons

### HUD panel

Bottom-right panel showing a compact session summary:

- copper / silver / gold / platinum
- harbor reputation
- active task count
- key placeable / consumable counts
- active effects
- control hints

### Inventory panel

Toggled with `I`.

Shows the full current pouch state:

- wood
- stone
- herb
- firestarter set
- warm tea
- wooden marker
- camp supplies
- copper / silver / gold / platinum
- harbor reputation
- active effects

This is still text-based. There is no item grid or drag-and-drop.

### Choice menu

Reusable menu for interactions with more than one option.

Current uses:

- workbench recipe selection
- contract board task selection

Controls:

- `W/S` or `Up/Down` to move
- `E` or `Enter` to confirm
- `Esc` to cancel

### Journal panel

Toggled with `J`.

Shows:

- active accepted contracts
- requirement summary
- reward summary
- whether the turn-in requirements are currently met

This is not a full quest log.

### Skill panel

Toggled with `P`.

Shows:

- Gathering XP
- Crafting XP
- Survival XP
- Trade XP

No unlocks or perk tree yet.

### Toasts

Short-lived feedback messages appear near the top of the screen.

Current uses include:

- gathered resource
- craft success / failure
- item placement
- fire lit
- tea brewed
- tea consumed
- contract accepted
- contract completed
- XP gained
- invalid actions

## Rendering Approach

The current UI uses Phaser text panels rendered through a dedicated UI camera.

That keeps:

- player UI stable across zoom changes
- UI concerns separate from world rendering
- the rendering path simple for now

This is still replaceable later by HTML/CSS or a more polished in-engine UI layer.

## What Is Intentionally Not Implemented Yet

- final visual design
- icons and polished framing for every item
- drag-and-drop inventory
- equipment UI
- quest trees
- market browsing UI
- recipe category tabs
- persistence
- multiplayer-aware shared UI

This pass is only the first readable gameplay-facing UI layer.
