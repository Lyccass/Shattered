import type { MapTransition, MapTransitionType } from '../../shared/map/MapTypes';
import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import { listProjectWorlds } from '../io/EditorWorldLibrary';

type TileCoord = { x: number; y: number };

type EditorConnectionPanelCallbacks = {
  getHoverTile: () => TileCoord | null;
  getMap: () => EditorMapDefinition;
  getWorldId: () => string;
  isTileInBounds: (tileX: number, tileY: number) => boolean;
  markTileDirty: (tileX: number, tileY: number) => void;
  onChanged: () => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  snapshot: (map: EditorMapDefinition) => void;
};

export class EditorConnectionPanelController {
  constructor(private readonly callbacks: EditorConnectionPanelCallbacks) {}

  bindEvents(): void {
    document.getElementById('ed-connection-close')?.addEventListener('click', () => this.hide());
    document.getElementById('ed-connection-cancel')?.addEventListener('click', () => this.hide());
    document.getElementById('ed-connection-use-hover')?.addEventListener('click', () => this.fillSourceFromHover());
    document.getElementById('ed-connection-save')?.addEventListener('click', () => this.saveFromPanel());
    document.getElementById('ed-connection-delete')?.addEventListener('click', () => this.deleteAtPanelSource());
  }

  async open(): Promise<void> {
    const panel = document.getElementById('ed-connection-panel');
    const targetWorld = document.getElementById('ed-connection-target-world') as HTMLSelectElement | null;

    if (!panel || !targetWorld) {
      return;
    }

    const worlds = await listProjectWorlds();
    targetWorld.innerHTML = '';
    for (const world of worlds) {
      const option = document.createElement('option');
      option.value = world.worldId;
      option.textContent = `${world.displayName} (${world.worldId})`;
      targetWorld.appendChild(option);
    }
    targetWorld.value = this.callbacks.getWorldId();
    this.fillSourceFromHover();
    panel.classList.remove('editor-hidden');
  }

  hide(): void {
    document.getElementById('ed-connection-panel')?.classList.add('editor-hidden');
  }

  fillSourceFromHover(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      this.callbacks.setStatus('Hover the entrance tile, then use it as the connection source.');
      return;
    }

    const worldId = this.callbacks.getWorldId();
    setInputValue('ed-connection-source-x', String(hoverTile.x));
    setInputValue('ed-connection-source-y', String(hoverTile.y));
    setInputValue('ed-connection-id', `${worldId}_${hoverTile.x}_${hoverTile.y}_connection`);
  }

  saveFromPanel(): void {
    try {
      const worldId = this.callbacks.getWorldId();
      const sourceX = parseIntegerInput(getInputValue('ed-connection-source-x', '0'), 0);
      const sourceY = parseIntegerInput(getInputValue('ed-connection-source-y', '0'), 0);

      if (!this.callbacks.isTileInBounds(sourceX, sourceY)) {
        this.callbacks.setStatus('Connection source tile is outside the loaded window.');
        return;
      }

      const footprintWidth = Math.max(1, parseIntegerInput(getInputValue('ed-connection-width', '1'), 1));
      const footprintHeight = Math.max(1, parseIntegerInput(getInputValue('ed-connection-height', '1'), 1));
      const targetWorldId = getSelectValue('ed-connection-target-world', worldId);
      const targetChunkX = parseIntegerInput(getInputValue('ed-connection-target-chunk-x', '0'), 0);
      const targetChunkY = parseIntegerInput(getInputValue('ed-connection-target-chunk-y', '0'), 0);
      const targetTileX = parseIntegerInput(getInputValue('ed-connection-target-tile-x', '0'), 0);
      const targetTileY = parseIntegerInput(getInputValue('ed-connection-target-tile-y', '0'), 0);
      const transitionId = slugifyMapId(getInputValue('ed-connection-id', `${worldId}_${sourceX}_${sourceY}_connection`));
      const label = getInputValue('ed-connection-label', targetWorldId);
      const transitionType = getSelectValue('ed-connection-type', 'door') as MapTransitionType;
      const targetSpawnId = getInputValue(
        'ed-connection-target-spawn',
        `chunk_${targetChunkX}_${targetChunkY}_tile_${targetTileX}_${targetTileY}`,
      );
      const transition: MapTransition = {
        id: transitionId,
        fromTile: {
          tileX: sourceX,
          tileY: sourceY,
        },
        triggerFootprint: createRectFootprint(footprintWidth, footprintHeight),
        visualAnchor: {
          tileX: sourceX,
          tileY: sourceY,
          label,
        },
        targetMapId: targetWorldId,
        targetSpawnId,
        transitionType,
        metadata: {
          sourceWorldId: worldId,
          targetWorldId,
          targetChunkX,
          targetChunkY,
          targetTileX,
          targetTileY,
        },
      };
      const map = this.callbacks.getMap();

      this.callbacks.snapshot(map);
      this.callbacks.setMap({
        ...map,
        transitions: [
          ...map.transitions.filter((candidate) => candidate.id !== transition.id),
          transition,
        ],
      });
      this.callbacks.markTileDirty(sourceX, sourceY);
      this.callbacks.onChanged();
      this.callbacks.setStatus(`Saved connection ${transition.id} -> ${targetWorldId} ${targetChunkX},${targetChunkY}:${targetTileX},${targetTileY}.`);
    } catch (error) {
      this.callbacks.setStatus(error instanceof Error ? error.message : 'Connection save failed.');
    }
  }

  deleteAtPanelSource(): void {
    const sourceX = parseIntegerInput(getInputValue('ed-connection-source-x', '0'), 0);
    const sourceY = parseIntegerInput(getInputValue('ed-connection-source-y', '0'), 0);
    const map = this.callbacks.getMap();
    const before = map.transitions.length;
    const transitions = map.transitions.filter((transition) =>
      transition.fromTile.tileX !== sourceX || transition.fromTile.tileY !== sourceY);
    const removed = before - transitions.length;

    this.callbacks.snapshot(map);
    this.callbacks.setMap({
      ...map,
      transitions,
    });

    if (removed > 0) {
      this.callbacks.markTileDirty(sourceX, sourceY);
      this.callbacks.onChanged();
    }

    this.callbacks.setStatus(removed > 0 ? `Removed ${removed} connection(s) at ${sourceX},${sourceY}.` : 'No connection at that source tile.');
  }
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

function slugifyMapId(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'editor_map';
}

function createRectFootprint(width: number, height: number): Array<{ x: number; y: number }> {
  const footprint: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      footprint.push({ x, y });
    }
  }

  return footprint;
}
