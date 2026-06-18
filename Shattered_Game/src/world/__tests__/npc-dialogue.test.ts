import { describe, expect, it, vi } from 'vitest';
import { NpcDialogueMenuHandler } from '../../npcs/NpcDialogueMenuHandler';
import type { NpcDefinition } from '../../npcs/NpcTypes';
import type { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import type { PlayerSessionState } from '../../player/PlayerSessionState';
import { PlayerSessionState as RealPlayerSessionState } from '../../player/PlayerSessionState';
import type { QuestSystem } from '../../quests/QuestSystem';
import { NPC_DEFINITIONS } from '../../npcs/NpcDefinitions';
import { validateNpcDefinitions } from '../../npcs/NpcDefinitionValidation';

const mockContractBoardSystem = {
  createMenuHandler: vi.fn((boardId: string) => ({
    title: `Contracts at ${boardId}`,
    getOptions: () => [],
    onConfirm: () => ({ kind: 'none' as const }),
  })),
} as unknown as ContractBoardSystem;

const mockPlayerState = {} as PlayerSessionState;

const mockQuestSystem = {
  handleQuestNpcInteraction: vi.fn((questId: string) => ({
    ok: true,
    interactionType: 'npc' as const,
    targetId: questId,
    message: `Quest hook ${questId}`,
  })),
  getActivePhaseId: vi.fn(() => null),
  getQuestMenuLabel: vi.fn((questId: string) => questId),
  getQuestMenuDisabledReason: vi.fn(() => undefined),
} as unknown as QuestSystem;

function makeNpc(overrides: Partial<NpcDefinition> = {}): NpcDefinition {
  return {
    id: 'test_npc',
    displayName: 'Test NPC',
    color: 0xffffff,
    behavior: 'stationary',
    ambientLines: [],
    dialogue: [{ text: 'Hello.' }],
    options: [],
    ...overrides,
  };
}

describe('NpcDialogueMenuHandler', () => {
  it('lists player-facing labels as menu options', () => {
    const npc = makeNpc({
      options: [
        { id: 'shop', label: 'Show me your wares.', outcome: { kind: 'shop', shopId: 'test_shop' } },
        { id: 'bye', label: 'Farewell.', outcome: { kind: 'close' } },
      ],
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem);

    expect(handler.getOptions(mockPlayerState)).toEqual([
      { id: 'shop', label: 'Show me your wares.' },
      { id: 'bye', label: 'Farewell.' },
    ]);
  });

  it('close option produces a farewell result and closes the menu', () => {
    const npc = makeNpc({
      options: [{ id: 'bye', label: 'Farewell.', outcome: { kind: 'close' } }],
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem);
    const outcome = handler.onConfirm('bye', mockPlayerState);

    expect(outcome).toMatchObject({
      kind: 'result',
      closeMenu: true,
      result: expect.objectContaining({ ok: true, interactionType: 'npc' }),
    });
  });

  it('shop option includes openShopId and closes the menu', () => {
    const npc = makeNpc({
      options: [{ id: 'shop', label: 'Browse.', outcome: { kind: 'shop', shopId: 'maren_general' } }],
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem);
    const outcome = handler.onConfirm('shop', mockPlayerState);

    expect(outcome).toMatchObject({
      kind: 'result',
      closeMenu: true,
      result: expect.objectContaining({ openShopId: 'maren_general' }),
    });
  });

  it('reply option returns the NPC text as the message without closing', () => {
    const npc = makeNpc({
      options: [{
        id: 'ask',
        label: 'What is this place?',
        outcome: { kind: 'reply', npcText: 'The archipelago of the Wake.' },
      }],
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem);
    const outcome = handler.onConfirm('ask', mockPlayerState);

    expect(outcome).toMatchObject({
      kind: 'result',
      result: expect.objectContaining({ message: 'The archipelago of the Wake.' }),
    });
    expect((outcome as { closeMenu?: boolean }).closeMenu).not.toBe(true);
  });

  it('contract_board option chains into the contract board menu handler', () => {
    const npc = makeNpc({
      options: [{
        id: 'contracts',
        label: 'Any work?',
        outcome: { kind: 'contract_board', boardId: 'harbor_contract_board_01' },
      }],
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem);
    const outcome = handler.onConfirm('contracts', mockPlayerState);

    expect(outcome.kind).toBe('open_menu');
    expect(mockContractBoardSystem.createMenuHandler).toHaveBeenCalledWith('harbor_contract_board_01');
  });

  it('unknown option id returns none', () => {
    const npc = makeNpc({ options: [] });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem);
    expect(handler.onConfirm('nonexistent', mockPlayerState)).toEqual({ kind: 'none' });
  });

  it('walks branching dialogue tree nodes without closing the menu', () => {
    const player = new RealPlayerSessionState();
    const npc = makeNpc({
      dialogueTree: {
        startNodeId: 'intro',
        nodes: {
          intro: {
            npcText: 'You saw the mark too, did you?',
            options: [
              { id: 'what_mark', label: 'What mark?', nextNodeId: 'explain_mark' },
              { id: 'bye', label: 'Never mind.', end: true },
            ],
          },
          explain_mark: {
            npcText: 'It appears where old gods are still dreaming.',
            options: [
              { id: 'help', label: 'I can help.', questAction: { kind: 'start_quest', questId: 'shattered_seal' } },
            ],
          },
        },
      },
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem, mockQuestSystem);

    expect(handler.getCurrentNpcText()).toBe('You saw the mark too, did you?');
    expect(handler.getOptions(player).map((option) => option.label)).toEqual([
      'What mark?',
      'Never mind.',
    ]);

    const next = handler.onConfirm('what_mark', player);
    expect(next).toMatchObject({
      kind: 'result',
      result: { message: 'It appears where old gods are still dreaming.' },
    });
    expect((next as { closeMenu?: boolean }).closeMenu).not.toBe(true);
    expect(handler.getOptions(player).map((option) => option.label)).toEqual(['I can help.']);
  });

  it('supports hidden and disabled condition-gated routes in large dialogue trees', () => {
    const player = new RealPlayerSessionState();
    const npc = makeNpc({
      dialogueTree: {
        startNodeId: 'intro',
        nodes: {
          intro: {
            npcText: 'Choose carefully.',
            options: [
              {
                id: 'hidden_item_route',
                label: 'I have the seal.',
                conditions: [{ kind: 'item_owned', itemId: 'shattered_seal' }],
                unavailableMode: 'hidden',
                nextNodeId: 'seal_route',
              },
              {
                id: 'disabled_skill_route',
                label: 'I know the old rite.',
                conditions: [{ kind: 'skill_level', skillId: 'magic', level: 10 }],
                unavailableReason: 'Requires Magic level 10.',
                nextNodeId: 'rite_route',
              },
              { id: 'bye', label: 'Never mind.', end: true },
            ],
          },
          seal_route: { npcText: 'Then we begin.', options: [] },
          rite_route: { npcText: 'Speak the rite.', options: [] },
        },
      },
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem, mockQuestSystem);

    expect(handler.getOptions(player)).toEqual([
      {
        id: 'disabled_skill_route',
        label: 'I know the old rite.',
        disabledReason: 'Requires Magic level 10.',
      },
      { id: 'bye', label: 'Never mind.', disabledReason: undefined },
    ]);

    player.getInventoryState().add('shattered_seal', 1);

    expect(handler.getOptions(player).map((option) => option.id)).toEqual([
      'hidden_item_route',
      'disabled_skill_route',
      'bye',
    ]);
  });

  it('lets tree branches call quest actions', () => {
    const player = new RealPlayerSessionState();
    const npc = makeNpc({
      dialogueTree: {
        startNodeId: 'intro',
        nodes: {
          intro: {
            npcText: 'The seal waits.',
            options: [
              {
                id: 'quest',
                label: 'I can help.',
                questAction: { kind: 'start_quest', questId: 'shattered_seal' },
              },
            ],
          },
        },
      },
    });
    const handler = new NpcDialogueMenuHandler(npc, 'anchor_01', mockContractBoardSystem, mockQuestSystem);

    expect(handler.onConfirm('quest', player)).toMatchObject({
      kind: 'result',
      result: { message: 'Quest hook shattered_seal' },
    });
    expect(mockQuestSystem.handleQuestNpcInteraction).toHaveBeenCalledWith(
      'shattered_seal',
      'test_npc',
      player,
    );
  });
});

describe('NPC_DEFINITIONS dialogue options', () => {
  it('ships structurally valid NPC dialogue definitions', () => {
    expect(validateNpcDefinitions(NPC_DEFINITIONS)).toEqual({ ok: true });
  });

  it('trader_maren has shop, contracts, a reply, and a close option', () => {
    const maren = NPC_DEFINITIONS.find((d) => d.id === 'trader_maren');
    expect(maren?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: expect.objectContaining({ kind: 'shop' }) }),
        expect.objectContaining({ outcome: expect.objectContaining({ kind: 'contract_board' }) }),
        expect.objectContaining({ outcome: expect.objectContaining({ kind: 'reply' }) }),
        expect.objectContaining({ outcome: expect.objectContaining({ kind: 'close' }) }),
      ]),
    );
  });

  it('every NPC definition with options has a close option', () => {
    for (const npc of NPC_DEFINITIONS) {
      if (!npc.options?.length) continue;
      const hasClose = npc.options.some((o) => o.outcome.kind === 'close');
      expect(hasClose, `${npc.id} is missing a close option`).toBe(true);
    }
  });

  it('old hermit has a branching first quest route and active quest branch', () => {
    const hermit = NPC_DEFINITIONS.find((d) => d.id === 'island_hermit');
    const player = new RealPlayerSessionState();
    const handler = new NpcDialogueMenuHandler(
      hermit as NpcDefinition,
      'hermit_anchor',
      mockContractBoardSystem,
      mockQuestSystem,
    );

    expect(handler.getOptions(player).map((option) => option.id)).toEqual([
      'ask_wake',
      'ask_island',
      'first_mark_intro',
      'bye',
    ]);

    player.startQuest('the_first_mark');

    const activeHandler = new NpcDialogueMenuHandler(
      hermit as NpcDefinition,
      'hermit_anchor',
      mockContractBoardSystem,
      mockQuestSystem,
    );

    expect(activeHandler.getOptions(player).map((option) => option.id)).toEqual([
      'ask_wake',
      'ask_island',
      'first_mark_continue',
      'bye',
    ]);
  });
});
