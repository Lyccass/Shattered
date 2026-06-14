import Phaser from 'phaser';
import { EnemyRegistry } from './EnemyRegistry';
import { ENEMY_DEFINITIONS } from './EnemyDefinitions';
import { EnemyVisualController } from './EnemyVisualController';
import type { EnemyTurnVisualState } from './EnemyVisualController';
import type { EnemyDefinition, EnemyRuntimeRecord, EnemySpawnDefinition } from './EnemyTypes';
import type { IsoTilemap } from '../world/IsoTilemap';

const DEFAULT_RESPAWN_MS = 60_000;

const WANDER_RADIUS_TILES   = 3;
const WANDER_SPEED_PER_MS   = 0.022;
const WANDER_MIN_WAIT_MS    = 3_000;
const WANDER_MAX_WAIT_MS    = 8_000;
const WANDER_ARRIVE_DIST    = 4;
const WANDER_PICK_ATTEMPTS  = 10;

export class EnemySystem {
  private readonly registry = new EnemyRegistry(ENEMY_DEFINITIONS);
  private readonly visualController: EnemyVisualController;

  private record:     EnemyRuntimeRecord | null = null;
  private definition: EnemyDefinition    | null = null;
  private tilemap:    IsoTilemap         | null = null;

  /** True while the enemy is a participant in an active turn combat. */
  private _inCombat = false;

  /** Used to compute deltaMs from successive nowMs values. */
  private lastUpdateMs: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.visualController = new EnemyVisualController(scene);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  setMapContext(mapId: string, tilemap: IsoTilemap, spawn: EnemySpawnDefinition | null): void {
    this.clearRuntime();
    this.tilemap = tilemap;

    if (!spawn) return;

    this.definition = this.registry.get(spawn.definitionId);
    const origin    = tilemap.getTileCenterWorld(spawn.tileX, spawn.tileY);

    this.record = {
      id:           spawn.id,
      definitionId: spawn.definitionId,
      mapId,
      spawnTileX:   spawn.tileX,
      spawnTileY:   spawn.tileY,
      tileX:        spawn.tileX,
      tileY:        spawn.tileY,
      worldX:       origin.x,
      worldY:       origin.y,
      hp:           this.definition.maxHealth,
      maxHp:        this.definition.maxHealth,
      inCombat:     false,
      diedAtMs:     null,
      respawnMs:    spawn.respawnMs ?? DEFAULT_RESPAWN_MS,
      areaId:       spawn.areaId,
      wanderTarget: null,
      nextWanderMs: 0,
    };

    this.visualController.spawn(origin.x, origin.y);
  }

  // ─── Per-frame update (called by TurnCombatSession outside of combat) ─────

  update(nowMs: number, blockRespawn = false): void {
    if (!this.record || !this.tilemap) return;

    const deltaMs = this.lastUpdateMs !== null ? nowMs - this.lastUpdateMs : 0;
    this.lastUpdateMs = nowMs;

    if (this.record.diedAtMs !== null) {
      if (!blockRespawn && nowMs - this.record.diedAtMs >= this.record.respawnMs) {
        this.respawn(nowMs);
      } else {
        // When blocked, keep resetting the death timestamp so the full respawn
        // delay is honoured after combat ends rather than firing immediately.
        if (blockRespawn) this.record.diedAtMs = nowMs;
        this.visualController.applyTurnState(
          this.record.worldX, this.record.worldY,
          false, 0, this.record.maxHp, 'dead', nowMs,
          false,
        );
      }
      return;
    }

    if (!this._inCombat) {
      this.updateWander(nowMs, deltaMs);

      this.visualController.applyTurnState(
        this.record.worldX, this.record.worldY,
        false, this.record.hp, this.record.maxHp, 'idle', nowMs,
        false,
      );
    }
  }

  // ─── Combat integration ───────────────────────────────────────────────────

  setInCombat(inCombat: boolean): void {
    this._inCombat = inCombat;
    if (this.record) {
      this.record.inCombat = inCombat;
      if (inCombat) {
        this.record.wanderTarget = null;
        this.record.nextWanderMs = 0;
      }
    }
  }

  get inCombat(): boolean { return this._inCombat; }

  /** Called by TurnCombatSession each frame during the enemy's turn. */
  applyVisualUpdate(
    worldX: number,
    worldY: number,
    facingRightward: boolean,
    hp: number,
    visualState: EnemyTurnVisualState,
    nowMs: number,
  ): void {
    if (!this.record) return;
    this.record.worldX = worldX;
    this.record.worldY = worldY;
    this.visualController.applyTurnState(
      worldX, worldY, facingRightward, hp, this.record.maxHp, visualState, nowMs,
      true,
    );
  }

  setCombatHp(hp: number): void {
    if (!this.record) return;
    this.record.hp = Math.max(0, Math.min(this.record.maxHp, hp));
  }

  setCombatTile(tileX: number, tileY: number, syncWorld = true): void {
    if (!this.record || !this.tilemap) return;
    this.record.tileX = tileX;
    this.record.tileY = tileY;
    if (syncWorld) {
      const world = this.tilemap.getTileCenterWorld(tileX, tileY);
      this.record.worldX = world.x;
      this.record.worldY = world.y;
    }
  }

  flashHit(nowMs: number): void {
    this.visualController.flashHit(nowMs);
  }

  /** Apply damage to the record HP. Returns true if killed. */
  applyDamage(amount: number): boolean {
    if (!this.record) return false;
    this.record.hp = Math.max(0, this.record.hp - amount);
    return this.record.hp <= 0;
  }

  recordDeath(nowMs: number): void {
    if (!this.record) return;
    this.record.diedAtMs = nowMs;
    this.record.hp = 0;
    this._inCombat = false;
    this.record.inCombat = false;
    this.record.wanderTarget = null;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  isAlive(): boolean {
    return !!this.record && this.record.diedAtMs === null && this.record.hp > 0;
  }

  getRecord(): EnemyRuntimeRecord | null { return this.record; }
  getDefinition(): EnemyDefinition | null { return this.definition; }
  getSpawnId(): string | null { return this.record?.id ?? null; }
  getDefinitionId(): string | null { return this.definition?.id ?? null; }
  getAreaId(): string | undefined { return this.record?.areaId; }

  getWorldPosition(): { x: number; y: number } | null {
    if (!this.record) return null;
    return { x: this.record.worldX, y: this.record.worldY };
  }

  getCurrentTile(): { x: number; y: number } | null {
    if (!this.record) return null;
    return { x: this.record.tileX, y: this.record.tileY };
  }

  /** Whether this enemy would start combat if the player walks into aggro range. */
  wouldAggro(): boolean {
    if (!this.definition || !this.record) return false;
    if (!this.isAlive()) return false;
    if (this._inCombat) return false;
    return (this.definition.behavior ?? 'aggressive') === 'aggressive';
  }

  isInAggroRange(playerTileX: number, playerTileY: number): boolean {
    if (!this.record || !this.definition) return false;
    const dx = Math.abs(playerTileX - this.record.tileX);
    const dy = Math.abs(playerTileY - this.record.tileY);
    return Math.max(dx, dy) <= this.definition.aggroRangeTiles;
  }

  destroy(): void {
    this.visualController.destroy();
    this.record = null;
    this.definition = null;
    this.tilemap = null;
    this.lastUpdateMs = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private clearRuntime(): void {
    this.visualController.destroy();
    this.record = null;
    this.definition = null;
    this._inCombat = false;
    this.lastUpdateMs = null;
  }

  private respawn(nowMs: number): void {
    if (!this.record || !this.definition || !this.tilemap) return;
    const origin = this.tilemap.getTileCenterWorld(this.record.spawnTileX, this.record.spawnTileY);
    this.record.tileX        = this.record.spawnTileX;
    this.record.tileY        = this.record.spawnTileY;
    this.record.worldX       = origin.x;
    this.record.worldY       = origin.y;
    this.record.hp           = this.record.maxHp;
    this.record.diedAtMs     = null;
    this.record.inCombat     = false;
    this._inCombat           = false;
    this.record.wanderTarget = null;
    this.record.nextWanderMs = nowMs + randomBetween(WANDER_MIN_WAIT_MS, WANDER_MAX_WAIT_MS);
    this.visualController.spawn(origin.x, origin.y);
  }

  private updateWander(nowMs: number, deltaMs: number): void {
    if (!this.record || !this.tilemap || deltaMs <= 0) return;

    if (this.record.wanderTarget === null) {
      if (nowMs < this.record.nextWanderMs) return;

      const target = this.pickWanderTarget();
      if (!target) {
        this.record.nextWanderMs = nowMs + WANDER_MIN_WAIT_MS;
        return;
      }
      this.record.wanderTarget = target;
      return;
    }

    const { tileX: targetTileX, tileY: targetTileY } = this.record.wanderTarget;
    const targetWorld = this.tilemap.getTileCenterWorld(targetTileX, targetTileY);

    const dx   = targetWorld.x - this.record.worldX;
    const dy   = targetWorld.y - this.record.worldY;
    const dist = Math.hypot(dx, dy);

    if (dist <= WANDER_ARRIVE_DIST) {
      this.record.worldX       = targetWorld.x;
      this.record.worldY       = targetWorld.y;
      this.record.tileX        = targetTileX;
      this.record.tileY        = targetTileY;
      this.record.wanderTarget = null;
      this.record.nextWanderMs = nowMs + randomBetween(WANDER_MIN_WAIT_MS, WANDER_MAX_WAIT_MS);
      return;
    }

    const step = Math.min(dist, WANDER_SPEED_PER_MS * deltaMs);
    this.record.worldX += (dx / dist) * step;
    this.record.worldY += (dy / dist) * step;

    // Keep tile in sync for aggro range checks
    const tileCoord = this.tilemap.transform.worldToTile(this.record.worldX, this.record.worldY);
    this.record.tileX = Math.round(tileCoord.x);
    this.record.tileY = Math.round(tileCoord.y);
  }

  private pickWanderTarget(): { tileX: number; tileY: number } | null {
    if (!this.record || !this.tilemap) return null;
    const { spawnTileX, spawnTileY } = this.record;

    for (let i = 0; i < WANDER_PICK_ATTEMPTS; i++) {
      const dx = Math.round((Math.random() * 2 - 1) * WANDER_RADIUS_TILES);
      const dy = Math.round((Math.random() * 2 - 1) * WANDER_RADIUS_TILES);
      if (dx === 0 && dy === 0) continue;
      const tx = spawnTileX + dx;
      const ty = spawnTileY + dy;

      if (
        this.tilemap.isTileInBounds(tx, ty) &&
        !this.tilemap.isTileTerrainBlocked(tx, ty)
      ) {
        return { tileX: tx, tileY: ty };
      }
    }
    return null;
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
