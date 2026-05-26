import {
  createEditorMap,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { ChunkCoordinate, ChunkKey } from '../../shared/world/ChunkKey';
import { createChunkKey } from '../../shared/world/ChunkKey';
import type { WorldChunkDefinition } from '../../shared/world/ChunkTypes';
import type { WorldManifest } from '../../shared/world/WorldManifestTypes';
import { assertValidWorldManifest } from '../../shared/world/WorldManifestValidation';
import { WorldChunkProvider } from '../../shared/world/WorldChunkProvider';
import {
  applyDirtyChunkBundle,
  type EditorDirtyChunkBundleV1,
} from '../chunks/EditorDirtyChunkBundle';

const WORLD_DATA_ENDPOINT = '/__shattered_world';

export type EditorWorldChunkWindowRequest = {
  centerChunkX: number;
  centerChunkY: number;
  fallbackPaint: EditorTerrainTilePaint;
  radius: number;
  worldId: string;
};

export type EditorWorldChunkWindowResult = {
  authoredChunkKeys: Set<ChunkKey>;
  loadedChunkKeys: Set<ChunkKey>;
  map: EditorMapDefinition;
  manifest: WorldManifest;
  originChunkX: number;
  originChunkY: number;
  regionId: string;
};

export type SaveWorldChunksResult = {
  savedChunkCount: number;
  verifiedChunkCount: number;
  worldId: string;
};

export type EditorWorldSummary = {
  authoredChunkCount: number;
  bounds: WorldManifest['bounds'];
  chunkSize: number;
  displayName: string;
  worldId: string;
};

export type CreateEditorWorldOptions = {
  bounds: WorldManifest['bounds'];
  chunkSize: number;
  defaultTerrain: WorldManifest['regions'][number]['defaultTerrain'];
  defaultWalkable: boolean;
  displayName: string;
  regionId: string;
  regionName: string;
  spawnChunkX: number;
  spawnChunkY: number;
  spawnTileX: number;
  spawnTileY: number;
  worldId: string;
};

export async function listProjectWorlds(): Promise<EditorWorldSummary[]> {
  const response = await fetch(WORLD_DATA_ENDPOINT);

  if (!response.ok) {
    throw new Error(`Could not list worlds (${response.status}).`);
  }

  const body = await response.json() as { worlds?: EditorWorldSummary[] };
  return body.worlds ?? [];
}

export async function loadWorldManifestFromProject(worldId: string): Promise<WorldManifest> {
  const response = await fetch(`${WORLD_DATA_ENDPOINT}/${encodeURIComponent(worldId)}/manifest`);

  if (!response.ok) {
    throw new Error(`Could not load world "${worldId}" manifest (${response.status}).`);
  }

  const manifest = await response.json() as unknown;
  assertValidWorldManifest(manifest);
  return manifest;
}

export async function createWorldManifestInProject(options: CreateEditorWorldOptions): Promise<WorldManifest> {
  const manifest: WorldManifest = {
    version: 1,
    worldId: options.worldId,
    displayName: options.displayName,
    chunkSize: options.chunkSize,
    bounds: options.bounds,
    defaultRegionId: options.regionId,
    regions: [{
      id: options.regionId,
      displayName: options.regionName,
      defaultTerrain: options.defaultTerrain,
      defaultWalkable: options.defaultWalkable,
      biomeTags: [],
    }],
    authoredChunks: [],
    defaultSpawn: {
      regionId: options.regionId,
      chunk: {
        chunkX: options.spawnChunkX,
        chunkY: options.spawnChunkY,
      },
      tileX: options.spawnTileX,
      tileY: options.spawnTileY,
      spawnId: 'default',
    },
    metadata: {
      source: 'map_editor_world_panel',
    },
  };
  assertValidWorldManifest(manifest);

  const response = await fetch(`${WORLD_DATA_ENDPOINT}/${encodeURIComponent(options.worldId)}/manifest`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Could not create world "${options.worldId}" (${response.status}).`);
  }

  return response.json() as Promise<WorldManifest>;
}

export async function loadEditorWorldChunkWindow(
  request: EditorWorldChunkWindowRequest,
): Promise<EditorWorldChunkWindowResult> {
  const manifest = await loadWorldManifestFromProject(request.worldId);
  const provider = new WorldChunkProvider(manifest, {
    loadAuthoredChunk: async (reference) => loadWorldChunkFromProject(request.worldId, reference),
  });
  const radius = Math.max(0, request.radius);
  const startChunkX = clamp(request.centerChunkX - radius, manifest.bounds.minChunkX, manifest.bounds.maxChunkX);
  const startChunkY = clamp(request.centerChunkY - radius, manifest.bounds.minChunkY, manifest.bounds.maxChunkY);
  const endChunkX = clamp(request.centerChunkX + radius, manifest.bounds.minChunkX, manifest.bounds.maxChunkX);
  const endChunkY = clamp(request.centerChunkY + radius, manifest.bounds.minChunkY, manifest.bounds.maxChunkY);
  const defaultRegion = manifest.regions.find((region) => region.id === manifest.defaultRegionId);

  if (!defaultRegion) {
    throw new Error(`World "${manifest.worldId}" default region is missing.`);
  }

  const chunks: WorldChunkDefinition[] = [];

  for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
      chunks.push((await provider.loadChunk({ chunkX, chunkY })).chunk);
    }
  }

  const width = (endChunkX - startChunkX + 1) * manifest.chunkSize;
  const height = (endChunkY - startChunkY + 1) * manifest.chunkSize;
  const baseMap = createEditorMap(
    width,
    height,
    defaultRegion.defaultTerrain,
    `${manifest.worldId}_window_${startChunkX}_${startChunkY}_${endChunkX}_${endChunkY}`,
    `${manifest.displayName} ${startChunkX},${startChunkY}-${endChunkX},${endChunkY}`,
    request.fallbackPaint,
  );
  const localBundle: EditorDirtyChunkBundleV1 = {
    version: 1,
    sourceMapId: manifest.worldId,
    exportedAt: new Date().toISOString(),
    chunkSize: manifest.chunkSize,
    worldId: manifest.worldId,
    regionId: defaultRegion.id,
    chunks: chunks.map((chunk) => ({
      ...chunk,
      chunkX: chunk.chunkX - startChunkX,
      chunkY: chunk.chunkY - startChunkY,
    })),
  };
  const map = applyDirtyChunkBundle(baseMap, localBundle);

  return {
    authoredChunkKeys: new Set(manifest.authoredChunks.map((chunk) => createChunkKey(chunk))),
    loadedChunkKeys: createChunkKeySet(startChunkX, startChunkY, endChunkX, endChunkY),
    map,
    manifest,
    originChunkX: startChunkX,
    originChunkY: startChunkY,
    regionId: defaultRegion.id,
  };
}

export async function saveWorldChunksToProject(
  bundle: EditorDirtyChunkBundleV1,
): Promise<SaveWorldChunksResult> {
  await Promise.all(bundle.chunks.map((chunk) => saveWorldChunkToProject(bundle.worldId, chunk)));
  const verifiedChunks = await Promise.all(
    bundle.chunks.map((chunk) => loadWorldChunkFromProject(bundle.worldId, chunk)),
  );

  return {
    savedChunkCount: bundle.chunks.length,
    verifiedChunkCount: verifiedChunks.filter((chunk): chunk is WorldChunkDefinition => chunk !== null).length,
    worldId: bundle.worldId,
  };
}

async function loadWorldChunkFromProject(
  worldId: string,
  coordinate: ChunkCoordinate,
): Promise<WorldChunkDefinition | null> {
  const response = await fetch(
    `${WORLD_DATA_ENDPOINT}/${encodeURIComponent(worldId)}/chunks/${coordinate.chunkX}_${coordinate.chunkY}`,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load chunk ${coordinate.chunkX},${coordinate.chunkY} (${response.status}).`);
  }

  return response.json() as Promise<WorldChunkDefinition>;
}

async function saveWorldChunkToProject(worldId: string, chunk: WorldChunkDefinition): Promise<void> {
  const response = await fetch(
    `${WORLD_DATA_ENDPOINT}/${encodeURIComponent(worldId)}/chunks/${chunk.chunkX}_${chunk.chunkY}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Could not save chunk ${chunk.chunkX},${chunk.chunkY} (${response.status}).`);
  }
}

function createChunkKeySet(startChunkX: number, startChunkY: number, endChunkX: number, endChunkY: number): Set<ChunkKey> {
  const keys = new Set<ChunkKey>();

  for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
      keys.add(createChunkKey({ chunkX, chunkY }));
    }
  }

  return keys;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
