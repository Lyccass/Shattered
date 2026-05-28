import { describe, expect, it, vi } from 'vitest';
import { createEditorMap, type EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import { EditorNpcToolController } from './EditorNpcToolController';

function createHarness(initialHover: { x: number; y: number } | null = { x: 3, y: 4 }) {
  let map: EditorMapDefinition = createEditorMap(10, 10, 'grass');
  let hoverTile = initialHover;
  const dirtyTiles: Array<{ x: number; y: number }> = [];
  const statuses: string[] = [];
  const onChanged = vi.fn();
  const snapshot = vi.fn();
  const controller = new EditorNpcToolController({
    getHoverTile: () => hoverTile,
    getMap: () => map,
    markTileDirty: (x, y) => { dirtyTiles.push({ x, y }); },
    onChanged,
    setMap: (nextMap) => { map = nextMap; },
    setStatus: (message) => { statuses.push(message); },
    snapshot,
  });

  return {
    controller,
    dirtyTiles,
    getMap: () => map,
    onChanged,
    setHover: (tile: { x: number; y: number } | null) => { hoverTile = tile; },
    snapshot,
    statuses,
  };
}

describe('EditorNpcToolController', () => {
  it('places the selected NPC at the hover tile and marks it dirty', () => {
    const harness = createHarness({ x: 3, y: 4 });

    harness.controller.placeAtHover();

    expect(harness.getMap().npcAnchors).toEqual([
      expect.objectContaining({
        id: 'npc_3_4',
        tileX: 3,
        tileY: 4,
        definitionId: harness.controller.getSelectedDefinitionId(),
      }),
    ]);
    expect(harness.dirtyTiles).toEqual([{ x: 3, y: 4 }]);
    expect(harness.snapshot).toHaveBeenCalledTimes(1);
    expect(harness.onChanged).toHaveBeenCalledTimes(1);
  });

  it('does not place two NPCs on one tile', () => {
    const harness = createHarness({ x: 3, y: 4 });

    harness.controller.placeAtHover();
    harness.controller.placeAtHover();

    expect(harness.getMap().npcAnchors).toHaveLength(1);
    expect(harness.statuses.at(-1)).toBe('An NPC is already placed at this tile.');
    expect(harness.snapshot).toHaveBeenCalledTimes(1);
  });

  it('removes an NPC at the hover tile', () => {
    const harness = createHarness({ x: 3, y: 4 });

    harness.controller.placeAtHover();
    harness.controller.removeAtHover();

    expect(harness.getMap().npcAnchors).toEqual([]);
    expect(harness.dirtyTiles).toEqual([{ x: 3, y: 4 }, { x: 3, y: 4 }]);
    expect(harness.statuses.at(-1)).toBe('Removed NPC at 3, 4.');
  });

  it('ignores unknown NPC definition selections', () => {
    const harness = createHarness();
    const originalId = harness.controller.getSelectedDefinitionId();

    harness.controller.setSelectedDefinitionId('missing_npc');

    expect(harness.controller.getSelectedDefinitionId()).toBe(originalId);
    expect(harness.onChanged).not.toHaveBeenCalled();
  });
});
