# Stability Refactor v0

A structural pass over the codebase to address the most pressing scaling problems before adding more gameplay. No new features, no gameplay changes. All existing tests pass.

---

## Goals

1. Break up the 1096-line `WorldRuntimeCoordinator` god object
2. Fix Phaser resource leaks on map transitions and scene shutdown
3. Encapsulate `WorldSessionState` mutations behind a proper API
4. Remove SFX routing via message-string matching
5. Move placed-object logic out of the coordinator into `PlacedStructureSystem`
6. Make choice menus extensible without editing central if-else chains
7. Introduce typed input modes to prevent dual-use key conflicts
8. Loosen the inventory's typed-union coupling

---

## Files Created

### `src/input/InputTypes.ts`
Defines `InputMode` (`normal | menu | placement | action_progress | combat`) and the `InputCallbacks` interface. No Phaser types leak here.

### `src/input/InputSystem.ts`
Centralises all keyboard input. `GameScene` constructs it once with a callbacks object and calls `setMode()` each frame. Key routing is mode-aware: W/S only navigate menus when `mode === 'menu'`, E routes to interact/confirm/placement-confirm by mode. `destroy()` removes all listeners.

### `src/interactions/ChoiceMenuCoordinator.ts`
Owns the choice-menu lifecycle (open, move selection, confirm, cancel) and the `ChoiceMenuHandler` interface. Systems implement `ChoiceMenuHandler` and register themselves; the coordinator never needs to know which menu type it is running. Replaces the if-else `choiceMenuContext` dispatch in the old coordinator.

### `src/interactions/InteractionActionFactory.ts`
Owns `ActionProgressDefinition` construction for gather, workbench-craft, and placed-object interactions. Takes `RangeChecker`, `getNowMs`, and `getObjectPlacementSystem` as constructor injections so it has no hard dependency on Phaser.

### `src/ui/UiStateAggregator.ts`
Assembles `UiStateSnapshot` from all the subsystems that contribute UI data (player state, interaction system, action progress, choice menu coordinator, placement mode, contract board). `WorldRuntimeCoordinator.getUiState()` delegates here entirely.

---

## Files Changed

### `src/world/session/WorldSessionState.ts`
Internal storage changed from `Map<string, RuntimePlacedObjectRecord[]>` to `Map<string, Map<string, RuntimePlacedObjectRecord>>` (keyed by object id for O(1) lookup).

Removed: `setPlacedObjects()` (direct array replacement, bypassed all guards)

Added:
- `addPlacedObject(record)` — inserts, makes a defensive copy
- `updatePlacedObject(mapId, id, patch)` — partial update, returns false if not found
- `removePlacedObject(mapId, id)` — returns false if not found
- `getPlacedObjectById(mapId, id)` — direct lookup
- `getPlacedObjects(mapId)` — returns a new array snapshot, not the internal map

### `src/interactions/PlacedStructureSystem.ts`
- Removed `currentObjects` cache — reads directly from `WorldSessionState`
- All mutations go through `sessionState.addPlacedObject()`, `.updatePlacedObject()`, `.removePlacedObject()`
- Added `getObjectsForCurrentMap()` for test inspection
- Added `getPlacedObjectActionConfig(placedObjectId, inventory)` — returns `PlacedObjectActionConfig | null`. Owns the "campfire needs herb" and "firestarter needs stone" checks; these no longer live in the coordinator
- Added `getPlacedObjectState(placedObjectId)` for single-object reads
- All `InteractionResult` values now include `sfxId`
- Added `createMenuHandler()` (via `ChoiceMenuHandler`) — not yet used, left as entry point for future campfire crafting menu

### `src/interactions/WorkbenchSystem.ts`
- Added `createMenuHandler(workbenchId)` implementing `ChoiceMenuHandler`
- Added `sfxId` on craft success/failure results

### `src/contracts/ContractBoardSystem.ts`
- Added `createMenuHandler(boardId)` implementing `ChoiceMenuHandler`
- Added `sfxId: 'contract_accepted'` and `sfxId: 'contract_completed'` on results

### `src/interactions/ResourceNodeSystem.ts`
- Added `sfxId: 'gather_success'` on successful gather results

### `src/items/ItemUseSystem.ts`
- Added `sfxId: 'tea_consumed'` on successful use results

### `src/interactions/InteractionTypes.ts`
- Added `sfxId?: SfxEventId` to `InteractionResult`

### `src/objects/ObjectRenderer.ts`
- Added `destroyAll()` — destroys and clears all rendered visuals

### `src/objects/ObjectDebugRenderer.ts`
- Added `destroyAll()` — removes all debug entries cleanly

### `src/player/PlayerInventoryState.ts`
- Internal storage changed from typed record properties to `Record<string, number>` for both resources and items
- Public typed API is unchanged (typed getters, typed adders/consumers still exist)
- Added generic API: `addGenericResource`, `addGenericItem`, `hasGenericResourceAtLeast`, `hasGenericItemAtLeast`, `consumeGenericResource`, `consumeGenericItem`, `getGenericCount`
- Added `static emptySnapshot()` factory

### `src/ui/UiTypes.ts`
- Added `emptyUiStateSnapshot()` factory — replaces the hardcoded inline literal in `GameScene.update()`
- Removed unused `ToastKind` import (moved to `ToastTypes.ts`)

### `src/ui/ToastTypes.ts`
- New file: `ToastKind` type lives here. `ToastQueue` and `ToastSystem` import from here instead of `UiTypes`.

### `src/ui/UiManager.ts`
- Resize handler extracted to named property `handleResize` so it can be unregistered
- Added `destroy()` — calls `scene.scale.off('resize', this.handleResize)`

### `src/audio/SfxSystem.ts`
- Added `destroy()` — unregisters the event bus listener
- Fixed unused `scene` parameter and `webkitAudioContext` type error

### `src/scenes/GameScene.ts`
Major changes:
- `registerDebugKeys()` removed; replaced by `InputSystem` construction in `create()` via `buildInputCallbacks()`
- `update()` now calls `inputSystem.setMode(computeInputMode())` at the top of each frame
- Player movement gated on `inputSystem.shouldProcessMovement()` instead of direct `isChoiceMenuOpen()` check
- Hardcoded fallback snapshot replaced with `emptyUiStateSnapshot()`
- Added `this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this)` in `create()`
- Added `handleShutdown()` — calls `destroy()` on InputSystem, CameraSystem, UiManager, SfxSystem
- `tryUseWarmTea()` generalised to `tryUseItem(itemId: PlayerItemKey)`

### `src/world/maps/WorldRuntimeCoordinator.ts`
Reduced from 1096 lines to ~830 lines. Key structural changes:

**Delegated out:**
- UI snapshot assembly → `UiStateAggregator`
- Action definition construction → `InteractionActionFactory`
- Choice menu lifecycle → `ChoiceMenuCoordinator`

**Removed methods:** `refreshChoiceMenu`, `createGatherAction`, `createWorkbenchCraftAction`, `createPlacedObjectAction`, `getResourceNodeDisplayName`, `getPlayerInventoryState`, `getPlayerActiveEffects`, `getPlayerSkillSnapshots`, `getPlayerCurrencySnapshot`, `getPlayerReputationSnapshot`, `getChoiceMenuState`, `getActiveTaskCount`, `getTaskJournalEntries`, `ACTION_DURATIONS_MS`

**`loadMap()` now:**
- Calls `objectRenderer.destroyAll()` and `objectDebugRenderer.destroyAll()` before replacing them, preventing orphaned Phaser objects on map transitions

**`emitResultSfx()` now:**
- Reads `result.sfxId` directly (set by the producing system)
- Replaces the old `result.message.startsWith('Accepted ')` pattern

**`confirmChoiceMenu()` now:**
- Switch on `ChoiceMenuConfirmResult.kind` (no if-else chain)

**`tryOpenChoiceMenu()` now:**
- 10 lines: creates handler from workbenchSystem or contractBoardSystem, calls `choiceMenuCoordinator.tryOpen(handler, playerState)`

---

## How Each Problem Was Fixed

### God Object
`WorldRuntimeCoordinator` now constructs three collaborators and delegates: `InteractionActionFactory` for action definitions, `ChoiceMenuCoordinator` for menu state, `UiStateAggregator` for snapshot assembly. The coordinator's own code is interaction routing, map loading, and wiring — all the "know what system to call" logic stays, but the "do it yourself" logic is gone.

### Map Transition Leaks
`loadMap()` calls `destroyAll()` on both `objectRenderer` and `objectDebugRenderer` before creating new instances. Previously these Phaser objects were orphaned on every map load.

### Listener Cleanup
- `InputSystem.destroy()` removes all keyboard listeners
- `CameraSystem.destroy()` (already existed) removes wheel and POST_UPDATE listeners
- `UiManager.destroy()` removes the resize listener
- `SfxSystem.destroy()` removes the event bus listener
- All four are called from `GameScene.handleShutdown()`, which fires on the `SHUTDOWN` scene event

### WorldSessionState Encapsulation
`setPlacedObjects()` is gone. All mutation goes through `addPlacedObject`, `updatePlacedObject`, `removePlacedObject`. `getPlacedObjects()` returns a new array snapshot. Nothing can hold a reference to the internal collection.

### SFX Without String Matching
Every system that produces an `InteractionResult` now sets `sfxId` on it. `WorldRuntimeCoordinator.emitResultSfx()` reads `result.sfxId` and emits. No string inspection needed. Adding a new SFX requires only adding an entry in `SfxTypes.ts` and setting it on the result in the producing system.

### Placed Object Logic Out of Coordinator
`PlacedStructureSystem.getPlacedObjectActionConfig()` owns: does a campfire need herb? does a firestarter need stone? The coordinator asks the system for the config and starts the action. It does not parse object kind or inventory itself.

### Choice Menu Extensibility
Adding a new menu type requires:
1. Implement `ChoiceMenuHandler` in the relevant system
2. Add a `createMenuHandler()` method to that system
3. Add two lines to `tryOpenChoiceMenu()` in the coordinator

No edits to `ChoiceMenuCoordinator`, no new `choiceMenuContext` variants.

### Input Modes
`InputMode = 'normal' | 'menu' | 'placement' | 'action_progress' | 'combat'`. `GameScene.computeInputMode()` derives the mode from coordinator state each frame. `InputSystem.shouldProcessMovement()` returns false only in menu mode (player can still move during placement preview). W/S only route to menu navigation when in menu mode.

### Inventory Generic Methods
`PlayerInventoryState` uses `Record<string, number>` internally. Typed getters/setters still exist for the named keys. New items/resources can be added via `addGenericItem(id, amount)` and `consumeGenericItem(id, amount)` without touching the union types or `KNOWN_*_KEYS` arrays.

---

## What Should Be Built Next

- Add tests for `WorldSessionState` mutation API, `ChoiceMenuCoordinator` handler dispatch, `sfxId` on all producing systems, and `InputSystem` mode switching (all low-risk, high-confidence)
- Move `NPC` and `generic_debug` interaction targets out of the coordinator (same pattern as workbench/contract handlers)
- Replace remaining `MapNpcAnchor[]` / `MapGenericDebugAnchor[]` processing in the coordinator with `createInteractionTargets()` methods on dedicated NPC and debug systems
- Consider whether `ObjectOcclusionSystem` also needs `destroyAll()` on map transition (currently recreated but old references may persist if anything holds them)
