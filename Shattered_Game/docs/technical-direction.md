# Technical Direction

This document is the current engineering guide for Shattered. It consolidates
the old architecture, stability, cleanup, and guardrail notes.

## Architecture Goals

Shattered is a grid-first, data-driven Phaser prototype that should stay easy to
grow without turning scene files into system containers.

Long-term source ownership:

- `src/apps` owns browser boot entrypoints.
- `src/game` owns game-only orchestration and controllers.
- `src/editor` owns editor-only scenes, tools, input, import, and export behavior.
- `src/shared` owns schemas, validation, terrain ids, coordinate helpers, and pure authoring helpers.
- domain folders own runtime behavior for player, world, combat, objects, interactions, UI, audio, persistence, tasks, skills, items, crafting, and effects.

`shared` must stay runtime-independent. It can contain plain data structures,
validation, adapters, and math helpers, but it must not import game scenes,
combat runtime, player runtime, editor tools, or persistence services.

## App Entrypoints

The browser pages boot explicit app entrypoints:

- `index.html` loads `src/apps/game/main.ts`.
- `editor.html` loads `src/apps/editor/main.ts`.

Compatibility shims may exist temporarily, but new code should use the app
entrypoints.

## Scene Responsibility

`GameScene` should compose dependencies, forward lifecycle calls, and run frame
updates. It should not own save parsing, map restore rules, combat rules,
pointer interaction policy, or editor behavior.

Current extracted game responsibilities include:

- save/load/autosave flow in `GameSaveController`
- pointer/default interaction flow in `GameInteractionController`
- keyboard and pointer routing in `InputSystem`
- UI assembly in `UiStateAggregator`
- save snapshot assembly and restore in `WorldPrototypeSaveController`

`EditorScene` is still the editor composition point. It should remain thin by
delegating new tools to focused controllers and renderers.

## World Runtime Ownership

`WorldRuntimeCoordinator` remains the largest game coordinator and should keep
shrinking in behavior-preserving slices.

Current extracted collaborators include:

- `WorldObjectManager` for map-local object renderer, placement, debug, and occlusion lifecycle
- `WorldMapRuntimeConfigurator` for post-load map setup and rebind flow
- `WorldInteractionTargetCoordinator` for active target lookup, range checks, pointer target lookup, and approach points
- `WorldInteractionOrchestrator` for interaction/menu/action decision routing
- `WorldActionBroker` for action progress execution and UI result emission
- `InteractionActionFactory` for gather, craft, and placed-object action definitions
- `ChoiceMenuCoordinator` for reusable menu lifecycle

Next useful cleanup slices:

- Extract placement mode flow from `WorldRuntimeCoordinator`.
- Extract action-progress/update flow from `WorldRuntimeCoordinator`.
- Move remaining NPC and generic debug target construction into dedicated systems.
- Keep adding small tests around each extracted ownership boundary.

## Combat Ownership

`CombatSandboxSystem` should decide combat update order, but pure rules and
Phaser drawing should live outside it.

Already extracted:

- grid direction snapping
- player attack targeting
- player dodge targeting
- player/enemy separation
- enemy attack math and tile footprints
- enemy attack selection
- enemy movement helpers
- enemy state transition helpers
- player attack feedback rendering
- debug hitbox rendering
- enemy visuals, attack tile rendering, and occupancy queries

Next useful combat cleanup:

- Separate player combat runtime from enemy runtime orchestration.
- Keep attack, guard, stamina, and HP rules testable without Phaser where practical.
- Keep visual feedback and debug drawing behind renderer/helper classes.

## Editor Ownership

The editor app produces map/chunk data. The game consumes validated data.

Already extracted from `EditorScene`:

- viewport pan, zoom, and centering
- input shortcut routing
- import/export/resize prompt parsing
- HUD and previews
- terrain brush behavior
- object placement behavior
- dirty chunk tracking and bundle import/export

Next editor layers should follow the same pattern:

- resource-node tool and renderer
- named spawn tool and renderer
- enemy spawn tool and renderer
- transition footprint and visual-anchor tool
- zone tool
- validation UI that mirrors runtime map loading constraints

## Guardrails

Code quality:

- Keep files small and focused.
- Prefer boring, predictable modules with clear ownership.
- Split files once they grow beyond roughly 250-300 lines unless they are pure data/test fixtures.
- Split functions once they grow beyond roughly 40-60 lines.
- Use structured types and registries for content instead of scattering hardcoded ids.
- Add comments only when they explain intent or a non-obvious constraint.

State management:

- Keep static authored data separate from runtime state.
- Keep persistent save state separate from temporary runtime-only state.
- Avoid hidden global state and direct cross-system mutation.
- Route mutations through clear state APIs.

Scope control:

- Build systems so they can later support multiplayer, but do not implement multiplayer early.
- Do not add backend, database, market, final inventory, or advanced combat systems before the prototype needs them.
- Use clean TODOs for future systems instead of half-building them.

## Validation Status

As of the docs hygiene pass, the local checks pass:

- `npm test` - 25 test files, 238 tests
- `npm run build` - TypeScript and Vite build pass

The production build currently warns that the terrain asset chunk is large.
Future performance work should consider manual chunks or lazy loading by app and
asset domain.
