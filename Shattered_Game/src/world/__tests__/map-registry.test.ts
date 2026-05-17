import { describe, expect, it } from 'vitest';
import { MapRegistry } from '../maps/MapRegistry';

describe('MapRegistry', () => {
  it('registers maps lazily and does not instantiate them until requested', () => {
    let factoryCalls = 0;
    const registry = new MapRegistry();

    registry.registerMapFactory({
      id: 'lazy_map',
      displayName: 'Lazy Map',
      factory: () => {
        factoryCalls += 1;
        return {
          id: 'lazy_map',
          displayName: 'Lazy Map',
          spaceType: 'open_world',
          width: 2,
          height: 2,
          terrain: [
            ['grass', 'grass'],
            ['grass', 'grass'],
          ],
          spawnPoints: {
            default: { id: 'default', tileX: 0, tileY: 0 },
          },
          objects: [],
          transitions: [],
        };
      },
    });

    expect(factoryCalls).toBe(0);
    expect(registry.hasMap('lazy_map')).toBe(true);
    expect(registry.listMapIds()).toEqual(['lazy_map']);
    expect(registry.getDisplayName('lazy_map')).toBe('Lazy Map');
    expect(factoryCalls).toBe(0);

    const definition = registry.getMapDefinition('lazy_map');

    expect(definition.id).toBe('lazy_map');
    expect(factoryCalls).toBe(1);
  });

  it('throws a clear error for an unknown map id', () => {
    const registry = new MapRegistry();

    registry.registerMapFactory({
      id: 'known_map',
      displayName: 'Known Map',
      factory: () => ({
        id: 'known_map',
        displayName: 'Known Map',
        spaceType: 'open_world',
        width: 1,
        height: 1,
        terrain: [['grass']],
        spawnPoints: {
          default: { id: 'default', tileX: 0, tileY: 0 },
        },
        objects: [],
        transitions: [],
      }),
    });

    expect(() => registry.getMapDefinition('missing_map')).toThrow(
      /MapRegistry: unknown map "missing_map". Registered maps: known_map/,
    );
  });
});
