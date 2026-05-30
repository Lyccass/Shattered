# Shattered Refactor and Optimization TODOs

Last updated: 2026-05-28

This is the current engineering backlog before the next large feature push. It is
based on a project-wide scan of source, docs, public UI files, editor-library
JSON, and asset inventory. Generated dependency/build output such as
`node_modules`, `dist`, and coverage output is intentionally excluded.

`docs/Shattered.md` remains the core vision document. This file is only the
technical cleanup roadmap.

## Scan Baseline

- TypeScript files scanned: 324.
- Markdown files scanned: 9.
- JSON files scanned: 18.
- HTML/CSS files scanned: 4.
- PNG assets inventoried: 508.
- Largest code monoliths:
  - `src/editor/EditorScene.ts`: 2492 lines.
  - `public/ui.css`: 1886 lines.
  - `public/editor.css`: 1233 lines.
  - `src/world/maps/WorldRuntimeCoordinator.ts`: 1113 lines.
  - `src/shared/editor/EditorMapModel.ts`: 1033 lines.
  - `editor.html`: 827 lines.
  - `src/combat/CombatSandboxSystem.ts`: 774 lines.
  - `src/editor/ui/EditorDefinitionPanelController.ts`: 739 lines.
  - `src/scenes/GameScene.ts`: 694 lines.
  - `src/editor/io/EditorLocalLibrary.ts`: 618 lines.
- Largest generated/editor data files:
  - `data/editor-library/published/ZWRpdG9yX3Rlc3RfbWFw.json`: 9468 lines.
  - Several saved maps/drafts are over 100 KB.

## Current Verification State

- `npx vitest run` passed on 2026-05-28:
  - 28 test files.
  - 269 tests.
- The previous 9 full-suite failures were triaged:
  - Combat aggro/reset tests had stale wolf tuning expectations.
  - Combat sandbox tests had stale light-attack range/recovery and enemy range
    expectations.
  - Facing tile tests expected diagonal isometric offsets, while placement now
    uses adjacent grid tiles.
  - Local persistence exposed a real validation bug: `equippedSlots` was dropped
    on load. Validation now preserves it.
  - Inventory UI tests expected stack counts for materials, while current item
    definitions model them as non-stackable inventory slots.
- `npm run build` passed on 2026-05-28, with the existing Vite warning about
  the large terrain asset chunk.

## Refactor Rules

- Behavior-preserving slices first. Do not rewrite a monolith and add a feature
  in the same change.
- Keep the editor-to-runtime pipeline working after every slice:
  author map -> save changed chunks -> reload prototype -> objects, terrain,
  zones, and encounters still appear.
- Keep static authoring data separate from runtime state. World chunks describe
  authored terrain/objects/resources/habitats/connections. Runtime saves own
  temporary state such as killed enemies, depleted nodes, opened chests, and
  player state.
- Do not move to a database until the local file/manifest/chunk model is stable.
  The database should eventually persist the same clean concepts, not rescue a
  messy local format.
- Keep `src/shared` pure. Shared code may define schemas, adapters, validation,
  and coordinate math. It should not reach into Phaser scenes, DOM controllers,
  combat runtime, or editor UI.

## P0 - Stabilize The Baseline

1. Done 2026-05-28: triaged the 9 full-suite failures.
   - Combat aggro/reset behavior.
   - Combat sandbox behavior.
   - Facing tile offset.
   - Inventory/equipment persistence expectations.
   - Inventory stacking UI expectation.
2. Done 2026-05-28: classified 8 as stale expectations and 1 as a real save
   validation bug.
3. Done 2026-05-28: added the test-status note above.

Acceptance:

- `npx vitest run` either passes or has an explicit tracked list of accepted
  failures with owners and reasons.
- New refactor slices must not add failures to the baseline.

## P1 - Split `EditorScene.ts`

`EditorScene.ts` is now the highest-risk file in the project. It owns Phaser
scene lifecycle, editor tools, overlays, serialization hooks, world-window UI,
testing, save workflows, custom assets, encounters, NPCs, chunk boundaries,
undo/redo, and panel coordination.

Target shape:

- `EditorScene.ts`
  - Phaser lifecycle and high-level orchestration only.
  - Owns controller construction and frame/update dispatch.
  - No direct DOM panel parsing.
  - Target size: under 500 lines.
- `EditorTerrainToolController`
  - Terrain brush, walkability, height, zone, delete behavior.
- `EditorObjectToolController`
  - Existing object placement, deletion, footprint handling, object categories.
- `EditorEncounterToolController`
  - Spawn area placement, manual spawn points, spawn rules, loot profile fields.
- `EditorNpcToolController`
  - NPC placement/editing if NPC authoring remains in the editor.
- `EditorOverlayRenderer`
  - Hover diamond, footprint overlays, red blocked cells, connection markers,
    encounter rectangles, NPC markers.
- `EditorWorldWindowPanelController`
  - Open world/dungeon, choose chunk window, current world label.
- `EditorChunkSaveController`
  - Save changed chunks, publish chunk, apply bundle if still needed.
- `EditorTestLaunchController`
  - Test in prototype, spawn world/chunk/tile, test save cleanup.
- `EditorUndoRedoController`
  - Command history and dirty state integration.

Progress:

- 2026-05-28: Extracted encounter area selection, drag creation, spawn-rule
  mutations, manual spawn mutations, and encounter dirty marking into
  `src/editor/encounters/EditorEncounterToolController.ts`.
- 2026-05-28: Extracted NPC placement/removal into
  `src/editor/npcs/EditorNpcToolController.ts`.
- 2026-05-28: Moved encounter and NPC overlay drawing into
  `src/editor/overlays/EditorOverlayRenderer.ts`.
- 2026-05-28: Moved tile-data, connection, and hover overlay drawing into
  `src/editor/overlays/EditorOverlayRenderer.ts`, leaving `EditorScene.ts` to
  pass overlay state rather than draw shapes directly.
- 2026-05-28: Extracted the connection panel open/save/delete workflow into
  `src/editor/ui/EditorConnectionPanelController.ts`.
- 2026-05-28: Extracted world/chunk window panel binding, form parsing, world
  creation, and load dispatch into
  `src/editor/ui/EditorWorldPanelController.ts`.
- 2026-05-28: Extracted dirty chunk save, project-world verification,
  chunk-library save/load/delete, and save-confidence snapshot ownership into
  `src/editor/chunks/EditorChunkPersistenceController.ts`.
- 2026-05-30: Extracted custom terrain/object definition create/delete
  workflows into
  `src/editor/assets/EditorCustomDefinitionWorkflowController.ts`.
- 2026-05-30: Extracted resize-map and chunk-name panel binding/parsing into
  `src/editor/ui/EditorMapStructurePanelController.ts`.

Acceptance:

- Existing editor workflows still work from the editor UI, not browser dialogs.
- Tool keyboard shortcuts are ignored while typing in inputs/textareas/selects.
- `EditorScene.ts` does not know the field names of every panel form.
- Each extracted controller has focused unit tests where logic is pure enough to
  test without Phaser.

## P1 - Split `EditorMapModel.ts`

`src/shared/editor/EditorMapModel.ts` is carrying too much: data types,
creation helpers, terrain editing, object placement, resizing, chunk conversion,
serialization, local/project persistence helpers, and migration behavior.

Target files:

- `EditorMapTypes.ts`
  - Pure map, tile, object, NPC, connection, and metadata types.
- `EditorTerrainLayerModel.ts`
  - Terrain tile reads/writes, walkability, height, zone painting.
- `EditorObjectLayerModel.ts`
  - Object placement/removal, footprint validation, layer queries.
- `EditorEncounterLayerModel.ts`
  - Encounter area/manual spawn mutations.
- `EditorMapSerializer.ts`
  - Parse/stringify, schema version handling, migration.
- `EditorChunkAdapter.ts`
  - Editor map window <-> authored chunk files.
- `EditorMapResize.ts`
  - Chunk-sized extend/resize with overwrite guardrails.
- `EditorProjectLibraryApi.ts`
  - Project file access helpers. Keep this out of pure shared model code.

Acceptance:

- Map model files are small enough that their ownership is obvious.
- Project-file IO and browser fallback cache are not mixed with pure model
  mutation logic.
- Chunk files store compact authored data. Large editor-only metadata overlays
  are only written when truly needed.

## P1 - Split `WorldRuntimeCoordinator.ts`

`src/world/maps/WorldRuntimeCoordinator.ts` is becoming the runtime equivalent
of the editor monolith. It owns world manifest loading, streaming, map
transitions, runtime-layer reconciliation, NPCs, shops, player state,
interaction wiring, and save/restore behavior.

Target files:

- `WorldStreamingCoordinator`
  - Manifest access, active chunk window, retain window, demand-loaded chunks.
- `WorldLayerReconciler`
  - Terrain/object/resource/zone/habitat layer diffing into runtime systems.
- `WorldObjectRuntimeBridge`
  - Materialize and remove streamed object placements.
- `WorldNpcRuntimeBridge`
  - NPC/object spawn hooks, static NPC state, future enemy population state.
- `WorldInteractionBridge`
  - Map transitions, placed structures, interaction target refresh.
- `WorldSaveRestoreBridge`
  - Runtime save hydration and persistence handoff.
- `WorldShopBridge`
  - Shop registration and interaction behavior.

Acceptance:

- Runtime startup cost depends on the active chunk window, not full world size.
- The coordinator does not scan all configured chunks to decide what should be
  active.
- Leaving and re-entering a chunk produces stable rendering without weird
  re-materialization artifacts.

## P1 - Streaming And Rendering Performance

The open-world fix is not "bigger chunks". The durable fix is sparse chunk
streaming plus careful rendering budgets.

Next work:

- Ensure terrain, objects, resources, zones, and habitats stream from the same
  active chunk index.
- Reconcile layer diffs instead of clearing and rebuilding whole systems when a
  chunk window changes.
- Add render texture pooling for terrain chunk textures.
- Add lightweight development metrics:
  - active chunk count
  - retained chunk count
  - chunks waiting to build
  - tiles drawn this frame
  - render textures allocated/reused/destroyed
- Keep chunk size at the value that feels best after streaming is correct. Do
  not use chunk size as a substitute for streaming.

Acceptance:

- A 1000 x 1000 chunk manifest can exist without increasing startup cost.
- Testing a 6 x 6 authored map from the editor does not drop frames because
  inactive chunks are being built.
- The runtime can load default fill terrain for un-authored chunks.

## P1 - Editor Storage And Chunk Data Size

The editor must stop treating browser storage as the real project database.
The browser cache is a convenience, not the source of truth.

Next work:

- Project files in `data/editor-library/` are authoritative during development.
- Imported asset image data lives once in the asset library.
- Maps and chunks reference asset IDs.
- Portable exports may embed asset definitions explicitly, but normal save does
  not duplicate image data.
- Chunk JSON should store compact terrain layer IDs directly.
- Editor-only metadata must be sparse and optional.
- Generated library files should be treated as generated data. Do not manually
  edit them unless debugging corruption.

Acceptance:

- Saving a map/chunk can succeed even when browser localStorage is full.
- UI message distinguishes project save success from browser cache failure.
- Chunk files remain small enough to review and diff when only a small area was
  edited.

## P2 - Enemy Spawn Areas And Ecology

The editor now has the beginning of encounter authoring, but runtime enemy
spawning is not complete enough for production map building.

Next work:

- Convert authored encounter areas into runtime spawn controllers.
- Support multiple overlapping spawn areas.
- Per area:
  - enemy type
  - max population
  - respawn delay
  - spawn weight
  - loot profile
  - manual spawn points
- Store runtime spawn state separately from chunk authoring data.
- Add validation:
  - enemy type exists
  - loot profile exists
  - max population is sane
  - spawn area overlaps walkable terrain unless deliberately allowed

Acceptance:

- Editor-authored spawn areas create enemies in the prototype.
- Killing enemies does not modify the authored chunk file.
- Respawn state can later move to a server without changing the chunk schema.

## P2 - World, Dungeon, And Connection Authoring

The WorldManifest is the correct anchor for the long-term MMO direction. Build
dungeons and overworld regions as worlds with manifests and chunk files.

Next work:

- World/dungeon creation:
  - display name drives generated world ID
  - default region ID and region name generated from display name
  - user can override IDs only in an advanced mode
- Connections panel:
  - place entrance/exit
  - select target world
  - select target chunk/tile
  - validate target exists or is marked intentionally unresolved
- Open existing world/dungeon from manifest.
- Save changed chunks back to their world directory.

Acceptance:

- Creating a dungeon does not require typing random IDs.
- Connections are authored visually and survive reload.
- The prototype can transition between authored worlds via chunk connection
  data.

## P2 - Resource Nodes And Loot Data

Objects, resources, enemies, and loot are currently too close to hardcoded
runtime definitions.

Next work:

- Resource-node editor UI:
  - resource type
  - respawn time
  - depletion behavior
  - required tool/skill if applicable
- Loot profile registry:
  - enemy loot
  - chest loot
  - resource yields
- Keep authored static data separate from runtime depletion/opened/killed state.

Acceptance:

- Designers can place resource nodes without touching code.
- Loot profiles are referenced by ID and validated.

## P2 - CSS And UI Structure

`public/ui.css` and `public/editor.css` are large enough to slow down UI work.

Target shape:

- Shared tokens:
  - colors
  - font declarations
  - spacing
  - borders
  - common panel primitives
- Game UI sections:
  - HUD
  - overlay shell
  - inventory/equipment/skills/journal
  - combat panels
  - shops/dialogues
- Editor UI sections:
  - shell/topbar
  - left inspector
  - world/chunk panels
  - definition/import panels
  - encounter/resource/connection panels

Acceptance:

- New editor panels do not require editing a 1200-line stylesheet directly.
- Shared tokens remain central, but domain UI can evolve independently.

## P3 - Database And MMO Direction

Do not start the database layer yet for static map authoring. Start it after:

- WorldManifest and per-chunk files are stable.
- Runtime streams active chunks from the manifest.
- Editor saves only dirty chunks.
- Runtime state is already separated from authored data.
- Enemy/resource/chest state has a clean sparse representation.

When those are true, the database model is straightforward:

- Static authored content can remain files or move to build artifacts.
- Server/database owns mutable runtime state:
  - player accounts
  - character position
  - inventory/equipment
  - depleted resources
  - defeated enemies and respawn timers
  - opened chests
  - quest progress
  - economy/trading records
- Chunk activation is driven by player positions, not camera position.

## Suggested Next 10 Slices

1. Extract world window/chunk save/test launch controllers.
2. Split `EditorMapModel.ts` into types, layer models, serializer, and chunk
   adapter.
3. Split `WorldRuntimeCoordinator.ts` streaming and layer reconciliation.
4. Add runtime chunk metrics and render texture pooling.
5. Implement runtime spawn controllers from encounter areas.
6. Add resource-node authoring and loot profile validation.
7. Compact chunk/editor-library data and mark generated files clearly.

## Not Next

- Do not migrate to a database as a fix for local JSON being messy.
- Do not add another large editor feature directly inside `EditorScene.ts`.
- Do not add more browser dialog workflows for editor tasks.
- Do not duplicate imported images inside every map or chunk.
- Do not optimize chunk size before active streaming and render pooling are
  measured.
