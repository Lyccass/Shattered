import { describe, expect, it, vi } from 'vitest';
import { createEditorMap, type EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import { EditorEncounterToolController } from './EditorEncounterToolController';

function createHarness(initialHover: { x: number; y: number } | null = { x: 2, y: 3 }) {
  let map: EditorMapDefinition = createEditorMap(10, 10, 'grass');
  let hoverTile = initialHover;
  const dirtyChunks: Array<{ chunkX: number; chunkY: number }> = [];
  const statuses: string[] = [];
  const onChanged = vi.fn();
  const snapshot = vi.fn();
  const controller = new EditorEncounterToolController({
    getHoverTile: () => hoverTile,
    getMap: () => map,
    markChunkDirty: (chunk) => { dirtyChunks.push(chunk); },
    onChanged,
    setMap: (nextMap) => { map = nextMap; },
    setStatus: (message) => { statuses.push(message); },
    snapshot,
  });

  return {
    controller,
    dirtyChunks,
    getMap: () => map,
    onChanged,
    setHover: (tile: { x: number; y: number } | null) => { hoverTile = tile; },
    snapshot,
    statuses,
  };
}

describe('EditorEncounterToolController', () => {
  it('creates an encounter area at the hover tile and marks the owning chunk dirty', () => {
    const harness = createHarness({ x: 2, y: 3 });

    harness.controller.createAreaAtHover();

    expect(harness.getMap().encounterAreas).toHaveLength(1);
    expect(harness.getMap().encounterAreas[0]).toEqual(expect.objectContaining({
      tileX: 2,
      tileY: 3,
      width: 8,
      height: 7,
    }));
    expect(harness.controller.getSelection().selectedAreaId).toBe(harness.getMap().encounterAreas[0].id);
    expect(harness.dirtyChunks).toEqual([{ chunkX: 0, chunkY: 0 }]);
    expect(harness.snapshot).toHaveBeenCalledTimes(1);
    expect(harness.onChanged).toHaveBeenCalledTimes(1);
  });

  it('creates a dragged encounter rectangle and selects it', () => {
    const harness = createHarness({ x: 1, y: 2 });

    harness.controller.beginStroke();
    harness.setHover({ x: 4, y: 6 });
    harness.controller.endStroke();

    const area = harness.getMap().encounterAreas[0];
    expect(area).toEqual(expect.objectContaining({
      tileX: 1,
      tileY: 2,
      width: 4,
      height: 5,
    }));
    expect(harness.controller.getSelection().selectedAreaId).toBe(area.id);
  });

  it('only adds manual spawns inside the selected encounter area', () => {
    const harness = createHarness({ x: 2, y: 2 });
    harness.controller.createAreaAtHover();

    harness.setHover({ x: 4, y: 4 });
    harness.controller.addManualSpawnAtHover();

    expect(harness.getMap().encounterAreas[0].manualSpawns).toHaveLength(1);

    harness.setHover({ x: 0, y: 0 });
    harness.controller.addManualSpawnAtHover();

    expect(harness.getMap().encounterAreas[0].manualSpawns).toHaveLength(1);
    expect(harness.statuses.at(-1)).toBe('Manual spawn must be inside the selected encounter area.');
  });
});
