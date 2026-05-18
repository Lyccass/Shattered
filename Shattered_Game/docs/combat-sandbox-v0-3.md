# Combat Sandbox v0.3

Combat Sandbox v0.3 turns the dodge-only combat sandbox into the first complete defensive and retaliation loop:

- enemy attacks
- player dodges or guards
- attacks resolve into damage, block, guard break, or miss
- enemy enters recovery
- player retaliates with one light attack

This is still a prototype combat slice. It is intentionally small, readable, and stamina-driven.

## HP model

HP is runtime-only and not persisted.

- player max HP: `10`
- training enemy max HP: `5`

Damage values:

- player light attack: `1`
- enemy stab: `1`
- enemy cone: `1`
- enemy jump: `2`

When the player reaches `0 HP`, they are treated as downed. There is no death penalty yet.

## Guard / block

Guard is now on held `Q`.

Rules:

- guard is only available in combat mode
- guard is directional and only works against roughly frontal attacks
- a successful block prevents all HP damage
- blocking consumes stamina based on the incoming damage
- stamina does not regenerate while guarding

For v0.3 there is no partial guard, chip damage, or perfect timing layer.

## Why deflect / parry is not included yet

Deflect and perfect guard are intentionally deferred.

The current MMO-style combat direction still needs the basic loop to feel solid first:

- readable attacks
- reliable dodge
- reliable guard
- stamina pressure
- punish windows
- simple retaliation

If that loop already produces good decision-making, a high-precision deflect layer can be evaluated later. It is not needed yet and would add timing complexity too early.

## Guard break

If the player is guarding but does not have enough stamina to absorb the hit:

- guard breaks
- the player takes full HP damage
- stamina is emptied
- guard is disabled briefly
- separate feedback and SFX play

This is intentionally harsher than a normal hit so stamina management matters.

## Player light attack

Player retaliation is a single light attack.

Inputs:

- preferred: left mouse click
- fallback: `F`

Rules:

- costs stamina
- cannot be started while dodging
- cannot be started while guarding
- cannot be spammed through recovery
- uses timing phases:
  - windup: `140ms`
  - active: `120ms`
  - recovery: `280ms`

The attack uses a short forward rectangle in front of the player. It deals `1 damage` if the enemy is inside the hit area during the active window.

## Enemy recovery / punish window

The training enemy is only safely punishable during recovery.

That means:

- the enemy cannot immediately chain into another attack
- the player has a readable opening after a defended or avoided enemy attack
- retaliation becomes a timing and spacing decision instead of button mashing

There are no combos, staggers, poise systems, or chain reactions yet.

## Stamina usage

Stamina is now shared by:

- sprint
- dodge
- guard impacts
- player light attack

Rules:

- no regeneration while sprinting
- no regeneration while guarding
- no regeneration while dodging
- no regeneration while attacking or in attack recovery
- regeneration resumes after the regen delay

Current sandbox combat is built around this shared stamina pressure.

## Result types

Enemy attacks now resolve into one of:

- `hit`
- `dodged`
- `blocked`
- `guard_broken`
- `missed`

There is intentionally no:

- `deflected`
- `parried`
- `perfect_guard`

## UI

The combat/stat panel now shows:

- player HP
- player stamina
- sprint state
- guard state / guard broken state
- combat active state
- enemy HP
- enemy state
- current enemy attack name when relevant

## Still intentionally not implemented

v0.3 still does **not** include:

- deflect / parry
- perfect guard
- player weapons or weapon inventory
- block values by shield or weapon
- armour
- loot
- combat XP
- death penalties
- multiple enemy types
- multiple enemies
- final animations or final VFX

## What this prepares next

With guard, HP, stamina pressure, and retaliation in place, the next sensible combat steps are:

- make player attack spacing and recovery feel better
- add clearer enemy punish windows and reactions
- evaluate whether guard needs partial chip damage later
- only then consider whether deflect/perfect guard adds value
