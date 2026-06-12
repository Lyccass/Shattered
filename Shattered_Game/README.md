# Shattered

Shattered is a TypeScript and Phaser prototype for a cozy-dark isometric island MMO. The long-term game fantasy is simple:

> This is my island in a living world.

Players should be able to specialize in building a personal island, exploring dangerous dead-god islands, or crafting and trading useful goods. No one path should be mandatory. The economy, worldstate, and social spaces connect the paths without forcing every player into combat, farming, or crafting.

## Current Status

This repository is currently a single-player browser prototype with a separate map editor. It proves the local game loop, data-driven content, chunked world authoring, local persistence, and a turn-based combat foundation. It is not a networked MMO yet.

Current stack:

- TypeScript with strict compiler settings
- Vite for dev server and production build
- Phaser 3 for game/editor runtime
- Vitest for unit and integration tests
- Browser `localStorage` for prototype saves
- Project JSON files under `data/` for editor and world authoring during development

Main browser entrypoints:

- `index.html` boots `src/apps/game/main.ts`
- `editor.html` boots `src/apps/editor/main.ts`

## Quick Start

Install dependencies:

```bash
npm install
```

Run the game:

```bash
npm run dev
```

Run the editor:

```bash
npm run dev:editor
```

Run tests:

```bash
npm test
```

Build both app entrypoints:

```bash
npm run build
```

The Vite dev server is configured for `127.0.0.1:5173`. The editor and runtime use Vite middleware for project-library and world-data file access while developing.

## Project Shape

Important top-level paths:

- `src/apps/` - tiny browser app entrypoints
- `src/scenes/GameScene.ts` - Phaser game scene composition point
- `src/editor/EditorScene.ts` - Phaser editor scene composition point
- `src/game/` - game-only controllers and persistence orchestration
- `src/editor/` - editor-only tools, panels, renderers, workflow controllers, and IO
- `src/shared/` - pure schemas, validation, coordinate helpers, and authoring helpers
- `src/world/` - grid, isometric transforms, maps, chunk streaming, terrain, world session state
- `src/combat/` - enemies, encounter population, abilities, turn combat engine/session/UI types
- `src/player/` - movement, facing, inventory, equipment, currency, reputation, spellbook, session state
- `src/items/` - item registry and data definitions
- `src/crafting/` - recipe definitions and inventory mutation helpers
- `src/contracts/` - contract board data and state rules
- `src/interactions/` - interaction targets, choice menus, action progress, placement, workbenches, resource nodes
- `src/objects/` - static object definitions, placement, rendering, occlusion, depth
- `src/npcs/` - NPC definitions, registry, runtime system, visual controller, dialogue menu handler
- `src/ui/` - HTML overlay UI, panels, toasts, inventory menus, HUD bridge
- `src/persistence/` - prototype save types, validation, restore safety, local save service
- `src/shared/world/` - world manifest, chunk definitions, chunk validation, chunk adapters/provider
- `data/worlds/` - authored world manifests and chunk JSON
- `data/editor-library/` - development editor library data, maps, drafts, assets, published test maps
- `public/assets/` - sprites, terrain, objects, icons, fonts
- `public/css/` - split game/editor CSS files

Generated or dependency output such as `node_modules/`, `dist/`, and `.DS_Store` should not be edited.

## Design North Star

Shattered is set in The Wake, an oceanic archipelago formed from the remains, memories, organs, bones, and dreams of dead gods. The world should feel strange, beautiful, dangerous, and lived in.

Core play paths:

- Builder: personal island ownership, layout, buildings, gardens, docks, workshops, shops, shrines, museums, guest spaces, and identity.
- Explorer: travel, ruins, lore, slow readable encounters, rare materials, bosses, threats, and worldstate changes.
- Crafter: production, refining, tools, furniture, food, potions, contracts, market stalls, services, and reputation.

Core design rule:

> You can do this yourself, trade with others, hire services, join friends, or take another route.

Progression should be evergreen and OSRS-like: stable caps, long-term mastery, old content remaining useful, and new content adding sideways depth rather than resetting everyone through power creep.

Tone:

- Cozy, but not childish.
- Dangerous, but not constantly stressful.
- Social, but not forced.
- Deep, but readable.
- Slow and meaningful, not grindy for its own sake.
- MMO-like, but not dependent on huge battles or massive crowds everywhere.

## Current Prototype Loop

The prototype currently focuses on a narrow loop:

1. Load The Wake world manifest.
2. Move around an isometric grid world.
3. Interact with resources, workbenches, NPCs, boards, placed structures, transitions, and enemies.
4. Gather `wood`, `stone`, and `herb`.
5. Craft field items such as `firestarter_set`, `wooden_marker`, `camp_supplies`, and `warm_tea`.
6. Place temporary objects where placement rules allow them.
7. Accept and complete harbor contracts.
8. Enter turn-based combat encounters, earn combat XP, and collect loot drops.
9. Persist prototype player/world state locally.

Visible skill ids in code today:

- `melee`
- `ranged`
- `magic`
- `devotion`
- `metalworking`
- `woodworking`
- `alchemy`
- `trade`

Each skill uses 10 ranks with 10 stages per rank for an absolute level range of 1 to 100.

## Controls

Game controls:

- Left click ground or target: move, interact, or choose combat tile depending on mode
- Right click target: context menu in explore mode
- `E`: interact, confirm menu, or confirm placement
- `Space`: toggle sprint outside combat; end turn in combat
- `F`: flee during combat
- `Escape`: cancel menu, placement, or action progress
- `W/S` or `Up/Down`: menu selection
- `I`: inventory
- `J`: journal
- `P`: skills
- `Option/Alt + V`: save now
- `Option/Alt + L`: load save
- `Option/Alt + R`: clear save

Developer/debug controls:

- `Z`: cycle camera zoom
- `G`: toggle grid debug
- `C`: toggle chunk debug
- `O`: toggle object debug
- `M`: placement debug hook

Combat is turn based. The HTML combat HUD exposes move, attack, ability, devotion, and end-turn actions. Combat stance is toggled through the taskbar combat button; when armed, clicking an enemy starts combat.

## Map Editor

The editor is a separate app, not a gameplay feature inside `GameScene`.

Run it with:

```bash
npm run dev:editor
```

The editor currently supports:

- terrain painting and exact terrain tile selection
- brush size, flip flags, walkability, elevation, and zone painting
- object placement, deletion, custom object definitions, and object footprints
- NPC placement
- encounter area and manual spawn authoring
- connection and transition authoring
- chunked terrain redraws, chunk outlines, chunk labels, and dirty chunk tracking
- map resize and chunk-window editing
- world/dungeon project library workflows backed by `data/`
- save/open through the project editor library
- dirty chunk save/apply workflows
- custom tile/object import with preview fitting
- test launch into the game with `?editorMap=1`

Common editor shortcuts:

- `T`: terrain mode
- `O`: object mode
- `1` to `5`: terrain family brush
- `Q/E` or `[`/`]`: cycle tile or object selection
- Left drag in terrain mode: paint
- Left click in object mode: place selected object
- `Shift + left click`, `D`, `Delete`, or `Backspace`: remove object
- `WASD` or arrows: pan camera
- Right or middle mouse drag: pan camera
- Mouse wheel or `+`/`-`: zoom
- `F`: flip brush left/right
- `V`: flip brush up/down
- `R`: open resize/extend panel
- `C`: center camera
- `U`: save dirty chunks
- `J`: open chunk bundle library
- `I`: open map library

Editor ownership rule:

`src/editor` may import shared schemas/helpers, terrain assets, object assets, and pure coordinate helpers. It must not import gameplay runtime systems such as combat, player controllers, persistence, contracts, game UI, or `GameScene`. This is enforced by `src/shared/editor/DependencyBoundaries.test.ts`.

## World And Persistence

The project is grid-first internally. Visuals are isometric; gameplay state is tile based.

The long-term overworld model is:

- `WorldManifest` describes a seamless world address space.
- `RegionManifest` and manifest region data describe region defaults and metadata.
- `WorldChunkDefinition` stores static authored chunk data.
- `WorldChunkRuntimeState` stores sparse mutable runtime changes.

The current default world is `data/worlds/the_wake/world.manifest.json`. It defines a 1000 by 1000 chunk address space with a 3 by 3 authored harbor-coast chunk set. Missing chunks are valid and can be filled from region defaults.

Static authored data may include:

- terrain
- static objects
- resource nodes
- zones
- connections
- habitats
- NPC anchors
- metadata

Static authored data must not include:

- player inventory
- skill XP
- active enemies
- defeated enemies
- depleted nodes
- opened chests
- temporary deployables
- open menus
- Phaser objects

Prototype save key:

- `shattered.prototype.save.v1`

Saved prototype player state includes current world/map, player tile, inventory, currency, reputation, skills, task journal, active effects, equipment, spellbook loadout, and combat cooldowns. Saved world state is sparse and mutable. Static authored content stays in files and registries.

## Data-Driven Content

Prefer registries and definitions over scattered conditionals.

Current definition anchors:

- Items: `src/items/definitions/`
- Recipes: `src/crafting/RecipeDefinitions.ts`
- Contracts: `src/contracts/ContractDefinitions.ts`
- Effects: `src/effects/EffectDefinitions.ts`
- Equipment: `src/equipment/EquipmentDefinitions.ts` and item equipment definitions
- Enemies: `src/combat/EnemyDefinitions.ts` and `src/combat/enemies/`
- Combat abilities: `src/combat/abilities/CombatAbilityDefinitions.ts`
- NPCs: `src/npcs/NpcDefinitions.ts`
- Objects: `src/objects/ObjectDefinitions.ts` and `src/objects/InteractionObjectDefinitions.ts`
- Skills/unlocks: `src/skills/`
- Maps/worlds/chunks: `src/world/maps/`, `src/shared/world/`, and `data/worlds/`

If a new gameplay concept needs persistence, add the type and validation path before writing data into saves.

## Architecture Guardrails

Keep scene files as composition points, not system containers.

Current largest coordinators:

- `src/combat/turn/TurnCombatSession.ts`
- `src/combat/turn/TurnCombatEngine.ts`
- `src/world/maps/WorldRuntimeCoordinator.ts`
- `src/scenes/GameScene.ts`
- `src/editor/EditorScene.ts`

When touching these files, prefer behavior-preserving extraction and focused tests instead of adding more responsibilities to the coordinator.

Boundary rules:

- `src/apps` should only boot game/editor runtime.
- `src/game` owns game-specific orchestration.
- `src/editor` owns editor runtime and authoring tools.
- `src/shared` must remain pure and runtime-independent.
- `src/world` owns grid, map loading, world/chunk runtime, terrain, and session world state.
- Static authoring data and mutable runtime state must remain separate.
- Do not introduce a backend or database as a fix for messy local JSON. Stabilize the file/manifest/chunk model first.

Coding rules:

- Keep files focused; split once ownership becomes unclear.
- Split functions that mix parsing, mutation, rendering, and IO.
- Prefer structured parsers, validators, and typed definitions.
- Avoid hidden globals and direct cross-system mutation.
- Keep comments for intent or non-obvious constraints.
- Add or update tests when behavior changes.

## Testing

The project has focused Vitest coverage for:

- turn combat engine behavior
- editor chunk tracking and chunk bundle validation
- editor encounter/NPC workflows
- editor save confidence and world test spawn logic
- equipment derived stats
- dependency boundaries
- editor map model, serializer, resize, and chunk authoring
- world manifests, map registry, transitions, chunk math, terrain resolution
- persistence validation and restore safety
- interactions, crafting, effects, contracts, task journal, UI foundations
- NPC dialogue and encounter population

Use:

```bash
npm test
npm run build
```

Last verified on 2026-06-12:

- `npm test` - 31 test files, 289 tests passed
- `npm run build` - TypeScript and Vite build passed

`npm run build` runs `tsc` and Vite production build. The build may warn about large terrain/assets chunks; that warning is expected until asset loading is split more aggressively.

## Current Roadmap

Near-term technical work:

- Continue shrinking `WorldRuntimeCoordinator` in small, tested slices.
- Keep `EditorScene` thin as new tools are added.
- Add resource-node authoring and loot profile validation.
- Improve runtime spawn controllers from authored encounter areas.
- Add render texture pooling and chunk/runtime metrics where needed.
- Keep editor-library saves compact and avoid duplicating imported image data in every map/chunk.

Near-term product work:

- Make the home/harbor/wild island loop feel better before expanding breadth.
- Deepen NPC dialogue, contracts, tasks, and worldstate reactions.
- Continue the turn-based combat foundation with readable enemy intent, companion participation, abilities, loot, and XP.
- Build toward personal island identity, shared harbor life, dangerous islands, and player economy.

Not next:

- Full MMO networking
- Database migration for static authoring data
- Huge raid battles
- PvP economy warfare
- Full AI-generated quest systems
- WoW-style expansion reset treadmill
- Mandatory base-building, crafting, or combat progression

## Future AI Contributors

Read `AGENTS.md` before changing code. It summarizes the rules that matter most for future AI work: ownership boundaries, verification, generated-data caution, and where to make changes.
