import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import {
  createWorldManifestInProject,
  listProjectWorlds,
} from '../io/EditorWorldLibrary';

type LoadedChunkWindowPanelState = {
  originChunkX: number;
  originChunkY: number;
  sourceRecordId: string;
  sourceType: 'map' | 'world';
};

type EditorWorldPanelCallbacks = {
  chunkSize: number;
  getLoadedChunkWindow: () => LoadedChunkWindowPanelState | null;
  getRegionId: () => string;
  getWorldId: () => string;
  loadWorldChunkWindow: (
    worldId: string,
    centerChunkX: number,
    centerChunkY: number,
    radius: number,
  ) => Promise<boolean>;
  setRegionId: (regionId: string) => void;
  setStatus: (message: string) => void;
  setWorldId: (worldId: string) => void;
};

export class EditorWorldPanelController {
  constructor(private readonly callbacks: EditorWorldPanelCallbacks) {}

  bindEvents(): void {
    document.getElementById('ed-chunk-window-close')?.addEventListener('click', () => this.hideChunkWindowPanel());
    document.getElementById('ed-chunk-window-cancel')?.addEventListener('click', () => this.hideChunkWindowPanel());
    document.getElementById('ed-chunk-window-load')?.addEventListener('click', () => this.loadChunkWindowFromPanel());
    document.getElementById('ed-world-panel-close')?.addEventListener('click', () => this.hideWorldPanel());
    document.getElementById('ed-world-panel-cancel')?.addEventListener('click', () => this.hideWorldPanel());
    document.getElementById('ed-world-panel-open-selected')?.addEventListener('click', () => this.openWorldFromPanel());
    document.getElementById('ed-world-panel-create')?.addEventListener('click', () => { void this.createWorldFromPanel(); });
    this.bindWorldCreateNameGenerator();
  }

  async openChunkWindowPanel(): Promise<void> {
    const panel = document.getElementById('ed-chunk-window');
    const select = document.getElementById('ed-chunk-window-map') as HTMLSelectElement | null;
    const chunkX = document.getElementById('ed-chunk-window-x') as HTMLInputElement | null;
    const chunkY = document.getElementById('ed-chunk-window-y') as HTMLInputElement | null;
    const radius = document.getElementById('ed-chunk-window-radius') as HTMLInputElement | null;
    const worldIdInput = document.getElementById('ed-chunk-window-world-id') as HTMLInputElement | null;
    const regionIdInput = document.getElementById('ed-chunk-window-region-id') as HTMLInputElement | null;

    if (!panel || !select || !chunkX || !chunkY || !radius) {
      return;
    }

    const worlds = await listProjectWorlds();
    const loadedWindow = this.callbacks.getLoadedChunkWindow();
    const worldId = this.callbacks.getWorldId();

    select.innerHTML = '';
    for (const world of worlds) {
      const option = document.createElement('option');
      option.value = `world:${world.worldId}`;
      option.textContent = `${world.displayName} (${world.authoredChunkCount} authored)`;
      select.appendChild(option);
    }

    if (select.options.length === 0) {
      const option = document.createElement('option');
      option.value = 'world:the_wake';
      option.textContent = 'The Wake world chunks';
      select.appendChild(option);
    }

    select.value = loadedWindow?.sourceType === 'world'
      ? loadedWindow.sourceRecordId
      : `world:${worldId}`;
    chunkX.value = String(loadedWindow?.originChunkX ?? 0);
    chunkY.value = String(loadedWindow?.originChunkY ?? 0);
    radius.value = '0';
    if (worldIdInput) worldIdInput.value = worldId;
    if (regionIdInput) regionIdInput.value = this.callbacks.getRegionId();
    panel.classList.remove('editor-hidden');
  }

  hideChunkWindowPanel(): void {
    document.getElementById('ed-chunk-window')?.classList.add('editor-hidden');
  }

  loadChunkWindowFromPanel(): void {
    try {
      const select = document.getElementById('ed-chunk-window-map') as HTMLSelectElement | null;
      const chunkXInput = document.getElementById('ed-chunk-window-x') as HTMLInputElement | null;
      const chunkYInput = document.getElementById('ed-chunk-window-y') as HTMLInputElement | null;
      const radiusInput = document.getElementById('ed-chunk-window-radius') as HTMLInputElement | null;
      const worldIdInput = document.getElementById('ed-chunk-window-world-id') as HTMLInputElement | null;
      const regionIdInput = document.getElementById('ed-chunk-window-region-id') as HTMLInputElement | null;

      if (!select || !chunkXInput || !chunkYInput || !radiusInput) {
        return;
      }

      const recordId = select.value;
      const centerChunkX = parseIntegerInput(chunkXInput.value, 0);
      const centerChunkY = parseIntegerInput(chunkYInput.value, 0);
      const radius = Math.max(0, parseIntegerInput(radiusInput.value, 0));
      const currentWorldId = this.callbacks.getWorldId();
      const nextWorldId = worldIdInput?.value.trim() || currentWorldId;
      this.callbacks.setWorldId(nextWorldId);
      this.callbacks.setRegionId(regionIdInput?.value.trim() || this.callbacks.getRegionId());

      const worldId = recordId.startsWith('world:') ? recordId.slice('world:'.length) : nextWorldId;
      void this.callbacks.loadWorldChunkWindow(worldId || nextWorldId, centerChunkX, centerChunkY, radius);
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'Chunk window load failed.');
    }
  }

  async openWorldPanel(): Promise<void> {
    const panel = document.getElementById('ed-world-panel');
    const select = document.getElementById('ed-world-select') as HTMLSelectElement | null;
    const centerX = document.getElementById('ed-world-open-chunk-x') as HTMLInputElement | null;
    const centerY = document.getElementById('ed-world-open-chunk-y') as HTMLInputElement | null;
    const radius = document.getElementById('ed-world-open-radius') as HTMLInputElement | null;

    if (!panel || !select || !centerX || !centerY || !radius) {
      return;
    }

    const worlds = await listProjectWorlds();
    const loadedWindow = this.callbacks.getLoadedChunkWindow();
    const worldId = this.callbacks.getWorldId();

    select.innerHTML = '';
    for (const world of worlds) {
      const option = document.createElement('option');
      option.value = world.worldId;
      option.textContent = `${world.displayName} (${world.worldId})`;
      select.appendChild(option);
    }

    select.value = worlds.some((world) => world.worldId === worldId)
      ? worldId
      : worlds[0]?.worldId ?? 'the_wake';
    centerX.value = String(loadedWindow?.originChunkX ?? 0);
    centerY.value = String(loadedWindow?.originChunkY ?? 0);
    radius.value = '0';
    setInputValue('ed-world-create-name', 'New Dungeon');
    this.updateGeneratedWorldCreateFields();
    panel.classList.remove('editor-hidden');
  }

  hideWorldPanel(): void {
    document.getElementById('ed-world-panel')?.classList.add('editor-hidden');
  }

  openWorldFromPanel(): void {
    const select = document.getElementById('ed-world-select') as HTMLSelectElement | null;
    const centerX = document.getElementById('ed-world-open-chunk-x') as HTMLInputElement | null;
    const centerY = document.getElementById('ed-world-open-chunk-y') as HTMLInputElement | null;
    const radius = document.getElementById('ed-world-open-radius') as HTMLInputElement | null;

    if (!select || !centerX || !centerY || !radius) {
      return;
    }

    void this.callbacks.loadWorldChunkWindow(
      select.value || this.callbacks.getWorldId(),
      parseIntegerInput(centerX.value, 0),
      parseIntegerInput(centerY.value, 0),
      Math.max(0, parseIntegerInput(radius.value, 0)),
    ).then((loaded) => {
      if (loaded) this.hideWorldPanel();
    });
  }

  async createWorldFromPanel(): Promise<void> {
    try {
      this.updateGeneratedWorldCreateFields();
      const displayName = getInputValue('ed-world-create-name', 'New Dungeon');
      const worldId = slugifyMapId(displayName);
      const regionId = createDefaultRegionId(worldId);
      const regionName = createDefaultRegionName(displayName);
      const defaultTerrain = getSelectValue('ed-world-create-terrain', 'grass') as TerrainFamily;
      const widthChunks = Math.max(1, parseIntegerInput(getInputValue('ed-world-create-width', '1'), 1));
      const heightChunks = Math.max(1, parseIntegerInput(getInputValue('ed-world-create-height', '1'), 1));
      const spawnChunkX = parseIntegerInput(getInputValue('ed-world-create-spawn-chunk-x', '0'), 0);
      const spawnChunkY = parseIntegerInput(getInputValue('ed-world-create-spawn-chunk-y', '0'), 0);
      const spawnTileX = parseIntegerInput(getInputValue('ed-world-create-spawn-tile-x', '16'), 16);
      const spawnTileY = parseIntegerInput(getInputValue('ed-world-create-spawn-tile-y', '16'), 16);

      await createWorldManifestInProject({
        bounds: {
          minChunkX: 0,
          minChunkY: 0,
          maxChunkX: widthChunks - 1,
          maxChunkY: heightChunks - 1,
        },
        chunkSize: this.callbacks.chunkSize,
        defaultTerrain,
        defaultWalkable: defaultTerrain !== 'water',
        displayName,
        regionId,
        regionName,
        spawnChunkX,
        spawnChunkY,
        spawnTileX,
        spawnTileY,
        worldId,
      });
      this.callbacks.setStatus(`Created ${displayName}. Opening chunk ${spawnChunkX},${spawnChunkY}.`);
      const loaded = await this.callbacks.loadWorldChunkWindow(worldId, spawnChunkX, spawnChunkY, 0);
      if (loaded) this.hideWorldPanel();
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'World creation failed.');
    }
  }

  private bindWorldCreateNameGenerator(): void {
    const displayNameInput = document.getElementById('ed-world-create-name') as HTMLInputElement | null;
    displayNameInput?.addEventListener('input', () => this.updateGeneratedWorldCreateFields());
  }

  private updateGeneratedWorldCreateFields(): void {
    const displayName = getInputValue('ed-world-create-name', 'New Dungeon');
    const worldId = slugifyMapId(displayName);
    setInputValue('ed-world-create-id', worldId);
    setInputValue('ed-world-create-region-id', createDefaultRegionId(worldId));
    setInputValue('ed-world-create-region-name', createDefaultRegionName(displayName));
  }
}

function slugifyMapId(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'editor_map';
}

function createDefaultRegionId(worldId: string): string {
  return `${worldId}_region`;
}

function createDefaultRegionName(displayName: string): string {
  return displayName.trim() || 'New Dungeon';
}

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getInputValue(id: string, fallback: string): string {
  const input = document.getElementById(id) as HTMLInputElement | null;
  const value = input?.value.trim();
  return value || fallback;
}

function setInputValue(id: string, value: string): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (input) input.value = value;
}

function getSelectValue(id: string, fallback: string): string {
  const select = document.getElementById(id) as HTMLSelectElement | null;
  return select?.value || fallback;
}
