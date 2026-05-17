# Combat Sandbox v0

## Purpose

Combat Sandbox v0 exists to prove the first readable combat exchange without committing to the full combat system yet.

The target interaction is:

- enemy notices the player
- enemy enters a visible windup
- telegraph shows where the hit will land
- player uses `Space` to dodge
- the game resolves hit or miss from timing and position

This is intentionally narrow. It is a combat readability test, not the finished combat loop.

## What Exists

- one dummy enemy in a temporary sandbox area on `test_harbor`
- explicit enemy state machine
- player dodge on `Space`
- runtime stamina state
- attack timing phases
- telegraph display and cleanup
- simple hit / miss feedback
- small combat HUD panel

## Combat Mode

Combat mode activates automatically when the player is close enough to the sandbox enemy.

While combat mode is active:

- `Space` is routed to dodge
- placement no longer uses `Space`
- `E` remains free for interaction / confirm
- `Esc` still cancels menus, placement, or active actions as appropriate

Combat mode is runtime-only and does not persist.

## Enemy State Machine

The prototype enemy uses these states:

- `idle`
- `aggro`
- `approach`
- `windup`
- `active`
- `recovery`
- `hurt`
- `dead`
- `reset`

Current loop:

1. Idle until the player enters aggro range.
2. Approach until the player is in attack range.
3. Enter windup and show a telegraph.
4. Enter active and resolve the attack.
5. Enter recovery.
6. Return to aggro if the player is still in the encounter.
7. Reset toward the leash/origin point if the player leaves too far.

## Attack Timing

Enemy attacks use the shared timing structure:

- `windupMs`
- `activeMs`
- `recoveryMs`

These phases are the future basis for:

- telegraph timing
- hurtbox / hitbox timing
- dodge timing windows
- recovery punish windows

No real damage economy, stagger system, or weapon logic exists yet.

## Player Dodge

The player now dodges with `Space` in combat mode.

Rules in v0:

- dodge costs stamina
- dodge lasts briefly
- dodge grants a short invulnerability window
- dodge direction uses current movement intent first
- if no direction is pressed, dodge uses facing direction
- if stamina is too low, dodge fails and gives feedback

This is runtime-only combat state. It is not part of local persistence yet.

## Stamina v0

Prototype values:

- max stamina: `100`
- dodge cost: `25`
- dodge duration: `250ms`
- stamina regen delay: short delay after spending stamina

Stamina currently exists only to prove that dodge timing and repeated panic dodging can be constrained later.

## Telegraphs and Hit Checks

The telegraph system currently supports placeholder warning shapes such as circles and rectangles.

For the sandbox enemy:

- telegraph appears during windup
- telegraph disappears when windup ends
- during the active phase the game checks whether the player is inside the attack shape
- if inside and not invulnerable: hit
- if outside or invulnerable: miss

This keeps combat legible and lets future enemies express different attacks through timing plus shape.

## Feedback

Current placeholder feedback:

- enemy tint changes across windup / active / recovery
- player visual state changes for dodge / hurt
- toast feedback for hit / dodge / miss
- combat HUD panel shows stamina, hit count, and current enemy state
- placeholder SFX can fire for dodge, hit, and miss

## What Is Not Implemented Yet

Not implemented in v0:

- real damage values
- death / respawn penalties
- enemy loot
- combat XP
- multiple enemies
- multiple enemy archetypes
- enemy pathfinding
- stamina costs for attacks or blocking
- weapons
- hit reactions with real animation assets
- lock-on
- boss logic

## Why This Exists Before Full Combat

This slice is meant to answer one question early:

Does the combat feel readable when the player sees a tell, reacts with a dodge, and the game resolves hit or miss clearly?

If that answer is no, adding weapons, stats, loot, and enemy content on top of it would only bury the real problem.
