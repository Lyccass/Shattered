import {
  getEditorTerrainElevationAt,
  getEditorTerrainAt,
  getEditorTerrainZoneAt,
  getEditorTerrainWalkabilityAt,
  type EditorMapDefinition,
  type EditorTerrainTilePaint,
} from '../../shared/editor/EditorMapModel';
import type { EditorDirtyChunkTracker } from '../chunks/EditorDirtyChunkTracker';
import type { EditorChunkPersistenceController } from '../chunks/EditorChunkPersistenceController';
import type { EditorEncounterToolController } from '../encounters/EditorEncounterToolController';
import type { EditorObjectToolController } from '../objects/EditorObjectToolController';
import type { EditorTerrainToolController } from '../terrain/EditorTerrainToolController';
import type { EditorNpcToolController } from '../npcs/EditorNpcToolController';
import type { EditorHudController } from './EditorHudController';
import type { EditorEncounterPanelController } from './EditorEncounterPanelController';
import type { EditorTestLaunchController } from '../workflow/EditorTestLaunchController';
import type { EditorMapEditWorkflowController } from '../workflow/EditorMapEditWorkflowController';
import type { EditorSelectionWorkflowController } from '../workflow/EditorSelectionWorkflowController';
import { createSaveConfidenceState } from '../workflow/EditorSaveConfidence';

type TileCoord = { x: number; y: number };

type EditorHudStateCallbacks = {
  chunkSize: number;
  getEncounterPanel: () => EditorEncounterPanelController | undefined;
  getHoverTile: () => TileCoord | null;
  getHud: () => EditorHudController | undefined;
  getMap: () => EditorMapDefinition;
  getObjectAtTile: (map: EditorMapDefinition, tileX: number, tileY: number) => { definitionId: string } | null;
  getSaveConfidenceTarget: () => 'project-world' | 'chunk-library';
  getTilePaint: (map: EditorMapDefinition, tileX: number, tileY: number) => EditorTerrainTilePaint | null;
  isTileInBounds: (tileX: number, tileY: number) => boolean;
};

export class EditorHudStateController {
  constructor(
    private readonly terrainTool: EditorTerrainToolController,
    private readonly objectTool: EditorObjectToolController,
    private readonly npcTool: EditorNpcToolController,
    private readonly encounterTool: EditorEncounterToolController,
    private readonly dirtyChunks: EditorDirtyChunkTracker,
    private readonly chunkPersistence: EditorChunkPersistenceController,
    private readonly mapEdit: EditorMapEditWorkflowController,
    private readonly selection: EditorSelectionWorkflowController,
    private readonly testLaunch: EditorTestLaunchController,
    private readonly callbacks: EditorHudStateCallbacks,
  ) {}

  updateInfoText(): void {
    const hud = this.callbacks.getHud();

    if (!hud) {
      return;
    }

    this.encounterTool.normalizeSelection();
    const encounterSelection = this.encounterTool.getSelection();
    const map = this.callbacks.getMap();
    const hoverTile = this.callbacks.getHoverTile();
    const hover = hoverTile && this.callbacks.isTileInBounds(hoverTile.x, hoverTile.y)
      ? hoverTile
      : null;
    const hoverFamily = hover ? getEditorTerrainAt(map, hover.x, hover.y) : null;
    const hoverPaint = hover ? this.callbacks.getTilePaint(map, hover.x, hover.y) : null;
    const hoverWalkable = hover ? getEditorTerrainWalkabilityAt(map, hover.x, hover.y) : null;
    const hoverElevation = hover ? getEditorTerrainElevationAt(map, hover.x, hover.y) : null;
    const hoverZone = hover ? getEditorTerrainZoneAt(map, hover.x, hover.y) : null;
    const hoverObject = hover ? this.callbacks.getObjectAtTile(map, hover.x, hover.y) : null;
    const hoverChunk = hover ? getChunkInfo(map, hover.x, hover.y, this.callbacks.chunkSize) : null;
    const selectedBrush = this.terrainTool.getSelectedBrush();
    const selectedObjectDefinition = this.objectTool.getSelectedDefinition();

    hud.update({
      brushSize: this.terrainTool.getBrushSize(),
      hover: {
        chunkName: hoverChunk?.chunkName ?? null,
        chunkX: hoverChunk?.chunkX ?? null,
        chunkY: hoverChunk?.chunkY ?? null,
        elevation: hoverElevation,
        family: hoverFamily,
        objectDefinitionId: hoverObject?.definitionId ?? null,
        paint: hoverPaint,
        tile: hover,
        walkable: hoverWalkable,
        zone: hoverZone,
      },
      dirtyChunks: this.dirtyChunks.getSummary(),
      map,
      npcAnchorCount: map.npcAnchors.length,
      npcDefinitions: this.npcTool.getDefinitionOptions(),
      selectedNpcDefinitionId: this.npcTool.getSelectedDefinitionId(),
      objectPreviewColor: this.objectTool.getPreviewColor(),
      objectPreviewTextureKey: this.objectTool.getPreviewTextureKey(),
      selectedBrush,
      selectedBrushIndexLabel: this.terrainTool.getSelectedBrushIndexLabel(),
      selectedElevation: this.mapEdit.getSelectedElevation(),
      selectedWalkable: this.mapEdit.getSelectedWalkable(),
      selectedZoneTag: this.mapEdit.getSelectedZoneTag(),
      selectedObjectDisplayName: selectedObjectDefinition.displayName,
      saveConfidence: createSaveConfidenceState(
        this.dirtyChunks.getDirtyChunks(),
        this.chunkPersistence.getLastSaveSnapshot(),
        this.callbacks.getSaveConfidenceTarget(),
      ),
      testSpawnLabel: this.testLaunch.getWorldTestSpawn().label,
      testSpawnMode: this.testLaunch.getTestSpawnMode(),
      toolMode: this.selection.getToolMode(),
    });

    const encounterPanel = this.callbacks.getEncounterPanel();
    encounterPanel?.setVisible(this.selection.getToolMode() === 'encounter');
    encounterPanel?.update({
      areas: map.encounterAreas,
      hoverTile: hover,
      selectedAreaId: encounterSelection.selectedAreaId,
      selectedManualSpawnId: encounterSelection.selectedManualSpawnId,
      selectedRuleId: encounterSelection.selectedRuleId,
    });
  }

}

function getChunkInfo(
  map: EditorMapDefinition,
  tileX: number,
  tileY: number,
  chunkSize: number,
): { chunkName: string; chunkX: number; chunkY: number } {
  const chunkX = Math.floor(tileX / chunkSize);
  const chunkY = Math.floor(tileY / chunkSize);
  const chunkName = map.chunkNames?.[`${chunkX},${chunkY}`] ?? '';
  return { chunkName, chunkX, chunkY };
}
