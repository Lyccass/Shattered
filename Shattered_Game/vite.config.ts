/// <reference types="vitest" />
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

const EDITOR_LIBRARY_ROOT = path.resolve('data/editor-library');
const EDITOR_LIBRARY_ASSET_IMAGE_ROOT = path.join(EDITOR_LIBRARY_ROOT, 'assets', 'images');
const EDITOR_LIBRARY_ENDPOINT = '/__shattered_editor_library';
const WORLD_DATA_ROOT = path.resolve('data/worlds');
const WORLD_DATA_ENDPOINT = '/__shattered_world';

export default defineConfig({
  plugins: [editorProjectLibraryPlugin()],
  build: {
    rollupOptions: {
      input: {
        game: 'index.html',
        editor: 'editor.html',
        forestPreview: 'forest-pack.html',
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});

function editorProjectLibraryPlugin(): Plugin {
  return {
    name: 'shattered-editor-project-library',
    configureServer(server) {
      server.middlewares.use('/__shattered_editor_library', async (req, res) => {
        try {
          await handleEditorLibraryRequest(req, res);
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Editor project library request failed.',
          });
        }
      });
      server.middlewares.use(WORLD_DATA_ENDPOINT, async (req, res) => {
        try {
          await handleWorldDataRequest(req, res);
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'World data request failed.',
          });
        }
      });
    },
  };
}

async function handleWorldDataRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const [encodedWorldId, resource, encodedChunkKey] = url.pathname.split('/').filter(Boolean);

  if (!encodedWorldId) {
    await handleWorldIndexRequest(req, res);
    return;
  }

  if (!encodedWorldId || !isSafePathSegment(encodedWorldId)) {
    sendJson(res, 404, { error: 'Unknown world.' });
    return;
  }

  const worldId = decodeURIComponent(encodedWorldId);

  if (!isSafePathSegment(worldId)) {
    sendJson(res, 404, { error: 'Unknown world.' });
    return;
  }

  if (resource === 'manifest') {
    await handleWorldManifestRequest(req, res, worldId);
    return;
  }

  if (resource === 'chunks') {
    await handleWorldChunkRequest(req, res, worldId, encodedChunkKey);
    return;
  }

  sendJson(res, 404, { error: 'Unknown world data resource.' });
}

async function handleWorldIndexRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Unsupported world index method.' });
    return;
  }

  const entries = await readdir(WORLD_DATA_ROOT, { withFileTypes: true }).catch((error: unknown) => {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  });
  const worlds: Array<{
    worldId: string;
    displayName: string;
    chunkSize: number;
    bounds: unknown;
    authoredChunkCount: number;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafePathSegment(entry.name)) {
      continue;
    }

    try {
      const manifest = JSON.parse(await readFile(getWorldManifestPath(entry.name), 'utf8')) as Record<string, unknown>;
      worlds.push({
        worldId: String(manifest.worldId ?? entry.name),
        displayName: String(manifest.displayName ?? entry.name),
        chunkSize: Number(manifest.chunkSize ?? 0),
        bounds: manifest.bounds,
        authoredChunkCount: Array.isArray(manifest.authoredChunks) ? manifest.authoredChunks.length : 0,
      });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        continue;
      }

      throw error;
    }
  }

  worlds.sort((a, b) => a.displayName.localeCompare(b.displayName));
  sendJson(res, 200, { worlds });
}

async function handleWorldManifestRequest(
  req: IncomingMessage,
  res: ServerResponse,
  worldId: string,
): Promise<void> {
  if (req.method === 'GET') {
    const manifest = JSON.parse(await readFile(getWorldManifestPath(worldId), 'utf8')) as unknown;
    sendJson(res, 200, manifest);
    return;
  }

  if (req.method === 'PUT') {
    const manifest = await readRequestJson(req);

    if (!isRecord(manifest) || manifest.worldId !== worldId) {
      sendJson(res, 400, { error: 'Manifest body does not match the requested world path.' });
      return;
    }

    await mkdir(path.dirname(getWorldManifestPath(worldId)), { recursive: true });
    await writeFile(getWorldManifestPath(worldId), JSON.stringify(manifest, null, 2), 'utf8');
    sendJson(res, 200, manifest);
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Unsupported world manifest method.' });
    return;
  }
}

async function handleWorldChunkRequest(
  req: IncomingMessage,
  res: ServerResponse,
  worldId: string,
  encodedChunkKey: string | undefined,
): Promise<void> {
  if (!encodedChunkKey || !isSafeChunkFileKey(encodedChunkKey)) {
    sendJson(res, 404, { error: 'Unknown world chunk.' });
    return;
  }

  const chunkKey = decodeURIComponent(encodedChunkKey);

  if (!isSafeChunkFileKey(chunkKey)) {
    sendJson(res, 404, { error: 'Unknown world chunk.' });
    return;
  }

  const chunkPath = getWorldChunkPath(worldId, chunkKey);

  if (req.method === 'GET') {
    try {
      const chunk = JSON.parse(await readFile(chunkPath, 'utf8')) as unknown;
      sendJson(res, 200, chunk);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        sendJson(res, 404, { error: 'World chunk not found.' });
        return;
      }

      throw error;
    }
    return;
  }

  if (req.method === 'PUT') {
    const chunk = await readRequestJson(req);
    const chunkCoordinate = parseChunkFileKey(chunkKey);

    if (
      !isRecord(chunk) ||
      chunk.worldId !== worldId ||
      chunk.chunkX !== chunkCoordinate.chunkX ||
      chunk.chunkY !== chunkCoordinate.chunkY ||
      typeof chunk.regionId !== 'string'
    ) {
      sendJson(res, 400, { error: 'Chunk body does not match the requested world/chunk path.' });
      return;
    }

    await mkdir(path.dirname(chunkPath), { recursive: true });
    await writeFile(chunkPath, `${JSON.stringify(chunk)}\n`, 'utf8');
    await upsertWorldManifestChunkReference(worldId, {
      chunkX: chunkCoordinate.chunkX,
      chunkY: chunkCoordinate.chunkY,
      regionId: chunk.regionId,
      path: `data/worlds/${worldId}/chunks/${chunkKey}.json`,
    });
    sendJson(res, 200, chunk);
    return;
  }

  sendJson(res, 405, { error: 'Unsupported world chunk method.' });
}

async function upsertWorldManifestChunkReference(
  worldId: string,
  reference: { chunkX: number; chunkY: number; regionId: string; path: string },
): Promise<void> {
  const manifestPath = getWorldManifestPath(worldId);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  const authoredChunks = Array.isArray(manifest.authoredChunks)
    ? manifest.authoredChunks.filter((chunk) =>
      !(
        isRecord(chunk) &&
        chunk.chunkX === reference.chunkX &&
        chunk.chunkY === reference.chunkY
      ),
    )
    : [];

  authoredChunks.push(reference);
  authoredChunks.sort((a, b) => {
    const left = isRecord(a) ? `${a.chunkY ?? 0},${a.chunkX ?? 0}` : '';
    const right = isRecord(b) ? `${b.chunkY ?? 0},${b.chunkX ?? 0}` : '';
    return left.localeCompare(right, undefined, { numeric: true });
  });
  manifest.authoredChunks = authoredChunks;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

function getWorldManifestPath(worldId: string): string {
  return path.join(WORLD_DATA_ROOT, worldId, 'world.manifest.json');
}

function getWorldChunkPath(worldId: string, chunkKey: string): string {
  return path.join(WORLD_DATA_ROOT, worldId, 'chunks', `${chunkKey}.json`);
}

function parseChunkFileKey(key: string): { chunkX: number; chunkY: number } {
  const [x = '0', y = '0'] = key.split('_');
  return {
    chunkX: Number.parseInt(x, 10),
    chunkY: Number.parseInt(y, 10),
  };
}

async function handleEditorLibraryRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const [collection, encodedId, ...restPath] = url.pathname.split('/').filter(Boolean);

  if (
    collection !== 'maps' &&
    collection !== 'chunks' &&
    collection !== 'assets' &&
    collection !== 'drafts' &&
    collection !== 'published'
  ) {
    sendJson(res, 404, { error: 'Unknown editor library collection.' });
    return;
  }

  if (collection === 'assets' && encodedId === 'images') {
    await handleAssetImageRequest(restPath.join('/'), res);
    return;
  }

  const dir = path.join(EDITOR_LIBRARY_ROOT, collection);

  if (req.method === 'GET' && !encodedId) {
    const records = await readRecordsFromDisk(dir);
    sendJson(res, 200, records);
    return;
  }

  if (req.method === 'GET' && encodedId) {
    const id = decodeURIComponent(encodedId);
    const record = JSON.parse(await readFile(path.join(dir, `${toFileKey(id)}.json`), 'utf8')) as unknown;
    sendJson(res, 200, record);
    return;
  }

  if (req.method === 'PUT' && encodedId) {
    const id = decodeURIComponent(encodedId);
    const body = await readRequestJson(req);
    const record = collection === 'assets'
      ? await materializeAssetRecordImages(body)
      : collection === 'published'
        ? await materializePublishedMapImages(body)
        : body;
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${toFileKey(id)}.json`), JSON.stringify(record, null, 2), 'utf8');
    sendJson(res, 200, record);
    return;
  }

  if (req.method === 'DELETE' && encodedId) {
    const id = decodeURIComponent(encodedId);
    await rm(path.join(dir, `${toFileKey(id)}.json`), { force: true });
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { error: 'Unsupported editor library method.' });
}

async function handleAssetImageRequest(fileName: string, res: ServerResponse): Promise<void> {
  if (!fileName || fileName.includes('..') || fileName.includes('/')) {
    sendJson(res, 404, { error: 'Unknown editor asset image.' });
    return;
  }

  try {
    const image = await readFile(path.join(EDITOR_LIBRARY_ASSET_IMAGE_ROOT, fileName));
    res.statusCode = 200;
    res.setHeader('Content-Type', getImageContentType(fileName));
    res.end(image);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      sendJson(res, 404, { error: 'Editor asset image not found.' });
      return;
    }

    throw error;
  }
}

async function materializeAssetRecordImages(value: unknown): Promise<unknown> {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    ...(Array.isArray(value.terrainBrushes)
      ? { terrainBrushes: await Promise.all(value.terrainBrushes.map(materializeTerrainBrushImage)) }
      : {}),
    ...(Array.isArray(value.objectDefinitions)
      ? { objectDefinitions: await Promise.all(value.objectDefinitions.map(materializeObjectDefinitionImages)) }
      : {}),
  };
}

async function materializePublishedMapImages(value: unknown): Promise<unknown> {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    return value;
  }

  return {
    ...value,
    metadata: {
      ...value.metadata,
      ...(isRecord(value.metadata.editorTerrainTiles)
        ? { editorTerrainTiles: await materializeTerrainTileRecordImages(value.metadata.editorTerrainTiles) }
        : {}),
      ...(Array.isArray(value.metadata.editorTerrainBrushes)
        ? { editorTerrainBrushes: await Promise.all(value.metadata.editorTerrainBrushes.map(materializeTerrainBrushImage)) }
        : {}),
      ...(Array.isArray(value.metadata.editorObjectDefinitions)
        ? { editorObjectDefinitions: await Promise.all(value.metadata.editorObjectDefinitions.map(materializeObjectDefinitionImages)) }
        : {}),
    },
  };
}

async function materializeTerrainTileRecordImages(value: Record<string, unknown>): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(value).map(async ([key, paint]) => [key, await materializeTerrainBrushImage(paint)] as const),
  );
  return Object.fromEntries(entries);
}

async function materializeTerrainBrushImage(value: unknown): Promise<unknown> {
  if (!isRecord(value) || typeof value.textureDataUrl !== 'string' || typeof value.textureKey !== 'string') {
    return value;
  }

  const imageUrl = await writeAssetImage(value.textureKey, value.textureDataUrl);
  return imageUrl ? { ...value, textureDataUrl: imageUrl } : value;
}

async function materializeObjectDefinitionImages(value: unknown): Promise<unknown> {
  if (!isRecord(value) || !isRecord(value.visual) || !Array.isArray(value.visual.parts)) {
    return value;
  }

  return {
    ...value,
    visual: {
      ...value.visual,
      parts: await Promise.all(value.visual.parts.map(materializeObjectVisualPartImage)),
    },
  };
}

async function materializeObjectVisualPartImage(value: unknown): Promise<unknown> {
  if (
    !isRecord(value) ||
    value.shape !== 'sprite' ||
    typeof value.editorTextureDataUrl !== 'string' ||
    typeof value.textureKey !== 'string'
  ) {
    return value;
  }

  const imageUrl = await writeAssetImage(value.textureKey, value.editorTextureDataUrl);
  return imageUrl ? { ...value, editorTextureDataUrl: imageUrl } : value;
}

async function writeAssetImage(textureKey: string, dataUrl: string): Promise<string | null> {
  const parsed = parseImageDataUrl(dataUrl);

  if (!parsed) {
    return null;
  }

  const fileName = `${toFileKey(textureKey)}.${parsed.extension}`;
  await mkdir(EDITOR_LIBRARY_ASSET_IMAGE_ROOT, { recursive: true });
  await writeFile(path.join(EDITOR_LIBRARY_ASSET_IMAGE_ROOT, fileName), parsed.data);
  return `${EDITOR_LIBRARY_ENDPOINT}/assets/images/${fileName}`;
}

function parseImageDataUrl(dataUrl: string): { data: Buffer; extension: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);

  if (!match) {
    return null;
  }

  return {
    data: Buffer.from(match[2], 'base64'),
    extension: imageExtensionForMime(match[1]),
  };
}

function imageExtensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/svg+xml':
      return 'svg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/png':
    default:
      return 'png';
  }
}

function getImageContentType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.png':
    default:
      return 'image/png';
  }
}

async function readRecordsFromDisk(dir: string): Promise<unknown[]> {
  try {
    const files = await readdir(dir);
    const records = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown),
    );

    return records.sort((a, b) => {
      const aSaved = getSavedAt(a);
      const bSaved = getSavedAt(b);
      return bSaved.localeCompare(aSaved);
    });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function getSavedAt(value: unknown): string {
  return typeof value === 'object' &&
    value !== null &&
    'savedAt' in value &&
    typeof value.savedAt === 'string'
    ? value.savedAt
    : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFileKey(id: string): string {
  return Buffer.from(id).toString('base64url');
}

function isSafePathSegment(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

function isSafeChunkFileKey(value: string): boolean {
  return /^-?\d+_-?\d+$/.test(value);
}

function readRequestJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
