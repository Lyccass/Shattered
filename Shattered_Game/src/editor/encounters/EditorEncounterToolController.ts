import type { EditorMapDefinition } from '../../shared/editor/EditorMapModel';
import {
  createEditorEncounterArea,
  createEditorEncounterRule,
  createEditorManualEncounterSpawn,
  type EditorEncounterArea,
  type EditorEncounterAreaPatch,
  type EditorEncounterRule,
  type EditorEncounterRulePatch,
} from '../../shared/editor/EditorEncounterModel';

const EDITOR_ENCOUNTER_CHUNK_SIZE = 32;

export type EditorEncounterSelection = {
  selectedAreaId: string | null;
  selectedManualSpawnId: string | null;
  selectedRuleId: string | null;
};

type TileCoord = { x: number; y: number };

type EditorEncounterToolCallbacks = {
  getHoverTile: () => TileCoord | null;
  getMap: () => EditorMapDefinition;
  onChanged: () => void;
  setMap: (map: EditorMapDefinition) => void;
  setStatus: (message: string) => void;
  snapshot: (map: EditorMapDefinition) => void;
  markChunkDirty: (chunk: { chunkX: number; chunkY: number }) => void;
};

export class EditorEncounterToolController {
  private selectedAreaId: string | null = null;
  private selectedRuleId: string | null = null;
  private selectedManualSpawnId: string | null = null;
  private dragStart: TileCoord | null = null;

  constructor(private readonly callbacks: EditorEncounterToolCallbacks) {}

  beginStroke(): void {
    const hoverTile = this.callbacks.getHoverTile();
    this.dragStart = hoverTile ? { ...hoverTile } : null;
  }

  endStroke(): void {
    this.finalizeDrag();
  }

  getDragStart(): TileCoord | null {
    return this.dragStart;
  }

  getSelection(): EditorEncounterSelection {
    return {
      selectedAreaId: this.selectedAreaId,
      selectedManualSpawnId: this.selectedManualSpawnId,
      selectedRuleId: this.selectedRuleId,
    };
  }

  normalizeSelection(): void {
    const area = this.getSelectedArea() ?? this.getMap().encounterAreas[0] ?? null;
    this.selectedAreaId = area?.id ?? null;

    if (!area) {
      this.selectedRuleId = null;
      this.selectedManualSpawnId = null;
      return;
    }

    const selectedRule = area.spawnRules.find((rule) => rule.id === this.selectedRuleId)
      ?? area.spawnRules[0]
      ?? null;
    const selectedManualSpawn = area.manualSpawns.find((spawn) => spawn.id === this.selectedManualSpawnId)
      ?? area.manualSpawns[0]
      ?? null;
    this.selectedRuleId = selectedRule?.id ?? null;
    this.selectedManualSpawnId = selectedManualSpawn?.id ?? null;
  }

  createAreaAtHover(): void {
    const map = this.getMap();
    const tile = this.callbacks.getHoverTile() ?? {
      x: Math.floor(map.width / 2),
      y: Math.floor(map.height / 2),
    };
    const area = clampEncounterAreaToMap(createEditorEncounterArea(tile.x, tile.y), map.width, map.height);

    this.callbacks.snapshot(map);
    this.setMap({
      ...map,
      encounterAreas: [...map.encounterAreas, area],
    });
    this.selectedAreaId = area.id;
    this.selectedRuleId = area.spawnRules[0]?.id ?? null;
    this.selectedManualSpawnId = null;
    this.markAreaDirty(area);
    this.callbacks.onChanged();
    this.callbacks.setStatus(`Created encounter area ${area.name} at ${area.tileX},${area.tileY}.`);
  }

  selectArea(areaId: string | null): void {
    const area = this.getMap().encounterAreas.find((candidate) => candidate.id === areaId) ?? null;
    this.selectedAreaId = area?.id ?? null;
    this.selectedRuleId = area?.spawnRules[0]?.id ?? null;
    this.selectedManualSpawnId = area?.manualSpawns[0]?.id ?? null;
    this.callbacks.onChanged();
  }

  selectRule(ruleId: string | null): void {
    this.selectedRuleId = ruleId;
    this.callbacks.onChanged();
  }

  selectManualSpawn(spawnId: string | null): void {
    this.selectedManualSpawnId = spawnId;
    this.callbacks.onChanged();
  }

  updateSelectedArea(patch: EditorEncounterAreaPatch): void {
    const map = this.getMap();
    const area = this.getSelectedArea();

    if (!area) {
      return;
    }

    const nextArea = clampEncounterAreaToMap({ ...area, ...patch }, map.width, map.height);
    this.callbacks.snapshot(map);
    this.setMap({
      ...map,
      encounterAreas: map.encounterAreas.map((candidate) =>
        candidate.id === area.id ? nextArea : candidate,
      ),
    });
    this.markAreaDirty(area);
    this.markAreaDirty(nextArea);
    this.callbacks.onChanged();
    this.callbacks.setStatus(`Updated encounter area ${nextArea.name}.`);
  }

  moveSelectedAreaToHover(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      this.callbacks.setStatus('Hover a tile before moving the encounter area.');
      return;
    }

    this.updateSelectedArea({
      tileX: hoverTile.x,
      tileY: hoverTile.y,
    });
  }

  deleteSelectedArea(): void {
    const map = this.getMap();
    const area = this.getSelectedArea();

    if (!area) {
      return;
    }

    const encounterAreas = map.encounterAreas.filter((candidate) => candidate.id !== area.id);
    this.callbacks.snapshot(map);
    this.setMap({
      ...map,
      encounterAreas,
    });
    this.markAreaDirty(area);
    this.selectedAreaId = encounterAreas[0]?.id ?? null;
    this.selectedRuleId = encounterAreas[0]?.spawnRules[0]?.id ?? null;
    this.selectedManualSpawnId = encounterAreas[0]?.manualSpawns[0]?.id ?? null;
    this.callbacks.onChanged();
    this.callbacks.setStatus(`Deleted encounter area ${area.name}.`);
  }

  addRule(ruleDraft: Omit<EditorEncounterRule, 'id'>): void {
    const area = this.getSelectedArea();

    if (!area) {
      return;
    }

    const rule = {
      ...createEditorEncounterRule(ruleDraft.enemyDefinitionId),
      ...ruleDraft,
    };
    const nextArea = {
      ...area,
      spawnRules: [...area.spawnRules, rule],
    };
    this.replaceArea(area, nextArea);
    this.selectedRuleId = rule.id;
    this.callbacks.setStatus(`Added ${rule.enemyDefinitionId} rule to ${area.name}.`);
  }

  updateSelectedRule(patch: EditorEncounterRulePatch): void {
    const area = this.getSelectedArea();

    if (!area || !this.selectedRuleId) {
      return;
    }

    const nextArea = {
      ...area,
      spawnRules: area.spawnRules.map((rule) =>
        rule.id === this.selectedRuleId ? { ...rule, ...patch } : rule,
      ),
    };
    this.replaceArea(area, nextArea);
    this.callbacks.setStatus(`Updated spawn rule in ${area.name}.`);
  }

  deleteSelectedRule(): void {
    const area = this.getSelectedArea();

    if (!area || !this.selectedRuleId) {
      return;
    }

    const nextRules = area.spawnRules.filter((rule) => rule.id !== this.selectedRuleId);
    const nextArea = { ...area, spawnRules: nextRules };
    this.replaceArea(area, nextArea);
    this.selectedRuleId = nextRules[0]?.id ?? null;
    this.callbacks.setStatus(`Deleted spawn rule from ${area.name}.`);
  }

  addManualSpawnAtHover(): void {
    const area = this.getSelectedArea();
    const hoverTile = this.callbacks.getHoverTile();

    if (!area || !hoverTile) {
      this.callbacks.setStatus('Select an encounter area and hover a tile before adding a manual spawn.');
      return;
    }

    if (!isTileInsideEncounterArea(area, hoverTile.x, hoverTile.y)) {
      this.callbacks.setStatus('Manual spawn must be inside the selected encounter area.');
      return;
    }

    const enemyDefinitionId = area.spawnRules[0]?.enemyDefinitionId ?? 'wolf_passive';
    const spawn = createEditorManualEncounterSpawn(hoverTile.x, hoverTile.y, enemyDefinitionId);
    const nextArea = {
      ...area,
      manualSpawns: [...area.manualSpawns, spawn],
    };
    this.replaceArea(area, nextArea);
    this.selectedManualSpawnId = spawn.id;
    this.callbacks.setStatus(`Added manual ${enemyDefinitionId} spawn at ${spawn.tileX},${spawn.tileY}.`);
  }

  deleteSelectedManualSpawn(): void {
    const area = this.getSelectedArea();

    if (!area || !this.selectedManualSpawnId) {
      return;
    }

    const nextSpawns = area.manualSpawns.filter((spawn) => spawn.id !== this.selectedManualSpawnId);
    const nextArea = { ...area, manualSpawns: nextSpawns };
    this.replaceArea(area, nextArea);
    this.selectedManualSpawnId = nextSpawns[0]?.id ?? null;
    this.callbacks.setStatus(`Deleted manual spawn from ${area.name}.`);
  }

  private finalizeDrag(): void {
    const start = this.dragStart;
    const end = this.callbacks.getHoverTile();
    this.dragStart = null;

    if (!start || !end) {
      this.selectAreaAtHover();
      return;
    }

    const x1 = Math.min(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const x2 = Math.max(start.x, end.x);
    const y2 = Math.max(start.y, end.y);
    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;

    if (width <= 1 && height <= 1) {
      this.selectAreaAtHover();
      return;
    }

    const map = this.getMap();
    const area = clampEncounterAreaToMap(
      { ...createEditorEncounterArea(x1, y1), tileX: x1, tileY: y1, width, height },
      map.width,
      map.height,
    );

    this.callbacks.snapshot(map);
    this.setMap({ ...map, encounterAreas: [...map.encounterAreas, area] });
    this.selectedAreaId = area.id;
    this.selectedRuleId = area.spawnRules[0]?.id ?? null;
    this.selectedManualSpawnId = null;
    this.markAreaDirty(area);
    this.callbacks.onChanged();
    this.callbacks.setStatus(`Created ${area.name} at ${x1},${y1} (${width}x${height}).`);
  }

  private selectAreaAtHover(): void {
    const hoverTile = this.callbacks.getHoverTile();

    if (!hoverTile) {
      return;
    }

    const area = this.findAreaAtTile(hoverTile.x, hoverTile.y);
    this.selectArea(area?.id ?? null);
    this.callbacks.setStatus(area ? `Selected encounter area ${area.name}.` : 'No encounter area at hovered tile.');
  }

  private replaceArea(previousArea: EditorEncounterArea, nextArea: EditorEncounterArea): void {
    const map = this.getMap();
    this.callbacks.snapshot(map);
    this.setMap({
      ...map,
      encounterAreas: map.encounterAreas.map((candidate) =>
        candidate.id === previousArea.id ? nextArea : candidate,
      ),
    });
    this.markAreaDirty(previousArea);
    this.markAreaDirty(nextArea);
    this.callbacks.onChanged();
  }

  private getSelectedArea(): EditorEncounterArea | null {
    return this.getMap().encounterAreas.find((area) => area.id === this.selectedAreaId) ?? null;
  }

  private findAreaAtTile(tileX: number, tileY: number): EditorEncounterArea | null {
    for (const area of [...this.getMap().encounterAreas].reverse()) {
      if (isTileInsideEncounterArea(area, tileX, tileY)) {
        return area;
      }
    }

    return null;
  }

  private getMap(): EditorMapDefinition {
    return this.callbacks.getMap();
  }

  private setMap(map: EditorMapDefinition): void {
    this.callbacks.setMap(map);
  }

  private markAreaDirty(area: EditorEncounterArea): void {
    const startChunkX = Math.floor(area.tileX / EDITOR_ENCOUNTER_CHUNK_SIZE);
    const startChunkY = Math.floor(area.tileY / EDITOR_ENCOUNTER_CHUNK_SIZE);
    const endChunkX = Math.floor((area.tileX + area.width - 1) / EDITOR_ENCOUNTER_CHUNK_SIZE);
    const endChunkY = Math.floor((area.tileY + area.height - 1) / EDITOR_ENCOUNTER_CHUNK_SIZE);

    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
      for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
        this.callbacks.markChunkDirty({ chunkX, chunkY });
      }
    }
  }
}

export function isTileInsideEncounterArea(area: EditorEncounterArea, tileX: number, tileY: number): boolean {
  return (
    tileX >= area.tileX &&
    tileY >= area.tileY &&
    tileX < area.tileX + area.width &&
    tileY < area.tileY + area.height
  );
}

function clampEncounterAreaToMap(
  area: EditorEncounterArea,
  mapWidth: number,
  mapHeight: number,
): EditorEncounterArea {
  const tileX = clampInteger(area.tileX, 0, Math.max(0, mapWidth - 1));
  const tileY = clampInteger(area.tileY, 0, Math.max(0, mapHeight - 1));
  const width = clampInteger(area.width, 1, Math.max(1, mapWidth - tileX));
  const height = clampInteger(area.height, 1, Math.max(1, mapHeight - tileY));

  return {
    ...area,
    tileX,
    tileY,
    width,
    height,
    tags: area.tags.map((tag) => tag.trim()).filter(Boolean),
    manualSpawns: area.manualSpawns.filter((spawn) =>
      spawn.tileX >= tileX &&
      spawn.tileY >= tileY &&
      spawn.tileX < tileX + width &&
      spawn.tileY < tileY + height,
    ),
  };
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}
