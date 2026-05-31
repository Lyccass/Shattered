import { describe, expect, it, vi } from 'vitest';
import { NpcDialogueMenuHandler } from '../../npcs/NpcDialogueMenuHandler';
import type { NpcDefinition } from '../../npcs/NpcTypes';
import type { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import type { PlayerSessionState } from '../../player/PlayerSessionState';
import { NPC_DEFINITIONS } from '../../npcs/NpcDefinitions';

const mockContractBoardSystem = {
  createMenuHandler: vi.fn((boardId: string) => ({
    title: `Contracts at ${boardId}`,
    getOptions: () => [],
    onConfirm: () => ({ kind: 'none' as const }),
  })),
} as unknown as ContractBoardSystem;

const mockPlayerState = {} as PlayerSessionState;

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
});

describe('NPC_DEFINITIONS dialogue options', () => {
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
});
