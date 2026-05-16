import { describe, expect, it } from 'vitest';
import { validateAllRegisteredMaps } from '../maps/MapDefinitions';

describe('registered maps', () => {
  it('all registered maps validate explicitly', () => {
    expect(() => validateAllRegisteredMaps()).not.toThrow();
  });
});
