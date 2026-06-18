import { describe, expect, it } from 'vitest';
import { PlayerSessionState } from '../player/PlayerSessionState';
import { QUEST_DEFINITIONS } from './QuestDefinitions';
import { validateQuestDefinitions } from './QuestDefinitionValidation';
import { QuestRegistry } from './QuestRegistry';
import { QuestSystem } from './QuestSystem';
import type { QuestDefinition } from './QuestTypes';

const TEST_QUEST: QuestDefinition = {
  id: 'test_shattered_seal',
  displayName: 'The Shattered Seal',
  description: 'A tiny test quest with combat and delivery beats.',
  start: {
    npcId: 'island_hermit',
    dialogue: 'The seal remembers what broke it.',
  },
  phases: [
    {
      id: 'break_the_echo',
      title: 'Break the Echo',
      journalHint: 'Defeat two training wretches while carrying the sealed blade.',
      completedLog: 'I broke the echo around the seal.',
      turnInNpcId: 'island_hermit',
      objectives: [
        {
          id: 'kill_wretches',
          kind: 'kill_with_item',
          enemyId: 'training_wretch',
          itemId: 'sealed_blade',
          count: 2,
          journalHint: 'Kill training wretches with the sealed blade nearby.',
          completedLog: 'Two wretches fell to the sealed blade.',
        },
      ],
    },
    {
      id: 'return_the_tea',
      title: 'Return the Tea',
      journalHint: 'Bring warm tea to the hermit.',
      completedLog: 'I brought warm tea to the hermit.',
      objectives: [
        {
          id: 'deliver_tea',
          kind: 'deliver_item_to',
          npcId: 'island_hermit',
          itemId: 'warm_tea',
          count: 1,
          journalHint: 'Bring one warm tea to the hermit.',
          completedLog: 'The hermit accepted the warm tea.',
        },
      ],
    },
  ],
  rewards: {
    copper: 25,
    harborReputation: 2,
    itemDelta: { wooden_marker: 1 },
    xpRewards: { melee: 15, trade: 5 },
    unlocks: [
      { kind: 'recipe', unlockId: 'seal_lantern', displayName: 'Seal Lantern' },
      { kind: 'place', unlockId: 'old_shrine_path', displayName: 'Old Shrine Path' },
    ],
  },
};

const BRANCHING_QUEST: QuestDefinition = {
  id: 'test_branching_quest',
  displayName: 'A Branch in the Road',
  description: 'A quest with item combining and alternative completion.',
  start: {
    npcId: 'island_hermit',
    dialogue: 'Choose the road you can survive.',
  },
  phases: [
    {
      id: 'prepare_charm',
      title: 'Prepare Charm',
      journalHint: 'Use the broken charm on the silver wire.',
      completedLog: 'I repaired the charm.',
      objectives: [
        {
          id: 'combine_charm',
          kind: 'use_item_on',
          itemId: 'broken_charm',
          target: { kind: 'item', itemId: 'silver_wire' },
          journalHint: 'Use the broken charm on silver wire.',
          completedLog: 'The charm holds together now.',
        },
      ],
    },
    {
      id: 'settle_debt',
      title: 'Settle Debt',
      journalHint: 'Pay the hermit or clear the cave.',
      completedLog: 'I settled the debt one way or another.',
      objectives: [
        {
          id: 'pay_or_fight',
          kind: 'any_of',
          journalHint: 'Pay 10,000 copper or kill two cave wretches.',
          completedLog: 'The debt is settled.',
          options: [
            {
              id: 'pay_hermit',
              kind: 'pay_currency_to',
              npcId: 'island_hermit',
              copper: 10_000,
              journalHint: 'Pay 10,000 copper to the hermit.',
              completedLog: 'I paid the hermit.',
            },
            {
              id: 'clear_cave',
              kind: 'kill_count_at',
              enemyId: 'training_wretch',
              mapId: 'cave_map',
              areaId: 'wormbrain_cave',
              count: 2,
              journalHint: 'Kill two wretches in Wormbrain Cave.',
              completedLog: 'I cleared Wormbrain Cave.',
            },
          ],
        },
      ],
    },
  ],
};

const SPELL_QUEST: QuestDefinition = {
  id: 'test_spell_quest',
  displayName: 'A Small Working',
  description: 'A quest about utility spell use.',
  start: {
    npcId: 'island_hermit',
    dialogue: 'Magic is just a door with manners.',
  },
  phases: [
    {
      id: 'mark_and_step',
      title: 'Mark and Step',
      journalHint: 'Cast Homeward Mark, then cast Waystep at the old bridge.',
      completedLog: 'I marked a safe place and stepped through the old bridge path.',
      objectives: [
        {
          id: 'cast_mark',
          kind: 'cast_spell',
          spellId: 'utility_homeward_mark',
          journalHint: 'Cast Homeward Mark.',
          completedLog: 'I set a Homeward Mark.',
        },
        {
          id: 'waystep_bridge',
          kind: 'cast_spell_at',
          spellId: 'utility_waystep',
          mapId: 'harbor_map',
          tile: { tileX: 4, tileY: 8 },
          journalHint: 'Cast Waystep at the old bridge.',
          completedLog: 'I cast Waystep at the old bridge.',
        },
      ],
    },
  ],
};

describe('QuestSystem', () => {
  it('ships valid cloneable quest definitions', () => {
    expect(validateQuestDefinitions(QUEST_DEFINITIONS)).toEqual({ ok: true });
    expect(new QuestRegistry(QUEST_DEFINITIONS).get('the_first_mark')).toMatchObject({
      displayName: 'The First Mark',
      phases: [
        expect.objectContaining({ id: 'make_a_spark' }),
        expect.objectContaining({ id: 'settle_the_lesson' }),
      ],
    });
  });

  it('plays the first example quest through the warm tea branch', () => {
    const player = new PlayerSessionState();
    const system = new QuestSystem(new QuestRegistry(QUEST_DEFINITIONS));

    player.getInventoryState().add('warm_tea', 1);

    expect(system.acceptQuest('the_first_mark', player, 'island_hermit')).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest started: The First Mark'),
    });

    expect(system.recordUseItemOn({
      itemId: 'wood',
      target: { kind: 'item', itemId: 'stone' },
    }, player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Return to island hermit'),
    });

    expect(system.recordNpcInteraction('island_hermit', player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Settle the lesson'),
    });

    expect(system.recordNpcInteraction('island_hermit', player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest complete: The First Mark'),
      currencyDelta: { copper: 20 },
      reputationDelta: { harborReputation: 1 },
      itemDelta: { wooden_marker: 1 },
      xpDelta: { woodworking: 45, alchemy: 15, trade: 10 },
    });

    expect(player.isQuestCompleted('the_first_mark')).toBe(true);
    expect(player.getInventoryState().hasAtLeast('warm_tea', 1)).toBe(false);
    expect(player.getInventoryState().hasAtLeast('wooden_marker', 1)).toBe(true);
    expect(player.getCurrencyState().getTotalCopperValue()).toBe(20);
    expect(player.getReputationSnapshot().harborReputation).toBe(1);
  });

  it('plays the first example quest through the copper branch', () => {
    const player = new PlayerSessionState();
    const system = new QuestSystem(new QuestRegistry(QUEST_DEFINITIONS));

    player.getCurrencyState().addCopper(10);
    player.getInventoryState().add('warm_tea', 1);
    system.acceptQuest('the_first_mark', player, 'island_hermit');
    system.recordUseItemOn({
      itemId: 'wood',
      target: { kind: 'item', itemId: 'stone' },
    }, player);
    system.recordNpcInteraction('island_hermit', player);

    expect(system.recordNpcInteraction('island_hermit', player, 'the_first_mark', 'pay_small_offering')).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest complete: The First Mark'),
    });
    expect(player.getCurrencyState().getTotalCopperValue()).toBe(20);
    expect(player.getInventoryState().hasAtLeast('warm_tea', 1)).toBe(true);
  });

  it('tracks phased objectives and grants end rewards', () => {
    const player = new PlayerSessionState();
    const system = new QuestSystem(new QuestRegistry([TEST_QUEST]));

    player.getInventoryState().add('sealed_blade', 1);
    player.getInventoryState().add('warm_tea', 1);

    expect(system.acceptQuest('test_shattered_seal', player, 'island_hermit')).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest started: The Shattered Seal'),
    });

    expect(system.recordEnemyKilled({ enemyId: 'training_wretch' }, player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest updated: The Shattered Seal'),
    });

    expect(system.recordEnemyKilled({ enemyId: 'training_wretch' }, player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Return to island hermit'),
    });

    expect(system.recordNpcInteraction('island_hermit', player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Bring warm tea'),
    });

    expect(player.getInventoryState().hasAtLeast('warm_tea', 1)).toBe(true);

    expect(system.recordNpcInteraction('island_hermit', player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest complete: The Shattered Seal'),
      currencyDelta: { copper: 25 },
      reputationDelta: { harborReputation: 2 },
      itemDelta: { wooden_marker: 1 },
      xpDelta: { melee: 15, trade: 5 },
    });

    expect(player.isQuestCompleted('test_shattered_seal')).toBe(true);
    expect(player.getInventoryState().hasAtLeast('warm_tea', 1)).toBe(false);
    expect(player.getInventoryState().hasAtLeast('wooden_marker', 1)).toBe(true);
    expect(player.getCurrencySnapshot().copper).toBe(25);
    expect(player.getReputationSnapshot().harborReputation).toBe(2);

    const entries = system.getJournalEntries(player);
    expect(entries).toEqual([
      expect.objectContaining({
        kind: 'quest',
        displayName: 'The Shattered Seal',
        status: 'completed',
        rewardSummary: expect.stringContaining('Seal Lantern'),
      }),
    ]);
  });

  it('does not count kill_with_item unless the item is owned or equipped', () => {
    const player = new PlayerSessionState();
    const system = new QuestSystem(new QuestRegistry([TEST_QUEST]));

    system.acceptQuest('test_shattered_seal', player, 'island_hermit');

    expect(system.recordEnemyKilled({ enemyId: 'training_wretch' }, player)).toBeNull();

    player.getInventoryState().add('sealed_blade', 1);

    expect(system.recordEnemyKilled({ enemyId: 'training_wretch' }, player)).toMatchObject({
      ok: true,
    });
  });

  it('supports item-on-item objectives, area kill counts, and OR branches', () => {
    const player = new PlayerSessionState();
    const system = new QuestSystem(new QuestRegistry([BRANCHING_QUEST]));

    system.acceptQuest('test_branching_quest', player, 'island_hermit');

    expect(system.recordUseItemOn({
      itemId: 'broken_charm',
      target: { kind: 'item', itemId: 'silver_wire' },
    }, player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Pay the hermit'),
    });

    expect(system.recordEnemyKilled({
      enemyId: 'training_wretch',
      mapId: 'wrong_map',
      areaId: 'wormbrain_cave',
    }, player)).toBeNull();

    expect(system.recordEnemyKilled({
      enemyId: 'training_wretch',
      mapId: 'cave_map',
      areaId: 'wormbrain_cave',
    }, player)).toMatchObject({ ok: true });

    expect(player.isQuestCompleted('test_branching_quest')).toBe(false);

    expect(system.recordEnemyKilled({
      enemyId: 'training_wretch',
      mapId: 'cave_map',
      areaId: 'wormbrain_cave',
    }, player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest complete'),
    });

    expect(player.isQuestCompleted('test_branching_quest')).toBe(true);

    const payer = new PlayerSessionState();
    payer.getCurrencyState().addCopper(10_000);
    system.acceptQuest('test_branching_quest', payer, 'island_hermit');
    system.recordUseItemOn({
      itemId: 'broken_charm',
      target: { kind: 'item', itemId: 'silver_wire' },
    }, payer);

    expect(system.recordNpcInteraction('island_hermit', payer)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest complete'),
    });
    expect(payer.getCurrencyState().getTotalCopperValue()).toBe(0);
  });

  it('supports utility spell objectives and location-sensitive spell casts', () => {
    const player = new PlayerSessionState();
    const system = new QuestSystem(new QuestRegistry([SPELL_QUEST]));

    system.acceptQuest('test_spell_quest', player, 'island_hermit');

    expect(system.recordSpellCast({
      spellId: 'utility_homeward_mark',
      mapId: 'harbor_map',
      tile: { tileX: 1, tileY: 1 },
    }, player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Cast Homeward Mark'),
    });

    expect(system.recordSpellCast({
      spellId: 'utility_waystep',
      mapId: 'harbor_map',
      tile: { tileX: 5, tileY: 8 },
    }, player)).toBeNull();

    expect(system.recordSpellCast({
      spellId: 'utility_waystep',
      mapId: 'harbor_map',
      tile: { tileX: 4, tileY: 8 },
    }, player)).toMatchObject({
      ok: true,
      message: expect.stringContaining('Quest complete'),
    });
  });
});
