import type { RuntimeEnemySpawn } from '../world/maps/MapRuntime';

type AreaRecord = {
  totalSpawns: number;
  defeatedSpawnIds: Set<string>;
};

/**
 * Tracks alive vs. defeated counts per encounter area so the game can detect
 * "area cleared" events, gate quests, and log worldstate changes without
 * modifying any authored chunk data.
 *
 * Respawn is handled by EnemySystem internally (via deathResetDelayMs). When
 * an enemy respawns, call `recordRespawn` to remove it from the defeated set.
 */
export class WorldEncounterPopulationTracker {
  private readonly areas = new Map<string, AreaRecord>();

  registerSpawns(spawns: RuntimeEnemySpawn[]): void {
    this.areas.clear();
    for (const spawn of spawns) {
      if (!spawn.areaId) continue;
      const record = this.areas.get(spawn.areaId) ?? { totalSpawns: 0, defeatedSpawnIds: new Set() };
      record.totalSpawns += 1;
      this.areas.set(spawn.areaId, record);
    }
  }

  recordKill(spawnId: string, areaId: string): void {
    const record = this.areas.get(areaId);
    if (record) {
      record.defeatedSpawnIds.add(spawnId);
    }
  }

  recordRespawn(spawnId: string, areaId: string): void {
    this.areas.get(areaId)?.defeatedSpawnIds.delete(spawnId);
  }

  getAliveCount(areaId: string): number {
    const record = this.areas.get(areaId);
    if (!record) return 0;
    return Math.max(0, record.totalSpawns - record.defeatedSpawnIds.size);
  }

  getTotalCount(areaId: string): number {
    return this.areas.get(areaId)?.totalSpawns ?? 0;
  }

  isAreaCleared(areaId: string): boolean {
    const record = this.areas.get(areaId);
    if (!record || record.totalSpawns === 0) return false;
    return record.defeatedSpawnIds.size >= record.totalSpawns;
  }

  getAreaIds(): string[] {
    return Array.from(this.areas.keys());
  }

  getClearedAreaIds(): string[] {
    return this.getAreaIds().filter((id) => this.isAreaCleared(id));
  }
}
