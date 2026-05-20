import Phaser from 'phaser';
import { getDynamicDepth } from '../render/RenderLayers';
import { EnemyRegistry } from './EnemyRegistry';
import {
  ENEMY_WOLF_ATTACK_ANIMATION_KEY,
  ENEMY_WOLF_DEATH_ANIMATION_KEY,
  ENEMY_WOLF_IDLE_ANIMATION_KEY,
  ENEMY_WOLF_RUN_ANIMATION_KEY,
  ENEMY_WOLF_WINDUP_ANIMATION_KEY,
  ENEMY_WOLF_IDLE_SHEET_KEY,
} from './EnemyAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
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
  private static readonly HIT_FLASH_MS = 120;

  private readonly enemyRegistry = new EnemyRegistry(ENEMY_DEFINITIONS);
  private runtimeState: EnemyRuntimeState | null = null;
  private definition: EnemyDefinition | null = null;
  private shadow: Phaser.GameObjects.Ellipse | null = null;
  private visual: Phaser.GameObjects.Sprite | null = null;
  private healthBarGraphics: Phaser.GameObjects.Graphics | null = null;
  private readonly attackTileGraphics: Phaser.GameObjects.Graphics;
  private currentAnimationKey: string | null = null;
  private activeMapId: string | null = null;
  private tilemap: IsoTilemap | null = null;
  private hitFlashUntilMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly telegraphSystem: TelegraphSystem,
  ) {
    this.attackTileGraphics = scene.add.graphics();
    this.attackTileGraphics.setVisible(false);
  }

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
    this.visual = this.scene.add.sprite(origin.x, origin.y - 8, ENEMY_WOLF_IDLE_SHEET_KEY, 0);
    this.healthBarGraphics = this.scene.add.graphics();
    this.visual.setOrigin(0.5, 0.4 );
    this.visual.setScale(2);
    this.visual.play(ENEMY_WOLF_IDLE_ANIMATION_KEY);
    this.currentAnimationKey = ENEMY_WOLF_IDLE_ANIMATION_KEY;
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
      this.hitFlashUntilMs = nowMs + EnemySystem.HIT_FLASH_MS;
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
    if (!this.tilemap) {
      return false;
    }

    const occupiedTile = this.getOccupiedTile();

    if (!occupiedTile) {
      return false;
    }

    const samplePoints = [
      { x: worldX, y: worldY },
      { x: worldX - PLAYER_CONFIG.groundFootprintRadiusX, y: worldY },
      { x: worldX + PLAYER_CONFIG.groundFootprintRadiusX, y: worldY },
      { x: worldX, y: worldY - PLAYER_CONFIG.groundFootprintRadiusY },
      { x: worldX, y: worldY + PLAYER_CONFIG.groundFootprintRadiusY },
    ];

    return samplePoints.some((point) => {
      const feetTile = this.tilemap!.transform.worldToTile(point.x, point.y);
      return feetTile.x === occupiedTile.x && feetTile.y === occupiedTile.y;
    });
  }

  getOccupiedTile(): { x: number; y: number } | null {
    if (!this.runtimeState || !this.tilemap || this.runtimeState.currentState === 'dead') {
      return null;
    }

    const tile = this.tilemap.transform.worldToTile(this.runtimeState.worldX, this.runtimeState.worldY);
    return { x: tile.x, y: tile.y };
  }

  getOccupiedTiles(): Array<{ x: number; y: number }> {
    const tile = this.getOccupiedTile();
    return tile ? [tile] : [];
  }

  getOccupiedTileSamples(): Array<{ x: number; y: number }> {
    if (!this.tilemap) {
      return [];
    }

    const occupiedTile = this.getOccupiedTile();

    if (!occupiedTile) {
      return [];
    }

    const center = this.tilemap.getTileCenterWorld(occupiedTile.x, occupiedTile.y);
    const corners = this.tilemap.transform.getTileDiamondPoints(occupiedTile.x, occupiedTile.y);
    const edgeMidpoints = corners.map((corner, index) => {
      const next = corners[(index + 1) % corners.length];
      return {
        x: (corner.x + next.x) / 2,
        y: (corner.y + next.y) / 2,
      };
    });

    return [
      { x: center.x, y: center.y },
      ...corners.map((point) => ({ x: point.x, y: point.y })),
      ...edgeMidpoints,
    ];
  }

  getActiveMapId(): string | null {
    return this.activeMapId;
  }

  forceReset(): void {
    this.resetRuntimeState();
  }

  destroy(): void {
    this.clearRuntime();
    this.attackTileGraphics.destroy();
    this.activeMapId = null;
    this.tilemap = null;
  }

  private applyVisualState(state: EnemyRuntimeState, nowMs: number, isActuallyMoving: boolean): void {
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
        // Crouch and tense during windup
        lift = 8 * easeOut(phaseProgress);
        scaleX = 1.0 + 0.06 * phaseProgress;
        scaleY = 1.0 - 0.08 * phaseProgress;
      } else if (state.currentState === 'active') {
        // Parabolic arc: peaks at midpoint, returns to ground at landing
        const arc = 4 * phaseProgress * (1 - phaseProgress);
        lift = 44 * arc;
        scaleX = 1.08;
        scaleY = 0.94;
      } else if (state.currentState === 'recovery') {
        // Landing squash at start of recovery, normalises quickly
        const squash = Math.max(0, 1 - phaseProgress * 5);
        scaleX = 1.0 + 0.28 * squash;
        scaleY = 1.0 - 0.22 * squash;
      }
    }

    this.shadow?.setPosition(state.worldX, state.worldY - 4);
    this.shadow?.setScale(Math.max(0.7, 1 - lift / 50), Math.max(0.6, 1 - lift / 58));
    this.shadow?.setDepth(getDynamicDepth(state.worldY, 4));

    this.visual.setPosition(state.worldX, state.worldY - 8 - lift);
    this.visual.setScale(scaleX, scaleY);
    this.visual.setFlipX(Math.cos(state.facingRad) > 0);
    this.visual.clearTint();
    this.visual.setDepth(getDynamicDepth(state.worldY, 8));

    const animationKey = resolveEnemyAnimationKey(state.currentState, isActuallyMoving, activeAttack?.kind ?? null);

    if (animationKey !== this.currentAnimationKey) {
      this.visual.play(animationKey);
      this.currentAnimationKey = animationKey;
    }

    switch (state.currentState) {
      case 'windup':
        this.visual.setTint(0xf59e0b);
        this.visual.setScale(scaleX * 1.08, scaleY * 1.08);
        break;
      case 'active':
        this.visual.setTint(activeAttack?.kind === 'jump' ? 0xffffff : 0xdc2626);
        this.visual.setScale(scaleX * 1.12, scaleY * 1.12);
        break;
      case 'recovery':
        this.visual.setTint(0xfb7185);
        this.visual.setScale(scaleX * 0.96, scaleY * 0.96);
        break;
      case 'dead':
        this.visual.setTint(0x6b7280);
        this.visual.setScale(0.9);
        break;
      default:
        break;
    }

    if (this.hitFlashUntilMs > 0 && nowMs < this.hitFlashUntilMs) {
      const flashT = (this.hitFlashUntilMs - nowMs) / EnemySystem.HIT_FLASH_MS;
      this.visual.setTint(0xffffff);
      this.visual.setScale(this.visual.scaleX * (1 + 0.12 * flashT), this.visual.scaleY * (1 + 0.12 * flashT));
    }

    this.updateHealthBar(state, lift);
  }

  private updateHealthBar(state: EnemyRuntimeState, lift: number): void {
    if (!this.healthBarGraphics || !this.definition) {
      return;
    }

    if (state.currentState === 'dead') {
      this.healthBarGraphics.setVisible(false);
      return;
    }

    const maxHp = this.definition.maxHealth;
    const pct = maxHp > 0 ? Math.max(0, state.health / maxHp) : 0;
    const barW = 40;
    const barH = 4;
    const x = state.worldX - barW / 2;
    const y = state.worldY - 8 - lift - 60;

    this.healthBarGraphics.clear();

    // Missing health — dark red background
    this.healthBarGraphics.fillStyle(0x7f1d1d, 0.92);
    this.healthBarGraphics.fillRect(x, y, barW, barH);

    // Current health — green fill
    if (pct > 0) {
      const filledW = Math.round(barW * pct);
      this.healthBarGraphics.fillStyle(0x22c55e, 1);
      this.healthBarGraphics.fillRect(x, y, filledW, barH);
    }

    // Thin border
    this.healthBarGraphics.lineStyle(1, 0x000000, 0.55);
    this.healthBarGraphics.strokeRect(x, y, barW, barH);

    this.healthBarGraphics.setDepth(getDynamicDepth(state.worldY, 16));
    this.healthBarGraphics.setVisible(true);
  }

  private applyTelegraphEvents(events: EnemyUpdateEvent[], _nowMs: number): void {
    events.forEach((event) => {
      if (event.kind === 'telegraph_show') {
        if (event.tiles && event.tiles.length > 0) {
          this.renderAttackTiles(event.tiles, event.attackKind);
        }
      }

      if (event.kind === 'telegraph_remove') {
        this.clearAttackTiles();
      }
    });
  }

  private clearRuntime(): void {
    if (this.runtimeState?.telegraphId) {
      this.telegraphSystem.removeTelegraph(this.runtimeState.telegraphId);
    }
    this.clearAttackTiles();

    this.runtimeState = null;
    this.definition = null;
    this.shadow?.destroy();
    this.shadow = null;
    this.visual?.destroy();
    this.visual = null;
    this.healthBarGraphics?.destroy();
    this.healthBarGraphics = null;
    this.currentAnimationKey = null;
  }

  private resetRuntimeState(): void {
    if (!this.runtimeState || !this.definition) {
      return;
    }

    if (this.runtimeState.telegraphId) {
      this.telegraphSystem.removeTelegraph(this.runtimeState.telegraphId);
    }
    this.clearAttackTiles();

    this.runtimeState = resetEnemyRuntimeState(this.runtimeState, this.definition);
  }

  private renderAttackTiles(tiles: Array<{ x: number; y: number }>, shapeKind?: string): void {
    if (!this.tilemap || tiles.length === 0) {
      this.clearAttackTiles();
      return;
    }

    const color = resolveAttackColor(shapeKind ?? '');
    this.attackTileGraphics.clear();
    this.attackTileGraphics.fillStyle(color, 0.32);
    let maxDepthY = 0;

    tiles.forEach((tile) => {
      const points = this.tilemap!.transform.getTileDiamondPoints(tile.x, tile.y);
      maxDepthY = Math.max(maxDepthY, ...points.map((point) => point.y));
      this.attackTileGraphics.beginPath();
      this.attackTileGraphics.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => this.attackTileGraphics.lineTo(point.x, point.y));
      this.attackTileGraphics.closePath();
      this.attackTileGraphics.fillPath();
    });

    this.attackTileGraphics.setDepth(getDynamicDepth(maxDepthY, 324));
    this.attackTileGraphics.setVisible(true);
  }

  private clearAttackTiles(): void {
    this.attackTileGraphics.clear();
    this.attackTileGraphics.setVisible(false);
  }
}

function resolveAttackColor(attackKind: string): number {
  switch (attackKind) {
    case 'jump':
      return 0xf97316; // orange — leap
    case 'stab':
      return 0xfbbf24; // amber — swipe
    case 'cone':
      return 0xa855f7; // violet — roar
    default:
      return 0xf97316;
  }
}

function resolveEnemyAnimationKey(
  state: EnemyRuntimeState['currentState'],
  isActuallyMoving: boolean,
  activeAttackKind: string | null,
): string {
  switch (state) {
    case 'approach':
    case 'reset':
      return isActuallyMoving ? ENEMY_WOLF_RUN_ANIMATION_KEY : ENEMY_WOLF_IDLE_ANIMATION_KEY;
    case 'windup':
      return ENEMY_WOLF_WINDUP_ANIMATION_KEY;
    case 'active':
      return activeAttackKind === 'jump' ? ENEMY_WOLF_RUN_ANIMATION_KEY : ENEMY_WOLF_ATTACK_ANIMATION_KEY;
    case 'dead':
      return ENEMY_WOLF_DEATH_ANIMATION_KEY;
    case 'idle':
    case 'aggro':
    case 'recovery':
    case 'hurt':
    default:
      return ENEMY_WOLF_IDLE_ANIMATION_KEY;
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

