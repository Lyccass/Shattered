import type { HabitatDefinition, ManualSpawnDefinition, SpawnRuleDefinition } from '../world/ChunkTypes';

export type EditorEncounterRule = {
  id: string;
  enemyDefinitionId: string;
  creatureFamilyId: string;
  maxPopulation: number;
  respawnMs: number;
  weight: number;
  lootTableId?: string;
};

export type EditorManualEncounterSpawn = {
  id: string;
  enemyDefinitionId: string;
  tileX: number;
  tileY: number;
  respawnMs: number;
  lootTableId?: string;
};

export type EditorEncounterArea = {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  tags: string[];
  spawnRules: EditorEncounterRule[];
  manualSpawns: EditorManualEncounterSpawn[];
};

export type EditorEncounterAreaPatch = Partial<Omit<EditorEncounterArea, 'id' | 'spawnRules' | 'manualSpawns'>>;
export type EditorEncounterRulePatch = Partial<Omit<EditorEncounterRule, 'id'>>;

const DEFAULT_RESPAWN_MS = 60_000;
const DEFAULT_AREA_SIZE = 8;

export function createEditorEncounterArea(
  tileX: number,
  tileY: number,
  enemyDefinitionId = 'wolf_aggressive',
): EditorEncounterArea {
  const id = createStableEditorId('encounter');

  return {
    id,
    name: 'New Encounter',
    tileX,
    tileY,
    width: DEFAULT_AREA_SIZE,
    height: DEFAULT_AREA_SIZE,
    tags: ['wilds'],
    spawnRules: [createEditorEncounterRule(enemyDefinitionId)],
    manualSpawns: [],
  };
}

export function createEditorEncounterRule(enemyDefinitionId: string): EditorEncounterRule {
  return {
    id: createStableEditorId('rule'),
    enemyDefinitionId,
    creatureFamilyId: enemyDefinitionId,
    maxPopulation: 3,
    respawnMs: DEFAULT_RESPAWN_MS,
    weight: 1,
  };
}

export function createEditorManualEncounterSpawn(
  tileX: number,
  tileY: number,
  enemyDefinitionId: string,
): EditorManualEncounterSpawn {
  return {
    id: createStableEditorId('manual_spawn'),
    enemyDefinitionId,
    tileX,
    tileY,
    respawnMs: DEFAULT_RESPAWN_MS,
  };
}

export function cloneEditorEncounterAreas(areas: EditorEncounterArea[]): EditorEncounterArea[] {
  return areas.map(cloneEditorEncounterArea);
}

export function cloneEditorEncounterArea(area: EditorEncounterArea): EditorEncounterArea {
  return {
    ...area,
    tags: [...area.tags],
    spawnRules: area.spawnRules.map((rule) => ({ ...rule })),
    manualSpawns: area.manualSpawns.map((spawn) => ({ ...spawn })),
  };
}

export function resizeEditorEncounterAreas(
  areas: EditorEncounterArea[],
  width: number,
  height: number,
): EditorEncounterArea[] {
  return areas
    .filter((area) => area.tileX < width && area.tileY < height)
    .map((area) => {
      const nextWidth = Math.max(1, Math.min(area.width, width - area.tileX));
      const nextHeight = Math.max(1, Math.min(area.height, height - area.tileY));

      return {
        ...area,
        width: nextWidth,
        height: nextHeight,
        manualSpawns: area.manualSpawns.filter((spawn) =>
          spawn.tileX >= 0 &&
          spawn.tileY >= 0 &&
          spawn.tileX < width &&
          spawn.tileY < height,
        ),
      };
    });
}

export function serializeEditorEncounterAreas(
  areas: EditorEncounterArea[],
): EditorEncounterArea[] {
  return cloneEditorEncounterAreas(areas);
}

export function parseEditorEncounterAreas(value: unknown): EditorEncounterArea[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(parseEditorEncounterArea)
    .filter((area): area is EditorEncounterArea => area !== null);
}

export function editorEncounterAreasToHabitats(
  areas: EditorEncounterArea[],
): HabitatDefinition[] {
  return areas.map((area) => {
    const habitat: HabitatDefinition = {
      id: area.id,
      name: area.name,
      tileX: area.tileX,
      tileY: area.tileY,
      width: area.width,
      height: area.height,
      tags: [...area.tags],
      spawnRules: area.spawnRules.map(toSpawnRuleDefinition),
    };

    if (area.manualSpawns.length > 0) {
      habitat.manualSpawns = area.manualSpawns.map(toManualSpawnDefinition);
    }

    return habitat;
  });
}

export function habitatsToEditorEncounterAreas(
  habitats: HabitatDefinition[],
): EditorEncounterArea[] {
  return habitats.map((habitat) => ({
    id: habitat.id,
    name: habitat.name ?? habitat.id,
    tileX: habitat.tileX,
    tileY: habitat.tileY,
    width: habitat.width,
    height: habitat.height,
    tags: [...(habitat.tags ?? [])],
    spawnRules: habitat.spawnRules.map(fromSpawnRuleDefinition),
    manualSpawns: (habitat.manualSpawns ?? []).map(fromManualSpawnDefinition),
  }));
}

function parseEditorEncounterArea(value: unknown): EditorEncounterArea | null {
  if (!isRecord(value)) {
    return null;
  }

  const tileX = parseInteger(value.tileX);
  const tileY = parseInteger(value.tileY);
  const width = parsePositiveInteger(value.width);
  const height = parsePositiveInteger(value.height);

  if (
    typeof value.id !== 'string' ||
    tileX === null ||
    tileY === null ||
    width === null ||
    height === null
  ) {
    return null;
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : value.id,
    tileX,
    tileY,
    width,
    height,
    tags: parseStringArray(value.tags),
    spawnRules: Array.isArray(value.spawnRules)
      ? value.spawnRules.map(parseEditorEncounterRule).filter((rule): rule is EditorEncounterRule => rule !== null)
      : [],
    manualSpawns: Array.isArray(value.manualSpawns)
      ? value.manualSpawns.map(parseEditorManualSpawn).filter((spawn): spawn is EditorManualEncounterSpawn => spawn !== null)
      : [],
  };
}

function parseEditorEncounterRule(value: unknown): EditorEncounterRule | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.enemyDefinitionId !== 'string') {
    return null;
  }

  const rule: EditorEncounterRule = {
    id: value.id,
    enemyDefinitionId: value.enemyDefinitionId,
    creatureFamilyId: typeof value.creatureFamilyId === 'string'
      ? value.creatureFamilyId
      : value.enemyDefinitionId,
    maxPopulation: parsePositiveInteger(value.maxPopulation) ?? 1,
    respawnMs: parsePositiveInteger(value.respawnMs) ?? DEFAULT_RESPAWN_MS,
    weight: parsePositiveNumber(value.weight) ?? 1,
  };

  if (typeof value.lootTableId === 'string' && value.lootTableId.trim()) {
    rule.lootTableId = value.lootTableId.trim();
  }

  return rule;
}

function parseEditorManualSpawn(value: unknown): EditorManualEncounterSpawn | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.enemyDefinitionId !== 'string') {
    return null;
  }

  const tileX = parseInteger(value.tileX);
  const tileY = parseInteger(value.tileY);

  if (tileX === null || tileY === null) {
    return null;
  }

  const spawn: EditorManualEncounterSpawn = {
    id: value.id,
    enemyDefinitionId: value.enemyDefinitionId,
    tileX,
    tileY,
    respawnMs: parsePositiveInteger(value.respawnMs) ?? DEFAULT_RESPAWN_MS,
  };

  if (typeof value.lootTableId === 'string' && value.lootTableId.trim()) {
    spawn.lootTableId = value.lootTableId.trim();
  }

  return spawn;
}

function toSpawnRuleDefinition(rule: EditorEncounterRule): SpawnRuleDefinition {
  const definition: SpawnRuleDefinition = {
    id: rule.id,
    creatureFamilyId: rule.creatureFamilyId,
    enemyDefinitionId: rule.enemyDefinitionId,
    maxPopulation: rule.maxPopulation,
    respawnMs: rule.respawnMs,
    weight: rule.weight,
  };

  if (rule.lootTableId) {
    definition.lootTableId = rule.lootTableId;
  }

  return definition;
}

function fromSpawnRuleDefinition(rule: SpawnRuleDefinition): EditorEncounterRule {
  const enemyDefinitionId = rule.enemyDefinitionId ?? rule.creatureFamilyId;
  const editorRule: EditorEncounterRule = {
    id: rule.id,
    enemyDefinitionId,
    creatureFamilyId: rule.creatureFamilyId,
    maxPopulation: rule.maxPopulation ?? 1,
    respawnMs: rule.respawnMs ?? DEFAULT_RESPAWN_MS,
    weight: rule.weight ?? rule.densityHint ?? 1,
  };

  if (rule.lootTableId) {
    editorRule.lootTableId = rule.lootTableId;
  }

  return editorRule;
}

function toManualSpawnDefinition(spawn: EditorManualEncounterSpawn): ManualSpawnDefinition {
  const definition: ManualSpawnDefinition = {
    id: spawn.id,
    enemyDefinitionId: spawn.enemyDefinitionId,
    tileX: spawn.tileX,
    tileY: spawn.tileY,
    respawnMs: spawn.respawnMs,
  };

  if (spawn.lootTableId) {
    definition.lootTableId = spawn.lootTableId;
  }

  return definition;
}

function fromManualSpawnDefinition(spawn: ManualSpawnDefinition): EditorManualEncounterSpawn {
  const editorSpawn: EditorManualEncounterSpawn = {
    id: spawn.id,
    enemyDefinitionId: spawn.enemyDefinitionId,
    tileX: spawn.tileX,
    tileY: spawn.tileY,
    respawnMs: spawn.respawnMs ?? DEFAULT_RESPAWN_MS,
  };

  if (spawn.lootTableId) {
    editorSpawn.lootTableId = spawn.lootTableId;
  }

  return editorSpawn;
}

function parseInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function parsePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function parsePositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createStableEditorId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
