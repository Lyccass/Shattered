# Combat Sandbox v0.2

Combat Sandbox v0.2 turns stamina into a global movement resource and expands the training enemy into a small multi-attack readability test.

## Global stamina

Stamina now exists all the time, not just while combat is active.

Current prototype values:

- max stamina: `100`
- dodge cost: `25`
- sprint drain out of combat: `1 / second`
- sprint drain in combat: `5 / second`
- stamina regen out of combat: `100 / 3 per second`
- stamina regen in combat: `100 / 6 per second`
- stamina regen delay: `900ms`

Current stamina is runtime-only for now. It is not persisted by local save/load yet. A reload starts the player with full stamina again.

## Sprint

Sprint is toggled with `Shift`.

Rules:

- pressing `Shift` toggles sprint on
- pressing `Shift` again toggles sprint off
- sprint turns off automatically when stamina reaches `0`
- sprint cannot start when stamina is empty
- stamina does not regenerate while sprinting
- sprint works in normal exploration and in combat

The current stat panel shows stamina and whether sprint is active.

## Dodge

`Space` now triggers dodge in both `normal` and `combat` modes.

It does not trigger dodge in:

- `menu`
- `placement`
- `action_progress`

Dodge still:

- costs stamina
- fails when stamina is too low
- uses live movement direction first
- falls back to facing direction when no movement key is held
- moves smoothly instead of blinking
- respects blocked terrain and occupied space
- grants a short invulnerability window

If sprint is active, dodge distance increases. That makes sprint useful for repositioning without creating a separate movement system yet.

## Enemy attack variety

The `training_wretch` now has multiple attacks instead of one generic strike:

### Jump Attack

- used at longer mid-range
- locks a landing point near the player
- shows an oval landing telegraph
- lands into the telegraphed area during the active phase

### Cone Attack

- used at close to mid range
- shows a frontal wedge telegraph
- checks whether the player remains inside the cone during the active moment

### Stab Attack

- used at the closest range
- faster windup than the other two
- narrow forward rectangle for sidestep testing

Attack choice is still intentionally simple:

- stab when close enough and ready
- cone when close or mid range and ready
- jump when farther out and ready
- cooldowns stop one attack from repeating endlessly

This is not a full AI system. It is only enough to test readable defensive questions.

## Oval telegraphs

The telegraph system now supports `ellipse` shapes.

This matters because circular ground warnings look wrong in the current isometric view. A landing area that is supposed to feel wide on the ground reads more naturally as an oval in the current camera setup.

For v0.2, ellipse telegraphs use matching visual and hit-detection math. The landing AoE is not a circle hitbox pretending to be an oval.

## What is still intentionally missing

This pass still does **not** add:

- block or deflect
- player attacks
- enemy health/damage economy
- player HP/death
- loot
- combat XP
- equipment or armour
- multiple enemies
- advanced AI
- final combat VFX/animations

The goal is still the same: prove readable spacing, dodge timing, stamina economy, and enemy tells before adding offense.
