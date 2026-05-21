import Phaser from 'phaser';
import type { ObjectDefinition, SpriteVisualPart } from '../../objects/ObjectTypes';
import type { TerrainFamily } from '../../shared/map/TerrainTypes';
import type { EditorObjectCatalog } from '../objects/EditorObjectCatalog';
import type { EditorTerrainBrush, EditorTerrainCatalog } from '../terrain/EditorTerrainCatalog';

const TERRAIN_FAMILY_ORDER: TerrainFamily[] = ['grass', 'dirt', 'stone', 'water', 'sand'];

type PaletteMode = 'terrain' | 'object';

type PaletteCallbacks = {
  onSelectBrush: (brush: EditorTerrainBrush) => void;
  onSelectObject: (definition: ObjectDefinition) => void;
};

export class EditorTilePaletteController {
  private isOpen = false;
  private currentMode: PaletteMode = 'terrain';
  private currentObjectCategory = 'all';
  private currentTerrainTab = 'grass';

  private readonly panel: HTMLElement;
  private readonly tabContainer: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly titleEl: HTMLElement;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly terrainCatalog: EditorTerrainCatalog,
    private readonly objectCatalog: EditorObjectCatalog,
    private readonly callbacks: PaletteCallbacks,
  ) {
    this.panel        = document.getElementById('ed-palette')!;
    this.tabContainer = document.getElementById('ed-palette-tabs')!;
    this.grid         = document.getElementById('ed-palette-grid')!;
    this.titleEl      = document.getElementById('ed-palette-title')!;

    document.getElementById('ed-palette-close')!.addEventListener('click', () => this.close());
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  openForTerrain(selectedBrush: EditorTerrainBrush): void {
    this.currentMode   = 'terrain';
    this.currentTerrainTab = getTerrainTabId(selectedBrush);
    this.titleEl.textContent = 'Tile Palette';
    this.isOpen = true;
    this.panel.style.display = 'flex';
    this.buildTerrainTabs();
    this.buildTerrainGrid(selectedBrush);
  }

  openForObjects(selectedObjectId: string): void {
    this.currentMode = 'object';
    this.currentObjectCategory = 'all';
    this.titleEl.textContent = 'Object Palette';
    this.isOpen = true;
    this.panel.style.display = 'flex';
    this.buildObjectTabs();
    this.buildObjectGrid(selectedObjectId);
  }

  close(): void {
    this.isOpen = false;
    this.panel.style.display = 'none';
  }

  toggle(mode: PaletteMode, selectedBrush: EditorTerrainBrush, selectedObjectId: string): void {
    if (this.isOpen && this.currentMode === mode) {
      this.close();
      return;
    }

    if (mode === 'terrain') {
      this.openForTerrain(selectedBrush);
    } else {
      this.openForObjects(selectedObjectId);
    }
  }

  updateTerrainSelection(brush: EditorTerrainBrush): void {
    if (!this.isOpen || this.currentMode !== 'terrain') {
      return;
    }

    this.currentTerrainTab = getTerrainTabId(brush);
    this.buildTerrainTabs();
    this.buildTerrainGrid(brush);

    this.highlightCell(brush.id);
  }

  updateObjectSelection(definitionId: string): void {
    if (!this.isOpen || this.currentMode !== 'object') {
      return;
    }

    this.highlightCell(definitionId);
  }

  // ── Terrain ──────────────────────────────────────────────────────────────

  private buildTerrainTabs(): void {
    this.tabContainer.innerHTML = '';

    for (const tab of this.getTerrainTabs()) {
      const btn = document.createElement('button');
      btn.className = 'ed-pal-tab';
      btn.textContent = tab.label;
      btn.dataset['family'] = tab.id;
      btn.classList.toggle('is-active', tab.id === this.currentTerrainTab);
      btn.addEventListener('click', () => {
        this.currentTerrainTab = tab.id;
        this.buildTerrainTabs();
        this.buildTerrainGrid();
      });
      this.tabContainer.appendChild(btn);
    }
  }

  private buildTerrainGrid(selectedBrush?: EditorTerrainBrush): void {
    this.grid.innerHTML = '';
    const brushes = this.terrainCatalog.all.filter((brush) => getTerrainTabId(brush) === this.currentTerrainTab);

    for (const brush of brushes) {
      const cell = this.makeCell(brush.id, brush.label);

      if (selectedBrush && brush.id === selectedBrush.id) {
        cell.classList.add('is-active');
      }

      if (this.scene.textures.exists(brush.textureKey)) {
        const img = document.createElement('img');
        img.className = 'ed-pal-img';
        img.src = this.scene.textures.getBase64(brush.textureKey);
        img.alt = '';
        cell.appendChild(img);
      } else {
        cell.appendChild(this.makePlaceholder());
      }

      cell.addEventListener('click', () => {
        this.callbacks.onSelectBrush(brush);
        this.highlightCell(brush.id);
      });

      this.grid.appendChild(cell);
    }
  }

  // ── Objects ───────────────────────────────────────────────────────────────

  private buildObjectGrid(selectedObjectId?: string): void {
    this.grid.innerHTML = '';

    for (const def of this.objectCatalog.all.filter((definition) =>
      this.currentObjectCategory === 'all' || definition.category === this.currentObjectCategory,
    )) {
      const cell = this.makeCell(def.id, def.displayName);

      if (selectedObjectId && def.id === selectedObjectId) {
        cell.classList.add('is-active');
      }

      const textureKey = this.getObjectTextureKey(def);

      if (textureKey && this.scene.textures.exists(textureKey)) {
        const img = document.createElement('img');
        img.className = 'ed-pal-img';
        img.src = this.scene.textures.getBase64(textureKey);
        img.alt = '';
        cell.appendChild(img);
      } else {
        const swatch = this.makeColorSwatch(def.debug?.color ?? 0x888888);
        cell.appendChild(swatch);
      }

      // Name label under the preview
      const label = document.createElement('span');
      label.className = 'ed-pal-obj-label';
      label.textContent = def.displayName;
      cell.appendChild(label);

      cell.addEventListener('click', () => {
        this.callbacks.onSelectObject(def);
        this.highlightCell(def.id);
      });

      this.grid.appendChild(cell);
    }
  }

  private buildObjectTabs(): void {
    this.tabContainer.innerHTML = '';
    const tabs = ['all', ...new Set(this.objectCatalog.all.map((definition) => definition.category))];

    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.className = 'ed-pal-tab';
      btn.textContent = tab;
      btn.classList.toggle('is-active', tab === this.currentObjectCategory);
      btn.addEventListener('click', () => {
        this.currentObjectCategory = tab;
        this.buildObjectTabs();
        this.buildObjectGrid();
      });
      this.tabContainer.appendChild(btn);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private makeCell(id: string, title: string): HTMLButtonElement {
    const cell = document.createElement('button');
    cell.className = 'ed-pal-cell';
    cell.dataset['cellId'] = id;
    cell.title = title;
    return cell;
  }

  private makePlaceholder(): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'ed-pal-placeholder';
    el.textContent = '?';
    return el;
  }

  private makeColorSwatch(color: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width  = 32;
    canvas.height = 32;
    canvas.className = 'ed-pal-swatch';
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const hex = `#${color.toString(16).padStart(6, '0')}`;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.moveTo(w / 2, 2);
      ctx.lineTo(w - 2, h / 2);
      ctx.lineTo(w / 2, h - 2);
      ctx.lineTo(2, h / 2);
      ctx.closePath();
      ctx.fill();
    }

    return canvas;
  }

  private getObjectTextureKey(def: ObjectDefinition): string | null {
    const spritePart = def.visual.parts
      .find((p): p is SpriteVisualPart => p.shape === 'sprite');
    return spritePart?.textureKey ?? null;
  }

  private highlightCell(id: string): void {
    this.grid.querySelectorAll<HTMLElement>('.ed-pal-cell').forEach((c) => {
      c.classList.toggle('is-active', c.dataset['cellId'] === id);
    });
  }

  private getTerrainTabs(): Array<{ id: string; label: string }> {
    const customTabs = this.terrainCatalog.all
      .filter((brush) => brush.source === 'custom' && brush.category)
      .map((brush) => brush.category!)
      .filter((category, index, categories) => categories.indexOf(category) === index);

    return [
      ...TERRAIN_FAMILY_ORDER.map((family) => ({ id: family, label: family })),
      ...customTabs.map((category) => ({ id: `custom:${category}`, label: category })),
    ];
  }
}

function getTerrainTabId(brush: EditorTerrainBrush): string {
  return brush.source === 'custom' && brush.category ? `custom:${brush.category}` : brush.family;
}
