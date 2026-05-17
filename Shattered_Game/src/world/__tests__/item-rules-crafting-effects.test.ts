import { describe, expect, it } from 'vitest';
import { ConsumableEffectSystem } from '../../effects/ConsumableEffectSystem';
import { EffectRegistry } from '../../effects/EffectRegistry';
import { EFFECT_DEFINITIONS } from '../../effects/EffectDefinitions';
import { ITEM_DEFINITIONS } from '../../items/ItemDefinitions';
import { evaluateItemPlacement } from '../../items/ItemPlacementRules';
import { ItemRegistry } from '../../items/ItemRegistry';
import type { ItemDefinition } from '../../items/ItemTypes';
import { ItemUseSystem } from '../../items/ItemUseSystem';
import { PlayerInventoryState } from '../../player/PlayerInventoryState';
import type { MapZoneTag } from '../maps/MapTypes';

const itemRegistry = new ItemRegistry(ITEM_DEFINITIONS);

function createPlacementQuery(overrides: Partial<Parameters<typeof evaluateItemPlacement>[1]> = {}) {
  return {
    tileX: 10,
    tileY: 10,
    mapSpaceType: 'open_world' as const,
    zoneTags: [] as MapZoneTag[],
    activePlacedCount: 0,
    isTileInBounds: () => true,
    isTerrainBlocked: () => false,
    isObjectBlocked: () => false,
    isTileWalkable: () => true,
    isNearTransition: () => false,
    objectPlacementEvaluation: { ok: true as const, footprintTiles: [{ x: 10, y: 10 }] },
    ...overrides,
  };
}

describe('evaluateItemPlacement', () => {
  const firestarter = itemRegistry.get('firestarter_set');
  const personalOnlyFurniture: ItemDefinition = {
    id: 'firestarter_set',
    displayName: 'Test Furniture',
    description: 'A test-only permanent placement item.',
    category: 'placeable',
    stackable: true,
    useMode: 'place',
    placementObjectDefinitionId: 'placed_firestarter_set',
    placementRules: {
      allowedSpaceTypes: ['personal_island'],
      mustBeWalkable: true,
      mustNotBeBlocked: true,
    },
  };

  it('allows firestarter placement in open world space', () => {
    const result = evaluateItemPlacement(
      firestarter,
      createPlacementQuery({ mapSpaceType: 'open_world', zoneTags: ['town', 'harbor'] }),
    );

    expect(result.ok).toBe(true);
  });

  it('allows firestarter placement on a personal island too', () => {
    const result = evaluateItemPlacement(
      firestarter,
      createPlacementQuery({ mapSpaceType: 'personal_island', zoneTags: ['personal_build'] }),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects a personal-only furniture item in open world space', () => {
    const result = evaluateItemPlacement(
      personalOnlyFurniture,
      createPlacementQuery({ mapSpaceType: 'open_world' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('not_allowed_zone');
    }
  });

  it('allows a personal-only furniture item on a personal island', () => {
    const result = evaluateItemPlacement(
      personalOnlyFurniture,
      createPlacementQuery({ mapSpaceType: 'personal_island', zoneTags: ['personal_build'] }),
    );

    expect(result.ok).toBe(true);
  });
});

describe('ItemUseSystem', () => {
  it('consuming warm_tea applies the Warmth effect and consumes the item', () => {
    const inventory = new PlayerInventoryState();
    inventory.addItem('warm_tea', 1);
    const effectSystem = new ConsumableEffectSystem(new EffectRegistry(EFFECT_DEFINITIONS));
    const system = new ItemUseSystem(itemRegistry, effectSystem);

    const result = system.useItem('warm_tea', inventory, 0);

    expect(result.ok).toBe(true);
    expect(result.message).toBe('You drink warm tea.');
    expect(inventory.getItemCount('warm_tea')).toBe(0);
    expect(effectSystem.getActiveEffects(0)).toEqual([
      { id: 'warm_tea_warmth', displayName: 'Warmth', remainingMs: 60_000 },
    ]);
  });

  it('expires the Warmth effect after its duration', () => {
    const inventory = new PlayerInventoryState();
    inventory.addItem('warm_tea', 1);
    const effectSystem = new ConsumableEffectSystem(new EffectRegistry(EFFECT_DEFINITIONS));
    const system = new ItemUseSystem(itemRegistry, effectSystem);

    system.useItem('warm_tea', inventory, 0);
    expect(effectSystem.getActiveEffects(59_999)).toHaveLength(1);

    effectSystem.update(60_001);

    expect(effectSystem.getActiveEffects(60_001)).toHaveLength(0);
  });
});
