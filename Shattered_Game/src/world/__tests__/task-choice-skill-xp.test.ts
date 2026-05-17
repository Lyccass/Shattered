import { describe, expect, it, vi } from 'vitest';
import { ContractBoardSystem } from '../../contracts/ContractBoardSystem';
import { CONTRACT_DEFINITIONS } from '../../contracts/ContractDefinitions';
import { ContractRegistry } from '../../contracts/ContractRegistry';
import { RECIPE_DEFINITIONS } from '../../crafting/RecipeDefinitions';
import { RecipeRegistry } from '../../crafting/RecipeRegistry';
import { ChoiceMenuState } from '../../interactions/ChoiceMenuState';
import { PlacedStructureSystem } from '../../interactions/PlacedStructureSystem';
import { ResourceNodeSystem } from '../../interactions/ResourceNodeSystem';
import { WorkbenchSystem } from '../../interactions/WorkbenchSystem';
import { PlayerSessionState } from '../../player/PlayerSessionState';
import { WorldSessionState } from '../session/WorldSessionState';
import type {
  MapContractBoardAnchor,
  MapPlacedObject,
  MapResourceNodeAnchor,
  MapWorkbenchAnchor,
} from '../maps/MapTypes';

describe('ChoiceMenuState', () => {
  it('moves selection and skips disabled options', () => {
    const menu = new ChoiceMenuState();
    menu.open('Workbench Recipes', [
      { id: 'one', label: 'One', disabledReason: 'Missing wood' },
      { id: 'two', label: 'Two' },
      { id: 'three', label: 'Three' },
    ]);

    expect(menu.getSelectedOption()?.id).toBe('two');

    menu.moveSelection(1);
    expect(menu.getSelectedOption()?.id).toBe('three');

    menu.moveSelection(1);
    expect(menu.getSelectedOption()?.id).toBe('two');
  });
});

describe('WorkbenchSystem menus and XP', () => {
  const recipeRegistry = new RecipeRegistry(RECIPE_DEFINITIONS);
  const workbench: MapWorkbenchAnchor = {
    id: 'home_bench',
    interactionType: 'workbench',
    tileX: 14,
    tileY: 17,
  };

  it('lists multiple workbench recipes', () => {
    const system = new WorkbenchSystem(recipeRegistry);
    system.setMapWorkbenches('test_home_island', [workbench]);

    expect(system.getRecipesForWorkbench('home_bench').map((recipe) => recipe.id)).toEqual([
      'workbench_firestarter_set',
      'workbench_wooden_marker',
      'workbench_camp_supplies',
    ]);
  });

  it('disables recipes when requirements are missing', () => {
    const system = new WorkbenchSystem(recipeRegistry);
    const playerSessionState = new PlayerSessionState();
    system.setMapWorkbenches('test_home_island', [workbench]);

    const options = system.getMenuOptions('home_bench', playerSessionState);
    const firestarterOption = options.find((option) => option.id === 'workbench_firestarter_set');

    expect(firestarterOption?.disabledReason).toContain('wood');
  });

  it('crafting consumes inputs, grants outputs, and awards Crafting XP', () => {
    const system = new WorkbenchSystem(recipeRegistry);
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().add('wood', 1);
    system.setMapWorkbenches('test_home_island', [workbench]);

    const result = system.craftRecipe('home_bench', 'workbench_firestarter_set', playerSessionState);

    expect(result.ok).toBe(true);
    expect(playerSessionState.getInventoryState().getCount('wood')).toBe(0);
    expect(playerSessionState.getInventoryState().getItemCount('firestarter_set')).toBe(1);
    expect(playerSessionState.getSkillProgressionSystem().getXp('crafting')).toBe(10);
  });
});

describe('Gathering and campfire XP', () => {
  const recipeRegistry = new RecipeRegistry(RECIPE_DEFINITIONS);

  it('gathering grants Gathering XP', () => {
    const playerSessionState = new PlayerSessionState();
    const sessionState = new WorldSessionState();
    const system = new ResourceNodeSystem(sessionState);
    const node: MapResourceNodeAnchor = {
      id: 'driftwood_01',
      interactionType: 'resource_node',
      tileX: 4,
      tileY: 7,
      linkedObjectId: 'wild_driftwood_node_01',
      resourceNodeType: 'driftwood',
    };
    const mapObjects: MapPlacedObject[] = [
      { id: 'wild_driftwood_node_01', definitionId: 'driftwood_node', tileX: 4, tileY: 7 },
    ];
    const removeObject = vi.fn(() => true);

    system.setMapNodes('test_wild_island', [node], mapObjects, 0);
    system.gatherNode('driftwood_01', playerSessionState, 0, { removeObject });

    expect(playerSessionState.getSkillProgressionSystem().getXp('gathering')).toBe(5);
  });

  it('brewing warm tea grants Survival XP', () => {
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().add('herb', 1);
    const sessionState = new WorldSessionState();
    const system = new PlacedStructureSystem(sessionState, recipeRegistry);
    const getInstance = vi.fn(() => undefined);
    const placeObject = vi.fn(() => ({
      id: 'test_home_island:campfire:1',
      definitionId: 'campfire',
      tileX: 16,
      tileY: 17,
      createdAt: Date.now(),
    }));
    const removeObject = vi.fn(() => true);

    sessionState.setPlacedObjects('test_home_island', [
      {
        id: 'test_home_island:campfire:1',
        mapId: 'test_home_island',
        tileX: 16,
        tileY: 17,
        objectDefinitionId: 'campfire',
        kind: 'campfire',
        despawnAtMs: 90_000,
      },
    ]);
    system.setCurrentMap('test_home_island', 0, { getInstance, placeObject, removeObject });

    const result = system.interactWithPlacedObject(
      'test_home_island:campfire:1',
      1_000,
      playerSessionState,
      { getInstance, placeObject, removeObject },
    );

    expect(result.ok).toBe(true);
    expect(playerSessionState.getInventoryState().getItemCount('warm_tea')).toBe(1);
    expect(playerSessionState.getSkillProgressionSystem().getXp('survival')).toBe(8);
  });
});

describe('Contract board tasks and trade XP', () => {
  const boardAnchor: MapContractBoardAnchor = {
    id: 'harbor_contract_board_01',
    interactionType: 'contract_board',
    tileX: 18,
    tileY: 14,
    contractIds: ['warmth_for_the_dockhands', 'camp_supplies'],
  };

  it('lists multiple contracts', () => {
    const system = new ContractBoardSystem(new ContractRegistry(CONTRACT_DEFINITIONS));
    const playerSessionState = new PlayerSessionState();
    system.setMapBoards('test_harbor', [boardAnchor]);

    expect(system.getMenuOptions('harbor_contract_board_01', playerSessionState)).toHaveLength(2);
  });

  it('accepting a contract adds it to the journal', () => {
    const system = new ContractBoardSystem(new ContractRegistry(CONTRACT_DEFINITIONS));
    const playerSessionState = new PlayerSessionState();
    system.setMapBoards('test_harbor', [boardAnchor]);

    const result = system.selectContract(
      'harbor_contract_board_01',
      'warmth_for_the_dockhands',
      playerSessionState,
    );

    expect(result.ok).toBe(true);
    expect(playerSessionState.getAcceptedContractIds()).toContain('warmth_for_the_dockhands');
    expect(system.getJournalEntries(playerSessionState)).toEqual([
      expect.objectContaining({
        id: 'warmth_for_the_dockhands',
        requirementsMet: false,
      }),
    ]);
  });

  it('completing the warm tea contract consumes warm_tea and grants rewards', () => {
    const system = new ContractBoardSystem(new ContractRegistry(CONTRACT_DEFINITIONS));
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().addItem('warm_tea', 1);
    system.setMapBoards('test_harbor', [boardAnchor]);

    const accepted = system.selectContract(
      'harbor_contract_board_01',
      'warmth_for_the_dockhands',
      playerSessionState,
    );
    const result = system.selectContract(
      'harbor_contract_board_01',
      'warmth_for_the_dockhands',
      playerSessionState,
    );

    expect(accepted.ok).toBe(true);
    expect(accepted.message).toContain('Accepted');
    expect(result.ok).toBe(true);
    expect(playerSessionState.getInventoryState().getItemCount('warm_tea')).toBe(0);
    expect(playerSessionState.getCurrencySnapshot().copper).toBe(55);
    expect(playerSessionState.getReputationSnapshot().harborReputation).toBe(1);
    expect(playerSessionState.getSkillProgressionSystem().getXp('trade')).toBe(10);
  });

  it('completing the firestarter contract consumes firestarter_set and grants rewards', () => {
    const system = new ContractBoardSystem(new ContractRegistry(CONTRACT_DEFINITIONS));
    const playerSessionState = new PlayerSessionState();
    playerSessionState.getInventoryState().addItem('firestarter_set', 1);
    system.setMapBoards('test_harbor', [boardAnchor]);

    const accepted = system.selectContract(
      'harbor_contract_board_01',
      'camp_supplies',
      playerSessionState,
    );
    const result = system.selectContract(
      'harbor_contract_board_01',
      'camp_supplies',
      playerSessionState,
    );

    expect(accepted.ok).toBe(true);
    expect(accepted.message).toContain('Accepted');
    expect(result.ok).toBe(true);
    expect(playerSessionState.getInventoryState().getItemCount('firestarter_set')).toBe(0);
    expect(playerSessionState.getCurrencySnapshot().copper).toBe(37);
    expect(playerSessionState.getSkillProgressionSystem().getXp('trade')).toBe(8);
  });
});
