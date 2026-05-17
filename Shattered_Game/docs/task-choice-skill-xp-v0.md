## Task Choice + Skill XP v0

This slice adds three missing pieces to the current prototype loop:

- the player can choose between multiple workbench recipes
- the harbor board can offer more than one task
- actions now feed lightweight skill XP and a simple task journal

It is still intentionally small.

## Generic choice menu

The choice menu is a reusable text menu used for:

- workbench recipe selection
- contract board task selection
- future campfire actions
- future NPC/dialogue options

Controls:

- `W/S` or `Up/Down` move selection
- `E` or `Enter` confirms
- `Escape` cancels

While the menu is open, normal movement and normal interaction confirmation are paused so the same keys can safely drive selection.

## Workbench recipes

Workbench recipes are data definitions.

Current recipes:

- `1 wood -> 1 firestarter_set`
- `2 wood -> 1 wooden_marker`
- `1 wood + 1 stone -> 1 camp_supplies`

Each recipe defines:

- `id`
- `displayName`
- `stationType`
- `inputs`
- `outputs`
- `xpRewards`
- `description`

If the player lacks materials, the recipe still appears in the menu but is disabled with a readable reason.

## Contracts and task choice

The harbor board is not a full market.

It is a tiny demand loop that gives the existing gather, craft, and travel loop a reason to exist.

Current contracts:

- `warmth_for_the_dockhands`
  - requires `1 warm_tea`
  - rewards copper, harbor reputation, and Trade XP
- `camp_supplies`
  - requires `1 firestarter_set`
  - rewards copper, harbor reputation, and Trade XP

The player can:

- accept a contract
- leave it active in the journal
- complete it later once the requirements are met

If the player already has the requirement when accepting, the contract can complete immediately.

## Task journal

The journal is a lightweight runtime panel toggled with `J`.

It currently shows:

- active accepted contracts
- requirement summary
- reward summary
- whether the requirements are currently met

This is not a full quest log. It only covers the current contract/task slice.

## Skill XP

The prototype now tracks four simple skills:

- Gathering
- Crafting
- Survival
- Trade

Current XP sources:

- gathering resource nodes -> Gathering XP
- crafting at the workbench -> Crafting XP
- brewing warm tea at a campfire -> Survival XP
- completing harbor contracts -> Trade XP

There are no unlocks, perks, or gameplay modifiers yet. XP is just visible progression for now.

## Runtime state split

Static maps still only define authored space:

- terrain
- objects
- transitions
- zones
- interaction anchors

Runtime/session state now holds:

- inventory and items
- currency and harbor reputation
- active effects
- active accepted contracts
- contract completion state
- skill XP
- depleted resource nodes and respawns
- temporary placed structures and despawn timers

Nothing here is persistent yet.

## What is intentionally missing

This slice does **not** include:

- a full quest system
- dialogue trees
- market prices
- buy/sell listings
- persistence
- multiplayer task sharing
- perk unlocks from XP
- polished crafting or journal UI

It is only enough to prove:

choose -> craft -> travel -> accept -> complete -> progress
