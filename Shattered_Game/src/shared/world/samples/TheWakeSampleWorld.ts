import type { RegionManifest } from '../RegionManifestTypes';
import type { WorldChunkDefinition } from '../ChunkTypes';
import type { WorldManifest } from '../WorldManifestTypes';

const SAMPLE_CHUNK_SIZE = 32;

export const THE_WAKE_WORLD_MANIFEST: WorldManifest = {
  version: 1,
  worldId: 'the_wake',
  displayName: 'The Wake',
  chunkSize: SAMPLE_CHUNK_SIZE,
  bounds: {
    minChunkX: 0,
    minChunkY: 0,
    maxChunkX: 999,
    maxChunkY: 999,
  },
  defaultRegionId: 'harbor_coast',
  regions: [
    {
      id: 'harbor_coast',
      displayName: 'Harbor Coast',
      defaultTerrain: 'grass',
      defaultWalkable: true,
      biomeTags: ['coast', 'harbor_edge'],
    },
  ],
  authoredChunks: [
    {
      chunkX: 0,
      chunkY: 0,
      regionId: 'harbor_coast',
      path: 'data/worlds/the_wake/chunks/0_0.json',
    },
  ],
  defaultSpawn: {
    regionId: 'harbor_coast',
    chunk: { chunkX: 0, chunkY: 0 },
    tileX: 4,
    tileY: 4,
    spawnId: 'harbor_coast_default',
  },
  terrainPaletteIds: ['wake_basic'],
  metadata: {
    authoringVersion: 'world_chunk_authoring_v0',
  },
};

export const HARBOR_COAST_REGION_MANIFEST: RegionManifest = {
  worldId: 'the_wake',
  regionId: 'harbor_coast',
  displayName: 'Harbor Coast',
  chunkSize: SAMPLE_CHUNK_SIZE,
  bounds: {
    minChunkX: 0,
    minChunkY: 0,
    maxChunkX: 0,
    maxChunkY: 0,
  },
  chunks: [
    { chunkX: 0, chunkY: 0 },
  ],
  biomeTags: ['coast', 'harbor_edge'],
  defaultTerrainPaletteId: 'wake_basic',
  environmentVariables: {
    corruption: 0,
    prosperity: 25,
    monsterPressure: 8,
    resourceAbundance: 35,
    routeSafety: 70,
    weather: 'mild',
    season: 'spring',
  },
};

export const HARBOR_COAST_CHUNK_0_0: WorldChunkDefinition = {
  worldId: 'the_wake',
  regionId: 'harbor_coast',
  chunkX: 0,
  chunkY: 0,
  width: SAMPLE_CHUNK_SIZE,
  height: SAMPLE_CHUNK_SIZE,
  terrainPalette: {
    0: 'grass',
    1: 'sand',
    2: 'water',
    3: 'stone',
  },
  terrain: {
    encoding: 'palette',
    tiles: createSampleHarborTerrainTiles(),
  },
  objectLayer: {
    objects: [
      { id: 'harbor_rock_01', definitionId: 'small_rock', tileX: 6, tileY: 1 },
    ],
  },
  resourceLayer: {
    nodes: [
      {
        id: 'driftwood_0_0_01',
        resourceDefinitionId: 'driftwood',
        tileX: 2,
        tileY: 5,
        respawnProfileId: 'coastal_driftwood_v0',
        tags: ['shore', 'starter_resource'],
      },
    ],
  },
  zoneLayer: {
    zones: [
      {
        id: 'harbor_safe_edge',
        tileX: 0,
        tileY: 0,
        width: 4,
        height: 4,
        tags: ['harbor', 'town'],
      },
    ],
  },
  habitatLayer: {
    habitats: [
      {
        id: 'coastal_scavenger_habitat',
        tileX: 4,
        tileY: 4,
        width: 4,
        height: 4,
        tags: ['road_edge', 'coast'],
        spawnRules: [
          {
            id: 'wolf_pressure_probe_v0',
            creatureFamilyId: 'wolf',
            densityHint: 0.2,
            maxPopulation: 2,
            initialMaturityLevel: 3,
            maxMaturityLevel: 10,
            maturityTickMs: 3_600_000,
            migrationThresholdLevel: 8,
            migrationTargetTags: ['nearby_forest', 'road_edge'],
            minWorldState: {
              monsterPressure: 20,
            },
          },
        ],
      },
    ],
  },
  metadata: {
    authoredFor: 'world_chunk_authoring_v0',
  },
};

function createSampleHarborTerrainTiles(): number[][] {
  return Array.from({ length: SAMPLE_CHUNK_SIZE }, (_, y) =>
    Array.from({ length: SAMPLE_CHUNK_SIZE }, (_, x) => {
      if (x >= 48 && y >= 8 && y <= 20) {
        return 3;
      }

      if (y >= x + 28) {
        return 2;
      }

      if (x <= 10 || y >= x + 22) {
        return 1;
      }

      return 0;
    }),
  );
}
