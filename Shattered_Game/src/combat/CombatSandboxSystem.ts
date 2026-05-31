import Phaser from 'phaser';
import { resolveClickMovementDodgeDirection } from './CombatDodge';
import {
  isAttackerInsideGuardFront,
  resolvePlayerAttackAimRad,
} from './CombatPlayerMath';
import { CombatDebugHitboxRenderer } from './CombatDebugHitboxRenderer';
import type { PlayerAttackPhase } from './PlayerCombatState';
import { DODGE_DURATION_MS } from './PlayerCombatState';
import { PlayerAttackFeedbackRenderer } from './PlayerAttackFeedbackRenderer';
import { HitsplatRenderer } from './HitsplatRenderer';
import { resolveAttackTarget, playerAttackHitsEnemy } from './PlayerAttackTargeting';
import type { PlayerAttackWorldShape } from './PlayerAttackTargeting';
import type { PlayerDerivedStats, WeaponAttackShape } from '../equipment/EquipmentTypes';
import { resolveTileDodgeMotion } from './PlayerDodgeTargeting';
import type { SfxEventId } from '../audio/SfxTypes';
import type { LevelUpEvent, SkillXpDelta } from '../skills/SkillTypes';
import type { UiHandledResult } from '../ui/UiTypes';
import { COMBAT_SANDBOX_SPAWNS } from './CombatSandboxDefinitions';
import type { CombatUiSnapshot } from './CombatUiTypes';
import { EnemySystem } from './EnemySystem';
import type { EnemyUpdateEvent } from './EnemyStateMachine';
import type { EnemySpawnDefinition } from './EnemyTypes';
import { PlayerCombatState } from './PlayerCombatState';
import type { PlayerController } from '../player/PlayerController';
import type { IsoTilemap } from '../world/IsoTilemap';
import type { TelegraphSystem } from './TelegraphSystem';
import type { GameEventBus } from '../events/GameEventBus';

export type EnemyKilledEvent = {
  spawnId: string;
  areaId?: string;
  lootTableId?: string;
  enemyDefinitionId: string;
  worldX: number;
  worldY: number;
};

export class CombatSandboxSystem {
  private static readonly SPRINT_SPEED_MULTIPLIER = 2;
  private currentAttackDamage = 1;
  private currentAttackRecoveryMs = 640;
  private currentAttackShape: WeaponAttackShape = { kind: 'arc', angleDeg: 180, rangeTiles: 1.5 };

  private readonly playerCombatState = new PlayerCombatState();
  private readonly scene: Phaser.Scene;
  private readonly telegraphSystem: TelegraphSystem;
  private enemySystems: EnemySystem[] = [];
  private readonly debugHitboxRenderer: CombatDebugHitboxRenderer;
  private readonly playerAttackFeedbackRenderer: PlayerAttackFeedbackRenderer;
  private readonly hitsplatRenderer: HitsplatRenderer;
  private currentTilemap: IsoTilemap | null = null;
  private lastPlayerAttackPhase: PlayerAttackPhase = 'idle';
  private playerAttackTargetWorld: { x: number; y: number } | null = null;
  private playerAttackShape: PlayerAttackWorldShape | null = null;
  private playerAttackHitResolved = false;
  private static readonly HIT_STOP_MS = 70;
  private static readonly POST_HIT_RECOVERY_MS = 320;
  private currentLightAttackReachTiles = 1;
  private currentWindupMs = 160;
  private currentActiveMs = 200;

  private currentPlayerTier = 1;
  private currentDodgeTileCount = 2;
  private hitStopUntilMs = 0;
  private pendingScreenShake = false;
  private onEnemyKilled?: (event: EnemyKilledEvent) => void;
  private onPlayerDied?: (worldX: number, worldY: number) => void;
  private onCombatXp?: (delta: SkillXpDelta) => LevelUpEvent[];
  private readonly areaIdBySpawnId = new Map<string, string>();
  private readonly lootTableIdBySpawnId = new Map<string, string>();
  private getThreatLevel: () => number = () => 0;

  constructor(
    scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
    telegraphSystem: TelegraphSystem,
    onEnemyKilled?: (event: EnemyKilledEvent) => void,
    onPlayerDied?: (worldX: number, worldY: number) => void,
    onCombatXp?: (delta: SkillXpDelta) => LevelUpEvent[],
  ) {
    this.scene = scene;
    this.telegraphSystem = telegraphSystem;
    this.debugHitboxRenderer = new CombatDebugHitboxRenderer(scene);
    this.playerAttackFeedbackRenderer = new PlayerAttackFeedbackRenderer(scene, telegraphSystem);
    this.hitsplatRenderer = new HitsplatRenderer(scene);
    this.onEnemyKilled = onEnemyKilled;
    this.onPlayerDied = onPlayerDied;
    this.onCombatXp = onCombatXp;
  }

  setThreatLevelSource(fn: () => number): void {
    this.getThreatLevel = fn;
  }

  setMapContext(mapId: string, tilemap: IsoTilemap, extraSpawns: EnemySpawnDefinition[] = []): void {
    this.currentTilemap = tilemap;

    for (const es of this.enemySystems) {
      es.destroy();
    }
    this.enemySystems = [];
    this.areaIdBySpawnId.clear();
    this.lootTableIdBySpawnId.clear();

    const spawns = [
      ...COMBAT_SANDBOX_SPAWNS.filter((s) => s.mapId === mapId),
      ...extraSpawns,
    ];
    for (const spawn of spawns) {
      const es = new EnemySystem(this.scene, this.telegraphSystem);
      es.setMapContext(mapId, tilemap, spawn);
      this.enemySystems.push(es);
      if (spawn.areaId) this.areaIdBySpawnId.set(spawn.id, spawn.areaId);
      if (spawn.lootTableId) this.lootTableIdBySpawnId.set(spawn.id, spawn.lootTableId);
    }

    this.playerCombatState.leaveCombat();
    this.playerCombatState.setGuardHeld(false);
    this.lastPlayerAttackPhase = 'idle';

    this.playerAttackTargetWorld = null;
    this.playerAttackShape = null;
    this.playerAttackHitResolved = false;
    this.playerAttackFeedbackRenderer.clear();
  }

  update(nowMs: number, deltaMs: number, playerController: PlayerController): UiHandledResult[] {
    const inHitStop = nowMs < this.hitStopUntilMs;

    this.playerCombatState.update(nowMs, deltaMs, playerController.isMoving());
    this.syncPlayerAttackVisuals(nowMs, playerController);

    if (!this.currentTilemap) {
      this.playerCombatState.leaveCombat();
      this.playerCombatState.setGuardHeld(false);
      playerController.setMovementSpeedMultiplier(1);
  
      this.playerAttackHitResolved = false;
      this.playerAttackFeedbackRenderer.clear();
      return [];
    }

    const feetPoint = playerController.getFeetPoint();
    const playerOccupiedTiles = playerController.getFootprintTiles();
    const combatActive = this.enemySystems.some((es) => es.isCombatActive(feetPoint.x, feetPoint.y));

    if (combatActive) {
      this.playerCombatState.enterCombat();
    } else {
      this.playerCombatState.leaveCombat();
      this.playerCombatState.setGuardHeld(false);
    }

    playerController.setMovementSpeedMultiplier(
      this.playerCombatState.getSnapshot(nowMs).isSprinting
        ? CombatSandboxSystem.SPRINT_SPEED_MULTIPLIER
        : 1,
    );

    const engagedEnemyId = this.getEngagedEnemyId();
    const threatLevel = this.getThreatLevel();

    const events: EnemyUpdateEvent[] = [];
    if (!inHitStop) {
      for (const es of this.enemySystems) {
        const esEvents = es.update(
          nowMs,
          deltaMs,
          feetPoint.x,
          feetPoint.y,
          this.playerCombatState.isInvulnerable(nowMs),
          playerOccupiedTiles,
          engagedEnemyId,
          this.currentPlayerTier,
          threatLevel,
        );
        events.push(...esEvents);
      }
    }
    this.resolvePlayerEnemyOverlap(playerController);
    this.syncDebugHitboxes(nowMs, playerController);

    const results: UiHandledResult[] = [];
    this.resolveEnemyAttackEvents(nowMs, playerController, events, results);
    this.resolvePlayerLightAttackActivation();
    this.resolvePlayerLightAttackHit(nowMs, results);

    if (this.playerCombatState.consumeRecoveredFromDowned()) {
      for (const es of this.enemySystems) {
        es.forceReset();
      }
      const feet = playerController.getFeetPoint();
      this.onPlayerDied?.(feet.x, feet.y);
    }

    return results;
  }

  tryDodge(
    nowMs: number,
    playerController: PlayerController,
    targetWorldX: number | null,
    targetWorldY: number | null,
  ): UiHandledResult | null {
    if (!this.currentTilemap) {
      return null;
    }

    if (playerController.isDodging()) {
      return null;
    }

    const playerFeet = playerController.getFeetPoint();
    const enemyPosition = this.getClosestEnemyPosition(playerFeet.x, playerFeet.y);
    // Use raw mouse direction when available — gives smooth free-angle dodge toward pointer.
    // Fall back to 8-directional resolution from movement/facing when no pointer.
    const pointerDelta =
      targetWorldX !== null
      && targetWorldY !== null
      && Math.hypot(targetWorldX - playerFeet.x, targetWorldY - playerFeet.y) > 0.001
        ? {
            x: targetWorldX - playerFeet.x,
            y: targetWorldY - playerFeet.y,
          }
        : null;
    const direction = pointerDelta ?? resolveClickMovementDodgeDirection({
      currentMoveDirection: playerController.getCurrentMoveDirection(),
      awayFromEnemyDirection: enemyPosition
        ? {
            x: playerFeet.x - enemyPosition.x,
            y: playerFeet.y - enemyPosition.y,
          }
        : null,
      lastMovementDirection: playerController.getLastMovementDirection(),
      facing: playerController.getFacingDirection(),
    });
    const isSprinting = this.playerCombatState.getSnapshot(nowMs).isSprinting;
    this.currentDodgeTileCount = isSprinting ? 2 : 1;

    const dodgeMotion = resolveTileDodgeMotion({
      tilemap: this.currentTilemap,
      playerController,
      direction,
      requestedTileCount: this.currentDodgeTileCount,
    });

    if (!dodgeMotion) {
      return null;
    }

    const dodgeResult = this.playerCombatState.tryStartDodge(nowMs);

    if (!dodgeResult.ok) {
      this.emitSfx('invalid_action');
      return {
        ok: false,
        message: dodgeResult.reason,
        toastKind: 'error',
      };
    }

    // Immediately clear any in-flight attack telegraphs so the cancel is visually instant
    this.lastPlayerAttackPhase = 'idle';

    this.playerAttackTargetWorld = null;
    this.playerAttackShape = null;
    this.playerAttackHitResolved = false;
    this.playerAttackFeedbackRenderer.clear();

    playerController.startDodgeMotion(dodgeMotion.direction, dodgeMotion.distance, DODGE_DURATION_MS);
    playerController.requestCombatVisualState(
      'dodge',
      nowMs,
      DODGE_DURATION_MS,
    );
    this.emitSfx('dodge');
    return null;
  }

  tryPlayerLightAttack(
    nowMs: number,
    playerController: PlayerController,
    targetWorldX: number | null,
    targetWorldY: number | null,
  ): UiHandledResult | null {
    if (!this.currentTilemap) {
      return null;
    }

    const playerFeet = playerController.getFeetPoint();
    const attackAimRad = resolvePlayerAttackAimRad(
      playerFeet.x,
      playerFeet.y,
      playerController.getFacingDirection(),
      targetWorldX,
      targetWorldY,
    );
    const result = this.playerCombatState.tryStartLightAttack(nowMs);

    if (!result.ok) {
      this.emitSfx('invalid_action');
      return {
        ok: false,
        message: result.reason,
        toastKind: 'error',
      };
    }

    playerController.clearClickMoveTarget();
    const attackResult = resolveAttackTarget({
      tilemap: this.currentTilemap,
      playerFeet,
      aimRad: attackAimRad,
      attackShape: this.currentAttackShape,
    });
    this.playerAttackTargetWorld = attackResult.targetWorld;
    this.playerAttackShape = attackResult.shape;
    this.playerAttackHitResolved = false;
    return null;
  }

  setGuardHeld(guardHeld: boolean): void {
    this.playerCombatState.setGuardHeld(guardHeld);
  }

  isCombatModeActive(nowMs: number): boolean {
    return this.playerCombatState.getSnapshot(nowMs).combatModeActive;
  }

  syncDerivedStats(derived: PlayerDerivedStats): void {
    this.playerCombatState.updateMaxHp(derived.maxHp);
    this.playerCombatState.syncAttackConfig(derived.attackStaminaCost, derived.attackRecoveryMs, derived.attackWindupMs, derived.attackActiveMs);
    this.currentWindupMs = derived.attackWindupMs;
    this.currentActiveMs = derived.attackActiveMs;
    this.currentLightAttackReachTiles = Math.max(0.5, derived.reachTiles);
    this.currentAttackDamage = Math.max(1, derived.attack);
    this.currentAttackRecoveryMs = derived.attackRecoveryMs;
    this.currentAttackShape = derived.attackShape;
  }

  syncPlayerTier(tier: number): void {
    this.currentPlayerTier = tier;
  }

  getUiSnapshot(nowMs: number): CombatUiSnapshot | null {
    if (!this.currentTilemap) {
      return null;
    }

    const playerSnapshot = this.playerCombatState.getSnapshot(nowMs);
    let enemySnapshot = null;

    if (playerSnapshot.combatModeActive) {
      for (const es of this.enemySystems) {
        const snap = es.getUiSnapshot();
        if (snap && snap.state !== 'idle' && snap.state !== 'dead' && snap.state !== 'reset') {
          enemySnapshot = snap;
          break;
        }
      }
    }

    return {
      active: playerSnapshot.combatModeActive,
      player: playerSnapshot,
      enemy: enemySnapshot,
    };
  }

  toggleSprint(): UiHandledResult | null {
    const result = this.playerCombatState.toggleSprint();

    if (result.ok || !result.reason) {
      return null;
    }

    return {
      ok: false,
      message: result.reason,
      toastKind: 'error',
    };
  }

  canPlayerOccupy(feetWorldX: number, feetWorldY: number): boolean {
    return !this.enemySystems.some((es) => es.blocksFeetAt(feetWorldX, feetWorldY));
  }

  preSyncAttackVisuals(nowMs: number, playerController: PlayerController): void {
    this.syncPlayerAttackVisuals(nowMs, playerController);
  }

  consumePendingScreenShake(): boolean {
    if (!this.pendingScreenShake) {
      return false;
    }

    this.pendingScreenShake = false;
    return true;
  }

  destroy(): void {
    this.playerAttackFeedbackRenderer.clear();
    this.debugHitboxRenderer.destroy();
    this.hitsplatRenderer.destroy();
    for (const es of this.enemySystems) {
      es.destroy();
    }
    this.enemySystems = [];
  }


  private emitSfx(id: SfxEventId): void {
    this.eventBus.emitSfx(id);
  }

  private resolveEnemyAttackEvents(
    nowMs: number,
    playerController: PlayerController,
    events: EnemyUpdateEvent[],
    results: UiHandledResult[],
  ): void {
    const playerFeet = playerController.getFeetPoint();
    const enemyPosition = this.getClosestEnemyPosition(playerFeet.x, playerFeet.y);
    const canBlockFromFront = enemyPosition
      ? isAttackerInsideGuardFront(
          playerFeet.x,
          playerFeet.y,
          playerController.getFacingDirection(),
          enemyPosition.x,
          enemyPosition.y,
        )
      : false;

    const attackerName = this.getEngagedEnemyName();

    events.forEach((event) => {
      if (event.kind !== 'attack_result') {
        return;
      }

      const damage = typeof event.damage === 'number' ? event.damage : 0;
      const hit = event.hit === true;

      if (!hit) {
        this.emitSfx('combat_miss');
        results.push({
          ok: true,
          message: event.reason === 'invulnerable' ? 'Dodged.' : 'Missed.',
          toastKind: 'info',
          combatLog: 'You dodge.',
        });
        return;
      }

      const resolution = this.playerCombatState.resolveIncomingAttack(
        nowMs,
        damage,
        canBlockFromFront,
      );

      switch (resolution.kind) {
        case 'dodged':
          this.emitSfx('combat_miss');
          results.push({
            ok: true,
            message: 'Dodged.',
            toastKind: 'info',
            combatLog: 'You dodge.',
          });
          return;

        case 'blocked':
          this.emitSfx('guard_block');
          results.push({
            ok: true,
            message: 'Blocked.',
            toastKind: 'info',
            combatLog: `You block ${attackerName}'s attack.`,
          });
          // Roar pushes through the guard at reduced force
          if (event.knockbackDirX !== undefined && event.knockbackDistanceWorld) {
            playerController.startDodgeMotion(
              { x: event.knockbackDirX, y: event.knockbackDirY ?? 0 },
              event.knockbackDistanceWorld * 0.55,
              280,
            );
          }
          return;

        case 'guard_broken': {
          playerController.requestCombatVisualState('hurt', nowMs, 360);
          this.emitSfx('guard_break');
          const gbXp = resolution.damageApplied > 0 ? resolution.damageApplied * 4 : 0;
          const gbLevelUps = gbXp > 0 ? this.onCombatXp?.({ defence: gbXp }) : undefined;
          results.push({
            ok: false,
            message: resolution.wasDowned ? 'Guard broken. Downed.' : 'Guard broken!',
            toastKind: 'error',
            combatLog: `${attackerName} breaks your guard${resolution.damageApplied > 0 ? ` for ${resolution.damageApplied}` : ''}.`,
            xpDelta: gbXp > 0 ? { defence: gbXp } : undefined,
            levelUps: gbLevelUps,
          });
          return;
        }

        case 'hit':
        default: {
          playerController.requestCombatVisualState(
            resolution.wasDowned ? 'dead' : 'hurt',
            nowMs,
            resolution.wasDowned ? 900 : 260,
          );
          this.emitSfx('combat_hit');
          const hitXp = resolution.damageApplied > 0 ? resolution.damageApplied * 4 : 0;
          const hitLevelUps = hitXp > 0 ? this.onCombatXp?.({ defence: hitXp }) : undefined;
          const hitLog = resolution.wasDowned
            ? `${attackerName} hits you for ${resolution.damageApplied}. You are downed.`
            : `${attackerName} hits you for ${resolution.damageApplied}.`;
          results.push({
            ok: false,
            message: resolution.wasDowned ? 'Downed.' : 'Hit!',
            toastKind: 'error',
            combatLog: hitLog,
            xpDelta: hitXp > 0 ? { defence: hitXp } : undefined,
            levelUps: hitLevelUps,
          });
        }
          if (event.knockbackDirX !== undefined && event.knockbackDistanceWorld) {
            playerController.startDodgeMotion(
              { x: event.knockbackDirX, y: event.knockbackDirY ?? 0 },
              event.knockbackDistanceWorld,
              300,
            );
          }
      }
    });
  }

  private resolvePlayerLightAttackActivation(): void {
    if (!this.playerCombatState.consumePendingLightAttackActivation()) {
      return;
    }
  }

  private resolvePlayerLightAttackHit(
    nowMs: number,
    results: UiHandledResult[],
  ): void {
    if (this.playerAttackHitResolved) {
      return;
    }

    const snapshot = this.playerCombatState.getSnapshot(nowMs);

    if (snapshot.lightAttackPhase !== 'active') {
      return;
    }

    if (!this.playerAttackShape || !this.currentTilemap) {
      return;
    }

    const tileWidth = this.currentTilemap.tileWidth;
    const engagedId = this.getEngagedEnemyId();
    const hitSystem = this.enemySystems.find((es) => {
      if (engagedId !== null && es.getRuntimeId() !== engagedId) return false;
      const pos = es.getWorldPosition();
      if (!pos) return false;
      const radiusPx = es.getCollisionRadiusTiles() * tileWidth;
      return playerAttackHitsEnemy(this.playerAttackShape!, pos.x, pos.y, radiusPx);
    });

    if (!hitSystem) {
      return;
    }

    // OSRS-style roll: 0 to maxHit inclusive
    const primaryDamage = Math.floor(Math.random() * (this.currentAttackDamage + 1));
    const outcome = hitSystem.applyDamage(primaryDamage, nowMs);

    if (!outcome.hit) {
      return;
    }

    const enemyName = hitSystem.getUiSnapshot()?.name ?? 'Enemy';
    const enemyPos = hitSystem.getWorldPosition();
    if (enemyPos) {
      this.hitsplatRenderer.show(enemyPos.x, enemyPos.y, primaryDamage);
    }

    // Dagger double-hit: second roll at 50% max damage.
    const isDagger = this.currentAttackShape.kind === 'thrust' && this.currentAttackShape.doubleHit === true;
    let totalDamageDealt = primaryDamage;
    let secondaryDamage: number | null = null;
    if (isDagger && !outcome.killed) {
      const secondaryMaxHit = Math.floor(this.currentAttackDamage * 0.5);
      secondaryDamage = Math.floor(Math.random() * (secondaryMaxHit + 1));
      hitSystem.applyDamage(secondaryDamage, nowMs);
      if (enemyPos) {
        this.hitsplatRenderer.show(enemyPos.x, enemyPos.y, secondaryDamage, 180);
      }
      totalDamageDealt += secondaryDamage;
    }

    this.playerAttackHitResolved = true;
    this.hitStopUntilMs = nowMs + CombatSandboxSystem.HIT_STOP_MS;
    this.pendingScreenShake = true;
    this.playerCombatState.setNextRecoveryMs(CombatSandboxSystem.POST_HIT_RECOVERY_MS);
    this.playerCombatState.refundLightAttackStamina();
    this.emitSfx(outcome.killed ? 'enemy_down' : 'player_attack');

    if (outcome.killed && this.onEnemyKilled) {
      const pos = hitSystem.getWorldPosition();
      const defId = hitSystem.getDefinitionId();
      const spawnId = hitSystem.getSpawnId();
      if (pos && defId && spawnId) {
        this.onEnemyKilled({
          spawnId,
          areaId: this.areaIdBySpawnId.get(spawnId),
          lootTableId: this.lootTableIdBySpawnId.get(spawnId),
          enemyDefinitionId: defId,
          worldX: pos.x,
          worldY: pos.y,
        });
      }
    }

    const dmgParts = secondaryDamage !== null
      ? `${primaryDamage}, ${secondaryDamage}`
      : String(primaryDamage);
    const combatLog = outcome.killed
      ? `You kill ${enemyName} (${dmgParts} dmg).`
      : `You hit ${enemyName} for ${dmgParts}.`;

    const meleeXp = totalDamageDealt * 4;
    const meleeLevelUps = this.onCombatXp?.({ melee: meleeXp });
    results.push({
      ok: true,
      message: outcome.killed ? 'Enemy down.' : 'You landed a hit.',
      toastKind: outcome.killed ? 'success' : 'info',
      combatLog,
      xpDelta: { melee: meleeXp },
      levelUps: meleeLevelUps,
    });
  }

  private syncPlayerAttackVisuals(nowMs: number, playerController: PlayerController): void {
    const snapshot = this.playerCombatState.getSnapshot(nowMs);

    if (snapshot.lightAttackPhase === this.lastPlayerAttackPhase) {
      return;
    }

    this.lastPlayerAttackPhase = snapshot.lightAttackPhase;

    switch (snapshot.lightAttackPhase) {
      case 'windup':
        playerController.requestCombatVisualState(
          'attack_windup',
          nowMs,
          this.currentWindupMs,
        );
        this.playerAttackFeedbackRenderer.showWindup({
          nowMs,
          tilemap: this.currentTilemap,
          playerController,
          targetWorld: this.playerAttackTargetWorld,
          maxTileReach: this.currentLightAttackReachTiles,
        });
        break;
      case 'active': {
        // Re-snap the target to the nearest enemy at active-phase entry.
        // Only snaps if the enemy drifted within AIM_SNAP_RADIUS_TILES of the original aim —
        // fixes accidental misses from enemy orbit without granting free auto-aim.
        const feetPoint = playerController.getFeetPoint();
        const snapped = this.findNearestEnemyWithinReach(
          feetPoint.x, feetPoint.y,
          this.playerAttackTargetWorld ?? undefined,
        );
        if (snapped) {
          this.playerAttackTargetWorld = snapped;
        }
        playerController.requestCombatVisualState(
          'attack_active',
          nowMs,
          this.currentActiveMs,
        );
        this.playerAttackFeedbackRenderer.showActive({
          nowMs,
          tilemap: this.currentTilemap,
          targetWorld: this.playerAttackTargetWorld,
        });
        this.playerAttackFeedbackRenderer.drawSlashVfx(this.playerAttackTargetWorld);
        break;
      }
      case 'recovery':
        playerController.requestCombatVisualState(
          'attack_recovery',
          nowMs,
          this.currentAttackRecoveryMs,
        );
        this.playerAttackHitResolved = false;
        this.playerAttackFeedbackRenderer.showRecovery({
          nowMs,
          tilemap: this.currentTilemap,
          playerController,
          recoveryMs: this.currentAttackRecoveryMs,
        });
        break;
      default:

        this.playerAttackTargetWorld = null;
        this.playerAttackShape = null;
        this.playerAttackHitResolved = false;
        this.playerAttackFeedbackRenderer.clear();
        break;
    }
  }

  private resolvePlayerEnemyOverlap(playerController: PlayerController): void {
    if (!this.currentTilemap) {
      return;
    }

    const feet = playerController.getFeetPoint();
    for (const es of this.enemySystems) {
      if (!es.blocksFeetAt(feet.x, feet.y)) continue;
      const pos = es.getWorldPosition();
      if (!pos) continue;
      const radiusPx = es.getCollisionRadiusTiles() * this.currentTilemap.tileWidth;
      const dx = feet.x - pos.x;
      const dy = feet.y - pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 0.0001) continue;
      const dist = Math.sqrt(distSq);
      const push = radiusPx - dist;
      feet.x += (dx / dist) * push;
      feet.y += (dy / dist) * push;
      playerController.setFeetWorldPosition(feet.x, feet.y);
    }
  }

  private syncDebugHitboxes(nowMs: number, playerController: PlayerController): void {
    const snapshot = this.playerCombatState.getSnapshot(nowMs);
    const allEnemyTiles = this.enemySystems.flatMap((es) => es.getOccupiedTiles());
    this.debugHitboxRenderer.render({
      tilemap: this.currentTilemap,
      playerTiles: playerController.getFootprintTiles(),
      enemyTiles: allEnemyTiles,
      dodgeDirection: playerController.getDodgeDirection(),
      dodgeTileCount: this.currentDodgeTileCount,
      playerAttackShape: this.playerAttackShape,
      playerAttackPhase: snapshot.lightAttackPhase,
    });
  }

  private getEngagedEnemyId(): string | null {
    for (const es of this.enemySystems) {
      if (es.isEngaged()) {
        return es.getRuntimeId();
      }
    }
    return null;
  }

  // Snap radius: enemy must be within this many tiles of the original aim point.
  // Prevents free auto-aim while still correcting for enemy drift during windup.
  private static readonly AIM_SNAP_RADIUS_TILES = 2.5;

  private findNearestEnemyWithinReach(
    fromX: number,
    fromY: number,
    originalAim?: { x: number; y: number },
  ): { x: number; y: number } | null {
    if (!this.currentTilemap) return null;
    const reachWorld = this.currentLightAttackReachTiles * this.currentTilemap.tileWidth;
    const aimSnapRadius = CombatSandboxSystem.AIM_SNAP_RADIUS_TILES * this.currentTilemap.tileWidth;
    let nearest: { x: number; y: number } | null = null;
    let nearestDist = reachWorld + 1;
    for (const es of this.enemySystems) {
      const snap = es.getUiSnapshot();
      if (!snap || snap.state === 'dead' || snap.state === 'idle' || snap.state === 'reset') continue;
      const pos = es.getWorldPosition();
      if (!pos) continue;
      const distFromPlayer = Math.hypot(pos.x - fromX, pos.y - fromY);
      if (distFromPlayer >= nearestDist) continue;
      if (originalAim && Math.hypot(pos.x - originalAim.x, pos.y - originalAim.y) > aimSnapRadius) continue;
      nearestDist = distFromPlayer;
      nearest = pos;
    }
    return nearest;
  }

  private getEngagedEnemyName(): string {
    for (const es of this.enemySystems) {
      if (es.isEngaged()) return es.getUiSnapshot()?.name ?? 'Enemy';
    }
    return 'Enemy';
  }

  private getClosestEnemyPosition(fromX: number, fromY: number): { x: number; y: number } | null {
    let closest: { x: number; y: number } | null = null;
    let closestDist = Infinity;
    for (const es of this.enemySystems) {
      const pos = es.getWorldPosition();
      if (pos) {
        const d = Math.hypot(pos.x - fromX, pos.y - fromY);
        if (d < closestDist) {
          closestDist = d;
          closest = pos;
        }
      }
    }
    return closest;
  }
}
