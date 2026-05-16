import { describe, expect, it } from 'vitest';
import { MapTransitionSystem, getTransitionFootprintTiles, isTileInsideTransition } from '../maps/MapTransitionSystem';
import type { MapTransition } from '../maps/MapTypes';

function makeTransition(overrides: Partial<MapTransition> = {}): MapTransition {
  return {
    id: 'test_transition',
    fromTile: { tileX: 10, tileY: 12 },
    targetMapId: 'target_map',
    targetSpawnId: 'target_spawn',
    transitionType: 'debug',
    ...overrides,
  };
}

describe('MapTransitionSystem', () => {
  it('matches a single-tile transition when the player stands on its source tile', () => {
    const transition = makeTransition();
    const system = new MapTransitionSystem();

    system.setTransitions([transition]);

    expect(system.getTransitionAtTile(10, 12)).toBe(transition);
    expect(isTileInsideTransition(transition, 10, 12)).toBe(true);
  });

  it('returns null when the player tile is outside the transition footprint', () => {
    const transition = makeTransition();
    const system = new MapTransitionSystem();

    system.setTransitions([transition]);

    expect(system.getTransitionAtTile(9, 12)).toBeNull();
    expect(isTileInsideTransition(transition, 9, 12)).toBe(false);
  });

  it('supports multi-tile footprints', () => {
    const transition = makeTransition({
      triggerFootprint: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    });
    const system = new MapTransitionSystem();

    system.setTransitions([transition]);

    expect(system.getTransitionAtTile(10, 12)).toBe(transition);
    expect(system.getTransitionAtTile(11, 12)).toBe(transition);
    expect(system.getTransitionAtTile(10, 13)).toBe(transition);
    expect(system.getTransitionAtTile(11, 13)).toBeNull();
  });

  it('returns the correct target map and spawn data for the active transition', () => {
    const transition = makeTransition({
      id: 'harbor_gate',
      targetMapId: 'test_harbor',
      targetSpawnId: 'dock',
      triggerFootprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    });
    const system = new MapTransitionSystem();

    system.setTransitions([transition]);

    const activeTransition = system.updateActiveTransition(11, 12);

    expect(activeTransition?.id).toBe('harbor_gate');
    expect(activeTransition?.targetMapId).toBe('test_harbor');
    expect(activeTransition?.targetSpawnId).toBe('dock');
  });

  it('expands footprint tiles from the source tile and offsets', () => {
    const transition = makeTransition({
      fromTile: { tileX: 3, tileY: 4 },
      triggerFootprint: [{ x: 0, y: 0 }, { x: 2, y: 1 }],
    });

    expect(getTransitionFootprintTiles(transition)).toEqual([
      { x: 3, y: 4 },
      { x: 5, y: 5 },
    ]);
  });
});
