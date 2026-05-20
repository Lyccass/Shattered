# Architecture Cleanup v0

This pass starts moving Shattered from prototype sediment toward explicit ownership boundaries without changing gameplay.

## Why This Exists

The prototype has grown many real systems:

- map loading
- click movement
- interaction menus
- combat sandbox
- local persistence
- editor tools
- chunk authoring
- UI panels
- SFX

That is normal for a playable prototype, but it creates risk when large scene/coordinator files become the place where unrelated systems negotiate with each other. Bugs like movement overriding dodge, combat swallowing travel, or UI clicks competing with world clicks are symptoms of unclear ownership.

## Current Direction

The long-term source layout should separate:

- `src/apps` for browser boot entrypoints
- `src/game` for gameplay-only orchestration and controllers
- `src/editor` for editor-only runtime/tools
- `src/shared` for pure schemas, coordinate helpers, validation, and import/export helpers
- existing domain folders while they are gradually moved/split by ownership

This pass introduces `src/apps` and starts `src/game` without a risky full-folder move.

## App Entrypoints

Game and editor now have explicit app entrypoints:

- `src/apps/game/main.ts`
- `src/apps/editor/main.ts`

The previous entry files remain as compatibility shims:

- `src/main.ts`
- `src/editor/main.ts`

The HTML files point at the app entrypoints directly.

## Scene Responsibility

`GameScene` should eventually only:

- preload/create scene-level systems
- call update methods
- forward lifecycle teardown
- compose dependencies

It should not own save parsing, pointer interaction policy, combat rules, world-map restore logic, or editor behavior.

In v0:

- save/load/autosave flow moved into `GameSaveController`
- pointer/default interaction/click-move flow moved into `GameInteractionController`
- app boot now imports the game scene through `src/game/scenes/GameScene.ts`
- the old scene path remains as a compatibility location until the scene is small enough to move physically

## World Runtime Coordinator

`WorldRuntimeCoordinator` is still a large file, but v0 starts peeling off responsibilities:

- prototype save/restore assembly moved into `WorldPrototypeSaveController`
- interaction approach-tile search moved into `InteractionApproachFinder`
- interaction menu labels/details moved into `InteractionMenuCopy`
- placed object renderer/placement/debug/occlusion lifecycle moved into `WorldObjectManager`
- interaction menu confirmation, target use/inspect routing, action startup, and transition result handling moved into `WorldInteractionOrchestrator`
- map runtime configuration, transition/object/placement binding, interaction-target rebuilding, and player/camera rebind moved into `WorldMapRuntimeConfigurator`
- active interaction updates, pointer target lookup, by-reference use/inspect/menu routing, range checks, and approach-point lookup moved into `WorldInteractionTargetCoordinator`

The coordinator still owns too much, but the extracted pieces are intentionally low-risk and behavior-preserving. `WorldObjectManager` is the first real ownership boundary for map-local object runtime: WRC asks it to load authored map objects, bind player occlusion, expose placement/debug systems, and tear down map-local object visuals. `WorldInteractionOrchestrator` now owns the interaction/menu/action decision tree, so WRC can stay closer to map/runtime coordination. `WorldMapRuntimeConfigurator` owns the post-load map setup path so WRC no longer directly wires every map-local system. `WorldInteractionTargetCoordinator` owns the "which target are we talking to?" path, including pointer conversion, range checks, active transition highlighting, and deferred by-reference interaction routing.

## Combat Sandbox

`CombatSandboxSystem` is still the combat orchestrator, but the first combat cleanup separates several responsibilities:

- isometric grid direction snapping moved into `CombatGridDirection`
- spear target tile selection moved into `PlayerAttackTargeting`
- tile-based dodge targeting moved into `PlayerDodgeTargeting`
- player/enemy overlap escape moved into `PlayerEnemySeparation`
- player attack telegraphs/slash feedback moved into `PlayerAttackFeedbackRenderer`
- debug body/attack/dodge tile overlays moved into `CombatDebugHitboxRenderer`

The important boundary is that the sandbox should decide the order of combat updates, while smaller helpers own rules or Phaser drawing details.

## Enemy Runtime

`EnemySystem` now stays closer to enemy orchestration:

- map context and spawn/reset
- state machine update calls
- damage application
- public combat queries for occupied tiles, UI, and blocking

Extracted responsibilities:

- enemy sprite/shadow/health bar/hit flash moved into `EnemyVisualController`
- tile warning overlays for enemy attacks moved into `EnemyAttackTileRenderer`
- enemy body tile/blocking/sample queries moved into `EnemyOccupancy`

The large remaining file is `EnemyStateMachine`. That should be split later into movement, attack selection, attack resolution, and telegraph event generation, but it should be done carefully because it is pure combat behavior rather than rendering glue.

## Enemy State Machine

The enemy state machine has started moving from one giant behavior file into focused pure helpers:

- state-machine event/context types moved into `EnemyStateMachineTypes`
- small math and tile conversion helpers moved into `EnemyStateMath`
- current-attack lookup and attack-state clearing moved into `EnemyAttackState`
- attack selection and cooldown/range readiness moved into `EnemyAttackSelection`
- pathing, orbit approach, movement, and jump landing moved into `EnemyMovement`
- tile footprint generation for enemy attacks moved into `EnemyAttackTiles`

`EnemyStateMachine` still owns the actual state transition order. That is intentional: the transition flow should stay in one readable place until each branch has enough tests to split further.

The transition branches have now been split into `EnemyStateTransitions`:

- `handleEnemyIdle`
- `handleEnemyAggro`
- `handleEnemyApproach`
- `handleEnemyWindup`
- `handleEnemyActive`
- `handleEnemyRecovery`
- `handleEnemyReset`

`EnemyStateMachine` is now the dispatcher and runtime-state factory. It should remain small; future combat tuning should happen in the named transition/helper files.

## Player Controller

`PlayerController` is still the player facade used by scene/combat systems, but click movement and dodge motion are no longer embedded directly in it:

- click target pathing and waypoint following moved into `PlayerClickMovementController`
- smooth dodge movement state moved into `PlayerDodgeMotionController`
- `PlayerController` still owns facing, safe-position recovery, animation forwarding, and public player queries

This keeps mouse movement and dodge behavior easier to reason about without changing the current control scheme.

## Editor Scene

`EditorScene` remains the editor composition point, but the first editor cleanup separates three responsibilities that were making it grow quickly:

- camera pan/zoom/centering moved into `EditorViewportController`
- import/export/resize prompt parsing moved into `EditorMapIoController`
- HUD text and selected/hovered tile previews moved into `EditorHudController`
- terrain brush selection, flipping, drag-stroke debounce, and paint mutation moved into `EditorTerrainToolController`
- object selection, placement, replacement, and deletion moved into `EditorObjectToolController`
- pointer/keyboard shortcut routing moved into `EditorInputController`
- changed chunk tracking moved into `EditorDirtyChunkTracker`
- dirty chunk bundle export/import moved into `EditorDirtyChunkBundle`

The scene still owns command callbacks and render refresh ordering. Dirty chunks are now tracked separately so editor persistence can export/import changed chunks without treating every edit as a full-map rewrite. Current editor shortcuts include `U` to export dirty chunks and `J` to import a dirty chunk bundle. Future editor layers should follow the same pattern: a focused tool controller plus renderer/import-export support, not more monolithic scene branches.

## Ownership Rules

`shared` may contain:

- map and world schemas
- terrain and chunk validation
- pure coordinate helpers
- editor import/export model helpers if they do not import runtime systems

`shared` must not import:

- game scenes
- combat runtime
- player runtime
- persistence services
- editor scenes/tools

`editor` must not import gameplay runtime systems such as combat, player, persistence, or GameScene.

`apps` may compose either game or editor runtime, but editor app entrypoints must not import game runtime.

## What This Pass Does Not Do Yet

This is not the full cleanup. These files are partially split but still need more focused ownership boundaries:

- `WorldRuntimeCoordinator`
- `CombatSandboxSystem`
- `EditorScene`

They should continue to shrink in small behavior-preserving slices, with tests after each slice.

## Next Cleanup Slices

Recommended order:

1. Continue splitting `WorldRuntimeCoordinator` by extracting placement mode flow or action-progress/update flow next.
2. Split `CombatSandboxSystem` into pure combat rules, enemy runtime, player combat runtime, and Phaser visual feedback.
3. Continue `PlayerController` cleanup by extracting collision recovery/facing/animation coordination if those areas start causing bugs.
4. Continue `EditorScene` cleanup by extracting future resource/spawn/zone tools and moving chunk bundle formats toward shared editor/world schemas when they stabilize.
5. Move folders into final app/domain structure once file ownership is clear.
