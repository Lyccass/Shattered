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

This is not the full cleanup. It does not yet split:

- `WorldRuntimeCoordinator`
- `CombatSandboxSystem`
- `PlayerController`
- `EditorScene`

Those are the next high-value refactor targets. They should be split in small behavior-preserving slices, with tests after each slice.

## Next Cleanup Slices

Recommended order:

1. Split `WorldRuntimeCoordinator` into map runtime, interaction runtime, placement runtime, object runtime, and save snapshot adapter.
2. Split `CombatSandboxSystem` into pure combat rules, enemy runtime, player combat runtime, and Phaser visual feedback.
3. Split `PlayerController` into click path following, dodge movement, collision recovery, facing, and animation state.
4. Split `EditorScene` into tool state, viewport controls, terrain tool, object tool, import/export, and UI overlay.
5. Move folders into final app/domain structure once file ownership is clear.
