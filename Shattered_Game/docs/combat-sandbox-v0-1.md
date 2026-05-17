# Combat Sandbox v0.1

## Purpose

Combat Sandbox v0.1 is the control-and-readability stabilisation pass for the first sandbox encounter.

It does not add new combat features. It fixes the prototype feel problems from v0:

- combat mode no longer blocks transition interaction
- dodge is a physical step instead of an instant blink
- dodge direction follows the same movement/facing rules as the player
- the enemy body is visible and depth-sorted correctly
- combat movement is slower and more deliberate than exploration movement
- dodge no longer shoves the player onto blocked or invalid ground

## Combat Input Priority

Input priority now works like this:

1. If a choice menu is open, `E` confirms the menu.
2. If placement mode is active, `E` confirms placement.
3. If action progress is active, `E` does not start unrelated actions.
4. If combat mode is active, `E` may still trigger world interaction.

That means a map transition can still be used while combat mode is active. Combat no longer swallows the player’s ability to leave the area.

`Space` remains reserved for dodge in combat mode only.

## Smooth Dodge

Dodge is now short movement over time instead of a teleport.

The dodge state tracks:

- start position
- target position
- elapsed time
- total duration

The player is moved smoothly between those points over the dodge duration. Invulnerability still comes from the combat state, but the visible movement now matches the timing.

## Dodge Direction Rules

Dodge direction uses:

- current movement input first
- last facing direction if no movement key is held

Current rule for diagonal input:

- choose the dominant axis

So the expected behaviour is:

- `W` dodges up
- `S` dodges down
- `A` dodges left
- `D` dodges right
- no input dodges in facing direction

The sandbox uses the same world-space movement convention as normal movement instead of mixing tile-adjacent logic into dodge targeting.

## Collision and Dodge Safety

Dodge no longer blindly snaps to a target tile.

Instead, the system:

- resolves a dodge direction
- samples the intended path in world space
- finds the furthest valid reachable point
- only starts the dodge if that movement is actually valid

If the path is blocked immediately, dodge fails safely and the player stays where they are.

## Enemy Readability

The enemy now has a visible placeholder body with correct dynamic depth sorting.

State readability in v0.1:

- `idle` / `approach`: neutral body
- `windup`: warning tint and slight scale-up
- `active`: stronger attack tint and larger pulse
- `recovery`: muted tint and slight settle-back

The telegraph still shows the danger zone on the ground.

## Movement Speed

The slower, more deliberate movement speed is now the default prototype movement speed everywhere.

That means the sandbox is no longer using a special combat-only slow effect. Later, proper walking / running / sprint logic can layer on top of this without making combat feel like a sudden rules change.

Dodge itself is controlled separately through dodge duration and dodge travel distance.

## What Is Still Not Implemented

Still intentionally missing:

- player attacks
- block / guard
- stamina use for attacks
- enemy damage values beyond prototype hit counting
- death / respawn consequences
- multiple enemies
- multiple enemy archetypes
- combat rewards
- real combat animations

This pass is about making one enemy tell and one player dodge feel legible and controlled before adding offensive actions.
