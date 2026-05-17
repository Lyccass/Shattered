import { describe, expect, it } from 'vitest';
import { ActionProgressSystem } from '../../actions/ActionProgressSystem';
import type { SfxEventId, SfxEventPayload } from '../../audio/SfxTypes';
import type { GameEventBus } from '../../events/GameEventBus';
import type { InteractionResult } from '../../interactions/InteractionTypes';
import { WorldActionBroker } from '../maps/WorldActionBroker';
import { type RuntimePlacedObjectRecord, WorldSessionState } from '../session/WorldSessionState';

class FakeSfxEventBus {
  readonly emitted: SfxEventId[] = [];
  private readonly listeners = new Set<(payload: SfxEventPayload) => void>();

  emitSfx(id: SfxEventId): void {
    this.emitted.push(id);
    const payload: SfxEventPayload = { id };
    this.listeners.forEach((listener) => listener(payload));
  }

  onSfx(listener: (payload: SfxEventPayload) => void): void {
    this.listeners.add(listener);
  }

  offSfx(listener: (payload: SfxEventPayload) => void): void {
    this.listeners.delete(listener);
  }
}

describe('WorldSessionState', () => {
  it('stores resource respawn timestamps through explicit mutation methods only', () => {
    const state = new WorldSessionState();

    expect(state.getResourceRespawnAt('test_wild_island', 'herb_01')).toBeNull();

    state.setResourceRespawnAt('test_wild_island', 'herb_01', 12_345);

    expect(state.getResourceRespawnAt('test_wild_island', 'herb_01')).toBe(12_345);

    const snapshot = state.getResourceRespawnSnapshot('test_wild_island');
    snapshot.herb_01 = 99_999;

    expect(state.getResourceRespawnAt('test_wild_island', 'herb_01')).toBe(12_345);

    expect(state.clearResourceRespawnAt('test_wild_island', 'herb_01')).toBe(true);
    expect(state.getResourceRespawnAt('test_wild_island', 'herb_01')).toBeNull();
  });

  it('returns placed-object snapshots that cannot mutate internal state by accident', () => {
    const state = new WorldSessionState();
    const record: RuntimePlacedObjectRecord = {
      id: 'firestarter_01',
      mapId: 'test_home_island',
      tileX: 16,
      tileY: 17,
      objectDefinitionId: 'placed_firestarter_set',
      kind: 'placed_firestarter_set',
      despawnAtMs: 5_000,
    };

    state.addPlacedObject(record);

    const singleSnapshot = state.getPlacedObjectSnapshot('test_home_island', 'firestarter_01');
    expect(singleSnapshot).toBeDefined();
    singleSnapshot!.tileX = 99;

    const listSnapshot = state.getPlacedObjectsSnapshot('test_home_island');
    listSnapshot[0].tileY = 88;

    expect(state.getPlacedObjectSnapshot('test_home_island', 'firestarter_01')).toMatchObject({
      tileX: 16,
      tileY: 17,
      kind: 'placed_firestarter_set',
    });

    expect(
      state.updatePlacedObject('test_home_island', 'firestarter_01', {
        kind: 'campfire',
        objectDefinitionId: 'campfire',
        despawnAtMs: 9_000,
      }),
    ).toBe(true);
    expect(state.getPlacedObjectSnapshot('test_home_island', 'firestarter_01')).toMatchObject({
      kind: 'campfire',
      objectDefinitionId: 'campfire',
      despawnAtMs: 9_000,
    });

    expect(state.removePlacedObject('test_home_island', 'firestarter_01')).toBe(true);
    expect(state.getPlacedObjectSnapshot('test_home_island', 'firestarter_01')).toBeUndefined();
  });
});

describe('WorldActionBroker', () => {
  it('emits structured SFX ids without relying on result messages', () => {
    const eventBus = new FakeSfxEventBus();
    const broker = new WorldActionBroker(
      new ActionProgressSystem(),
      eventBus as unknown as GameEventBus,
      () => undefined,
    );

    const result: InteractionResult = {
      ok: true,
      interactionType: 'contract_board',
      targetId: 'warmth_for_the_dockhands',
      message: 'This message should not matter for SFX routing.',
      sfxId: 'contract_completed',
      xpDelta: { trade: 10 },
    };

    broker.emitResultSfx(result);

    expect(eventBus.emitted).toEqual(['contract_completed', 'xp_gain']);
  });
});
