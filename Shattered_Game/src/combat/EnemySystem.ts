import Phaser from 'phaser';
import { computeEnemyBlockingRadius, computeEnemyHitRadius } from './EnemyMetrics';
import { getDynamicDepth } from '../render/RenderLayers';
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

export class EnemySystem {
  private static readonly DEATH_RESET_DELAY_MS = 1_800;

  private readonly enemyRegistry = new EnemyRegistry(ENEMY_DEFINITIONS);
  private runtimeState: EnemyRuntimeState | null = null;
  private definition: EnemyDefinition | null = null;
  private shadow: Phaser.GameObjects.Ellipse | null = null;
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
    this.shadow = this.scene.add.ellipse(origin.x, origin.y - 4, 28, 12, 0x020617, 0.2);
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

    if (shouldRespawnEnemy(this.runtimeState, nowMs)) {
      this.resetRuntimeState();
      this.applyVisualState(this.runtimeState, nowMs);
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
    this.applyVisualState(result.state, nowMs);
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

    if (!result.killed) {
      return result;
    }

    if (telegraphId) {
      this.telegraphSystem.removeTelegraph(telegraphId);
    }
    this.applyVisualState(this.runtimeState, nowMs);
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

  getHitCircle(): { worldX: number; worldY: number; radius: number } | null {
    if (!this.runtimeState || !this.definition || !this.tilemap) {
      return null;
    }

    if (this.runtimeState.currentState === 'dead') {
      return null;
    }

    return {
      worldX: this.runtimeState.worldX,
      worldY: this.runtimeState.worldY,
      radius: computeEnemyHitRadius(
        this.definition.collisionRadiusTiles,
        this.tilemap.tileWidth,
        this.tilemap.tileHeight,
      ),
    };
  }

  getActiveMapId(): string | null {
    return this.activeMapId;
  }

  forceReset(): void {
    this.resetRuntimeState();
  }

  destroy(): void {
    this.clearRuntime();
    this.activeMapId = null;
    this.tilemap = null;
  }

  private applyVisualState(state: EnemyRuntimeState, nowMs: number): void {
    if (!this.visual) {
      return;
    }

    const definition = this.definition;
    const activeAttack = definition && state.currentAttackId
      ? definition.attacks.find((attack) => attack.id === state.currentAttackId) ?? null
      : null;
    const phaseProgress = getPhaseProgress(state, nowMs);
    let lift = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (activeAttack?.kind === 'jump') {
      if (state.currentState === 'windup') {
        lift = 22 * easeOut(phaseProgress);
        scaleX = 1.02 + 0.08 * phaseProgress;
        scaleY = 1 - 0.12 * phaseProgress;
      } else if (state.currentState === 'active') {
        lift = 24 * (1 - phaseProgress);
        scaleX = 1.1 - 0.06 * phaseProgress;
        scaleY = 0.9 + 0.08 * phaseProgress;
      }
    }

    this.shadow?.setPosition(state.worldX, state.worldY - 4);
    this.shadow?.setScale(Math.max(0.7, 1 - lift / 40), Math.max(0.6, 1 - lift / 46));
    this.shadow?.setDepth(getDynamicDepth(state.worldY, 4));

    this.visual.setPosition(state.worldX, state.worldY - 18 - lift);
    this.visual.setScale(scaleX, scaleY);
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
      case 'dead':
        this.visual.setFillStyle(0x6b7280, 0.82);
        this.visual.setScale(0.9);
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
    this.shadow?.destroy();
    this.shadow = null;
    this.visual?.destroy();
    this.visual = null;
  }

  private resetRuntimeState(): void {
    if (!this.runtimeState || !this.definition) {
      return;
    }

    if (this.runtimeState.telegraphId) {
      this.telegraphSystem.removeTelegraph(this.runtimeState.telegraphId);
    }

    this.runtimeState = resetEnemyRuntimeState(this.runtimeState, this.definition);
  }
}

function getPhaseProgress(state: EnemyRuntimeState, nowMs: number): number {
  if (state.phaseStartedAtMs === null || state.phaseEndsAtMs === null) {
    return 0;
  }

  const duration = Math.max(1, state.phaseEndsAtMs - state.phaseStartedAtMs);
  return Phaser.Math.Clamp((nowMs - state.phaseStartedAtMs) / duration, 0, 1);
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
