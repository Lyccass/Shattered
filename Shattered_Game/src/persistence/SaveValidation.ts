import {
  PROTOTYPE_SAVE_VERSION,
  type ActiveEffectSaveState,
  type PersonalIslandPlacedObjectSaveState,
  type PersonalIslandSaveState,
  type PlayerSaveState,
  type SaveGameV1,
  type SaveValidationResult,
  type TaskJournalSaveState,
  type WorldChunkSnapshotState,
  type WorldMapSnapshotState,
  type WorldRegionSnapshotState,
} from './SaveTypes';

export function validateSaveGameV1(input: unknown): SaveValidationResult<SaveGameV1> {
  const root = asRecord(input, 'SaveGameV1');
  if (!root.ok) return root;

  if (root.value.version !== PROTOTYPE_SAVE_VERSION) {
    return fail(`SaveGameV1: expected version ${PROTOTYPE_SAVE_VERSION}.`);
  }

  const savedAt = readNumber(root.value.savedAt, 'SaveGameV1.savedAt');
  if (!savedAt.ok) return savedAt;

  const playerState = validatePlayerSaveState(root.value.playerState);
  if (!playerState.ok) return playerState;

  const personalIslandState = validatePersonalIslandSaveState(root.value.personalIslandState);
  if (!personalIslandState.ok) return personalIslandState;

  const worldMapSnapshot = validateWorldMapSnapshotState(root.value.worldMapSnapshot);
  if (!worldMapSnapshot.ok) return worldMapSnapshot;

  return {
    ok: true,
    value: {
      version: PROTOTYPE_SAVE_VERSION,
      savedAt: savedAt.value,
      playerState: playerState.value,
      personalIslandState: personalIslandState.value,
      worldMapSnapshot: worldMapSnapshot.value,
    },
  };
}

function validatePlayerSaveState(input: unknown): SaveValidationResult<PlayerSaveState> {
  const record = asRecord(input, 'PlayerSaveState');
  if (!record.ok) return record;

  const currentWorldId = readString(record.value.currentWorldId, 'PlayerSaveState.currentWorldId');
  if (!currentWorldId.ok) return currentWorldId;

  const currentMapId = readString(record.value.currentMapId, 'PlayerSaveState.currentMapId');
  if (!currentMapId.ok) return currentMapId;

  const playerTileRecord = asRecord(record.value.playerTile, 'PlayerSaveState.playerTile');
  if (!playerTileRecord.ok) return playerTileRecord;

  const tileX = readInteger(playerTileRecord.value.tileX, 'PlayerSaveState.playerTile.tileX');
  if (!tileX.ok) return tileX;
  const tileY = readInteger(playerTileRecord.value.tileY, 'PlayerSaveState.playerTile.tileY');
  if (!tileY.ok) return tileY;

  const resources = readNumberRecord(record.value.resources, 'PlayerSaveState.resources');
  if (!resources.ok) return resources;
  const items = readNumberRecord(record.value.items, 'PlayerSaveState.items');
  if (!items.ok) return items;
  const currency = readNumberRecord(record.value.currency, 'PlayerSaveState.currency');
  if (!currency.ok) return currency;
  const reputation = readNumberRecord(record.value.reputation, 'PlayerSaveState.reputation');
  if (!reputation.ok) return reputation;
  const skillXp = readNumberRecord(record.value.skillXp, 'PlayerSaveState.skillXp');
  if (!skillXp.ok) return skillXp;

  const journal = validateTaskJournalSaveState(record.value.journal);
  if (!journal.ok) return journal;

  const activeEffects = validateActiveEffectSaveStates(record.value.activeEffects);
  if (!activeEffects.ok) return activeEffects;

  const equippedSlots = record.value.equippedSlots === undefined
    ? undefined
    : readStringRecord(record.value.equippedSlots, 'PlayerSaveState.equippedSlots');
  if (equippedSlots && !equippedSlots.ok) return equippedSlots;

  const spellbookLoadout = record.value.spellbookLoadout === undefined
    ? undefined
    : validateSpellbookLoadout(record.value.spellbookLoadout);
  if (spellbookLoadout && !spellbookLoadout.ok) return spellbookLoadout;

  const combatCooldowns = record.value.combatCooldowns === undefined
    ? undefined
    : validateCombatCooldowns(record.value.combatCooldowns);
  if (combatCooldowns && !combatCooldowns.ok) return combatCooldowns;

  return {
    ok: true,
    value: {
      currentWorldId: currentWorldId.value,
      currentMapId: currentMapId.value,
      playerTile: {
        tileX: tileX.value,
        tileY: tileY.value,
      },
      resources: resources.value,
      items: items.value,
      currency: currency.value,
      reputation: reputation.value,
      skillXp: skillXp.value,
      journal: journal.value,
      activeEffects: activeEffects.value,
      ...(equippedSlots ? { equippedSlots: equippedSlots.value } : {}),
      ...(spellbookLoadout ? { spellbookLoadout: spellbookLoadout.value } : {}),
      ...(combatCooldowns ? { combatCooldowns: combatCooldowns.value } : {}),
    },
  };
}

function validateCombatCooldowns(input: unknown): SaveValidationResult<NonNullable<PlayerSaveState['combatCooldowns']>> {
  const record = asRecord(input, 'PlayerSaveState.combatCooldowns');
  if (!record.ok) return record;

  const attackCooldowns = record.value.attackCooldowns === undefined
    ? undefined
    : readNumberRecord(record.value.attackCooldowns, 'PlayerSaveState.combatCooldowns.attackCooldowns');
  if (attackCooldowns && !attackCooldowns.ok) return attackCooldowns;

  const abilityCooldowns = record.value.abilityCooldowns === undefined
    ? undefined
    : readNumberRecord(record.value.abilityCooldowns, 'PlayerSaveState.combatCooldowns.abilityCooldowns');
  if (abilityCooldowns && !abilityCooldowns.ok) return abilityCooldowns;

  return {
    ok: true,
    value: {
      attackCooldowns: sanitizeCooldownRecord(attackCooldowns?.value),
      abilityCooldowns: sanitizeCooldownRecord(abilityCooldowns?.value),
    },
  };
}

function sanitizeCooldownRecord(record: Record<string, number> | undefined): Record<string, number> {
  const sanitized: Record<string, number> = {};
  for (const [id, value] of Object.entries(record ?? {})) {
    const remaining = Math.max(0, Math.floor(value));
    if (remaining > 0) sanitized[id] = remaining;
  }
  return sanitized;
}

function validateSpellbookLoadout(input: unknown): SaveValidationResult<NonNullable<PlayerSaveState['spellbookLoadout']>> {
  const record = asRecord(input, 'PlayerSaveState.spellbookLoadout');
  if (!record.ok) return record;

  return {
    ok: true,
    value: {
      combatSpellIds: readNullableStringArray(record.value.combatSpellIds),
      utilitySpellIds: readNullableStringArray(record.value.utilitySpellIds),
      devotionAbilityIds: readNullableStringArray(record.value.devotionAbilityIds),
    },
  };
}

function validateTaskJournalSaveState(input: unknown): SaveValidationResult<TaskJournalSaveState> {
  const record = asRecord(input, 'TaskJournalSaveState');
  if (!record.ok) return record;

  const acceptedContractIds = readStringArray(
    record.value.acceptedContractIds,
    'TaskJournalSaveState.acceptedContractIds',
  );
  if (!acceptedContractIds.ok) return acceptedContractIds;

  const completedNonRepeatableContractIds = readStringArray(
    record.value.completedNonRepeatableContractIds,
    'TaskJournalSaveState.completedNonRepeatableContractIds',
  );
  if (!completedNonRepeatableContractIds.ok) return completedNonRepeatableContractIds;

  const contractCompletionCounts = readNumberRecord(
    record.value.contractCompletionCounts,
    'TaskJournalSaveState.contractCompletionCounts',
  );
  if (!contractCompletionCounts.ok) return contractCompletionCounts;

  return {
    ok: true,
    value: {
      acceptedContractIds: acceptedContractIds.value,
      completedNonRepeatableContractIds: completedNonRepeatableContractIds.value,
      contractCompletionCounts: contractCompletionCounts.value,
    },
  };
}

function validateActiveEffectSaveStates(input: unknown): SaveValidationResult<ActiveEffectSaveState[]> {
  if (!Array.isArray(input)) {
    return fail('PlayerSaveState.activeEffects must be an array.');
  }

  const effects: ActiveEffectSaveState[] = [];

  for (const [index, entry] of input.entries()) {
    const record = asRecord(entry, `PlayerSaveState.activeEffects[${index}]`);
    if (!record.ok) return record;

    const effectId = readString(
      record.value.effectId,
      `PlayerSaveState.activeEffects[${index}].effectId`,
    );
    if (!effectId.ok) return effectId;

    const remainingMs = readNumber(
      record.value.remainingMs,
      `PlayerSaveState.activeEffects[${index}].remainingMs`,
    );
    if (!remainingMs.ok) return remainingMs;

    effects.push({
      effectId: effectId.value,
      remainingMs: Math.max(0, Math.floor(remainingMs.value)),
    });
  }

  return { ok: true, value: effects };
}

function validatePersonalIslandSaveState(
  input: unknown,
): SaveValidationResult<PersonalIslandSaveState> {
  const record = asRecord(input, 'PersonalIslandSaveState');
  if (!record.ok) return record;

  const islandId = readString(record.value.islandId, 'PersonalIslandSaveState.islandId');
  if (!islandId.ok) return islandId;

  const persistentPlacedObjects = validatePersonalIslandPlacedObjects(
    record.value.persistentPlacedObjects,
  );
  if (!persistentPlacedObjects.ok) return persistentPlacedObjects;

  const terrainEdits = Array.isArray(record.value.terrainEdits) ? record.value.terrainEdits : [];
  const buildings = Array.isArray(record.value.buildings) ? record.value.buildings : [];
  const storage = readNumberRecord(record.value.storage, 'PersonalIslandSaveState.storage');
  if (!storage.ok) return storage;

  return {
    ok: true,
    value: {
      islandId: islandId.value,
      persistentPlacedObjects: persistentPlacedObjects.value,
      terrainEdits,
      buildings,
      storage: storage.value,
    },
  };
}

function validatePersonalIslandPlacedObjects(
  input: unknown,
): SaveValidationResult<PersonalIslandPlacedObjectSaveState[]> {
  if (!Array.isArray(input)) {
    return fail('PersonalIslandSaveState.persistentPlacedObjects must be an array.');
  }

  const objects: PersonalIslandPlacedObjectSaveState[] = [];

  for (const [index, entry] of input.entries()) {
    const record = asRecord(entry, `PersonalIslandSaveState.persistentPlacedObjects[${index}]`);
    if (!record.ok) return record;

    const id = readString(record.value.id, `PersonalIslandSaveState.persistentPlacedObjects[${index}].id`);
    if (!id.ok) return id;
    const definitionId = readString(
      record.value.definitionId,
      `PersonalIslandSaveState.persistentPlacedObjects[${index}].definitionId`,
    );
    if (!definitionId.ok) return definitionId;
    const tileX = readInteger(
      record.value.tileX,
      `PersonalIslandSaveState.persistentPlacedObjects[${index}].tileX`,
    );
    if (!tileX.ok) return tileX;
    const tileY = readInteger(
      record.value.tileY,
      `PersonalIslandSaveState.persistentPlacedObjects[${index}].tileY`,
    );
    if (!tileY.ok) return tileY;

    objects.push({
      id: id.value,
      definitionId: definitionId.value,
      tileX: tileX.value,
      tileY: tileY.value,
      state: isPlainObject(record.value.state) ? record.value.state : undefined,
    });
  }

  return { ok: true, value: objects };
}

function validateWorldMapSnapshotState(
  input: unknown,
): SaveValidationResult<WorldMapSnapshotState> {
  const record = asRecord(input, 'WorldMapSnapshotState');
  if (!record.ok) return record;

  const worldId = readString(record.value.worldId, 'WorldMapSnapshotState.worldId');
  if (!worldId.ok) return worldId;

  const changedRegions = asRecord(record.value.changedRegions, 'WorldMapSnapshotState.changedRegions');
  if (!changedRegions.ok) return changedRegions;

  const validatedRegions: Record<string, WorldRegionSnapshotState> = {};

  for (const [regionKey, regionValue] of Object.entries(changedRegions.value)) {
    const region = validateWorldRegionSnapshotState(regionValue, regionKey);
    if (!region.ok) return region;
    validatedRegions[regionKey] = region.value;
  }

  return {
    ok: true,
    value: {
      worldId: worldId.value,
      changedRegions: validatedRegions,
    },
  };
}

function validateWorldRegionSnapshotState(
  input: unknown,
  regionKey: string,
): SaveValidationResult<WorldRegionSnapshotState> {
  const record = asRecord(input, `WorldMapSnapshotState.changedRegions.${regionKey}`);
  if (!record.ok) return record;

  const regionId = readString(
    record.value.regionId,
    `WorldMapSnapshotState.changedRegions.${regionKey}.regionId`,
  );
  if (!regionId.ok) return regionId;

  const changedChunks = asRecord(
    record.value.changedChunks,
    `WorldMapSnapshotState.changedRegions.${regionKey}.changedChunks`,
  );
  if (!changedChunks.ok) return changedChunks;

  const validatedChunks: Record<string, WorldChunkSnapshotState> = {};

  for (const [chunkKey, chunkValue] of Object.entries(changedChunks.value)) {
    const chunk = validateWorldChunkSnapshotState(chunkValue, regionKey, chunkKey);
    if (!chunk.ok) return chunk;
    validatedChunks[chunkKey] = chunk.value;
  }

  return {
    ok: true,
    value: {
      regionId: regionId.value,
      changedChunks: validatedChunks,
    },
  };
}

function validateWorldChunkSnapshotState(
  input: unknown,
  regionKey: string,
  chunkKey: string,
): SaveValidationResult<WorldChunkSnapshotState> {
  const record = asRecord(
    input,
    `WorldMapSnapshotState.changedRegions.${regionKey}.changedChunks.${chunkKey}`,
  );
  if (!record.ok) return record;

  const validatedChunkKey = readString(
    record.value.chunkKey,
    `WorldMapSnapshotState.changedRegions.${regionKey}.changedChunks.${chunkKey}.chunkKey`,
  );
  if (!validatedChunkKey.ok) return validatedChunkKey;

  const depletedResourcesRecord = asRecord(
    record.value.depletedResources,
    `WorldMapSnapshotState.changedRegions.${regionKey}.changedChunks.${chunkKey}.depletedResources`,
  );
  if (!depletedResourcesRecord.ok) return depletedResourcesRecord;

  const depletedResources: WorldChunkSnapshotState['depletedResources'] = {};

  for (const [resourceId, resourceValue] of Object.entries(depletedResourcesRecord.value)) {
    const resourceRecord = asRecord(
      resourceValue,
      `WorldChunkSnapshotState.depletedResources.${resourceId}`,
    );
    if (!resourceRecord.ok) return resourceRecord;

    const respawnAt = readNumber(
      resourceRecord.value.respawnAt,
      `WorldChunkSnapshotState.depletedResources.${resourceId}.respawnAt`,
    );
    if (!respawnAt.ok) return respawnAt;

    depletedResources[resourceId] = {
      respawnAt: Math.max(0, Math.floor(respawnAt.value)),
    };
  }

  return {
    ok: true,
    value: {
      chunkKey: validatedChunkKey.value,
      depletedResources,
      changedFlags: isPlainObject(record.value.changedFlags)
        ? record.value.changedFlags as Record<string, string | number | boolean>
        : undefined,
    },
  };
}

function readNumber(value: unknown, label: string): SaveValidationResult<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(`${label} must be a finite number.`);
  }

  return { ok: true, value };
}

function readInteger(value: unknown, label: string): SaveValidationResult<number> {
  const numberResult = readNumber(value, label);
  if (!numberResult.ok) return numberResult;

  return { ok: true, value: Math.trunc(numberResult.value) };
}

function readString(value: unknown, label: string): SaveValidationResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(`${label} must be a non-empty string.`);
  }

  return { ok: true, value };
}

function readStringArray(value: unknown, label: string): SaveValidationResult<string[]> {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    return fail(`${label} must be an array of non-empty strings.`);
  }

  return { ok: true, value: [...value] };
}

function readNullableStringArray(value: unknown): Array<string | null> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) => typeof entry === 'string' && entry.length > 0 ? entry : null);
}

function readNumberRecord(value: unknown, label: string): SaveValidationResult<Record<string, number>> {
  const record = asRecord(value, label);
  if (!record.ok) return record;

  const parsed: Record<string, number> = {};

  for (const [key, entryValue] of Object.entries(record.value)) {
    const numberResult = readNumber(entryValue, `${label}.${key}`);
    if (!numberResult.ok) return numberResult;
    parsed[key] = Math.max(0, Math.floor(numberResult.value));
  }

  return { ok: true, value: parsed };
}

function readStringRecord(value: unknown, label: string): SaveValidationResult<Record<string, string>> {
  const record = asRecord(value, label);
  if (!record.ok) return record;

  const parsed: Record<string, string> = {};

  for (const [key, entryValue] of Object.entries(record.value)) {
    const stringResult = readString(entryValue, `${label}.${key}`);
    if (!stringResult.ok) return stringResult;
    parsed[key] = stringResult.value;
  }

  return { ok: true, value: parsed };
}

function asRecord(value: unknown, label: string): SaveValidationResult<Record<string, unknown>> {
  if (!isPlainObject(value)) {
    return fail(`${label} must be an object.`);
  }

  return { ok: true, value };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail<T>(error: string): SaveValidationResult<T> {
  return { ok: false, error };
}
