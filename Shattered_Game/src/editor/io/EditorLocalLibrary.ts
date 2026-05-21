import {
  createEditorMapFromMapDefinition,
  parseEditorMapJson,
  serializeEditorMap,
  type EditorMapDefinition,
} from '../../shared/editor/EditorMapModel';
import { applyDirtyChunkBundle, parseDirtyChunkBundleJson, type EditorDirtyChunkBundleV1 } from '../chunks/EditorDirtyChunkBundle';

const MAP_LIBRARY_KEY = 'shattered.editor.map_library.v1';
const CHUNK_LIBRARY_KEY = 'shattered.editor.chunk_library.v1';

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

export function saveMapToLocalLibrary(map: EditorMapDefinition): SavedEditorMapRecord {
  const records = listSavedMaps();
  const record: SavedEditorMapRecord = {
    id: map.id,
    displayName: map.displayName,
    height: map.height,
    json: serializeEditorMap(map),
    previewDataUrl: createMapPreviewDataUrl(map),
    savedAt: new Date().toISOString(),
    width: map.width,
  };
  writeRecords(MAP_LIBRARY_KEY, upsertById(records, record));
  return record;
}

export function listSavedMaps(): SavedEditorMapRecord[] {
  return readRecords<SavedEditorMapRecord>(MAP_LIBRARY_KEY);
}

export function loadSavedMap(recordId: string): EditorMapDefinition {
  const record = listSavedMaps().find((candidate) => candidate.id === recordId);

  if (!record) {
    throw new Error(`Saved map "${recordId}" was not found.`);
  }

  return createEditorMapFromMapDefinition(parseEditorMapJson(record.json));
}

export function deleteSavedMap(recordId: string): void {
  writeRecords(MAP_LIBRARY_KEY, listSavedMaps().filter((record) => record.id !== recordId));
}

export function saveDirtyChunkBundleToLocalLibrary(
  bundle: EditorDirtyChunkBundleV1,
): SavedDirtyChunkBundleRecord {
  const records = listSavedChunkBundles();
  const id = `${bundle.sourceMapId}:${bundle.regionId}:${bundle.exportedAt}`;
  const record: SavedDirtyChunkBundleRecord = {
    id,
    chunkCount: bundle.chunks.length,
    chunkSize: bundle.chunkSize,
    json: JSON.stringify(bundle, null, 2),
    previewDataUrl: createChunkBundlePreviewDataUrl(bundle),
    regionId: bundle.regionId,
    savedAt: new Date().toISOString(),
    sourceMapId: bundle.sourceMapId,
    worldId: bundle.worldId,
  };
  writeRecords(CHUNK_LIBRARY_KEY, upsertById(records, record));
  return record;
}

export function listSavedChunkBundles(): SavedDirtyChunkBundleRecord[] {
  return readRecords<SavedDirtyChunkBundleRecord>(CHUNK_LIBRARY_KEY);
}

export function loadSavedChunkBundle(recordId: string): EditorDirtyChunkBundleV1 {
  const record = listSavedChunkBundles().find((candidate) => candidate.id === recordId);

  if (!record) {
    throw new Error(`Saved chunk bundle "${recordId}" was not found.`);
  }

  return parseDirtyChunkBundleJson(record.json);
}

export function deleteSavedChunkBundle(recordId: string): void {
  writeRecords(CHUNK_LIBRARY_KEY, listSavedChunkBundles().filter((record) => record.id !== recordId));
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
      ? chunk.terrain.tiles.map((terrainRow) =>
        terrainRow.map((id) => chunk.terrainPalette?.[id] ?? 'grass'),
      )
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
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeRecords<T>(key: string, records: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(records));
}

function upsertById<T extends { id: string }>(records: T[], record: T): T[] {
  return [
    record,
    ...records.filter((candidate) => candidate.id !== record.id),
  ];
}
