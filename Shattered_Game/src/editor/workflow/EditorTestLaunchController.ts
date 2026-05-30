import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import type { EditorMapIoController } from '../io/EditorMapIoController';
import {
  resolveEditorWorldTestSpawn,
  type EditorResolvedTestSpawn,
  type EditorTestSpawnMode,
} from './EditorWorldTestSpawn';

type LoadedChunkWindowTestContext = {
  chunkSize: number;
  originChunkX: number;
  originChunkY: number;
  sourceDisplayName: string;
  sourceType: 'map' | 'world';
  worldId: string;
};

type EditorTestLaunchCallbacks = {
  chunkSize: number;
  getHoverTile: () => { x: number; y: number } | null;
  getLoadedChunkWindow: () => LoadedChunkWindowTestContext | null;
  getMap: () => EditorMapDefinition;
  getSerializableMap: () => EditorMapDefinition;
  saveDirtyChunks: () => Promise<boolean>;
  setStatus: (message: string) => void;
};

export class EditorTestLaunchController {
  private testSpawnMode: EditorTestSpawnMode = 'hover';

  constructor(
    private readonly mapIo: EditorMapIoController,
    private readonly callbacks: EditorTestLaunchCallbacks,
  ) {}

  getTestSpawnMode(): EditorTestSpawnMode {
    return this.testSpawnMode;
  }

  getWorldTestSpawn(): EditorResolvedTestSpawn {
    const loadedWindow = this.callbacks.getLoadedChunkWindow();
    const map = this.callbacks.getMap();

    return resolveEditorWorldTestSpawn(this.testSpawnMode, {
      chunkSize: loadedWindow?.chunkSize ?? this.callbacks.chunkSize,
      hoverTile: this.callbacks.getHoverTile(),
      mapHeight: map.height,
      mapWidth: map.width,
      originChunkX: loadedWindow?.originChunkX ?? 0,
      originChunkY: loadedWindow?.originChunkY ?? 0,
    });
  }

  setTestSpawnMode(mode: EditorTestSpawnMode): void {
    this.testSpawnMode = mode;
    this.callbacks.setStatus(mode === 'hover'
      ? 'Test spawn follows the hovered tile.'
      : 'Test spawn uses the loaded window center.');
  }

  async testMapInGame(): Promise<void> {
    try {
      const loadedWindow = this.callbacks.getLoadedChunkWindow();

      if (loadedWindow?.sourceType === 'world') {
        const saved = await this.callbacks.saveDirtyChunks();
        if (!saved) {
          this.callbacks.setStatus('Test blocked: save the current world chunks successfully first.');
          return;
        }

        const testSpawn = this.getWorldTestSpawn();
        const manifestUrl = `/data/worlds/${loadedWindow.worldId}/world.manifest.json`;
        const query = new URLSearchParams({
          worldManifest: manifestUrl,
          spawnId: testSpawn.spawnId,
        });
        window.open(`/index.html?${query.toString()}`, '_blank', 'noopener,noreferrer');
        this.callbacks.setStatus(`Testing ${loadedWindow.sourceDisplayName} at ${testSpawn.label}.`);
        return;
      }

      const map = this.callbacks.getMap();
      await this.mapIo.publishToGame(this.callbacks.getSerializableMap());
      window.open('/index.html?editorMap=1', '_blank', 'noopener,noreferrer');
      this.callbacks.setStatus(`Testing ${map.displayName} in game.`);
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'Test in game failed.');
    }
  }

  clearPublishedGameMap(): void {
    this.mapIo.clearPublishedGameMap();
    this.callbacks.setStatus('Cleared the editor test map from game startup.');
  }
}
