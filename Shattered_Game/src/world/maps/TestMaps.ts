import type { MapRegistration } from './MapTypes';
import { createHarborMap } from './TestHarborMap';
import { createHomeIslandMap } from './TestHomeIslandMap';
import { createWildIslandMap } from './TestWildIslandMap';

export const TEST_MAPS: MapRegistration[] = [
  {
    id: 'test_home_island',
    displayName: 'Test Home Island',
    factory: createHomeIslandMap,
  },
  {
    id: 'test_harbor',
    displayName: 'Test Harbor',
    factory: createHarborMap,
  },
  {
    id: 'test_wild_island',
    displayName: 'Test Wild Island',
    factory: createWildIslandMap,
  },
];
