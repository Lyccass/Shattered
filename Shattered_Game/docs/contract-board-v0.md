## Contract Board v0

This is not the full market.

The contract board is a tiny demand loop that gives the current gather and craft slice a reason to exist without pretending the game already has player trading, price discovery, shopkeeping, or persistent orders.

Current loop:

- gather wood, stone, and herb
- craft a `firestarter_set` at home
- place and light it into a campfire
- process herb into `warm_tea`
- carry `warm_tea` to the harbor board
- turn it in for copper and harbor reputation

## Why contracts exist

The board creates simple demand.

Instead of crafting `warm_tea` because the prototype can, the player now crafts it because the harbor wants it. That gives the home island, wild island, and harbor a cleaner economic relationship:

- wild/home loop creates supply
- harbor creates demand
- the player closes the loop by moving goods between places

This is the first small step toward an MMO-lite economy, but it is intentionally narrow.

## How contracts are defined

Contracts are data definitions, not hardcoded scene logic.

Each contract defines:

- `id`
- `displayName`
- `description`
- `requiredItems`
- `requiredResources`
- `rewards`
- `repeatable`
- `interactionType`
- `tags`

Current shipped contract:

- `warmth_for_the_dockhands`
  - requires `1 warm_tea`
  - rewards `55 copper`
  - grants `1 harbor_reputation`
  - repeatable

## Runtime state

Static maps stay static.

The board anchor is authored in the harbor map, but completion state lives in session/runtime state, not in `StaticMapDefinition`.

For now:

- player-side session state tracks currency, reputation, and contract completion counts
- world-side session state still tracks depleted nodes, respawns, and temporary placed objects

Nothing is persisted yet.

## What this is not yet

This system intentionally does **not** include:

- a full market
- dynamic pricing
- buy orders / sell orders
- player-to-player trade
- contract browsing UI
- contract history
- persistence
- town/world economy simulation

It is only enough to prove that crafted goods can satisfy external demand and return a visible reward.
