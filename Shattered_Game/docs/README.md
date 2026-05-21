# Shattered Docs

`Shattered.md` is the core vision reference. Treat it as the north star for
design, tone, feature priority, and long-term product direction.

The other docs are current technical references. They replace the older v0
chronology notes that used to live in this folder.

## Reading Order

1. [Shattered.md](Shattered.md) - vision, game identity, design pillars, MVP.
2. [technical-direction.md](technical-direction.md) - architecture rules, code ownership, next cleanup work.
3. [world-and-persistence.md](world-and-persistence.md) - maps, chunks, terrain, save state, runtime state.
4. [gameplay-systems.md](gameplay-systems.md) - controls, UI, crafting, contracts, skills, combat.
5. [map-editor.md](map-editor.md) - editor app, authoring model, import/export, next editor layers.

## Current Prototype Shape

The current prototype is a Phaser + TypeScript game with separate game and
editor app entrypoints:

- `index.html` -> `src/apps/game/main.ts`
- `editor.html` -> `src/apps/editor/main.ts`

The codebase is intentionally moving toward explicit ownership boundaries:

- `src/apps` for browser boot entrypoints
- `src/game` for game-only orchestration
- `src/editor` for editor-only runtime and tools
- `src/shared` for schemas, validation, coordinate helpers, and pure import/export helpers
- domain folders for player, combat, objects, interactions, persistence, UI, audio, and world runtime

## Doc Policy

- Keep `Shattered.md` as the vision source of truth.
- Keep technical docs current, not historical.
- When a v0 implementation note becomes stale, merge the still-useful rule into
  one of the current references and remove the old note.
- Prefer links to real code paths over local absolute file links.
- Keep "intentionally not implemented" sections only when they help protect scope.
