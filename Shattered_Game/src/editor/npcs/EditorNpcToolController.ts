import { NPC_DEFINITIONS } from '../../npcs/NpcDefinitions';
import type { EditorMapDefinition, EditorNpcAnchor } from '../../shared/editor/EditorMapModel';

type TileCoord = { x: number; y: number };

export type EditorNpcDefinitionOption = {
  id: string;
  displayName: string;
};

type EditorNpcToolCallbacks = {
  getHoverTile: () => TileCoord | null;
  getMap: () => EditorMapDefinition;
  onChanged: () => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  snapshot: (map: EditorMapDefinition) => void;
  markTileDirty: (tileX: number, tileY: number) => void;
};

export class EditorNpcToolController {
  private selectedDefinitionId = NPC_DEFINITIONS[0]?.id ?? '';

  constructor(private readonly callbacks: EditorNpcToolCallbacks) {}

  getDefinitionOptions(): EditorNpcDefinitionOption[] {
    return NPC_DEFINITIONS.map((definition) => ({
      id: definition.id,
      displayName: definition.displayName,
    }));
  }

  getSelectedDefinitionId(): string {
    return this.selectedDefinitionId;
  }

  setSelectedDefinitionId(id: string): void {
    if (!NPC_DEFINITIONS.some((definition) => definition.id === id)) {
      return;
    }

    this.selectedDefinitionId = id;
    this.callbacks.onChanged();
  }

  placeAtHover(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile || !this.selectedDefinitionId) {
      return;
    }

    const map = this.callbacks.getMap();
    const { x, y } = hoverTile;

    if (map.npcAnchors.some((anchor) => anchor.tileX === x && anchor.tileY === y)) {
      this.callbacks.setStatus('An NPC is already placed at this tile.');
      return;
    }

    const anchor: EditorNpcAnchor = {
      id: `npc_${x}_${y}`,
      definitionId: this.selectedDefinitionId,
      tileX: x,
      tileY: y,
    };

    this.callbacks.snapshot(map);
    this.callbacks.setMap({
      ...map,
      npcAnchors: [...map.npcAnchors, anchor],
    });
    this.callbacks.markTileDirty(x, y);
    this.callbacks.onChanged();

    const definition = NPC_DEFINITIONS.find((candidate) => candidate.id === this.selectedDefinitionId);
    this.callbacks.setStatus(`Placed ${definition?.displayName ?? this.selectedDefinitionId} at ${x}, ${y}.`);
  }

  removeAtHover(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    const map = this.callbacks.getMap();
    const { x, y } = hoverTile;
    const existing = map.npcAnchors.find((anchor) => anchor.tileX === x && anchor.tileY === y);

    if (!existing) {
      this.callbacks.setStatus('No NPC at hovered tile.');
      return;
    }

    this.callbacks.snapshot(map);
    this.callbacks.setMap({
      ...map,
      npcAnchors: map.npcAnchors.filter((anchor) => anchor !== existing),
    });
    this.callbacks.markTileDirty(x, y);
    this.callbacks.onChanged();
    this.callbacks.setStatus(`Removed NPC at ${x}, ${y}.`);
  }
}
