import {
  createEditorMapFromMapDefinition,
  createEditorMapFromWorldChunkDefinition,
  parseEditorMapJson,
  parseEditorObjectDefinitions,
  parseEditorTerrainBrushes,
  serializeEditorMap,
  serializeEditorMapForProjectLibrary,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { ObjectDefinition } from '../../objects/ObjectTypes';
import { decodeTerrainPaletteLayer } from '../../shared/world/TerrainPalette';
import {
  applyDirtyChunkBundle,
  createReferenceOnlyDirtyChunkBundle,
  parseDirtyChunkBundleJson,
  type EditorDirtyChunkBundleV1,
} from '../chunks/EditorDirtyChunkBundle';

const MAP_LIBRARY_KEY = 'shattered.editor.map_library.v1';
const CHUNK_LIBRARY_KEY = 'shattered.editor.chunk_library.v1';
const WORKING_DRAFT_KEY = 'shattered.editor.working_draft.v1';
const ASSET_LIBRARY_KEY = 'shattered.editor.asset_library.v1';
const ASSET_LIBRARY_RECORD_ID = 'global';
const WORKING_DRAFT_RECORD_ID = 'working';
const PROJECT_LIBRARY_ENDPOINT = '/__shattered_editor_library';
type ProjectLibraryCollection = 'assets' | 'chunks' | 'drafts' | 'maps';

export type SavedEditorMapRecord = {
  id: string;
  displayName: string;
  height: number;
  json: string;
  previewDataUrl: string;
  savedAt: string;
  width: number;
};

export type SavedDirtyChunkBundleRecord = {
  id: string;
  chunkCount: number;
  chunkSize: number;
  json: string;
  previewDataUrl: string;
  regionId: string;
  savedAt: string;
  sourceMapId: string;
  worldId: string;
};

export type EditorAssetLibrary = {
  objectDefinitions: ObjectDefinition[];
  terrainBrushes: EditorTerrainTilePaint[];
};

type SavedEditorAssetLibraryRecord = EditorAssetLibrary & {
  id: typeof ASSET_LIBRARY_RECORD_ID;
  savedAt: string;
};

let projectMapRecordsCache: SavedEditorMapRecord[] = [];
let projectChunkRecordsCache: SavedDirtyChunkBundleRecord[] = [];
let lastCacheWriteSkipped = false;

export function saveMapToLocalLibrary(map: EditorMapDefinition): SavedEditorMapRecord {
  const records = listSavedMaps();
  const record = createMapRecord(map, { portable: false });
  writeRecordsToCache(MAP_LIBRARY_KEY, upsertById(records, record));
  void writeProjectRecord('maps', record);
  return record;
}

export async function saveMapToProjectLibrary(map: EditorMapDefinition): Promise<SavedEditorMapRecord> {
  const record = createMapRecord(map, { portable: false });
  const savedToProject = await writeProjectRecord('maps', record);

  if (savedToProject) {
    projectMapRecordsCache = upsertById(projectMapRecordsCache, record);
    writeRecordsToCache(MAP_LIBRARY_KEY, upsertById(listSavedMaps(), record));
  } else {
    writeRecordsOrThrow(MAP_LIBRARY_KEY, upsertById(listSavedMaps(), record));
  }

  return record;
}

export function listSavedMaps(): SavedEditorMapRecord[] {
  return readRecords<SavedEditorMapRecord>(MAP_LIBRARY_KEY);
}

export async function listSavedMapsFromProjectLibrary(): Promise<SavedEditorMapRecord[]> {
  projectMapRecordsCache = await syncProjectRecords('maps', MAP_LIBRARY_KEY);
  return projectMapRecordsCache;
}

export function saveEditorWorkingDraft(map: EditorMapDefinition): void {
  const json = serializeEditorMapForProjectLibrary(map);
  void writeProjectRecord('drafts', { id: WORKING_DRAFT_RECORD_ID, json }).then((savedToProject) => {
    if (!savedToProject) {
      writeJsonToCache(WORKING_DRAFT_KEY, json);
    }
  });
}

export function loadEditorWorkingDraft(): EditorMapDefinition | null {
  const projectDraft = loadEditorWorkingDraftFromProject();

  if (projectDraft) {
    return projectDraft;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const json = window.localStorage.getItem(WORKING_DRAFT_KEY);

  if (!json) {
    return null;
  }

  try {
    return createEditorMapFromMapDefinition(parseEditorMapJson(json));
  } catch {
    window.localStorage.removeItem(WORKING_DRAFT_KEY);
    return null;
  }
}

function loadEditorWorkingDraftFromProject(): EditorMapDefinition | null {
  const record = readProjectRecordSync(WORKING_DRAFT_RECORD_ID, 'drafts');

  if (!isRecord(record) || typeof record.json !== 'string') {
    return null;
  }

  try {
    return createEditorMapFromMapDefinition(parseEditorMapJson(record.json));
  } catch {
    return null;
  }
}

export function loadEditorAssetLibrary(): EditorAssetLibrary {
  return parseEditorAssetLibraryRecord(readJson(ASSET_LIBRARY_KEY));
}

export function saveEditorAssetLibrary(library: EditorAssetLibrary): void {
  const record = createAssetLibraryRecord(library);
  void writeProjectRecord('assets', record).then((savedToProject) => {
    if (!savedToProject) {
      writeJsonToCache(ASSET_LIBRARY_KEY, JSON.stringify(record));
    }
  });
}

export async function syncEditorAssetLibraryFromProject(): Promise<EditorAssetLibrary> {
  const embeddedLibrary = await collectEmbeddedAssetLibrary();

  try {
    const response = await fetch(`${PROJECT_LIBRARY_ENDPOINT}/assets`);

    if (!response.ok) {
      throw new Error(`Project library returned ${response.status}.`);
    }

    const records = await response.json() as unknown[];
    const projectRecord = records.find((record) =>
      isRecord(record) && record.id === ASSET_LIBRARY_RECORD_ID,
    );
    const projectLibrary = parseEditorAssetLibraryRecord(projectRecord);
    const localLibrary = loadEditorAssetLibrary();
    const merged = mergeEditorAssetLibraries(
      mergeEditorAssetLibraries(localLibrary, projectLibrary),
      embeddedLibrary,
    );
    saveEditorAssetLibrary(merged);
    return merged;
  } catch {
    const merged = mergeEditorAssetLibraries(loadEditorAssetLibrary(), embeddedLibrary);
    saveEditorAssetLibrary(merged);
    return merged;
  }
}

export function loadSavedMap(recordId: string): EditorMapDefinition {
  const record = findById(projectMapRecordsCache, recordId) ?? findById(listSavedMaps(), recordId);

  if (!record) {
    throw new Error(`Saved map "${recordId}" was not found.`);
  }

  return createEditorMapFromMapDefinition(parseEditorMapJson(record.json));
}

export function deleteSavedMap(recordId: string): void {
  projectMapRecordsCache = projectMapRecordsCache.filter((record) => record.id !== recordId);
  writeRecordsToCache(MAP_LIBRARY_KEY, listSavedMaps().filter((record) => record.id !== recordId));
  void deleteProjectRecord('maps', recordId);
}

export function saveDirtyChunkBundleToLocalLibrary(
  bundle: EditorDirtyChunkBundleV1,
): SavedDirtyChunkBundleRecord {
  const records = listSavedChunkBundles();
  const record = createChunkBundleRecord(createReferenceOnlyDirtyChunkBundle(bundle));
  writeRecordsToCache(CHUNK_LIBRARY_KEY, upsertById(records, record));
  void writeProjectRecord('chunks', record);
  return record;
}

export async function saveDirtyChunkBundleToProjectLibrary(
  bundle: EditorDirtyChunkBundleV1,
): Promise<SavedDirtyChunkBundleRecord> {
  const record = createChunkBundleRecord(createReferenceOnlyDirtyChunkBundle(bundle));
  const savedToProject = await writeProjectRecord('chunks', record);

  if (savedToProject) {
    projectChunkRecordsCache = upsertById(projectChunkRecordsCache, record);
    writeRecordsToCache(CHUNK_LIBRARY_KEY, upsertById(listSavedChunkBundles(), record));
  } else {
    writeRecordsOrThrow(CHUNK_LIBRARY_KEY, upsertById(listSavedChunkBundles(), record));
  }

  return record;
}

export function listSavedChunkBundles(): SavedDirtyChunkBundleRecord[] {
  return readRecords<SavedDirtyChunkBundleRecord>(CHUNK_LIBRARY_KEY);
}

export async function listSavedChunkBundlesFromProjectLibrary(): Promise<SavedDirtyChunkBundleRecord[]> {
  projectChunkRecordsCache = await syncProjectRecords('chunks', CHUNK_LIBRARY_KEY);
  return projectChunkRecordsCache;
}

export function loadSavedChunkBundle(recordId: string): EditorDirtyChunkBundleV1 {
  const record = findById(projectChunkRecordsCache, recordId) ?? findById(listSavedChunkBundles(), recordId);

  if (!record) {
    throw new Error(`Saved chunk bundle "${recordId}" was not found.`);
  }

  return parseDirtyChunkBundleJson(record.json);
}

export function deleteSavedChunkBundle(recordId: string): void {
  projectChunkRecordsCache = projectChunkRecordsCache.filter((record) => record.id !== recordId);
  writeRecordsToCache(CHUNK_LIBRARY_KEY, listSavedChunkBundles().filter((record) => record.id !== recordId));
  void deleteProjectRecord('chunks', recordId);
}

export function applySavedChunkBundle(
  map: EditorMapDefinition,
  recordId: string,
  originChunkX = 0,
  originChunkY = 0,
): EditorMapDefinition {
  const bundle = loadSavedChunkBundle(recordId);
  return applyDirtyChunkBundle(map, {
    ...bundle,
    chunks: bundle.chunks.map((chunk) => ({
      ...chunk,
      chunkX: chunk.chunkX - originChunkX,
      chunkY: chunk.chunkY - originChunkY,
    })),
  });
}

export function consumeEditorLibraryCacheMessage(): string | null {
  if (!lastCacheWriteSkipped) {
    return null;
  }

  lastCacheWriteSkipped = false;
  return 'Browser cache skipped because localStorage is full; saved to project library.';
}

async function collectEmbeddedAssetLibrary(): Promise<EditorAssetLibrary> {
  const library: EditorAssetLibrary = {
    objectDefinitions: [],
    terrainBrushes: [],
  };

  for (const record of await listSavedMapsFromProjectLibrary()) {
    try {
      const map = createEditorMapFromMapDefinition(parseEditorMapJson(record.json));
      library.objectDefinitions = mergeById(library.objectDefinitions, map.customObjectDefinitions);
      library.terrainBrushes = mergeById(library.terrainBrushes, map.customTerrainBrushes);
    } catch {
      // Ignore stale/corrupt saved-map records while keeping the editor usable.
    }
  }

  for (const record of await listSavedChunkBundlesFromProjectLibrary()) {
    try {
      const bundle = parseDirtyChunkBundleJson(record.json);
      for (const chunk of bundle.chunks) {
        const map = createEditorMapFromWorldChunkDefinition(chunk);
        library.objectDefinitions = mergeById(library.objectDefinitions, map.customObjectDefinitions);
        library.terrainBrushes = mergeById(library.terrainBrushes, map.customTerrainBrushes);
      }
    } catch {
      // Ignore stale/corrupt chunk records; users can delete them from the library.
    }
  }

  return library;
}

function createMapPreviewDataUrl(map: EditorMapDefinition): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  drawTerrainPreview(ctx, map.terrain, map.width, map.height, canvas.width, canvas.height);

  for (const object of map.objects) {
    const x = Math.floor((object.tileX / Math.max(1, map.width - 1)) * (canvas.width - 1));
    const y = Math.floor((object.tileY / Math.max(1, map.height - 1)) * (canvas.height - 1));
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }

  return canvas.toDataURL('image/png');
}

function createMapRecord(
  map: EditorMapDefinition,
  options: { portable?: boolean } = {},
): SavedEditorMapRecord {
  return {
    id: map.id,
    displayName: map.displayName,
    height: map.height,
    json: options.portable === false
      ? serializeEditorMapForProjectLibrary(map)
      : serializeEditorMap(map),
    previewDataUrl: createMapPreviewDataUrl(map),
    savedAt: new Date().toISOString(),
    width: map.width,
  };
}

function createChunkBundleRecord(bundle: EditorDirtyChunkBundleV1): SavedDirtyChunkBundleRecord {
  return {
    id: `${bundle.sourceMapId}:${bundle.regionId}:${bundle.exportedAt}`,
    chunkCount: bundle.chunks.length,
    chunkSize: bundle.chunkSize,
    json: JSON.stringify(bundle, null, 2),
    previewDataUrl: createChunkBundlePreviewDataUrl(bundle),
    regionId: bundle.regionId,
    savedAt: new Date().toISOString(),
    sourceMapId: bundle.sourceMapId,
    worldId: bundle.worldId,
  };
}

function createAssetLibraryRecord(library: EditorAssetLibrary): SavedEditorAssetLibraryRecord {
  return {
    id: ASSET_LIBRARY_RECORD_ID,
    objectDefinitions: library.objectDefinitions,
    savedAt: new Date().toISOString(),
    terrainBrushes: library.terrainBrushes,
  };
}

function createChunkBundlePreviewDataUrl(bundle: EditorDirtyChunkBundleV1): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const columns = Math.max(1, Math.ceil(Math.sqrt(bundle.chunks.length)));
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / Math.max(1, Math.ceil(bundle.chunks.length / columns));

  bundle.chunks.forEach((chunk, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const terrain = chunk.terrain.encoding === 'palette'
      ? decodeTerrainPaletteLayer(chunk.terrainPalette ?? {}, chunk.terrain.tiles)
      : chunk.terrain.tiles;
    ctx.save();
    ctx.translate(column * cellWidth, row * cellHeight);
    ctx.beginPath();
    ctx.rect(0, 0, cellWidth, cellHeight);
    ctx.clip();
    drawTerrainPreview(ctx, terrain, chunk.width, chunk.height, cellWidth, cellHeight);
    ctx.strokeStyle = '#bc8c40';
    ctx.strokeRect(0.5, 0.5, cellWidth - 1, cellHeight - 1);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

function drawTerrainPreview(
  ctx: CanvasRenderingContext2D,
  terrain: string[][],
  width: number,
  height: number,
  previewWidth: number,
  previewHeight: number,
): void {
  const tileW = previewWidth / Math.max(1, width);
  const tileH = previewHeight / Math.max(1, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      ctx.fillStyle = terrainColor(terrain[y]?.[x] ?? 'grass');
      ctx.fillRect(Math.floor(x * tileW), Math.floor(y * tileH), Math.ceil(tileW), Math.ceil(tileH));
    }
  }
}

function terrainColor(family: string): string {
  switch (family) {
    case 'dirt':
      return '#76613e';
    case 'sand':
      return '#bca76a';
    case 'stone':
      return '#737373';
    case 'water':
      return '#1e5d76';
    case 'grass':
    default:
      return '#426b34';
  }
}

function readRecords<T>(key: string): T[] {
  const parsed = readJson(key);
  return Array.isArray(parsed) ? parsed as T[] : [];
}

function readJson(key: string): unknown {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRecordsToCache<T>(key: string, records: T[]): boolean {
  return writeJsonToCache(key, JSON.stringify(records));
}

function writeRecordsOrThrow<T>(key: string, records: T[]): void {
  if (!writeRecordsToCache(key, records)) {
    throw new Error('Editor library storage is full. Run the editor through the Vite dev server so maps and assets can save to the project library, or delete browser editor data to free space.');
  }
}

function writeJsonToCache(key: string, json: string): boolean {
  try {
    window.localStorage.setItem(key, json);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      lastCacheWriteSkipped = true;
      return false;
    }
    throw error;
  }
}

async function syncProjectRecords<T extends { id: string }>(
  collection: ProjectLibraryCollection,
  storageKey: string,
): Promise<T[]> {
  try {
    const cachedRecords = readRecords<T>(storageKey);
    const response = await fetch(`${PROJECT_LIBRARY_ENDPOINT}/${collection}`);

    if (!response.ok) {
      throw new Error(`Project library returned ${response.status}.`);
    }

    const projectRecords = await response.json() as T[];
    const projectIds = new Set(projectRecords.map((record) => record.id));
    const localOnlyRecords = cachedRecords.filter((record) => !projectIds.has(record.id));
    const records = [...projectRecords, ...localOnlyRecords];
    writeRecordsToCache(storageKey, records);

    for (const record of localOnlyRecords) {
      void writeProjectRecord(collection, record);
    }

    return records;
  } catch {
    return readRecords<T>(storageKey);
  }
}

async function writeProjectRecord(
  collection: ProjectLibraryCollection,
  record: { id: string } & Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch(`${PROJECT_LIBRARY_ENDPOINT}/${collection}/${encodeURIComponent(record.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    return response.ok;
  } catch {
    // The production build and plain static hosts do not have the dev middleware.
    // In that case localStorage remains the fallback cache.
    return false;
  }
}

function readProjectRecordSync(id: string, collection: ProjectLibraryCollection): unknown | null {
  if (typeof XMLHttpRequest === 'undefined') {
    return null;
  }

  try {
    const request = new XMLHttpRequest();
    request.open('GET', `${PROJECT_LIBRARY_ENDPOINT}/${collection}/${encodeURIComponent(id)}`, false);
    request.send();

    if (request.status < 200 || request.status >= 300 || !request.responseText) {
      return null;
    }

    return JSON.parse(request.responseText) as unknown;
  } catch {
    return null;
  }
}

async function deleteProjectRecord(collection: ProjectLibraryCollection, id: string): Promise<void> {
  try {
    await fetch(`${PROJECT_LIBRARY_ENDPOINT}/${collection}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {
    // Local deletion already happened; project deletion is best-effort.
  }
}

function upsertById<T extends { id: string }>(records: T[], record: T): T[] {
  return [
    record,
    ...records.filter((candidate) => candidate.id !== record.id),
  ];
}

function findById<T extends { id: string }>(records: T[], id: string): T | undefined {
  return records.find((record) => record.id === id);
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  );
}

function parseEditorAssetLibraryRecord(value: unknown): EditorAssetLibrary {
  if (!isRecord(value)) {
    return { objectDefinitions: [], terrainBrushes: [] };
  }

  return {
    objectDefinitions: parseEditorObjectDefinitions(value.objectDefinitions),
    terrainBrushes: parseEditorTerrainBrushes(value.terrainBrushes),
  };
}

function mergeEditorAssetLibraries(
  first: EditorAssetLibrary,
  second: EditorAssetLibrary,
): EditorAssetLibrary {
  return {
    objectDefinitions: mergeById(first.objectDefinitions, second.objectDefinitions),
    terrainBrushes: mergeById(first.terrainBrushes, second.terrainBrushes),
  };
}

function mergeById<T extends { id: string }>(first: T[], second: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of first) {
    merged.set(item.id, item);
  }

  for (const item of second) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
