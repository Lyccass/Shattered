import type { MapDefinition } from './MapTypes';
import { createHarborMap } from './TestHarborMap';
import { createHomeIslandMap } from './TestHomeIslandMap';
import { createWildIslandMap } from './TestWildIslandMap';

export const TEST_MAPS: MapDefinition[] = [
  createHomeIslandMap(),
  createHarborMap(),
  createWildIslandMap(),
];
