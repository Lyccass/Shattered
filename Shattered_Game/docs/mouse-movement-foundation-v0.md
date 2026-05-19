# Mouse Movement Foundation v0

Shattered now treats mouse-directed movement as the primary control style.

This shifts the prototype away from direct WASD locomotion and toward the control feel the project actually wants:

- calmer click movement outside combat
- positional repositioning during combat
- a more OSRS / MOBA-style movement model than a direct-action one

This is still a prototype layer. It now includes lightweight grid pathing and still leans on the existing grid-first collision model.

## Why the game is switching away from WASD

The combat and exploration direction both benefit from target-based movement:

- exploration feels less twitchy and more deliberate
- sprint and stamina become positional tools instead of finger-tax
- dodge can become a committed movement response instead of a keyboard-dependent escape
- combat spacing reads more clearly when movement commands are explicit

WASD is no longer required for primary movement. The menu navigation bindings still exist.

## Exploration click movement

In explore mode, left click on valid ground:

- sets a movement target
- moves the player toward that tile centre
- replaces any previous movement target
- stops when the player reaches the destination
- follows a lightweight grid path around simple obstacles
- stops if the route becomes invalid

Movement still respects:

- tile walkability
- blocked tiles
- water
- current occupancy checks

No freeform movement bypass was added.

## Explore and combat controls

The prototype now uses an explicit control toggle:

- `R` toggles between `Explore controls` and `Combat controls`
- this only changes the input scheme
- combat proximity still matters for stamina/combat state, but it does not steal the mouse controls automatically

### Explore controls

- left click on ground: move
- left click on an interactable: perform the default/top action
- right click on an interactable: open the `Use / Inspect` menu

If the player is out of range, the game finds a valid approach tile, walks there, and then performs the chosen action.

### Combat controls

- left click: reposition
- right click: player light attack
- `F` remains as a temporary fallback light-attack key

Each movement click replaces the old one, dodge cancels the current move target, and the goal is to keep repositioning responsive instead of letting autopilot drag the player through telegraphs.

## Interaction click behaviour

Left click on an interactable in explore mode now behaves like this:

1. If already in range, it uses the existing interaction flow immediately.
2. If out of range, it finds a valid approach tile inside the interaction range.
3. The player walks there using click movement.
4. Once in range, the existing interaction flow is triggered.

This keeps the current `E` interactions intact while making click interaction useful.

The current interaction coverage still includes:

- resource gathering
- workbenches
- contract boards
- map transitions
- placed firestarters and campfires

Placement is unchanged:

- `B` enters placement
- `E` confirms placement
- `Escape` cancels placement

## Dodge direction without WASD

`Space` still dodges, but the direction logic no longer depends on WASD movement.

Current priority:

1. current mouse direction
2. current click-move direction if there is no mouse direction
3. away from the active enemy if no click movement exists
4. last movement direction
5. last facing direction

Dodge still:

- costs stamina
- fails if stamina is too low
- moves smoothly
- grants temporary invulnerability
- cancels the current click movement target

## Visual feedback

Click movement uses a visible tile marker:

- shown on the clicked destination tile
- cleared when the target is reached or cancelled
- red when the clicked tile is invalid

This is only prototype feedback, not final art.

## What is intentionally not implemented yet

Mouse Movement Foundation v0 still does **not** add:

- queued movement commands
- mobile controls
- a final combat click scheme
- advanced obstacle routing beyond simple grid A*
- companion / pet following logic

The current combat sandbox still keeps `F` as a backup light-attack key while the mouse-first scheme is being tuned.

## What this prepares next

This foundation makes the next movement/combat steps much cleaner:

- better combat click targeting
- finalising guard / attack input around mouse-first play
- smarter approach handling for interactions
- optional lightweight pathing if the world scale starts demanding it
