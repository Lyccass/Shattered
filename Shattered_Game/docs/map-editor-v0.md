# Map Editor v0

Shattered's map editor is a separate app entrypoint, not a gameplay feature inside `GameScene`.

The playable game consumes map data. The editor produces map data. Shared code owns the schemas, terrain family ids, validation, and pure isometric coordinate helpers that both apps need.

## Project Structure

- `index.html` boots the playable game through the existing game entrypoint.
- `editor.html` boots the editor through `src/editor/main.ts`.
- `src/editor/` owns editor-only Phaser scenes, editor input, painting, import, and export behavior.
- `src/shared/` owns plain data types, pure coordinate helpers, editor map helpers, and shared validation.
- `src/world/maps/MapTypes.ts` remains as a compatibility barrel for current game imports, but the actual map schema now lives in `src/shared/map/MapTypes.ts`.

The editor must not import gameplay runtime systems such as combat, player controllers, persistence, contracts, UI, or `GameScene`. The game can import shared map types and helpers. The editor can import shared map types and helpers. Game and editor runtime code should not import each other.

Editor v0 reuses the same terrain asset loader and terrain tile definitions as the game so authored tiles visually match the current playable prototype. It does not use the game's terrain resolver while painting, because the resolver intentionally chooses variants and transitions from neighbouring terrain. That is useful for procedural/runtime rendering, but wrong for manual authoring.

## Running The Editor

Use:

```bash
npm run dev:editor
```

The regular game still runs with:

```bash
npm run dev
```

The current Vite build is multi-page, so `npm run build` validates and builds both `index.html` and `editor.html`.

## Editor Controls

- `1` selects the grass brush.
- `2` selects the dirt brush.
- `3` selects the stone brush.
- `4` selects the water brush.
- `5` selects the sand brush.
- `Q` / `E` or `[` / `]` cycle the exact selected tile inside the current terrain family.
- Hold left mouse and drag to paint over tiles.
- `WASD` or arrow keys pan the camera.
- Right mouse drag or middle mouse drag pans the camera.
- Mouse wheel zooms the editor view.
- `+` / `-` also zoom the editor view.
- `F` flips the selected brush left/right.
- `V` flips the selected brush up/down.
- `T` switches to terrain mode.
- `O` switches to object mode.
- In object mode, `Q` / `E` or `[` / `]` cycle explicit object definitions.
- In object mode, left click places the selected object on the hovered tile.
- In object mode, `Shift` + left click removes an object at the hovered tile.
- `D`, `Delete`, or `Backspace` removes an object at the hovered tile.
- `R` opens a simple resize prompt using `width,height`.
- `C` centers the camera on the current map.
- `X` exports the map JSON to the clipboard when available and always logs it to the console.
- `I` opens a simple paste prompt for importing compatible map JSON.

The editor shows the current mode, selected tile id, selected object id, selected texture key, selected flip direction, hovered grid coordinate, hovered terrain family, hovered tile art id, hovered object id, current map dimensions, and two previews: selected tile and hovered tile. Rendering is intentionally simple in v0, but it uses the same isometric coordinate convention and terrain art keys as the game.

The editor renders terrain in `16x16` chunks and redraws affected chunks when painting. Chunk outlines are visible as a light blue editor overlay.

## Terrain Data

The exported map still includes a terrain family layer:

- `grass`
- `dirt`
- `stone`
- `water`
- `sand`

For manual editing, the editor also stores an exact `editorTerrainTiles` metadata layer. Each painted cell records:

- selected tile id
- terrain family
- texture key
- `flipX`
- `flipY`

The editor does not auto-pick random variants, does not auto-transition adjacent tiles, and does not change neighbouring art when one tile is painted. If a transition tile is needed, it should be selected from the tile catalog and painted manually.

Runtime use of `editorTerrainTiles` is intentionally not wired into gameplay yet. The current game still consumes the family terrain layer.

## Export Format

Export produces a shared `MapDefinition` shape with:

- `id`
- `displayName`
- `spaceType`
- `width`
- `height`
- `terrain`
- a default spawn point
- explicit object ids if object placements exist in editor data
- empty transition, zone, and interaction layers for now
- metadata marking the source as `map_editor_v0`
- metadata `editorTerrainTiles` for exact editor-authored tile art
- metadata `editorEnemySpawns` once enemy spawn editing is added

The exported terrain dimensions are validated before serialization. Invalid imports fail before replacing the current editor map.

## Not Implemented Yet

Map Editor v0 has terrain and object placement layers. The editor data model already separates exact terrain tile art, explicit object ids, and future enemy spawn ids so later layers can scale without rewriting the terrain brush. It intentionally does not implement:

- resource placement
- spawn editing
- transition editing
- zone editing
- height or elevation editing
- NPC routes
- combat content
- gameplay persistence

Those should become separate editor layers in v0.1+ instead of being mixed into the terrain brush.

## Next Layers

The natural next editor pass is object/resource/spawn authoring:

- object palette UI, better placement validation, and footprint previews before click
- resource node layer
- named spawn point layer
- enemy spawn layer
- transition trigger and visual anchor layer
- validation that mirrors runtime map loading constraints
