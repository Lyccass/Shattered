import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_ID,
  type SaveGameV1,
} from '../../persistence/SaveTypes';
import {
  createPrototypeSaveV1,
  restorePrototypeSaveV1,
} from '../../persistence/PrototypeSaveV1';
import { PlayerSessionState } from '../../player/PlayerSessionState';
import { WorldSessionState } from '../session/WorldSessionState';

describe('Persistence Prep v0', () => {
  it('creates a plain JSON player save snapshot with open string-id inventory records', () => {
    const playerSessionState = new PlayerSessionState();
    const worldSessionState = new WorldSessionState();

    playerSessionState.getInventoryState().add('wood', 3);
    playerSessionState.getInventoryState().add('sea_salt', 7);
    playerSessionState.getInventoryState().add('warm_tea', 2);
    playerSessionState.getInventoryState().add('prototype_token', 4);
    playerSessionState.getCurrencyState().addCopper(155);
    playerSessionState.getReputationState().addHarborReputation(6);
    playerSessionState.getSkillProgressionSystem().addXp('woodworking', 15);
    playerSessionState.acceptContract('warmth_for_the_dockhands');
    playerSessionState.completeContract('camp_supplies', false);
    playerSessionState.getEffectSystem().applyEffect('warm_tea_warmth', 1_000);

    const save = createPrototypeSaveV1({
      playerSessionState,
      worldSessionState,
      currentMapId: 'test_home_island',
      playerTile: { tileX: 14, tileY: 17 },
      nowMs: 1_100,
    });

    expect(JSON.parse(JSON.stringify(save))).toEqual(save);
    expect(save.playerState.currentWorldId).toBe(DEFAULT_WORLD_ID);
    expect(save.playerState.items.wood).toBe(3);
    expect(save.playerState.items.sea_salt).toBe(7);
    expect(save.playerState.items.warm_tea).toBe(2);
    expect(save.playerState.items.prototype_token).toBe(4);
    expect(save.playerState.currency.copper).toBe(55);
    expect(save.playerState.currency.silver).toBe(1);
    expect(save.playerState.reputation.harborReputation).toBe(6);
    expect(save.playerState.skillXp.woodworking).toBe(15);
    expect(save.playerState.journal.acceptedContractIds).toContain('warmth_for_the_dockhands');
    expect(save.playerState.journal.completedNonRepeatableContractIds).toContain('camp_supplies');
    expect(save.playerState.activeEffects).toEqual([
      { effectId: 'warm_tea_warmth', remainingMs: 59_900 },
    ]);
  });

  it('restores player inventory, currency, reputation, skills, journal, and effects from save state', () => {
    const originalPlayer = new PlayerSessionState();
    const originalWorld = new WorldSessionState();

    originalPlayer.getInventoryState().add('wood', 5);
    originalPlayer.getInventoryState().add('stone', 2);
    originalPlayer.getInventoryState().add('prototype_token', 3);
    originalPlayer.getCurrencyState().addCopper(10_255);
    originalPlayer.getReputationState().addHarborReputation(4);
    originalPlayer.getSkillProgressionSystem().addXp('woodworking', 20);
    originalPlayer.getSkillProgressionSystem().addXp('trade', 8);
    originalPlayer.acceptContract('warmth_for_the_dockhands');
    originalPlayer.completeContract('camp_supplies', false);
    originalPlayer.getEffectSystem().applyEffect('warm_tea_warmth', 500);

    const save = createPrototypeSaveV1({
      playerSessionState: originalPlayer,
      worldSessionState: originalWorld,
      currentMapId: 'test_harbor',
      playerTile: { tileX: 11, tileY: 15 },
      nowMs: 1_000,
    });

    const restoredPlayer = new PlayerSessionState();
    const restoredWorld = new WorldSessionState();
    const restoreResult = restorePrototypeSaveV1(save, {
      playerSessionState: restoredPlayer,
      worldSessionState: restoredWorld,
      nowMs: 2_000,
    });

    expect(restoreResult.ok).toBe(true);
    expect(restoredPlayer.getInventoryState().getCount('wood')).toBe(5);
    expect(restoredPlayer.getInventoryState().getCount('stone')).toBe(2);
    expect(restoredPlayer.getInventoryState().getCount('prototype_token')).toBe(3);
    expect(restoredPlayer.getCurrencySnapshot()).toEqual({
      copper: 55,
      silver: 2,
      gold: 1,
      platinum: 0,
    });
    expect(restoredPlayer.getReputationSnapshot()).toEqual({ harborReputation: 4 });
    expect(restoredPlayer.getSkillProgressionSystem().getXp('woodworking')).toBe(20);
    expect(restoredPlayer.getSkillProgressionSystem().getXp('trade')).toBe(8);
    expect(restoredPlayer.isContractAccepted('warmth_for_the_dockhands')).toBe(true);
    expect(restoredPlayer.isContractCompletedNonRepeatable('camp_supplies')).toBe(true);
    expect(restoredPlayer.getActiveEffects(2_000)).toEqual([
      { id: 'warm_tea_warmth', displayName: 'Warmth', remainingMs: 59_500 },
    ]);
  });

  it('discards expired active effects safely during restore', () => {
    const save: SaveGameV1 = {
      version: 1,
      savedAt: 5_000,
      playerState: {
        currentWorldId: DEFAULT_WORLD_ID,
        currentMapId: 'test_home_island',
        playerTile: { tileX: 10, tileY: 10 },
        resources: {},
        items: {},
        currency: {},
        reputation: {},
        skillXp: {},
        journal: {
          acceptedContractIds: [],
          completedNonRepeatableContractIds: [],
          contractCompletionCounts: {},
          quests: {
            activeQuests: {},
            completedQuestIds: [],
            questCompletionCounts: {},
          },
        },
        activeEffects: [
          { effectId: 'warm_tea_warmth', remainingMs: 0 },
        ],
      },
      personalIslandState: {
        islandId: 'player_home_island',
        persistentPlacedObjects: [],
        terrainEdits: [],
        buildings: [],
        storage: {},
      },
      worldMapSnapshot: {
        worldId: DEFAULT_WORLD_ID,
        changedRegions: {},
      },
    };

    const restoredPlayer = new PlayerSessionState();
    const restoredWorld = new WorldSessionState();
    const restoreResult = restorePrototypeSaveV1(save, {
      playerSessionState: restoredPlayer,
      worldSessionState: restoredWorld,
      nowMs: 6_000,
    });

    expect(restoreResult.ok).toBe(true);
    expect(restoredPlayer.getActiveEffects(6_000)).toEqual([]);
  });

  it('stores sparse changed world chunks only for future resource respawns', () => {
    const save = createPrototypeSaveV1({
      playerSessionState: new PlayerSessionState(),
      worldSessionState: (() => {
        const state = new WorldSessionState();
        state.setResourceRespawnAt('the_wake', 'the_wake:0,0:resource:pine_01', 5_000);
        state.setResourceRespawnAt('the_wake', 'the_wake:0,0:resource:stone_01', 8_000);
        state.setResourceRespawnAt('the_wake', 'the_wake:0,0:resource:copper_01', 500);
        state.addPlacedObject({
          id: 'temp_firestarter_01',
          mapId: 'test_home_island',
          tileX: 12,
          tileY: 12,
          objectDefinitionId: 'placed_firestarter_set',
          kind: 'placed_firestarter_set',
          despawnAtMs: 9_000,
        });
        state.addPlacedObject({
          id: 'temp_campfire_01',
          mapId: 'test_home_island',
          tileX: 13,
          tileY: 12,
          objectDefinitionId: 'campfire',
          kind: 'campfire',
          despawnAtMs: 9_500,
        });
        return state;
      })(),
      currentMapId: 'test_harbor',
      playerTile: { tileX: 10, tileY: 15 },
      nowMs: 1_000,
    });

    expect(Object.keys(save.worldMapSnapshot.changedRegions)).toEqual(['the_wake']);
    expect(Object.keys(save.worldMapSnapshot.changedRegions.the_wake.changedChunks)).toEqual([
      '0,0',
    ]);
    expect(
      save.worldMapSnapshot.changedRegions.the_wake.changedChunks['0,0'].depletedResources,
    ).toEqual({
      'the_wake:0,0:resource:pine_01': { respawnAt: 5_000 },
      'the_wake:0,0:resource:stone_01': { respawnAt: 8_000 },
    });
    expect(JSON.stringify(save.worldMapSnapshot)).not.toContain('temp_firestarter_01');
    expect(JSON.stringify(save.worldMapSnapshot)).not.toContain('temp_campfire_01');
  });

  it('restores future resource depletion, drops expired depletion, and does not restore temporary deployables', () => {
    const worldSessionState = new WorldSessionState();
    const save: SaveGameV1 = {
      version: 1,
      savedAt: 1_000,
      playerState: {
        currentWorldId: DEFAULT_WORLD_ID,
        currentMapId: 'test_harbor',
        playerTile: { tileX: 10, tileY: 15 },
        resources: {},
        items: {},
        currency: {},
        reputation: {},
        skillXp: {},
        journal: {
          acceptedContractIds: [],
          completedNonRepeatableContractIds: [],
          contractCompletionCounts: {},
          quests: {
            activeQuests: {},
            completedQuestIds: [],
            questCompletionCounts: {},
          },
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
        worldId: DEFAULT_WORLD_ID,
        changedRegions: {
          the_wake: {
            regionId: 'the_wake',
            changedChunks: {
              '0,0': {
                chunkKey: '0,0',
                depletedResources: {
                  'the_wake:0,0:resource:pine_01': { respawnAt: 7_000 },
                },
              },
            },
          },
          expired_region: {
            regionId: 'expired_region',
            changedChunks: {
              '0,0': {
                chunkKey: '0,0',
                depletedResources: {
                  'expired_region:0,0:resource:herb_01': { respawnAt: 500 },
                },
              },
            },
          },
        },
      },
    };

    const restoreResult = restorePrototypeSaveV1(save, {
      playerSessionState: new PlayerSessionState(),
      worldSessionState,
      nowMs: 1_000,
    });

    expect(restoreResult.ok).toBe(true);
    expect(worldSessionState.getResourceRespawnAt('the_wake', 'the_wake:0,0:resource:pine_01')).toBe(7_000);
    expect(worldSessionState.getResourceRespawnAt('expired_region', 'expired_region:0,0:resource:herb_01')).toBeNull();
    expect(worldSessionState.getPlacedObjectsSnapshot('test_home_island')).toEqual([]);
  });

  it('fails safely on malformed snapshots without mutating existing runtime state', () => {
    const playerSessionState = new PlayerSessionState();
    const worldSessionState = new WorldSessionState();

    playerSessionState.getInventoryState().add('wood', 2);
    worldSessionState.setResourceRespawnAt('test_harbor', 'harbor_driftwood_gather_01', 9_000);

    const restoreResult = restorePrototypeSaveV1(
      {
        version: 1,
        savedAt: 'bad',
      },
      {
        playerSessionState,
        worldSessionState,
        nowMs: 2_000,
      },
    );

    expect(restoreResult.ok).toBe(false);
    if (!restoreResult.ok) {
      expect(restoreResult.error).toContain('savedAt');
    }
    expect(playerSessionState.getInventoryState().getCount('wood')).toBe(2);
    expect(worldSessionState.getResourceRespawnAt('test_harbor', 'harbor_driftwood_gather_01')).toBe(9_000);
  });
});
