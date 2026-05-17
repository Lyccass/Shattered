import {
  PROTOTYPE_SAVE_VERSION,
  type PlayerTileSaveState,
  type SaveGameV1,
} from './SaveTypes';
import { validateSaveGameV1 } from './SaveValidation';

export const LOCAL_SAVE_STORAGE_KEY = 'shattered.prototype.save.v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LocalSaveSummary = {
  savedAt: number;
  currentWorldId: string;
  currentMapId: string;
  playerTile: PlayerTileSaveState;
  totalCopperEquivalent: number;
  totalSkillXp: number;
};

export type LocalSaveWriteResult =
  | { ok: true }
  | { ok: false; error: string };

export type LocalSaveLoadResult =
  | { status: 'success'; saveGame: SaveGameV1 }
  | { status: 'no_save' }
  | { status: 'invalid_json'; error: string }
  | { status: 'unsupported_version'; version: number | null }
  | { status: 'validation_failed'; error: string }
  | { status: 'storage_unavailable'; error: string };

export class LocalSaveService {
  constructor(
    private readonly storageKey = LOCAL_SAVE_STORAGE_KEY,
    private readonly storage: StorageLike | null = resolveLocalStorage(),
  ) {}

  save(saveGame: SaveGameV1): LocalSaveWriteResult {
    if (!this.storage) {
      return { ok: false, error: 'Browser storage is unavailable.' };
    }

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(saveGame));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: formatStorageError('Failed to write browser save.', error),
      };
    }
  }

  load(): LocalSaveLoadResult {
    if (!this.storage) {
      return {
        status: 'storage_unavailable',
        error: 'Browser storage is unavailable.',
      };
    }

    const raw = this.storage.getItem(this.storageKey);

    if (!raw) {
      return { status: 'no_save' };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return {
        status: 'invalid_json',
        error: formatStorageError('Stored save JSON is invalid.', error),
      };
    }

    const version =
      typeof parsed === 'object'
      && parsed !== null
      && 'version' in parsed
      && typeof parsed.version === 'number'
        ? parsed.version
        : null;

    if (version !== PROTOTYPE_SAVE_VERSION) {
      return {
        status: 'unsupported_version',
        version,
      };
    }

    const validation = validateSaveGameV1(parsed);

    if (!validation.ok) {
      return {
        status: 'validation_failed',
        error: validation.error,
      };
    }

    return {
      status: 'success',
      saveGame: validation.value,
    };
  }

  hasSave(): boolean {
    return this.storage?.getItem(this.storageKey) !== null;
  }

  clearSave(): boolean {
    if (!this.storage) {
      return false;
    }

    this.storage.removeItem(this.storageKey);
    return true;
  }

  getSaveSummary(): LocalSaveSummary | null {
    const result = this.load();

    if (result.status !== 'success') {
      return null;
    }

    const { saveGame } = result;
    const currency = saveGame.playerState.currency;
    const totalCopperEquivalent =
      (currency.copper ?? 0)
      + (currency.silver ?? 0) * 100
      + (currency.gold ?? 0) * 10_000
      + (currency.platinum ?? 0) * 1_000_000;
    const totalSkillXp = Object.values(saveGame.playerState.skillXp).reduce(
      (sum, xp) => sum + xp,
      0,
    );

    return {
      savedAt: saveGame.savedAt,
      currentWorldId: saveGame.playerState.currentWorldId,
      currentMapId: saveGame.playerState.currentMapId,
      playerTile: saveGame.playerState.playerTile,
      totalCopperEquivalent,
      totalSkillXp,
    };
  }

  validateLoadedSave(): LocalSaveLoadResult {
    return this.load();
  }
}

function resolveLocalStorage(): StorageLike | null {
  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  return globalThis.localStorage;
}

function formatStorageError(prefix: string, error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${prefix} ${error.message}`;
  }

  return prefix;
}
