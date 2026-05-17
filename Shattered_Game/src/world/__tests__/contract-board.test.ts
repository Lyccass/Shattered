import { describe, expect, it } from 'vitest';
import { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import { CONTRACT_DEFINITIONS } from '../../contracts/ContractDefinitions';
import { ContractRegistry } from '../../contracts/ContractRegistry';
import type { ContractDefinition } from '../../contracts/ContractTypes';
import { PlayerSessionState } from '../../player/PlayerSessionState';
import type { MapContractBoardAnchor } from '../maps/MapTypes';

function createBoardAnchor(
  overrides: Partial<MapContractBoardAnchor> = {},
): MapContractBoardAnchor {
  return {
    id: 'harbor_contract_board_01',
    interactionType: 'contract_board',
    tileX: 18,
    tileY: 14,
    interactionRangeTiles: 1,
    promptLabel: 'Turn In Contract',
    contractIds: ['warmth_for_the_dockhands'],
    ...overrides,
  };
}

function createSystem(definitions: readonly ContractDefinition[] = CONTRACT_DEFINITIONS): ContractBoardSystem {
  const system = new ContractBoardSystem(new ContractRegistry(definitions));
  system.setMapBoards('test_harbor', [createBoardAnchor({
    contractIds: definitions.map((definition) => definition.id),
  })]);
  return system;
}

describe('ContractBoardSystem', () => {
  it('cannot complete a contract without the required item', () => {
    const system = createSystem();
    const playerSessionState = new PlayerSessionState();

    const result = system.useBoard('harbor_contract_board_01', playerSessionState);

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Accepted');
    expect(playerSessionState.getCurrencySnapshot().copper).toBe(0);
  });

  it('consumes warm_tea and grants copper when the contract completes', () => {
    const system = createSystem();
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().addItem('warm_tea', 1);

    const accepted = system.useBoard('harbor_contract_board_01', playerSessionState);
    const result = system.useBoard('harbor_contract_board_01', playerSessionState);

    expect(accepted.ok).toBe(true);
    expect(accepted.message).toContain('Accepted');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Warmth for the Dockhands');
    expect(playerSessionState.getInventoryState().getItemCount('warm_tea')).toBe(0);
    expect(playerSessionState.getCurrencySnapshot().copper).toBe(55);
    expect(playerSessionState.getReputationSnapshot().harborReputation).toBe(1);
  });

  it('repeatable contracts can be completed more than once', () => {
    const system = createSystem();
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().addItem('warm_tea', 2);

    const firstAccept = system.useBoard('harbor_contract_board_01', playerSessionState);
    const firstComplete = system.useBoard('harbor_contract_board_01', playerSessionState);
    const secondAccept = system.useBoard('harbor_contract_board_01', playerSessionState);
    const secondComplete = system.useBoard('harbor_contract_board_01', playerSessionState);

    expect(firstAccept.ok).toBe(true);
    expect(firstComplete.ok).toBe(true);
    expect(secondAccept.ok).toBe(true);
    expect(secondComplete.ok).toBe(true);
    expect(playerSessionState.getInventoryState().getItemCount('warm_tea')).toBe(0);
    expect(playerSessionState.getCurrencyState().getTotalCopperValue()).toBe(110);
    expect(playerSessionState.getCurrencySnapshot()).toEqual({
      copper: 10,
      silver: 1,
      gold: 0,
      platinum: 0,
    });
    expect(playerSessionState.getReputationSnapshot().harborReputation).toBe(2);
  });

  it('non-repeatable contracts cannot be completed twice', () => {
    const nonRepeatableContract: ContractDefinition = {
      id: 'camp_supplies',
      displayName: 'Camp Supplies',
      description: 'The board wants one ready-made firestarter set.',
      requiredItems: {
        firestarter_set: 1,
      },
      rewards: {
        copper: 3,
      },
      repeatable: false,
      interactionType: 'contract_board',
      tags: ['harbor', 'starter'],
    };
    const system = createSystem([nonRepeatableContract]);
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().addItem('firestarter_set', 2);

    const firstAccept = system.useBoard('harbor_contract_board_01', playerSessionState);
    const first = system.useBoard('harbor_contract_board_01', playerSessionState);
    const second = system.useBoard('harbor_contract_board_01', playerSessionState);

    expect(firstAccept.ok).toBe(true);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('No contracts are available');
    expect(playerSessionState.getInventoryState().getItemCount('firestarter_set')).toBe(1);
    expect(playerSessionState.getCurrencySnapshot().copper).toBe(3);
  });

  it('exposes available contracts and filters completed non-repeatables', () => {
    const nonRepeatableContract: ContractDefinition = {
      id: 'camp_supplies',
      displayName: 'Camp Supplies',
      description: 'The board wants one ready-made firestarter set.',
      requiredItems: {
        firestarter_set: 1,
      },
      rewards: {
        copper: 3,
      },
      repeatable: false,
      interactionType: 'contract_board',
      tags: ['harbor', 'starter'],
    };
    const system = createSystem([nonRepeatableContract]);
    const playerSessionState = new PlayerSessionState();

    expect(system.getAvailableContracts('harbor_contract_board_01', playerSessionState)).toHaveLength(1);

    playerSessionState.getInventoryState().addItem('firestarter_set', 1);
    system.useBoard('harbor_contract_board_01', playerSessionState);
    system.useBoard('harbor_contract_board_01', playerSessionState);

    expect(system.getAvailableContracts('harbor_contract_board_01', playerSessionState)).toHaveLength(0);
  });
});
