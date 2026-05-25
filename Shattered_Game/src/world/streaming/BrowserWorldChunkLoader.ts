import type { WorldChunkDefinition } from '../../shared/world/ChunkTypes';
import { validateWorldChunkDefinition } from '../../shared/world/ChunkValidation';
import { WorldChunkProvider } from '../../shared/world/WorldChunkProvider';
import type {
  AuthoredWorldChunkReference,
  WorldManifest,
} from '../../shared/world/WorldManifestTypes';
import { assertValidWorldManifest } from '../../shared/world/WorldManifestValidation';

export async function loadWorldChunkProviderFromManifestUrl(
  manifestUrl: string,
): Promise<WorldChunkProvider> {
  const manifest = await fetchJson(manifestUrl);
  assertValidWorldManifest(manifest);
  const manifestBaseUrl = getBaseUrl(manifestUrl);

  return new WorldChunkProvider(manifest, {
    loadAuthoredChunk: (reference) => loadAuthoredWorldChunk(reference, manifestBaseUrl),
  });
}

async function loadAuthoredWorldChunk(
  reference: AuthoredWorldChunkReference,
  manifestBaseUrl: string,
): Promise<WorldChunkDefinition | null> {
  const chunkUrl = resolveChunkUrl(reference.path, manifestBaseUrl);
  const response = await fetch(chunkUrl);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load world chunk "${reference.path}": ${response.status}.`);
  }

  const chunk = await response.json() as unknown;
  const validation = validateWorldChunkDefinition(chunk as WorldChunkDefinition);

  if (!validation.ok) {
    throw new Error(validation.errors.join('\n'));
  }

  return chunk as WorldChunkDefinition;
}

async function fetchJson(url: string): Promise<WorldManifest> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load world manifest "${url}": ${response.status}.`);
  }

  return response.json() as Promise<WorldManifest>;
}

function resolveChunkUrl(path: string, manifestBaseUrl: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('/')) {
    return path;
  }

  if (path.startsWith('data/')) {
    return `/${path}`;
  }

  return `${manifestBaseUrl}${path}`;
}

function getBaseUrl(url: string): string {
  const index = url.lastIndexOf('/');
  return index >= 0 ? url.slice(0, index + 1) : '';
}
