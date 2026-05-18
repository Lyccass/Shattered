import Phaser from 'phaser';
import { computeEnemyBlockingRadius } from './EnemyMetrics';
import { getDynamicDepth } from '../render/RenderLayers';
import { EnemyRegistry } from './EnemyRegistry';
import {
  advanceEnemyStateMachine,
  createEnemyRuntimeState,
  type EnemyUpdateEvent,
} from './EnemyStateMachine';
import type { EnemyDefinition, EnemyRuntimeState, EnemySpawnDefinition, EnemyUiSnapshot } from './EnemyTypes';
import { ENEMY_DEFINITIONS } from './EnemyDefinitions';
import type { TelegraphSystem } from './TelegraphSystem';
import type { IsoTilemap } from '../world/IsoTilemap';

export class EnemySystem {
  private readonly enemyRegistry = new EnemyRegistry(ENEMY_DEFINITIONS);
  private runtimeState: EnemyRuntimeState | null = null;
  private definition: EnemyDefinition | null = null;
  private visual: Phaser.GameObjects.Ellipse | null = null;
  private activeMapId: string | null = null;
  private tilemap: IsoTilemap | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly telegraphSystem: TelegraphSystem,
  ) {}

  setMapContext(mapId: string, tilemap: IsoTilemap, spawn: EnemySpawnDefinition | null): void {
    this.clearRuntime();
    this.activeMapId = mapId;
    this.tilemap = tilemap;

    if (!spawn) {
      return;
    }

    this.definition = this.enemyRegistry.get(spawn.definitionId);
    const origin = tilemap.getTileCenterWorld(spawn.tileX, spawn.tileY);
    this.runtimeState = createEnemyRuntimeState(this.definition, spawn, origin.x, origin.y);
    this.visual = this.scene.add.ellipse(origin.x, origin.y - 18, 28, 36, 0x7f1d1d, 0.95);
    this.visual.setStrokeStyle(2, 0x111827, 0.85);
  }

  update(
    nowMs: number,
    deltaMs: number,
    playerWorldX: number,
    playerWorldY: number,
    playerInvulnerable: boolean,
  ): EnemyUpdateEvent[] {
    if (!this.runtimeState || !this.definition || !this.tilemap) {
      return [];
    }

    const result = advanceEnemyStateMachine(this.definition, this.runtimeState, {
      nowMs,
      deltaMs,
      playerWorldX,
      playerWorldY,
      playerInvulnerable,
      tileWidth: this.tilemap.tileWidth,
      tileHeight: this.tilemap.tileHeight,
    });

    this.runtimeState = result.state;
    this.applyVisualState(result.state);
    this.applyTelegraphEvents(result.events, nowMs);
    return result.events;
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
    const body = this.getBlockingCircle();

    if (!body) {
      return false;
    }

    return Math.hypot(worldX - body.worldX, worldY - body.worldY) < body.radius;
  }

  getBlockingCircle(): { worldX: number; worldY: number; radius: number } | null {
    if (!this.runtimeState || !this.definition || !this.tilemap) {
      return null;
    }

    if (this.runtimeState.currentState === 'dead') {
      return null;
    }

    const blockingRadius = computeEnemyBlockingRadius(
      this.definition.collisionRadiusTiles,
      this.tilemap.tileWidth,
      this.tilemap.tileHeight,
    );
    return {
      worldX: this.runtimeState.worldX,
      worldY: this.runtimeState.worldY,
      radius: blockingRadius,
    };
  }

  getActiveMapId(): string | null {
    return this.activeMapId;
  }

  destroy(): void {
    this.clearRuntime();
    this.activeMapId = null;
    this.tilemap = null;
  }

  private applyVisualState(state: EnemyRuntimeState): void {
    if (!this.visual) {
      return;
    }

    this.visual.setPosition(state.worldX, state.worldY - 18);
    this.visual.setScale(1);
    this.visual.setFillStyle(0x7f1d1d, 0.95);
    this.visual.setDepth(getDynamicDepth(state.worldY, 8));

    switch (state.currentState) {
      case 'windup':
        this.visual.setFillStyle(0xf59e0b, 0.95);
        this.visual.setScale(1.08);
        break;
      case 'active':
        this.visual.setFillStyle(0xdc2626, 0.95);
        this.visual.setScale(1.12);
        break;
      case 'recovery':
        this.visual.setFillStyle(0xfb7185, 0.95);
        this.visual.setScale(0.96);
        break;
      default:
        break;
    }
  }

  private applyTelegraphEvents(events: EnemyUpdateEvent[], nowMs: number): void {
    events.forEach((event) => {
      if (event.kind === 'telegraph_show') {
        this.telegraphSystem.showTelegraph({
          id: event.telegraphId,
          worldX: event.worldX,
          worldY: event.worldY,
          shape: event.shape,
          durationMs: event.durationMs,
          startedAtMs: nowMs,
          warningColor: 0xef4444,
          fadeOutMs: event.durationMs,
        });
      }

      if (event.kind === 'telegraph_remove') {
        this.telegraphSystem.removeTelegraph(event.telegraphId);
      }
    });
  }

  private clearRuntime(): void {
    if (this.runtimeState?.telegraphId) {
      this.telegraphSystem.removeTelegraph(this.runtimeState.telegraphId);
    }

    this.runtimeState = null;
    this.definition = null;
    this.visual?.destroy();
    this.visual = null;
  }
}
