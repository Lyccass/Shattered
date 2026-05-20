import Phaser from 'phaser';
import { EnemyRegistry } from './EnemyRegistry';
import {
  applyEnemyDamage,
  resetEnemyRuntimeState,
  shouldRespawnEnemy,
} from './EnemyRuntimeStateUtils';
import {
  advanceEnemyStateMachine,
  createEnemyRuntimeState,
  type EnemyUpdateEvent,
} from './EnemyStateMachine';
import type { EnemyDefinition, EnemyRuntimeState, EnemySpawnDefinition, EnemyUiSnapshot } from './EnemyTypes';
import { ENEMY_DEFINITIONS } from './EnemyDefinitions';
import type { TelegraphSystem } from './TelegraphSystem';
import type { IsoTilemap } from '../world/IsoTilemap';
import { EnemyAttackTileRenderer } from './EnemyAttackTileRenderer';
import {
  blocksEnemyFeetAt,
  getEnemyOccupiedTile,
  getEnemyOccupiedTiles,
  getEnemyOccupiedTileSamples,
} from './EnemyOccupancy';
import { EnemyVisualController } from './EnemyVisualController';

export class EnemySystem {
  private static readonly DEATH_RESET_DELAY_MS = 1_800;

  private readonly enemyRegistry = new EnemyRegistry(ENEMY_DEFINITIONS);
  private readonly attackTileRenderer: EnemyAttackTileRenderer;
  private readonly visualController: EnemyVisualController;
  private runtimeState: EnemyRuntimeState | null = null;
  private definition: EnemyDefinition | null = null;
  private activeMapId: string | null = null;
  private tilemap: IsoTilemap | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly telegraphSystem: TelegraphSystem,
  ) {
    this.attackTileRenderer = new EnemyAttackTileRenderer(scene);
    this.visualController = new EnemyVisualController(scene);
  }

  setMapContext(mapId: string, tilemap: IsoTilemap, spawn: EnemySpawnDefinition | null): void {
    this.clearRuntime();
    this.activeMapId = mapId;
    this.tilemap = tilemap;
    this.attackTileRenderer.setTilemap(tilemap);

    if (!spawn) {
      return;
    }

    this.definition = this.enemyRegistry.get(spawn.definitionId);
    const origin = tilemap.getTileCenterWorld(spawn.tileX, spawn.tileY);
    this.runtimeState = createEnemyRuntimeState(this.definition, spawn, origin.x, origin.y);
    this.visualController.spawn(this.runtimeState);
  }

  update(
    nowMs: number,
    deltaMs: number,
    playerWorldX: number,
    playerWorldY: number,
    playerInvulnerable: boolean,
    playerOccupiedTiles: Array<{ x: number; y: number }>,
  ): EnemyUpdateEvent[] {
    if (!this.runtimeState || !this.definition || !this.tilemap) {
      return [];
    }

    if (shouldRespawnEnemy(this.runtimeState, nowMs)) {
      this.resetRuntimeState();
      this.applyVisualState(this.runtimeState, nowMs, false);
      return [];
    }

    const prevX = this.runtimeState.worldX;
    const prevY = this.runtimeState.worldY;

    const result = advanceEnemyStateMachine(this.definition, this.runtimeState, {
      nowMs,
      deltaMs,
      playerWorldX,
      playerWorldY,
      playerInvulnerable,
      playerOccupiedTiles,
      tileWidth: this.tilemap.tileWidth,
      tileHeight: this.tilemap.tileHeight,
      mapWidth: this.tilemap.width,
      mapHeight: this.tilemap.height,
      worldToTile: (worldX, worldY) => this.tilemap!.transform.worldToTile(worldX, worldY),
      getTileCenterWorld: (tileX, tileY) => this.tilemap!.getTileCenterWorld(tileX, tileY),
      getTileDiamondPoints: (tileX, tileY) => this.tilemap!.transform.getTileDiamondPoints(tileX, tileY),
      isTileWalkable: (tileX, tileY) => this.tilemap!.isTileWalkable(tileX, tileY),
    });

    const isActuallyMoving = Math.hypot(result.state.worldX - prevX, result.state.worldY - prevY) > 0.5;
    this.runtimeState = result.state;
    this.applyVisualState(result.state, nowMs, isActuallyMoving);
    this.applyTelegraphEvents(result.events, nowMs);
    return result.events;
  }

  applyDamage(amount: number, nowMs: number): { hit: boolean; killed: boolean; currentHp: number } {
    if (!this.runtimeState || !this.definition || this.runtimeState.currentState === 'dead') {
      return { hit: false, killed: false, currentHp: this.runtimeState?.health ?? 0 };
    }

    const telegraphId = this.runtimeState.telegraphId;
    const result = applyEnemyDamage(
      this.runtimeState,
      amount,
      nowMs,
      EnemySystem.DEATH_RESET_DELAY_MS,
    );
    this.runtimeState = result.state;

    if (result.hit && !result.killed) {
      this.visualController.flashHit(nowMs);
    }

    if (!result.killed) {
      return result;
    }

    if (telegraphId) {
      this.telegraphSystem.removeTelegraph(telegraphId);
    }
    this.applyVisualState(this.runtimeState, nowMs, false);
    return result;
  }

  isInPunishWindow(): boolean {
    return this.runtimeState?.currentState === 'recovery';
  }

  getWorldPosition(): { x: number; y: number } | null {
    if (!this.runtimeState) {
      return null;
    }

    return { x: this.runtimeState.worldX, y: this.runtimeState.worldY };
  }

  isCombatActive(playerWorldX: number, playerWorldY: number): boolean {
    if (!this.runtimeState || !this.definition) {
      return false;
    }

    const distance = Math.hypot(this.runtimeState.worldX - playerWorldX, this.runtimeState.worldY - playerWorldY);
    return distance <= this.definition.aggroRangeTiles * (this.tilemap?.tileWidth ?? 32)
      || this.runtimeState.currentState !== 'idle';
  }

  getUiSnapshot(): EnemyUiSnapshot | null {
    if (!this.runtimeState || !this.definition) {
      return null;
    }

    const runtimeState = this.runtimeState;
    const definition = this.definition;

    const activeAttack = runtimeState.currentAttackId
      ? definition.attacks.find((attack) => attack.id === runtimeState.currentAttackId) ?? null
      : null;

    return {
      name: definition.displayName,
      state: runtimeState.currentState,
      health: runtimeState.health,
      maxHealth: definition.maxHealth,
      activeAttackName: activeAttack?.displayName ?? null,
    };
  }

  blocksFeetAt(worldX: number, worldY: number): boolean {
    return blocksEnemyFeetAt({
      tilemap: this.tilemap,
      occupiedTile: this.getOccupiedTile(),
      worldX,
      worldY,
    });
  }

  getOccupiedTile(): { x: number; y: number } | null {
    return getEnemyOccupiedTile(this.runtimeState, this.tilemap);
  }

  getOccupiedTiles(): Array<{ x: number; y: number }> {
    return getEnemyOccupiedTiles(this.runtimeState, this.tilemap);
  }

  getOccupiedTileSamples(): Array<{ x: number; y: number }> {
    return getEnemyOccupiedTileSamples({
      tilemap: this.tilemap,
      occupiedTile: this.getOccupiedTile(),
    });
  }

  getActiveMapId(): string | null {
    return this.activeMapId;
  }

  forceReset(): void {
    this.resetRuntimeState();
  }

  destroy(): void {
    this.clearRuntime();
    this.attackTileRenderer.destroy();
    this.activeMapId = null;
    this.tilemap = null;
  }

  private applyVisualState(state: EnemyRuntimeState, nowMs: number, isActuallyMoving: boolean): void {
    if (!this.definition) {
      return;
    }

    this.visualController.applyState(state, this.definition, nowMs, isActuallyMoving);
  }

  private applyTelegraphEvents(events: EnemyUpdateEvent[], _nowMs: number): void {
    events.forEach((event) => {
      if (event.kind === 'telegraph_show') {
        if (event.tiles && event.tiles.length > 0) {
          this.attackTileRenderer.render(event.tiles, event.attackKind);
        }
      }

      if (event.kind === 'telegraph_remove') {
        this.attackTileRenderer.clear();
      }
    });
  }

  private clearRuntime(): void {
    if (this.runtimeState?.telegraphId) {
      this.telegraphSystem.removeTelegraph(this.runtimeState.telegraphId);
    }
    this.attackTileRenderer.clear();

    this.runtimeState = null;
    this.definition = null;
    this.visualController.destroy();
  }

  private resetRuntimeState(): void {
    if (!this.runtimeState || !this.definition) {
      return;
    }

    if (this.runtimeState.telegraphId) {
      this.telegraphSystem.removeTelegraph(this.runtimeState.telegraphId);
    }
    this.attackTileRenderer.clear();

    this.runtimeState = resetEnemyRuntimeState(this.runtimeState, this.definition);
  }
}
