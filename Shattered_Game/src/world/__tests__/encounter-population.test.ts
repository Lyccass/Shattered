import { describe, expect, it } from 'vitest';
import { WorldEncounterPopulationTracker } from '../../combat/WorldEncounterPopulationTracker';
import type { RuntimeEnemySpawn } from '../../world/maps/MapRuntime';
import { synthesizeEditorAreaSpawns } from '../../world/maps/WorldEncounterSpawnBridge';
import { createEditorEncounterArea } from '../../shared/editor/EditorEncounterModel';

function makeSpawn(id: string, areaId?: string): RuntimeEnemySpawn {
  return { id, definitionId: 'wolf_aggressive', mapId: 'test', tileX: 0, tileY: 0, areaId };
}

describe('WorldEncounterPopulationTracker', () => {
  it('reports full alive count after registering spawns', () => {
    const tracker = new WorldEncounterPopulationTracker();
    tracker.registerSpawns([makeSpawn('s1', 'area_a'), makeSpawn('s2', 'area_a'), makeSpawn('s3', 'area_b')]);

    expect(tracker.getAliveCount('area_a')).toBe(2);
    expect(tracker.getAliveCount('area_b')).toBe(1);
    expect(tracker.getTotalCount('area_a')).toBe(2);
  });

  it('reduces alive count after a kill', () => {
    const tracker = new WorldEncounterPopulationTracker();
    tracker.registerSpawns([makeSpawn('s1', 'area_a'), makeSpawn('s2', 'area_a')]);
    tracker.recordKill('s1', 'area_a');

    expect(tracker.getAliveCount('area_a')).toBe(1);
    expect(tracker.isAreaCleared('area_a')).toBe(false);
  });

  it('marks area cleared when all enemies are defeated', () => {
    const tracker = new WorldEncounterPopulationTracker();
    tracker.registerSpawns([makeSpawn('s1', 'area_a'), makeSpawn('s2', 'area_a')]);
    tracker.recordKill('s1', 'area_a');
    tracker.recordKill('s2', 'area_a');

    expect(tracker.isAreaCleared('area_a')).toBe(true);
    expect(tracker.getClearedAreaIds()).toContain('area_a');
  });

  it('restores alive count after a respawn', () => {
    const tracker = new WorldEncounterPopulationTracker();
    tracker.registerSpawns([makeSpawn('s1', 'area_a')]);
    tracker.recordKill('s1', 'area_a');
    expect(tracker.isAreaCleared('area_a')).toBe(true);

    tracker.recordRespawn('s1', 'area_a');
    expect(tracker.isAreaCleared('area_a')).toBe(false);
    expect(tracker.getAliveCount('area_a')).toBe(1);
  });

  it('ignores spawns without areaId', () => {
    const tracker = new WorldEncounterPopulationTracker();
    tracker.registerSpawns([makeSpawn('s1', undefined), makeSpawn('s2', 'area_a')]);

    expect(tracker.getAreaIds()).toEqual(['area_a']);
    expect(tracker.getAliveCount('area_a')).toBe(1);
  });

  it('registerSpawns clears previous state', () => {
    const tracker = new WorldEncounterPopulationTracker();
    tracker.registerSpawns([makeSpawn('s1', 'area_a')]);
    tracker.recordKill('s1', 'area_a');
    tracker.registerSpawns([makeSpawn('s2', 'area_b')]);

    expect(tracker.getAreaIds()).toEqual(['area_b']);
    expect(tracker.isAreaCleared('area_a')).toBe(false);
  });
});

describe('areaId flows through synthesizeEditorAreaSpawns', () => {
  it('carries areaId from encounter area into RuntimeEnemySpawn for rule spawns', () => {
    const area = createEditorEncounterArea(0, 0, 'wolf_aggressive');
    area.id = 'zone_wolf_cave';
    area.spawnRules[0].maxPopulation = 2;

    const spawns = synthesizeEditorAreaSpawns([area], 'test_map');

    expect(spawns.every((s) => s.areaId === 'zone_wolf_cave')).toBe(true);
    expect(spawns.length).toBe(2);
  });

  it('offsets spawns from multiple rules so variants do not stack on the first tile', () => {
    const area = createEditorEncounterArea(10, 20, 'boar_passive');
    area.width = 4;
    area.height = 4;
    area.spawnRules = [
      {
        id: 'passive_boars',
        enemyDefinitionId: 'boar_passive',
        creatureFamilyId: 'boar',
        maxPopulation: 2,
        respawnMs: 60_000,
        weight: 1,
      },
      {
        id: 'aggressive_boar',
        enemyDefinitionId: 'boar_aggressive',
        creatureFamilyId: 'boar',
        maxPopulation: 1,
        respawnMs: 60_000,
        weight: 1,
      },
    ];

    const spawns = synthesizeEditorAreaSpawns([area], 'test_map');
    const occupiedTiles = new Set(spawns.map((spawn) => `${spawn.tileX},${spawn.tileY}`));

    expect(spawns).toHaveLength(3);
    expect(occupiedTiles.size).toBe(spawns.length);
  });
});
