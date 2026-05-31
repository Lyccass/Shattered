import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import type { EditorToolMode } from '../input/EditorInputController';
import type { EditorObjectToolController } from '../objects/EditorObjectToolController';
import type { EditorTerrainToolController } from '../terrain/EditorTerrainToolController';
import type { EditorTilePaletteController } from '../ui/EditorTilePaletteController';

type EditorSelectionWorkflowCallbacks = {
  getPalette: () => EditorTilePaletteController | undefined;
  redrawOverlay: () => void;
  setStatus: (message: string) => void;
  updateInfoText: () => void;
};

export class EditorSelectionWorkflowController {
  private toolMode: EditorToolMode = 'terrain';

  constructor(
    private readonly terrainTool: EditorTerrainToolController,
    private readonly objectTool: EditorObjectToolController,
    private readonly callbacks: EditorSelectionWorkflowCallbacks,
  ) {}

  getToolMode(): EditorToolMode {
    return this.toolMode;
  }

  setToolMode(mode: EditorToolMode): void {
    this.toolMode = mode;
    this.callbacks.redrawOverlay();
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(formatToolModeStatus(mode));
  }

  selectBrushForFamily(family: TerrainFamily): void {
    const selectedBrush = this.terrainTool.selectFamily(family);
    this.callbacks.getPalette()?.updateTerrainSelection(selectedBrush);
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(`Selected ${selectedBrush.label}. Use Q/E or [/] to choose a specific tile.`);
  }

  selectBrushById(brushId: string): void {
    const selectedBrush = this.terrainTool.selectById(brushId);
    this.callbacks.getPalette()?.updateTerrainSelection(selectedBrush);
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(`Selected tile ${selectedBrush.label}.`);
  }

  selectObjectById(definitionId: string): void {
    const def = this.objectTool.selectById(definitionId);
    this.callbacks.getPalette()?.updateObjectSelection(def.id);
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(`Selected object ${def.displayName}.`);
  }

  cycleSelection(offset: number): void {
    if (this.toolMode === 'object') {
      const def = this.objectTool.cycle(offset);
      this.callbacks.getPalette()?.updateObjectSelection(def.id);
      this.callbacks.updateInfoText();
      this.callbacks.setStatus(`Selected object ${def.displayName}.`);
      return;
    }

    this.cycleSelectedBrush(offset);
  }

  flipSelectedBrush(axis: 'x' | 'y'): void {
    const selectedBrush = this.terrainTool.flip(axis);
    this.callbacks.getPalette()?.updateTerrainSelection(selectedBrush);
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(axis === 'x' ? 'Selected brush flipped left/right.' : 'Selected brush flipped up/down.');
  }

  togglePalette(): void {
    this.callbacks.getPalette()?.toggle(
      this.toolMode === 'object' ? 'object' : 'terrain',
      this.terrainTool.getSelectedBrush(),
      this.objectTool.getSelectedDefinition().id,
    );
  }

  adjustBrushSize(delta: number): void {
    this.terrainTool.setBrushSize(this.terrainTool.getBrushSize() + delta);
    this.callbacks.redrawOverlay();
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(`Brush size ${this.terrainTool.getBrushSize()}.`);
  }

  private cycleSelectedBrush(offset: number): void {
    const selectedBrush = this.terrainTool.cycle(offset);
    this.callbacks.getPalette()?.updateTerrainSelection(selectedBrush);
    this.callbacks.updateInfoText();
    this.callbacks.setStatus(`Selected tile ${selectedBrush.label}.`);
  }
}

function formatToolModeStatus(mode: EditorToolMode): string {
  switch (mode) {
    case 'elevation':
      return 'Height paint mode.';
    case 'object':
      return 'Object mode.';
    case 'walkability':
      return 'Walkability paint mode.';
    case 'zone':
      return 'Zone paint mode. Left-click to paint, select tag in sidebar.';
    case 'encounter':
      return 'Encounter mode. Left-click an area to select it, then edit spawns in the sidebar.';
    case 'terrain':
    default:
      return 'Terrain mode.';
  }
}
