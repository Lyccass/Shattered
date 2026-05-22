/// <reference types="vitest" />
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

const EDITOR_LIBRARY_ROOT = path.resolve('data/editor-library');

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
  const [, collection, encodedId] = url.pathname.split('/');

  if (collection !== 'maps' && collection !== 'chunks' && collection !== 'assets') {
    sendJson(res, 404, { error: 'Unknown editor library collection.' });
    return;
  }

  const dir = path.join(EDITOR_LIBRARY_ROOT, collection);

  if (req.method === 'GET' && !encodedId) {
    const records = await readRecordsFromDisk(dir);
    sendJson(res, 200, records);
    return;
  }

  if (req.method === 'PUT' && encodedId) {
    const id = decodeURIComponent(encodedId);
    const body = await readRequestJson(req);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${toFileKey(id)}.json`), JSON.stringify(body, null, 2), 'utf8');
    sendJson(res, 200, body);
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
