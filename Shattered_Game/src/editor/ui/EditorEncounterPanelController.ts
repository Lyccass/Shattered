import type {
  EditorEncounterArea,
  EditorEncounterAreaPatch,
  EditorEncounterRule,
  EditorEncounterRulePatch,
} from '../../shared/editor/EditorEncounterModel';
import { EDITOR_ENEMY_CATALOG } from '../../shared/editor/EditorEnemyCatalog';
import { requireById } from '../../ui/domUtils';

export type EditorEncounterPanelState = {
  areas: EditorEncounterArea[];
  hoverTile: { x: number; y: number } | null;
  selectedAreaId: string | null;
  selectedManualSpawnId: string | null;
  selectedRuleId: string | null;
};

type EditorEncounterPanelCallbacks = {
  onAddManualSpawnAtHover: () => void;
  onAddRule: (rule: Omit<EditorEncounterRule, 'id'>) => void;
  onCreateAreaAtHover: () => void;
  onDeleteArea: () => void;
  onDeleteManualSpawn: () => void;
  onDeleteRule: () => void;
  onMoveAreaToHover: () => void;
  onSelectArea: (areaId: string | null) => void;
  onSelectManualSpawn: (spawnId: string | null) => void;
  onSelectRule: (ruleId: string | null) => void;
  onUpdateArea: (patch: EditorEncounterAreaPatch) => void;
  onUpdateRule: (patch: EditorEncounterRulePatch) => void;
};

export class EditorEncounterPanelController {
  private readonly els = {
    section: requireById<HTMLElement>('ed-encounter-section'),
    areaSelect: requireById<HTMLSelectElement>('ed-encounter-area-select'),
    areaName: requireById<HTMLInputElement>('ed-encounter-area-name'),
    areaTags: requireById<HTMLInputElement>('ed-encounter-area-tags'),
    areaX: requireById<HTMLInputElement>('ed-encounter-area-x'),
    areaY: requireById<HTMLInputElement>('ed-encounter-area-y'),
    areaWidth: requireById<HTMLInputElement>('ed-encounter-area-width'),
    areaHeight: requireById<HTMLInputElement>('ed-encounter-area-height'),
    newArea: requireById<HTMLButtonElement>('ed-encounter-area-new'),
    moveArea: requireById<HTMLButtonElement>('ed-encounter-area-move'),
    deleteArea: requireById<HTMLButtonElement>('ed-encounter-area-delete'),
    ruleSelect: requireById<HTMLSelectElement>('ed-encounter-rule-select'),
    enemySelect: requireById<HTMLSelectElement>('ed-encounter-enemy'),
    maxPopulation: requireById<HTMLInputElement>('ed-encounter-max-population'),
    respawnSeconds: requireById<HTMLInputElement>('ed-encounter-respawn-seconds'),
    weight: requireById<HTMLInputElement>('ed-encounter-weight'),
    lootTable: requireById<HTMLInputElement>('ed-encounter-loot-table'),
    addRule: requireById<HTMLButtonElement>('ed-encounter-rule-add'),
    saveRule: requireById<HTMLButtonElement>('ed-encounter-rule-save'),
    deleteRule: requireById<HTMLButtonElement>('ed-encounter-rule-delete'),
    manualSelect: requireById<HTMLSelectElement>('ed-encounter-manual-select'),
    addManual: requireById<HTMLButtonElement>('ed-encounter-manual-add'),
    deleteManual: requireById<HTMLButtonElement>('ed-encounter-manual-delete'),
    hover: requireById<HTMLElement>('ed-encounter-hover'),
  };

  private state: EditorEncounterPanelState = {
    areas: [],
    hoverTile: null,
    selectedAreaId: null,
    selectedManualSpawnId: null,
    selectedRuleId: null,
  };

  constructor(private readonly callbacks: EditorEncounterPanelCallbacks) {
    this.populateEnemyOptions();
    this.bindEvents();
  }

  setVisible(visible: boolean): void {
    this.els.section.classList.toggle('editor-hidden', !visible);
  }

  update(state: EditorEncounterPanelState): void {
    this.state = state;
    this.render();
  }

  private bindEvents(): void {
    this.els.areaSelect.addEventListener('change', () => {
      this.callbacks.onSelectArea(this.els.areaSelect.value || null);
    });
    this.els.ruleSelect.addEventListener('change', () => {
      this.callbacks.onSelectRule(this.els.ruleSelect.value || null);
    });
    this.els.manualSelect.addEventListener('change', () => {
      this.callbacks.onSelectManualSpawn(this.els.manualSelect.value || null);
    });

    for (const input of [
      this.els.areaName,
      this.els.areaTags,
      this.els.areaX,
      this.els.areaY,
      this.els.areaWidth,
      this.els.areaHeight,
    ]) {
      input.addEventListener('change', () => this.callbacks.onUpdateArea(this.readAreaPatch()));
    }

    this.els.newArea.addEventListener('click', () => this.callbacks.onCreateAreaAtHover());
    this.els.moveArea.addEventListener('click', () => this.callbacks.onMoveAreaToHover());
    this.els.deleteArea.addEventListener('click', () => this.callbacks.onDeleteArea());
    this.els.addRule.addEventListener('click', () => this.callbacks.onAddRule(this.readRuleDraft()));
    this.els.saveRule.addEventListener('click', () => this.callbacks.onUpdateRule(this.readRuleDraft()));
    this.els.deleteRule.addEventListener('click', () => this.callbacks.onDeleteRule());
    this.els.addManual.addEventListener('click', () => this.callbacks.onAddManualSpawnAtHover());
    this.els.deleteManual.addEventListener('click', () => this.callbacks.onDeleteManualSpawn());
  }

  private render(): void {
    const area = this.getSelectedArea();
    const rule = this.getSelectedRule(area);
    const manualSpawn = area?.manualSpawns.find((spawn) => spawn.id === this.state.selectedManualSpawnId) ?? null;

    this.syncOptions(
      this.els.areaSelect,
      this.state.areas.map((candidate) => ({
        label: `${candidate.name} (${candidate.spawnRules.length}/${candidate.manualSpawns.length})`,
        value: candidate.id,
      })),
      area?.id ?? '',
      'No encounter areas',
    );

    this.els.areaName.value = area?.name ?? '';
    this.els.areaTags.value = area?.tags.join(', ') ?? '';
    this.els.areaX.value = area ? String(area.tileX) : '0';
    this.els.areaY.value = area ? String(area.tileY) : '0';
    this.els.areaWidth.value = area ? String(area.width) : '1';
    this.els.areaHeight.value = area ? String(area.height) : '1';

    this.syncOptions(
      this.els.ruleSelect,
      (area?.spawnRules ?? []).map((candidate) => ({
        label: `${candidate.enemyDefinitionId} max ${candidate.maxPopulation}`,
        value: candidate.id,
      })),
      rule?.id ?? '',
      'No spawn rules',
    );

    this.els.enemySelect.value = rule?.enemyDefinitionId ?? this.els.enemySelect.options[0]?.value ?? '';
    this.els.maxPopulation.value = String(rule?.maxPopulation ?? 3);
    this.els.respawnSeconds.value = String(Math.round((rule?.respawnMs ?? 60_000) / 1000));
    this.els.weight.value = String(rule?.weight ?? 1);
    this.els.lootTable.value = rule?.lootTableId ?? '';

    this.syncOptions(
      this.els.manualSelect,
      (area?.manualSpawns ?? []).map((candidate) => ({
        label: `${candidate.enemyDefinitionId} @ ${candidate.tileX},${candidate.tileY}`,
        value: candidate.id,
      })),
      manualSpawn?.id ?? '',
      'No manual spawns',
    );

    this.els.hover.textContent = this.state.hoverTile
      ? `${this.state.hoverTile.x}, ${this.state.hoverTile.y}`
      : '-';

    this.setAreaControlsEnabled(area !== null);
    this.els.deleteRule.disabled = rule === null;
    this.els.saveRule.disabled = rule === null;
    this.els.deleteManual.disabled = manualSpawn === null;
  }

  private setAreaControlsEnabled(enabled: boolean): void {
    for (const element of [
      this.els.areaName,
      this.els.areaTags,
      this.els.areaX,
      this.els.areaY,
      this.els.areaWidth,
      this.els.areaHeight,
      this.els.moveArea,
      this.els.deleteArea,
      this.els.addRule,
      this.els.addManual,
    ]) {
      element.disabled = !enabled;
    }
  }

  private populateEnemyOptions(): void {
    this.els.enemySelect.innerHTML = '';

    for (const definition of EDITOR_ENEMY_CATALOG) {
      const option = document.createElement('option');
      option.value = definition.id;
      option.textContent = `${definition.displayName} (${definition.id})`;
      this.els.enemySelect.appendChild(option);
    }
  }

  private syncOptions(
    select: HTMLSelectElement,
    options: Array<{ label: string; value: string }>,
    selectedValue: string,
    emptyLabel: string,
  ): void {
    select.innerHTML = '';

    if (options.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyLabel;
      select.appendChild(option);
      select.value = '';
      select.disabled = true;
      return;
    }

    for (const optionData of options) {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      select.appendChild(option);
    }

    select.disabled = false;
    select.value = selectedValue || options[0].value;
  }

  private getSelectedArea(): EditorEncounterArea | null {
    return this.state.areas.find((area) => area.id === this.state.selectedAreaId) ?? null;
  }

  private getSelectedRule(area: EditorEncounterArea | null): EditorEncounterRule | null {
    return area?.spawnRules.find((rule) => rule.id === this.state.selectedRuleId) ?? area?.spawnRules[0] ?? null;
  }

  private readAreaPatch(): EditorEncounterAreaPatch {
    return {
      name: this.els.areaName.value.trim() || 'Encounter',
      tags: this.els.areaTags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
      tileX: parseIntegerInput(this.els.areaX.value, 0),
      tileY: parseIntegerInput(this.els.areaY.value, 0),
      width: Math.max(1, parseIntegerInput(this.els.areaWidth.value, 1)),
      height: Math.max(1, parseIntegerInput(this.els.areaHeight.value, 1)),
    };
  }

  private readRuleDraft(): Omit<EditorEncounterRule, 'id'> {
    const enemyDefinitionId = this.els.enemySelect.value || 'wolf_passive';
    const lootTableId = this.els.lootTable.value.trim();
    const rule: Omit<EditorEncounterRule, 'id'> = {
      enemyDefinitionId,
      creatureFamilyId: enemyDefinitionId,
      maxPopulation: Math.max(1, parseIntegerInput(this.els.maxPopulation.value, 1)),
      respawnMs: Math.max(1, parseIntegerInput(this.els.respawnSeconds.value, 60)) * 1000,
      weight: Math.max(0.01, parseNumberInput(this.els.weight.value, 1)),
    };

    if (lootTableId) {
      rule.lootTableId = lootTableId;
    }

    return rule;
  }
}

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
