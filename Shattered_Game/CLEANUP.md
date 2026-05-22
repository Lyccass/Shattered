# Shattered — Codebase Cleanup Backlog

Generated 2026-05-22 after the wolf + NPC feature slice. Full scan of all `src/` including editor. Items are grouped by category; within each category, **highest-impact first**.

### Overall Code Quality Picture

**Strengths:** Zero `any` types in production code. Zero `@ts-ignore` / `eslint-disable` suppressions. TypeScript strict mode is clean. CSS is lean with no dead selectors. The game-side UI follows consistent patterns (functional panels, `ui-hidden` class, data-driven style writes only).

**Structural debt:** The editor and the world coordinator were built without the discipline applied to the game side — they use raw `style.display`, raw DOM assertions, and have grown unchecked. `EditorScene.ts` at 1649 lines is the single worst file. Test coverage is near-zero outside `src/world/__tests__/` — the entire `combat/` domain (37 files) has no test files.

---

---

## 1. Inline `style=` in HTML Templates

These are `style="..."` attributes baked into innerHTML template literals. They should move to CSS classes.

| File | Line | Issue | Fix |
|------|------|-------|-----|
| [EnemyPanel.ts](src/ui/overlay/panels/EnemyPanel.ts#L24) | 24 | `<div class="enemy-hp-fill" style="width:100%">` — resets bar to 100% every DOM rebuild | Remove; the CSS default or a `.is-full` class handles the initial state |
| [JournalTabContent.ts](src/ui/overlay/panels/JournalTabContent.ts#L29) | 29–30 | `<strong style="color:var(--c-primary)">` used twice | Add `.journal-stat-highlight { color: var(--c-primary); }` to `ui.css` |

**Note:** `.style.width` / `.style.height` on progress bars (SkillDetailWindow, MinimapPanel, SkillsTabContent, EnemyPanel update loop) are _data-driven writes_ — those are correct and do not need changing.

---

## 2. Tooltip Positioned via Direct Style Assignment

| File | Lines | Issue | Fix |
|------|-------|-------|-----|
| [EquipmentTabContent.ts](src/ui/overlay/panels/EquipmentTabContent.ts#L156) | 156–159 | `tip.style.left`, `.width`, `.top`, `.transform` set inline on every hover | Extract a `positionTooltipAbove(tip, anchorRect)` helper in a shared `ui/tooltipUtils.ts` — keeps logic in one place and removes the only place we write layout directly from a panel |

---

## 3. Console Statements in Production Code

| File | Line | Statement | Action |
|------|------|-----------|--------|
| [ObjectPlacementSystem.ts](src/objects/ObjectPlacementSystem.ts#L186) | 184–195 | `console.log` debug dump (3 lines, in a `debugDump()` method) | Gate behind `if (import.meta.env.DEV)` or remove the method entirely — nothing calls it |
| [EditorMapIoController.ts](src/editor/io/EditorMapIoController.ts#L51) | 51 | `console.log(json)` — dumps raw map JSON on every export | Remove; the editor toasts "printed to console" but the user gets the file download anyway |
| [AudioUnlockGate.ts](src/audio/AudioUnlockGate.ts#L285) | 285 | `console.warn` | Keep — this is a meaningful browser-policy warning |
| [SfxSystem.ts](src/audio/SfxSystem.ts#L116) | 116 | `console.warn` | Keep — meaningful missing-asset warning |
| [GameScene.ts](src/scenes/GameScene.ts#L289) | 289 | `console.error` on map load failure | Keep — critical error path |

---

## 4. Type Casts That Bypass Safety

### 4a. Discriminated union switch using `as` instead of narrowing

The `InteractionTarget` type is a union discriminated on `definition.interactionType`, but TypeScript can't narrow through a nested `definition` property. The result is a switch block full of unsafe `as` casts in three files:

| File | Lines |
|------|-------|
| [InteractionSystem.ts](src/interactions/InteractionSystem.ts#L138) | 138–153 (8 casts) |
| [WorldInteractionHandlers.ts](src/world/maps/WorldInteractionHandlers.ts#L64) | 64–124 (6+ casts) |
| [WorldInteractionOrchestrator.ts](src/world/maps/WorldInteractionOrchestrator.ts#L120) | 120–224 (4+ casts) |
| [InteractionMenuCopy.ts](src/world/maps/InteractionMenuCopy.ts#L19) | 19–65 (3 casts) |

**Fix:** Flatten `InteractionTarget` so `interactionType` is a top-level discriminant, or add type-predicate narrowing functions (`isMapTransitionTarget(t): t is MapTransitionInteractionTarget`). Either approach eliminates every cast in the switch blocks.

### 4b. Repeated inventory snapshot casts

| File | Lines | Issue |
|------|-------|-------|
| [InventoryTabContent.ts](src/ui/overlay/panels/InventoryTabContent.ts#L21) | 21–22, 33–34 | `snapshot.resources as Record<string, number>` — same cast in two functions |

**Fix:** Change `PlayerInventorySnapshot.resources` type to `Record<string, number>` (or a typed `Partial<Record<PlayerItemKey, number>>`).

### 4c. `itemId as PlayerItemKey` casts

| File | Lines |
|------|-------|
| [GameScene.ts](src/scenes/GameScene.ts#L393) | 393 |
| [ContractBoardSystem.ts](src/contracts/ContractBoardSystem.ts#L229) | 229, 244, 380, 386 |

**Fix:** Validate with `isPlayerItemKey(id)` type guard at the boundary rather than casting inside logic.

---

## 5. Non-Null Assertions (`!`) on DOM Queries

All panel constructors use `querySelector(...)!` without validating the DOM. If the template HTML drifts, these become silent `null` dereferences at runtime.

| File | Count | Pattern |
|------|-------|---------|
| [EnemyPanel.ts](src/ui/overlay/panels/EnemyPanel.ts#L30) | 4 | `this.root.querySelector('.enemy-name')!` etc. |
| [MinimapPanel.ts](src/ui/overlay/panels/MinimapPanel.ts#L36) | 5 | querySelector assertions |
| [ChatPanel.ts](src/ui/overlay/panels/ChatPanel.ts#L26) | 1 | querySelector assertion |
| [InventoryTabContent.ts](src/ui/overlay/panels/InventoryTabContent.ts#L100) | 4+ | querySelector assertions |
| [EditorHudController.ts](src/editor/ui/EditorHudController.ts#L113) | 20+ | `document.getElementById(...)!` throughout |

**Fix:** Create a single helper:
```ts
function requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing required element: "${selector}"`);
  return el;
}
```
Use it in every panel constructor. Turns silent runtime crashes into loud init-time errors with a useful message.

---

## 6. `style.display` / Direct Style Sprawl in the Editor

The editor never adopted the `ui-hidden` class pattern used by the game UI. Instead it manually toggles `style.display` and sets pixel-position properties everywhere.

**Total count:** 59 meaningful `.style.*` writes across editor files.

| File | Style writes | Worst patterns |
|------|-------------|----------------|
| [EditorDefinitionImage.ts](src/editor/assets/EditorDefinitionImage.ts) | 20 | Pixel-positioning image/selection/resize-handle elements on every frame |
| [EditorDefinitionPanelController.ts](src/editor/ui/EditorDefinitionPanelController.ts) | 17 | `style.display` toggling — 17 call sites, checks `fitPanel.style.display === 'none'` as a state read (line 273) |
| [EditorHudController.ts](src/editor/ui/EditorHudController.ts#L268) | 10 | `style.display` on brush/object section toggling |
| [EditorScene.ts](src/editor/EditorScene.ts#L1018) | 6 | `style.display = 'flex'` / `'none'` on panel open/close |
| [EditorTilePaletteController.ts](src/editor/ui/EditorTilePaletteController.ts) | 3 | display toggles |
| [EditorLibraryPanelController.ts](src/editor/ui/EditorLibraryPanelController.ts#L65) | 3 | display toggles |

**Notable smell (line 273):** `fitPanel.style.display === 'none'` is used as a boolean state check — the style property is doubling as application state, which is fragile.

**Fix:**
- Add `.editor-hidden { display: none !important; }` to the editor stylesheet
- Replace all `el.style.display = 'none'` → `el.classList.add('editor-hidden')` and `el.style.display = ''` / `'flex'` → `el.classList.remove('editor-hidden')`
- Replace the `fitPanel.style.display === 'none'` state check with a real boolean field `private fitPanelVisible = false`
- `EditorDefinitionImage.ts` pixel positioning is legitimate (canvas element layout driven by image geometry) — keep those, but document the coordinate system

---

## 7. Magic Numbers

### 7a. EnemyVisualController — animation squash/stretch constants

[EnemyVisualController.ts](src/combat/EnemyVisualController.ts) lines 60–121 use raw floats for every animation multiplier:

```ts
// scattered through applyState():
lift = 8 * easeOut(phaseProgress);        // windup lift max
scaleX = 1.0 + 0.06 * phaseProgress;     // anticipation squeeze
scaleY = 1.0 - 0.08 * phaseProgress;
lift = 44 * arc;                          // jump arc max
scaleX = 1.08; scaleY = 0.94;            // jump squash
scaleX = 1.0 + 0.28 * squash;            // land squash X
this.visual.setScale(scaleX * 1.08, ...); // windup scale bump
this.visual.setScale(scaleX * 1.12, ...); // active scale bump
this.visual.setScale(0.9);               // dead scale
// hit flash
this.visual.setScale(... * (1 + 0.12 * flashT));
```

**Fix:** Extract a `const ENEMY_ANIM = { ... }` block at the top of the file with named values.

### 7b. EnemyVisualController — world-space health bar layout

Lines 158–175: `barW = 40`, `barH = 4`, `y = state.worldY - 8 - lift - 60` — all raw numbers.

**Fix:** `const BAR_WIDTH = 40; const BAR_HEIGHT = 4; const BAR_OFFSET_Y = 60;`

### 7c. EnemyVisualController — shadow geometry

Line 26: `this.scene.add.ellipse(state.worldX, state.worldY - 4, 28, 12, 0x020617, 0.2)` — shadow size, offset, colour, alpha all raw.

**Fix:** Named constants at file top.

### 7d. PlayerAttackFeedbackRenderer — visual alpha/radius values

Alpha values `0.15`, `0.06`, `0.38`, `0.60`, `0.95` and radius `14` and duration `160` scattered through the renderer.

**Fix:** `const FEEDBACK = { windupAlpha: 0.06, activeAlpha: 0.38, ... }` block.

### 7e. CombatSandboxSystem — timing

Line 52: `HIT_STOP_MS = 70` is already a class constant. Line 544: `this.playerCombatState.setNextRecoveryMs(320)` is a magic number (player post-hit recovery).

**Fix:** Add `private static readonly POST_HIT_RECOVERY_MS = 320`.

---

## 8. Overly Large Files

Complete ranking of files ≥ 400 lines. The editor is not excluded — it's the worst offender.

| File | Lines | Responsibilities | Split suggestion |
|------|-------|-----------------|-----------------|
| [EditorScene.ts](src/editor/EditorScene.ts) | 1649 | Phaser scene + tile paint + object tool + chunk export + import + UI wiring + input | Extract at minimum: `EditorExportController` (export/import logic ~300 lines), `EditorPanelController` (panel open/close wiring ~200 lines) |
| [WorldRuntimeCoordinator.ts](src/world/maps/WorldRuntimeCoordinator.ts) | 895 | NPC lifecycle, combat stat sync, player state, UI state, map load/unload, NPC visual | Extract `MapLifecycleBridge` (load/unload) and `CombatStatSyncer` (derived stats → combat) |
| [EditorDefinitionPanelController.ts](src/editor/ui/EditorDefinitionPanelController.ts) | 745 | Asset panel UI, image fit preview, footprint input, texture upload, form validation | Split into `EditorDefinitionFormController` (form values) and `EditorImageFitController` (image fit/preview) |
| [EditorMapModel.ts](src/shared/editor/EditorMapModel.ts) | 699 | Editor map data model + serialization + chunk conversion + validation helpers | Extract `EditorMapSerializer.ts` and `EditorChunkAdapter.ts`; keep model as pure data |
| [CombatSandboxSystem.ts](src/combat/CombatSandboxSystem.ts) | 680 | Enemy orchestration, player hit resolution, dodge, sprint, attack feedback, screen shake | Extract `CombatHitResolver` (the `resolveEnemyAttackEvents` + `resolvePlayerLightAttackHit` block, ~120 lines) |
| [EnemyStateTransitions.ts](src/combat/EnemyStateTransitions.ts) | 609 | All state handlers + telegraph builder (buildAttackTelegraph is ~130 lines alone) + hit evaluator | Extract `EnemyTelegraphBuilder.ts` — the whole `buildAttackTelegraph` switch is self-contained |
| [GameScene.ts](src/scenes/GameScene.ts) | 600 | Phaser scene + input routing + stat sync + screen shake + map load + result handling | Extract `GameStatSyncer` (the sync block that runs every frame) |
| [EditorDefinitionImage.ts](src/editor/assets/EditorDefinitionImage.ts) | 517 | Image loading, canvas grid drawing, fit preview rendering, stage rendering | Already well-decomposed into pure functions — acceptable as-is |
| [PlayerCombatState.ts](src/combat/PlayerCombatState.ts) | 494 | Attack, dodge, guard, sprint, regen, downed state all in one class | Extract `PlayerGuardState` (guard + resolve incoming attack logic, ~100 lines) |
| [EditorLocalLibrary.ts](src/editor/io/EditorLocalLibrary.ts) | 467 | IndexedDB read/write + migration + validation for editor library | Acceptable — this is all one concern (library persistence); no split needed |
| [TerrainChunkDrawSystem.ts](src/world/chunks/TerrainChunkDrawSystem.ts) | 429 | Chunk rendering | Acceptable — rendering system, single concern |
| [SaveValidation.ts](src/persistence/SaveValidation.ts) | 420 | Save file schema validation | Acceptable — validation logic, single concern |
| [DebugOverlaySystem.ts](src/debug/DebugOverlaySystem.ts) | 403 | Debug overlay | Acceptable — dev tool, not in critical path |

---

## 9. Dead / Zombie Code

| File | Location | Issue |
|------|----------|-------|
| [InventoryTabContent.ts](src/ui/overlay/panels/InventoryTabContent.ts#L286) | ~286–288 | `getSlotData()` method has a comment "Kept for external callers that previously used the old single-callback form" — grep shows zero call sites |
| [ObjectPlacementSystem.ts](src/objects/ObjectPlacementSystem.ts#L184) | 184–195 | `debugDump()` method — never called from outside, see also item 3 above |

**Action:** Verify with a grep for each, then delete if confirmed dead.

---

## 10. Test Coverage Gap

All existing tests live in `src/world/__tests__/` (20 files) and two `src/shared/` test files. Every other directory is completely uncovered:

| Directory | Source files | Test files | Risk |
|-----------|-------------|------------|------|
| `combat/` | 37 | 0 | **High** — state machine, damage, telegraph, hit eval |
| `player/` | 16 | 0 | **High** — inventory, sessions state, combat state |
| `interactions/` | 17 | 0 | Medium — interaction target dispatch |
| `skills/` | 11 | 0 | Medium — XP, rank-up, derived stats |
| `npcs/` | 5 | 0 | Medium — new, untested patrol/bubble logic |
| `objects/` | 13 | 0 | Medium — placement, grid blocking |
| `persistence/` | 6 | 0 | Medium — save/load |
| `contracts/` | 4 | 0 | Medium — reward calculation |
| `audio/` | 6 | 0 | Low |
| `crafting/` | 4 | 0 | Low |
| `effects/` | 4 | 0 | Low |
| `equipment/` | 4 | 0 | Low |
| `items/` | 5 | 0 | Low |

**Highest-value tests to add first:**
1. `combat/EnemyStateMachine` — the idle→aggro→approach→attack cycle; tier suppression; passive/aggressive behavior; 1v1 lock
2. `combat/PlayerCombatState` — dodge window, guard resolution, downed/recovery
3. `npcs/NpcSystem` — patrol waypoint advancement, bubble scheduling
4. `player/PlayerSessionState` — derived stats calculation, inventory mutations
5. `skills/SkillSystem` — XP accumulation, rank-up thresholds

---

## 11. Repeated Pattern — Drag Event Target Casts

| File | Lines | Pattern |
|------|-------|---------|
| [InventoryTabContent.ts](src/ui/overlay/panels/InventoryTabContent.ts#L253) | 253, 258 | `(e.currentTarget as HTMLElement).classList` in drag listeners |

**Fix:** Type the listener properly — `el.addEventListener('dragover', (e: DragEvent) => { (e.currentTarget as HTMLElement)...` is correct form; alternatively wrap in a typed helper. Low severity.

---

## 11. `editor.html` — Not Checked in Original Audit

This file was missed in the first sweep. It has four distinct problems:

### 11a. Entire editor CSS is an inline `<style>` block

Lines 8–1185 of `editor.html` contain **1177 lines of CSS** inside a `<style>` tag. There is no `editor.css` file — this is the only place editor styles live.

**Fix:** Extract to `public/editor.css`, add `<link rel="stylesheet" href="/editor.css" />` to the `<head>`. One mechanical move, zero behaviour change.

### 11b. `style="display:none"` on 10+ overlay panels

Every panel and dialog in the HTML starts hidden via an inline `style="display:none"` attribute, then gets shown by the TS via `style.display = 'flex'` or `''`. This is the root cause of the `style.display` sprawl tracked in §6.

Affected elements (line numbers in `editor.html`):

| Line | Element |
|------|---------|
| 1262 | `#ed-map-name` |
| 1332 | `#ed-object-section` |
| 1336 | `#ed-preview-object` img |
| 1337 | `#ed-obj-color-swatch` canvas |
| 1356 | `#ed-tile-meta-section` |
| 1465 | `#ed-palette` |
| 1478 | `#ed-library` |
| 1491 | `#ed-definition` |
| 1560 | `#ed-fit-panel` |
| 1590 | `#ed-chunk-window` |
| 1633 | `#ed-resize` |
| 1660 | `#ed-chunk-name-panel` |

**Fix:** Remove all inline `style="display:none"` attributes. Set each panel's default to `display: none` in `editor.css` (`.ed-palette`, `.ed-library`, `.ed-definition`, etc. — several already have this in the `<style>` block). Then toggle visibility from TS using `classList.add/remove('editor-hidden')` or `classList.toggle('is-visible', open)`. This and §6 are the same fix, done together.

### 11c. `style="grid-template-columns:1fr"` layout overrides

Three dialogs reuse `.ed-definition-body` (which defaults to a 2-column grid) but override the grid inline:

| Line | Element |
|------|---------|
| 1595 | `#ed-chunk-window` body |
| 1638 | `#ed-resize` body |
| 1665 | `#ed-chunk-name-panel` body |

**Fix:** Add `.ed-definition-body--full { grid-template-columns: 1fr; }` to `editor.css`. Replace the three inline style attributes with this class.

### 11d. Inline `onclick` with real JavaScript

Lines 1250–1255 — the help toggle button has logic directly in the HTML attribute:

```html
<button onclick="
  const p = document.getElementById('ed-help-panel');
  const b = document.getElementById('ed-help-toggle');
  const open = p.classList.toggle('is-visible');
  b.classList.toggle('is-active', open);
">? Keys</button>
```

This is the only inline JS in the codebase. The `EditorHudController` already wires up all other button listeners — this one was left inline.

**Fix:** Remove the `onclick` attribute. Add `document.getElementById('ed-help-toggle')?.addEventListener('click', ...)` in `EditorHudController.bindEvents()`.

---

## 12. CSS Audit (`public/ui.css`)

A grep of all CSS class selectors against TypeScript usage found **no dead selectors** — every class in the stylesheet is referenced in TS code. The stylesheet is well-structured.

Two minor items (both already fixed as part of §1):

- **`.enemy-hp-fill` initial `width: 100%`** — ✅ Added to CSS; inline attribute removed.
- **`.journal-stat-highlight`** — ✅ Class added to CSS; inline `style=` removed.

---

## Priority Order

### P1 — Fix These First (affect correctness or will bite soon)

1. ✅ **Inline style in EnemyPanel template** (§1) — done
2. ✅ (partial) **DOM querySelector null assertions — game panels** (§5) — `requireElement` + `requireById` helpers in `src/ui/domUtils.ts`; applied to EnemyPanel (4), MinimapPanel (5), ChatPanel (1), InventoryTabContent (4). `EditorHudController` (20+) remains.
3. ✅ **InteractionTarget discriminant casts** (§4a) — added 8 type predicates to `InteractionTypes.ts`; converted all switch/if blocks in 5 files to use predicates; zero `as` casts remaining
4. ✅ **`fitPanel.style.display` used as state** (§6, §11b) — added `fitPanelVisible` local boolean; `closeFitEditor`/`openFitEditor` maintain it; state check replaced with `!fitPanelVisible`

### P2 — High Value, Self-Contained Cleanups

5. ✅ **Extract `editor.html` `<style>` block to `editor.css`** (§11a) — extracted 1176 lines to `public/editor.css`; `editor.html` now has a `<link>` tag; file reduced from 1681 → 504 lines
6. ✅ **`style="display:none"` on HTML panels + TS `style.display` sprawl** (§11b, §6) — added `.editor-hidden { display: none !important; }` to `editor.css`; updated CSS defaults for 5 selectors; removed 12 inline HTML attrs; replaced all `style.display` calls in 6 TS files with `classList` toggles
7. ✅ **Inline `onclick` in `editor.html`** (§11d) — removed `onclick` attribute; wired in `EditorHudController.constructor()`
8. ✅ **`style="grid-template-columns"` overrides** (§11c) — added `.ed-definition-body--full` to `editor.css`; replaced 3 inline attrs
9. ✅ **Remove dead code** (§9) — deleted `getSlotData()` + `SlotData` type from `InventoryTabContent.ts`; deleted `debugLogPlacementInfo()` from `ObjectPlacementSystem.ts`; stubbed out `onDebugLogPlacement` callback in `GameScene.ts`
10. ✅ **Remove `console.log`** (§3) — removed unconditional JSON log in `EditorMapIoController.writeExport`; kept clipboard-fallback log
11. ✅ **Magic numbers in EnemyVisualController** (§7a–c) — extracted `ANIM`, `SHADOW`, `BAR` constants blocks at file top

### P3 — Architecture / Long Game

12. **Combat test suite** (§10) — start with EnemyStateMachine and PlayerCombatState; most logic-dense, zero-coverage files
13. **Split large files** (§8) — EditorScene first (1649 lines), then WorldRuntimeCoordinator; do when the next feature touches each
14. **Inventory snapshot type fix** (§4b) — fix the type, remove the casts
15. **Tooltip positioning helper** (§2) — do when adding a second tooltip type
16. **Attack feedback constants** (§7d–e) — do during next VFX pass

---

## Estimated Scope

| Priority | Groups | Effort |
|----------|--------|--------|
| P1 | ✅ complete | — |
| P2 | ✅ complete | — |
| P3 | 5 items | ~20 h |
| **Total** | **15** | **~34 h** |

P1 + P2 is the cleanup sprint (~14 h). The editor HTML items (§11) are new and together account for most of P2 — they're all in one file and can be done in a single session.

---

## ✅ Done

| # | Item | What was done |
|---|------|---------------|
| §1 | Inline `style=` in HTML templates | Removed `style="width:100%"` from `EnemyPanel` template; added `width: 100%` to `.enemy-hp-fill` in `ui.css`. Replaced `style="color:var(--c-primary)"` in `JournalTabContent` with `.journal-stat-highlight` class. |
| §4a | InteractionTarget discriminant casts | Added 8 type predicates (`isMapTransitionTarget` … `isGroundItemTarget`) to `InteractionTypes.ts`. Replaced all `as` casts across 5 files. Zero `as`-casts on interaction targets remaining. |
| §5 (partial) | DOM null assertions — game panels | Created `src/ui/domUtils.ts` with `requireElement` + `requireById` helpers. Applied to `EnemyPanel` (4), `MinimapPanel` (5), `ChatPanel` (1), `InventoryTabContent` coin block (4). `EditorHudController` (20+) still pending. |
| §6 + §11b | `style.display` sprawl + inline HTML display attrs | Added `.editor-hidden { display: none !important; }` to `editor.css`. Updated CSS defaults for 5 selectors (`ed-library`, `ed-definition`, `ed-fit-panel`, `ed-definition-resize-handle`, `ed-fit-selection`). Removed 12 `style="display:none"` HTML attrs. Replaced all `style.display` calls in 6 TS files with `classList` toggles. Also resolved `fitPanelVisible` boolean (§6 partial from P1). |
| §11a | Inline `<style>` block in `editor.html` | Extracted 1176 lines to `public/editor.css`; replaced with `<link>` tag. `editor.html` reduced from 1681 → 504 lines. |
| §11c | Inline `grid-template-columns` overrides | Added `.ed-definition-body--full` to `editor.css`; replaced 3 inline style attrs. |
| §11d | Inline `onclick` on help button | Removed attribute; added listener in `EditorHudController.constructor()`. |
| §9 | Dead code | Deleted `getSlotData()` + `SlotData` type from `InventoryTabContent.ts`; deleted `debugLogPlacementInfo()` from `ObjectPlacementSystem.ts`. |
| §3 | `console.log` in production | Removed unconditional `console.log(json)` from `EditorMapIoController.writeExport`; clipboard-fallback path still logs. |
| §7a–c | Magic numbers in EnemyVisualController | Extracted `ANIM`, `SHADOW`, `BAR` constant objects at file top. All raw floats replaced. |
| §12 | CSS sub-section headers in `ui.css` | Added `/* ── Subsection ── */` headers to enemy nameplate, skills tab, and chat sections. The two selector fixes (`.enemy-hp-fill` width, `.journal-stat-highlight`) were applied as part of §1. |

