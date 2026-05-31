import type { MapDefinition } from '../map/MapTypes';
import { EDITOR_GAME_MAP_STORAGE_KEY, type EditorMapDefinition } from './EditorMapTypes';
import { serializeEditorMap, parseEditorMapJson } from './EditorMapSerializer';

const EDITOR_PROJECT_LIBRARY_ENDPOINT = '/__shattered_editor_library';
const EDITOR_PROJECT_PUBLISHED_MAP_ID = 'editor_test_map';

export async function publishEditorMapForGame(map: EditorMapDefinition): Promise<void> {
  if (typeof fetch !== 'undefined') {
    const response = await fetch(
      `${EDITOR_PROJECT_LIBRARY_ENDPOINT}/published/${EDITOR_PROJECT_PUBLISHED_MAP_ID}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: serializeEditorMap(map),
      },
    );

    if (response.ok) {
      clearPublishedEditorMapFromLocalStorage();
      return;
    }
  }

  publishEditorMapToLocalStorage(map);
}

export function clearPublishedEditorMapForGame(): void {
  clearPublishedEditorMapFromLocalStorage();

  if (typeof fetch !== 'undefined') {
    void fetch(`${EDITOR_PROJECT_LIBRARY_ENDPOINT}/published/${EDITOR_PROJECT_PUBLISHED_MAP_ID}`, {
      method: 'DELETE',
    });
  }
}

export function loadPublishedEditorMapDefinition(): MapDefinition | null {
  const projectMap = loadPublishedEditorMapDefinitionFromProjectLibrary();

  if (projectMap) {
    return projectMap;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const json = window.localStorage.getItem(EDITOR_GAME_MAP_STORAGE_KEY);

  if (!json) return null;

  try {
    return parseEditorMapJson(json);
  } catch {
    return null;
  }
}

function loadPublishedEditorMapDefinitionFromProjectLibrary(): MapDefinition | null {
  if (typeof XMLHttpRequest === 'undefined') {
    return null;
  }

  try {
    const request = new XMLHttpRequest();
    request.open('GET', `${EDITOR_PROJECT_LIBRARY_ENDPOINT}/published/${EDITOR_PROJECT_PUBLISHED_MAP_ID}`, false);
    request.send();

    if (request.status < 200 || request.status >= 300 || !request.responseText) {
      return null;
    }

    return parseEditorMapJson(request.responseText);
  } catch {
    return null;
  }
}

function publishEditorMapToLocalStorage(map: EditorMapDefinition): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Editor map publishing requires the Vite editor project library or browser localStorage.');
  }

  window.localStorage.setItem(EDITOR_GAME_MAP_STORAGE_KEY, serializeEditorMap(map));
}

function clearPublishedEditorMapFromLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(EDITOR_GAME_MAP_STORAGE_KEY);
}
