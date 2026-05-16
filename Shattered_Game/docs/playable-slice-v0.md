Shattered playable slice v0 is the first minimal world loop:

- start on the home island
- travel to the harbor
- travel to the wild island
- gather a simple resource node
- return home
- use the workbench to build one test object

This slice is intentionally narrow. It proves that static maps, runtime interaction state, authored objects, and lightweight player state can work together without introducing full combat, full crafting, full inventory UI, multiplayer, or persistence.

Core responsibilities:

- `InteractionSystem` finds the best nearby interaction target and routes `E` presses
- `ResourceNodeSystem` manages gatherable node runtime state
- `WorkbenchSystem` manages the test build spot runtime state
- `PlayerInventoryState` stores a tiny session-only resource pouch
- `InteractionPromptSystem` shows the current prompt, feedback text, and simple resource counts

Map data remains static/authored:

- terrain
- placed objects
- transitions
- interaction anchors

Runtime state remains separate:

- which resource nodes are depleted this session
- whether the home workbench build spot has already been used
- current player resource counts

Transitions:

- existing map transitions are exposed through the interaction layer
- they still use the existing map switching/runtime coordinator path
- they do not auto-trigger

Resource nodes:

- driftwood gives `wood`
- stone piles give `stone`
- herb patches give `herb`
- gathering removes the linked visual object for the current session

Minimal inventory:

- tracks only `wood`, `stone`, and `herb`
- no inventory grid
- no equipment
- no persistence yet

Workbench behavior:

- the home island workbench currently checks only for `wood`
- if the player has enough, it consumes wood and creates one test object
- if not, it returns a simple feedback message

Intentionally not implemented yet:

- combat
- quests
- dialogue trees
- NPC AI
- crafting trees
- inventory UI
- persistence
- build mode/editor
- dynamic world state beyond this tiny local session slice
