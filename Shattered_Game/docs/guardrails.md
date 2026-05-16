Project guardrails for Shattered:

Code quality:
- Keep files small and focused.
- Avoid monolithic files.
- Do not put all logic into GameScene.
- Prefer small classes/modules with clear responsibility.
- If a file grows beyond roughly 250–300 lines, split it into smaller files.
- If a function grows beyond roughly 40–60 lines, split it into helper functions.
- Avoid deeply nested logic.
- Use clear names over clever names.
- Add short comments only where they explain intent, not obvious code.

Architecture:
- GameScene should coordinate systems, not contain all systems.
- Separate rendering, input, map logic, player logic, object logic, collision, combat and save/load.
- Keep data definitions separate from behavior where possible.
- Use structured types/interfaces for player, objects, tiles, enemies and placed buildings.
- Do not hardcode content everywhere if it can be represented as data.
- Build systems so they can later support multiplayer, but do not implement multiplayer yet.

State management:
- Keep runtime state explicit and easy to inspect.
- Avoid hidden global state.
- Avoid random direct mutations across unrelated files.
- Use clear state objects for:
  - player state
  - map/tile state
  - world object state
  - build mode state
  - combat state later
- Keep save/load state separate from temporary runtime-only state.

Readability:
- Code should be easy for another developer or AI agent to understand later.
- Prefer boring, predictable structure over clever abstractions.
- Do not over-engineer with complex patterns unless clearly needed.
- After implementing, explain which files were created or changed and why.

Scope control:
- Implement only the requested feature.
- Do not add extra systems unless explicitly requested.
- Do not add menus, inventory, multiplayer, database, final art, or advanced systems early.
- Leave clean TODO comments for future systems instead of half-building them.