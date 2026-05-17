import { describe, expect, it } from 'vitest';
import { LocalSaveService, LOCAL_SAVE_STORAGE_KEY } from '../../persistence/LocalSaveService';
import {
  createPrototypeSaveV1,
} from '../../persistence/PrototypeSaveV1';
import { resolvePrototypeRestoreMap, resolvePrototypeRestoreTile } from '../../persistence/RestoreSafety';
import type { SaveGameV1 } from '../../persistence/SaveTypes';
import { PlayerSessionState } from '../../player/PlayerSessionState';
import { WorldSessionState } from '../session/WorldSessionState';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('Local Persistence v0', () => {
  it('saves plain JSON to localStorage using the prototype save key', () => {
    const storage = new MemoryStorage();
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, storage);
    const playerSessionState = new PlayerSessionState();
    const worldSessionState = new WorldSessionState();

    playerSessionState.getInventoryState().add('wood', 3);

    const save = createPrototypeSaveV1({
      playerSessionState,
      worldSessionState,
      currentMapId: 'test_home_island',
      playerTile: { tileX: 12, tileY: 14 },
      nowMs: 1_000,
    });

    expect(service.save(save)).toEqual({ ok: true });
    expect(JSON.parse(storage.getItem(LOCAL_SAVE_STORAGE_KEY) ?? '')).toEqual(save);
  });

  it('returns no_save when no browser save exists', () => {
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, new MemoryStorage());

    expect(service.load()).toEqual({ status: 'no_save' });
  });

  it('fails safely when stored JSON is invalid', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_SAVE_STORAGE_KEY, '{bad json');
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, storage);
    const result = service.load();

    expect(result.status).toBe('invalid_json');
  });

  it('fails safely when stored save version is unsupported', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LOCAL_SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        savedAt: 123,
      }),
    );
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, storage);

    expect(service.load()).toEqual({
      status: 'unsupported_version',
      version: 999,
    });
  });

  it('loads and validates a valid stored save', () => {
    const storage = new MemoryStorage();
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, storage);
    const playerSessionState = new PlayerSessionState();
    const worldSessionState = new WorldSessionState();

    playerSessionState.getInventoryState().add('herb', 2);
    playerSessionState.getCurrencyState().addCopper(155);

    const save = createPrototypeSaveV1({
      playerSessionState,
      worldSessionState,
      currentMapId: 'test_harbor',
      playerTile: { tileX: 8, tileY: 10 },
      nowMs: 5_000,
    });

    storage.setItem(LOCAL_SAVE_STORAGE_KEY, JSON.stringify(save));

    expect(service.load()).toEqual({
      status: 'success',
      saveGame: save,
    });
  });

  it('clears the stored save and reports no_save afterwards', () => {
    const storage = new MemoryStorage();
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, storage);
    const save: SaveGameV1 = {
      version: 1,
      savedAt: 100,
      playerState: {
        currentWorldId: 'the_wake',
        currentMapId: 'test_home_island',
        playerTile: { tileX: 5, tileY: 5 },
        resources: {},
        items: {},
        currency: {},
        reputation: {},
        skillXp: {},
        journal: {
          acceptedContractIds: [],
          completedNonRepeatableContractIds: [],
          contractCompletionCounts: {},
        },
        activeEffects: [],
      },
      personalIslandState: {
        islandId: 'player_home_island',
        persistentPlacedObjects: [],
        terrainEdits: [],
        buildings: [],
        storage: {},
      },
      worldMapSnapshot: {
        worldId: 'the_wake',
        changedRegions: {},
      },
    };

    service.save(save);
    expect(service.hasSave()).toBe(true);
    expect(service.clearSave()).toBe(true);
    expect(service.hasSave()).toBe(false);
    expect(service.load()).toEqual({ status: 'no_save' });
  });

  it('reads a safe summary from a valid stored save', () => {
    const storage = new MemoryStorage();
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, storage);
    const playerSessionState = new PlayerSessionState();
    const worldSessionState = new WorldSessionState();

    playerSessionState.getCurrencyState().addCopper(12_345);
    playerSessionState.getSkillProgressionSystem().addXp('gathering', 10);
    playerSessionState.getSkillProgressionSystem().addXp('trade', 5);

    const save = createPrototypeSaveV1({
      playerSessionState,
      worldSessionState,
      currentMapId: 'test_wild_island',
      playerTile: { tileX: 21, tileY: 33 },
      nowMs: 9_000,
    });

    service.save(save);

    expect(service.getSaveSummary()).toEqual({
      savedAt: 9_000,
      currentWorldId: 'the_wake',
      currentMapId: 'test_wild_island',
      playerTile: { tileX: 21, tileY: 33 },
      totalCopperEquivalent: 12_345,
      totalSkillXp: 15,
    });
  });

  it('falls back safely when a saved map id is unavailable', () => {
    expect(
      resolvePrototypeRestoreMap({
        savedMapId: 'missing_map',
        defaultMapId: 'test_home_island',
        hasMap: (mapId) => mapId === 'test_home_island',
      }),
    ).toEqual({
      mapId: 'test_home_island',
      usedFallbackMap: true,
      warningMessage: 'Saved map "missing_map" is unavailable. Loaded test_home_island instead.',
    });
  });

  it('falls back safely when a saved tile is invalid', () => {
    expect(
      resolvePrototypeRestoreTile({
        savedTile: { tileX: 999, tileY: 999 },
        isTileValid: () => false,
      }),
    ).toEqual({
      playerTile: null,
      usedFallbackSpawn: true,
      warningMessage: 'Saved tile 999,999 is invalid. Spawn fallback used instead.',
    });
  });

  it('does not persist temporary deployables into the stored JSON', () => {
    const storage = new MemoryStorage();
    const service = new LocalSaveService(LOCAL_SAVE_STORAGE_KEY, storage);
    const playerSessionState = new PlayerSessionState();
    const worldSessionState = new WorldSessionState();

    worldSessionState.addPlacedObject({
      id: 'temp_firestarter_01',
      mapId: 'test_home_island',
      tileX: 12,
      tileY: 12,
      objectDefinitionId: 'placed_firestarter_set',
      kind: 'placed_firestarter_set',
      despawnAtMs: 9_000,
    });
    worldSessionState.addPlacedObject({
      id: 'temp_campfire_01',
      mapId: 'test_home_island',
      tileX: 13,
      tileY: 12,
      objectDefinitionId: 'campfire',
      kind: 'campfire',
      despawnAtMs: 9_500,
    });

    service.save(
      createPrototypeSaveV1({
        playerSessionState,
        worldSessionState,
        currentMapId: 'test_home_island',
        playerTile: { tileX: 10, tileY: 10 },
        nowMs: 1_000,
      }),
    );

    const raw = storage.getItem(LOCAL_SAVE_STORAGE_KEY) ?? '';
    expect(raw).not.toContain('temp_firestarter_01');
    expect(raw).not.toContain('temp_campfire_01');
  });
});
