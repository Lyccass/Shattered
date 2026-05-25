/// <reference types="vitest" />
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

const EDITOR_LIBRARY_ROOT = path.resolve('data/editor-library');
const EDITOR_LIBRARY_ASSET_IMAGE_ROOT = path.join(EDITOR_LIBRARY_ROOT, 'assets', 'images');
const EDITOR_LIBRARY_ENDPOINT = '/__shattered_editor_library';

export default defineConfig({
  plugins: [editorProjectLibraryPlugin()],
  build: {
    rollupOptions: {
      input: {
        game: 'index.html',
        editor: 'editor.html',
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
    },
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
