# Combat Foundation v0

This pass does not add full combat yet.

It prepares the prototype for Combat Sandbox v0 by fixing input debt and adding reusable timing and telegraph foundations.

## Placement Input Change

`Space` is no longer used for placement.

Current prototype controls:

- `B` enters placement mode
- `E` confirms placement
- `Esc` cancels placement

This keeps `Space` free for future dodge or step behavior.

## Input Modes

The input layer explicitly supports:

- `normal`
- `menu`
- `placement`
- `action_progress`
- `combat`

Important routing now:

- `E` confirms menus and placement, and interacts only when appropriate
- `Esc` cancels the active menu, placement, or action progress state
- `Space` is reserved for combat dodge input and does nothing in non-combat modes

## Combat Animation States

The prototype now has lightweight combat animation state hooks:

- `idle`
- `move`
- `attack_windup`
- `attack_active`
- `attack_recovery`
- `dodge`
- `hurt`
- `dead`

No final sprite animations are required yet.
The player visual layer uses placeholder tint and scale feedback so future combat actions have somewhere to attach.

## Attack Timing Phases

Attack timing definitions now separate:

- `windupMs`
- `activeMs`
- `recoveryMs`

These phases are the future basis for:

- telegraphs
- hit windows
- dodge timing
- action lockouts

No real damage or hit detection is added in this pass.

## Telegraph Foundation

The prototype now has a basic telegraph system for temporary warning indicators.

Supported placeholder shapes:

- circle
- rectangle
- line
- polygon

Telegraphs support:

- id
- world position
- duration
- warning color
- optional fade
- cleanup and destroy

This is future-facing support for enemy tells and area warnings.

## Not Implemented Yet

Still intentionally missing:

- real attacks
- hitboxes
- stamina
- enemy AI
- damage
- loot
- combat rewards
- final animations
- real combat VFX
