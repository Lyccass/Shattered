import Phaser from 'phaser';
import { EnemySystem } from '../EnemySystem';
import { HitsplatRenderer } from '../HitsplatRenderer';
import type { EnemySpawnDefinition } from '../EnemyTypes';
import type { IsoTilemap } from '../../world/IsoTilemap';
import type { PlayerController } from '../../player/PlayerController';
import type { GameEventBus } from '../../events/GameEventBus';
import type { SkillXpDelta, LevelUpEvent } from '../../skills/SkillTypes';
import type { PlayerDerivedStats } from '../../equipment/EquipmentTypes';
import { TurnActionPreviewRenderer } from './TurnActionPreviewRenderer';
import {
  applyAction,
  buildUiSnapshot,
  createCombatState,
  getActiveParticipant,
} from './TurnCombatEngine';
import { resolveEnemyTurnStep } from './TurnEnemyAi';
import type {
  ActionOutcome,
  CombatEndReason,
  TurnAttack,
  TurnAction,
  TurnCombatState,
  TurnCombatUiSnapshot,
  TurnParticipant,
  TurnDamageType,
} from './TurnCombatTypes';
import type { TurnTileContext } from './TurnActionValidator';
import { getBestApproachTile, getReachableTiles } from './TurnActionValidator';

export type CombatEndEvent = {
  reason: CombatEndReason;
  killedSpawnIds: string[];
};

// Animation step types for visual sequencing
type AnimStep =
  | { kind: 'move_tween';    enemyId: string; fromWorld: { x: number; y: number }; toWorld: { x: number; y: number }; durationMs: number; visualState?: 'moving' | 'attacking' }
  | { kind: 'attack_flash';  attackerId: string; targetId: string; durationMs: number }
  | { kind: 'hit_flash';     targetId: string; durationMs: number }
  | { kind: 'delay';         durationMs: number };

const ENEMY_MOVE_TWEEN_MS  = 280;
const ENEMY_ATTACK_WAIT_MS = 420;
const ENEMY_TURN_DELAY_MS  = 180;
const PLAYER_MAIN_ACTIONS_PER_TURN      = 1;
const PLAYER_SECONDARY_ACTIONS_PER_TURN = 1;
const PLAYER_MOVE_POINTS_PER_TURN       = 5;
const PLAYER_HP_REGEN_INTERVAL_MS       = 60_000;

export class TurnCombatSession {
  // ─── State ───────────────────────────────────────────────────────────────
  private combatState: TurnCombatState | null = null;
  private enemySystems: EnemySystem[] = [];
  private currentTilemap: IsoTilemap | null = null;
  private playerController: PlayerController | null = null;
  private derivedStats: PlayerDerivedStats | null = null;
  private animQueue: AnimStep[] = [];
  private animStepStartMs = 0;
  private blockedByAnim = false;

  /** Persistent player HP across combats. Null until first combat entry. */
  private persistedPlayerHp: number | null = null;
  private persistedPlayerMaxHp: number | null = null;
  private lastPlayerHpRegenMs = 0;
  private _isSprinting = false;
  /** Whether the player has activated "pick a target" attack mode. */
  private _isAttackMode = false;
  private selectedPlayerAttackId: string | null = null;

  private readonly previewRenderer: TurnActionPreviewRenderer;
  private readonly hitsplatRenderer: HitsplatRenderer;

  // Callbacks
  private onCombatEnd?: (event: CombatEndEvent) => void;
  private onCombatXp?: (delta: SkillXpDelta) => LevelUpEvent[];
  private onEnemyKilledForLoot?: (spawnId: string, areaId: string | undefined, lootTableId: string | undefined, worldX: number, worldY: number) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
  ) {
    const dummyGetDiamonds = (_x: number, _y: number) =>
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    this.previewRenderer  = new TurnActionPreviewRenderer(scene, dummyGetDiamonds);
    this.hitsplatRenderer = new HitsplatRenderer(scene);
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  setMapContext(mapId: string, tilemap: IsoTilemap, extraSpawns: EnemySpawnDefinition[] = []): void {
    this.endCombatImmediately();
    this.currentTilemap = tilemap;

    // Wire the real isometric diamond function for tile overlays
    this.previewRenderer.setDiamondFn(
      tilemap.transform.getTileDiamondPoints.bind(tilemap.transform),
    );

    for (const es of this.enemySystems) es.destroy();
    this.enemySystems = [];

    for (const spawn of extraSpawns) {
      const es = new EnemySystem(this.scene);
      es.setMapContext(mapId, tilemap, spawn);
      this.enemySystems.push(es);
    }
  }

  setPlayerController(pc: PlayerController): void {
    this.playerController = pc;
  }

  setDerivedStats(stats: PlayerDerivedStats): void {
    this.derivedStats = stats;
    this.persistedPlayerMaxHp = stats.maxHp;
    if (this.persistedPlayerHp === null) this.persistedPlayerHp = stats.maxHp;
    else this.persistedPlayerHp = Math.min(this.persistedPlayerHp, stats.maxHp);
  }

  /** Call after the player respawns so HP is reset to full. */
  resetPlayerHp(): void {
    const maxHp = this.derivedStats?.maxHp ?? null;
    this.persistedPlayerHp = maxHp;
    this.persistedPlayerMaxHp = maxHp;
  }

  onEnd(cb: (evt: CombatEndEvent) => void): void {
    this.onCombatEnd = cb;
  }

  onXp(cb: (delta: SkillXpDelta) => LevelUpEvent[]): void {
    this.onCombatXp = cb;
  }

  onEnemyKilled(
    cb: (spawnId: string, areaId: string | undefined, lootTableId: string | undefined, worldX: number, worldY: number) => void,
  ): void {
    this.onEnemyKilledForLoot = cb;
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────

  update(nowMs: number): void {
    // Update idle / dead enemy visuals outside of combat
    for (const es of this.enemySystems) {
      if (!es.inCombat) es.update(nowMs);
    }

    this.updatePlayerHpRegen(nowMs);

    if (!this.combatState) {
      this.checkAggroTrigger(nowMs);
      this.previewRenderer.update(null, this.buildTileCtx());
      return;
    }

    // Process animation queue first — block all logic until animations settle
    if (this.animQueue.length > 0) {
      this.processAnimQueue(nowMs);
      return;
    }
    this.blockedByAnim = false;

    // Update previews
    this.previewRenderer.update(this.combatState, this.buildTileCtx(), this._isAttackMode);

    if (this.combatState.phase === 'player_turn' && this.isPlayerMovementAnimating()) {
      return;
    }

    // Auto-advance turn when player has exhausted all actions
    if (this.combatState.phase === 'player_turn') {
      const active = getActiveParticipant(this.combatState);
      if (
        active?.kind === 'player' &&
        active.apRemaining === 0 &&
        active.mpRemaining === 0 &&
        (active.secondaryActionRemaining ?? 0) === 0
      ) {
        this._isAttackMode = false;
        this.submitPlayerAction({ kind: 'end_turn' });
        return;
      }
    }

    // Run enemy turns automatically
    if (this.combatState.phase === 'enemy_turn') {
      this._isAttackMode = false;
      this.runEnemyTurn(nowMs);
    }
  }

  // ─── Player actions ───────────────────────────────────────────────────────

  isInCombat(): boolean { return this.combatState !== null; }
  isPlayerTurn(): boolean { return this.combatState?.phase === 'player_turn'; }
  isAnimating(): boolean { return this.animQueue.length > 0 || this.blockedByAnim || this.isPlayerMovementAnimating(); }

  tryPlayerMove(toTileX: number, toTileY: number): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    return this.submitPlayerAction({ kind: 'move', toTileX, toTileY });
  }

  tryPlayerAttack(targetId: string, attackId = this.selectedPlayerAttackId ?? undefined): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    return this.submitPlayerAction({ kind: 'attack', targetId, attackId });
  }

  tryPlayerEndTurn(): void {
    if (!this.canAcceptPlayerInput()) return;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.submitPlayerAction({ kind: 'end_turn' });
  }

  tryPlayerFlee(): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    return this.submitPlayerAction({ kind: 'flee' });
  }

  tryPlayerGuard(): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    return this.submitPlayerAction({ kind: 'guard' });
  }

  tryPlayerCleanse(): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    return this.submitPlayerAction({ kind: 'cleanse' });
  }

  /** Toggle the "pick-a-target" attack cursor on/off. */
  toggleAttackMode(attackId?: string): void {
    if (!this.isPlayerTurn() || this.isAnimating()) return;
    if (this._isAttackMode && this.selectedPlayerAttackId === (attackId ?? null)) {
      this._isAttackMode = false;
      this.selectedPlayerAttackId = null;
      return;
    }

    this._isAttackMode = true;
    this.selectedPlayerAttackId = attackId ?? null;
  }

  /**
   * Called from pointer interaction.
   * - Attack mode ON: click an enemy to attack; click elsewhere cancels mode.
   * - Attack mode OFF: clicking an enemy auto-attacks; clicking empty tile moves.
   */
  handleTileClick(tileX: number, tileY: number): ActionOutcome | null {
    if (!this.canAcceptPlayerInput() || !this.combatState) return null;

    const targetParticipant = this.combatState.participants.find(
      (p) => p.kind === 'enemy' && p.hp > 0 && p.tileX === tileX && p.tileY === tileY,
    );

    if (this._isAttackMode) {
      // In attack mode: any click resolves it
      this._isAttackMode = false;
      const attackId = this.selectedPlayerAttackId ?? undefined;
      this.selectedPlayerAttackId = null;
      if (targetParticipant) return this.tryPlayerAttack(targetParticipant.id, attackId);
      return null; // cancelled by clicking empty tile
    }

    // Normal mode: attack if in range, otherwise move toward enemy
    if (targetParticipant) {
      const attackResult = this.tryPlayerAttack(targetParticipant.id, undefined);
      if (attackResult?.kind !== 'invalid') return attackResult;

      // Out of attack range — move toward the enemy as far as possible
      const active = getActiveParticipant(this.combatState);
      if (active && active.mpRemaining > 0) {
        const approach = getBestApproachTile(
          active, targetParticipant.tileX, targetParticipant.tileY,
          this.combatState, this.buildTileCtx(),
        );
        if (approach) return this.tryPlayerMove(approach.x, approach.y);
      }
      return attackResult;
    }
    return this.tryPlayerMove(tileX, tileY);
  }

  // ─── UI ───────────────────────────────────────────────────────────────────

  setSprinting(sprinting: boolean): void {
    this._isSprinting = sprinting;
  }

  getUiSnapshot(): TurnCombatUiSnapshot {
    const base = buildUiSnapshot(this.combatState);
    const liveHp = this.combatState?.participants.find((p) => p.id === 'player')?.hp ?? null;
    return {
      ...base,
      playerCurrentHp: liveHp ?? this.persistedPlayerHp,
      playerMaxHp: this.persistedPlayerMaxHp ?? this.derivedStats?.maxHp ?? null,
      isSprinting: this._isSprinting,
      isAttackMode: this._isAttackMode,
      selectedAttackId: this.selectedPlayerAttackId,
    };
  }

  getMovementRangeTiles(): { x: number; y: number }[] {
    if (!this.combatState || this.combatState.phase !== 'player_turn') return [];
    const active = getActiveParticipant(this.combatState);
    if (!active || active.kind !== 'player') return [];
    return getReachableTiles(active, this.combatState, this.buildTileCtx());
  }

  // ─── Private: combat trigger ──────────────────────────────────────────────

  private checkAggroTrigger(nowMs: number): void {
    if (!this.playerController || !this.currentTilemap) return;

    const playerPos  = this.playerController.getFeetPoint();
    const playerTile = this.currentTilemap.transform.worldToTile(playerPos.x, playerPos.y);

    const aggroEnemies = this.enemySystems.filter(
      (es) => es.wouldAggro() && es.isInAggroRange(playerTile.x, playerTile.y),
    );

    if (aggroEnemies.length === 0) return;

    this.enterCombat(playerTile.x, playerTile.y, aggroEnemies, nowMs);
  }

  /**
   * Triggered when the player explicitly clicks an enemy while in combat stance
   * (explore mode + combat toggle active). Works for passive AND aggressive enemies.
   * Returns true if combat was triggered.
   */
  tryTriggerCombatAtTile(tileX: number, tileY: number, nowMs: number): boolean {
    if (this.combatState) return false;
    if (!this.playerController || !this.currentTilemap) return false;

    const target = this.enemySystems.find(
      (es) => es.isAlive() && !es.inCombat &&
              es.getCurrentTile()?.x === tileX && es.getCurrentTile()?.y === tileY,
    );
    if (!target) return false;

    const playerPos  = this.playerController.getFeetPoint();
    const playerTile = this.currentTilemap.transform.worldToTile(playerPos.x, playerPos.y);
    this.enterCombat(playerTile.x, playerTile.y, [target], nowMs);
    return true;
  }

  /** Returns true if any alive enemy occupies the given tile. */
  hasEnemyAtTile(tileX: number, tileY: number): boolean {
    return this.enemySystems.some(
      (es) => es.isAlive() && es.getCurrentTile()?.x === tileX && es.getCurrentTile()?.y === tileY,
    );
  }

  /**
   * Can also be called directly when the player attacks an enemy.
   */
  triggerCombatWith(es: EnemySystem, nowMs: number): void {
    if (this.combatState) return;
    if (!this.playerController || !this.currentTilemap) return;

    const playerPos  = this.playerController.getFeetPoint();
    const playerTile = this.currentTilemap.transform.worldToTile(playerPos.x, playerPos.y);
    this.enterCombat(playerTile.x, playerTile.y, [es], nowMs);
  }

  // ─── Private: combat setup ────────────────────────────────────────────────

  private enterCombat(
    playerTileX: number,
    playerTileY: number,
    enemySystems: EnemySystem[],
    _nowMs: number,
  ): void {
    if (!this.derivedStats) return;

    // Stop any ongoing click-move so player doesn't keep walking into enemies
    this.playerController?.clearClickMoveTarget();

    const maxHp = this.derivedStats.maxHp;
    this.persistedPlayerMaxHp = maxHp;
    if (this.persistedPlayerHp === null) this.persistedPlayerHp = maxHp;
    const playerAttacks = buildPlayerTurnAttacks(this.derivedStats);

    const playerParticipant: TurnParticipant = {
      id:              'player',
      kind:            'player',
      name:            'You',
      tileX:           playerTileX,
      tileY:           playerTileY,
      hp:              this.persistedPlayerHp,
      maxHp:           maxHp,
      apMax:           PLAYER_MAIN_ACTIONS_PER_TURN,
      mpMax:           PLAYER_MOVE_POINTS_PER_TURN,
      apRemaining:     PLAYER_MAIN_ACTIONS_PER_TURN,
      secondaryActionMax: PLAYER_SECONDARY_ACTIONS_PER_TURN,
      secondaryActionRemaining: PLAYER_SECONDARY_ACTIONS_PER_TURN,
      mpRemaining:     PLAYER_MOVE_POINTS_PER_TURN,
      initiative:      5,
      attackPower:     this.derivedStats.attack,
      hitChance:       this.derivedStats.accuracy,
      defensePower:    Math.floor(this.derivedStats.physicalDefence / 10),
      slashDefence:    Math.floor(this.derivedStats.slashDefence / 10),
      pierceDefence:   Math.floor(this.derivedStats.pierceDefence / 10),
      crushDefence:    Math.floor(this.derivedStats.crushDefence / 10),
      attackRangeTiles: Math.max(...playerAttacks.map((attack) => attack.maxRangeTiles)),
      attacks:         playerAttacks,
      attackCooldowns: {},
      stagger:         0,
      staggerThreshold: Math.max(10, Math.ceil(this.derivedStats.staggerThreshold / 10)),
      weaponId:        this.derivedStats.weaponArchetype,
      statusEffects:   [],
    };

    const enemyParticipants: TurnParticipant[] = enemySystems
      .map((es) => {
        const record = es.getRecord();
        const def    = es.getDefinition();
        if (!record || !def) return null;

        es.setInCombat(true);
        return {
          id:              record.id,
          kind:            'enemy' as const,
          name:            def.displayName,
          tileX:           record.tileX,
          tileY:           record.tileY,
          hp:              record.hp,
          maxHp:           record.maxHp,
          apMax:           def.apPerTurn,
          mpMax:           def.mpPerTurn,
          apRemaining:     def.apPerTurn,
          mpRemaining:     def.mpPerTurn,
          initiative:      def.initiative,
          attackPower:     def.attacks[0]?.damage ?? 1,
          hitChance:       def.attacks[0]?.hitChance,
          defensePower:    def.defense,
          slashDefence:    def.defense,
          pierceDefence:   def.defense,
          crushDefence:    def.defense,
          attackRangeTiles: Math.max(1, ...def.attacks.map((attack) => attack.maxRangeTiles)),
          attacks:         def.attacks.map((attack) => ({
            id: attack.id,
            displayName: attack.displayName,
            apCost: attack.apCost,
            minRangeTiles: attack.minRangeTiles,
            maxRangeTiles: attack.maxRangeTiles,
            damage: attack.damage,
            damageType: attack.damageType ?? 'slash',
            hitChance: attack.hitChance,
            statusEffect: attack.statusEffect ? {
              kind: attack.statusEffect.kind,
              turns: attack.statusEffect.turns,
              value: attack.statusEffect.value,
            } : undefined,
            cooldownTurns: attack.cooldownTurns ?? 0,
            telegraph: attack.telegraph ? { ...attack.telegraph } : undefined,
            forcedMovement: attack.forcedMovement ? { ...attack.forcedMovement } : undefined,
          })),
          attackCooldowns: {},
          stagger:         0,
          staggerThreshold: 10,
          definitionId:    def.id,
          spawnId:         record.id,
          areaId:          undefined,
          lootTableId:     undefined,
          statusEffects:   [],
        };
      })
      .filter(Boolean) as TurnParticipant[];

    if (enemyParticipants.length === 0) return;

    this.combatState = createCombatState([playerParticipant, ...enemyParticipants]);
    this.eventBus.emitSfx('combat_hit');
  }

  // ─── Private: action submission ───────────────────────────────────────────

  private submitPlayerAction(action: TurnAction): ActionOutcome | null {
    if (!this.combatState) return null;

    const { outcome, state: next } = applyAction(this.combatState, action, this.buildTileCtx());
    this.combatState = next;
    this.handleOutcome(outcome);
    if (next.phase === 'combat_ended' && next.endReason) {
      this.finalizeCombat(next.endReason);
    }
    return outcome;
  }

  private handleOutcome(outcome: ActionOutcome): void {
    switch (outcome.kind) {
      case 'attacked': {
        const targetEs = this.findEnemySystem(outcome.targetId);
        if (targetEs) {
          this.syncEnemyCombatHp(outcome.targetId);
          const pos = targetEs.getWorldPosition();
          if (pos) this.hitsplatRenderer.show(pos.x, pos.y, outcome.damage);
          if (outcome.hit) targetEs.flashHit(this.scene.time.now);

          if (outcome.actorId === 'player' && outcome.hit && outcome.damage > 0) {
            const meleeXp = outcome.damage * 4;
            this.onCombatXp?.({ melee: meleeXp });
          }
        } else if (outcome.targetId === 'player') {
          const feet = this.playerController?.getFeetPoint();
          if (feet) this.hitsplatRenderer.show(feet.x, feet.y, outcome.damage);
          if (outcome.hit) {
            this.playerController?.requestCombatVisualState('hurt', this.scene.time.now, 240);
            const attacker = this.combatState?.participants.find((p) => p.id === outcome.actorId);
            if (attacker && this.currentTilemap) {
              const attackerWorld = this.currentTilemap.getTileCenterWorld(attacker.tileX, attacker.tileY);
              this.playerController?.setFacingFromTarget(attackerWorld.x, attackerWorld.y);
            }
          }
        }

        if (outcome.killed) {
          const es = this.findEnemySystem(outcome.targetId);
          if (es) {
            const pos  = es.getWorldPosition();
            const def  = es.getDefinition();
            const spawnId = es.getSpawnId();
            es.recordDeath(this.scene.time.now);
            if (spawnId && pos && def) {
              this.onEnemyKilledForLoot?.(spawnId, undefined, def.id, pos.x, pos.y);
            }
          }
        }
        if (outcome.pushed) this.handleForcedMovementVisual(outcome.pushed);
        break;
      }

      case 'telegraph_resolved': {
        if (!outcome.targetWasInArea) {
          if (outcome.actorMoved) this.handleTelegraphActorMoveVisual(outcome.actorMoved);
          break;
        }

        const targetEs = this.findEnemySystem(outcome.targetId);
        if (targetEs) {
          this.syncEnemyCombatHp(outcome.targetId);
          const pos = targetEs.getWorldPosition();
          if (pos) this.hitsplatRenderer.show(pos.x, pos.y, outcome.damage);
          if (outcome.hit) targetEs.flashHit(this.scene.time.now);

          if (outcome.actorId === 'player' && outcome.hit && outcome.damage > 0) {
            const meleeXp = outcome.damage * 4;
            this.onCombatXp?.({ melee: meleeXp });
          }
        } else if (outcome.targetId === 'player') {
          const feet = this.playerController?.getFeetPoint();
          if (feet) this.hitsplatRenderer.show(feet.x, feet.y, outcome.damage);
          if (outcome.hit) {
            this.playerController?.requestCombatVisualState('hurt', this.scene.time.now, 240);
            const attacker = this.combatState?.participants.find((p) => p.id === outcome.actorId);
            if (attacker && this.currentTilemap) {
              const attackerWorld = this.currentTilemap.getTileCenterWorld(attacker.tileX, attacker.tileY);
              this.playerController?.setFacingFromTarget(attackerWorld.x, attackerWorld.y);
            }
          }
        }

        if (outcome.killed) {
          const es = this.findEnemySystem(outcome.targetId);
          if (es) {
            const pos  = es.getWorldPosition();
            const def  = es.getDefinition();
            const spawnId = es.getSpawnId();
            es.recordDeath(this.scene.time.now);
            if (spawnId && pos && def) {
              this.onEnemyKilledForLoot?.(spawnId, undefined, def.id, pos.x, pos.y);
            }
          }
        }
        if (outcome.actorMoved) this.handleTelegraphActorMoveVisual(outcome.actorMoved);
        if (outcome.pushed) this.handleForcedMovementVisual(outcome.pushed);
        break;
      }

      case 'moved': {
        if (outcome.actorId === 'player' && this.playerController && this.currentTilemap) {
          const world = this.currentTilemap.getTileCenterWorld(outcome.toTile.x, outcome.toTile.y);
          // Use click-move so the player walks smoothly instead of teleporting.
          // playerController.update() always runs (see GameScene) so this resolves each frame.
          this.playerController.setClickMoveTarget(world.x, world.y);
        } else {
          const es = this.findEnemySystem(outcome.actorId);
          if (es && this.currentTilemap) {
            es.setCombatTile(outcome.toTile.x, outcome.toTile.y, false);
            this.queueEnemyMove(outcome.actorId, outcome.fromTile, outcome.path ?? [outcome.toTile]);
            this.animQueue.push({ kind: 'delay', durationMs: ENEMY_TURN_DELAY_MS });
          }
        }
        break;
      }

      case 'telegraph_prepared': {
        const es = this.findEnemySystem(outcome.actorId);
        const actor = this.combatState?.participants.find((p) => p.id === outcome.actorId);
        if (es && actor && this.currentTilemap) {
          const world = this.currentTilemap.getTileCenterWorld(actor.tileX, actor.tileY);
          es.applyVisualUpdate(world.x, world.y, false, actor.hp, 'windup', this.scene.time.now);
          this.animQueue.push({ kind: 'delay', durationMs: ENEMY_TURN_DELAY_MS });
        }
        break;
      }

      case 'status_tick':
        this.handleStatusTickVisual(outcome);
        break;

      case 'cleansed':
        if (outcome.actorId === 'player') {
          const feet = this.playerController?.getFeetPoint();
          if (feet) this.hitsplatRenderer.show(feet.x, feet.y, 0, 0, 'Cleanse', '#a7f3d0');
        }
        break;

      case 'turn_ended':
        for (const tick of outcome.statusTicks ?? []) this.handleStatusTickVisual(tick, 360);
        break;

      case 'combat_ended':
        for (const tick of outcome.statusTicks ?? []) this.handleStatusTickVisual(tick, 360);
        this.finalizeCombat(outcome.reason);
        break;

      case 'fled':
        this.finalizeCombat('player_fled');
        break;
    }
  }

  // ─── Private: enemy turn execution ───────────────────────────────────────

  private runEnemyTurn(_nowMs: number): void {
    if (!this.combatState) return;
    if (this.animQueue.length > 0) return;

    const { outcomes, state: next } = resolveEnemyTurnStep(this.combatState, this.buildTileCtx());
    this.combatState = next;

    for (const outcome of outcomes) {
      this.handleOutcome(outcome);
      if (outcome.kind === 'combat_ended' || outcome.kind === 'fled') break;
    }
    this.previewRenderer.update(this.combatState, this.buildTileCtx(), this._isAttackMode);

    if (this.combatState?.phase === 'combat_ended' && this.combatState.endReason) {
      this.finalizeCombat(this.combatState.endReason);
      return;
    }

    // Small delay before returning control to the player
    if (next.phase === 'player_turn' && this.animQueue.length === 0) {
      this.animQueue.push({ kind: 'delay', durationMs: ENEMY_ATTACK_WAIT_MS });
    }
  }

  // ─── Private: animation processing ───────────────────────────────────────

  private processAnimQueue(nowMs: number): void {
    if (this.animQueue.length === 0) {
      this.blockedByAnim = false;
      return;
    }

    const step = this.animQueue[0];
    if (!this.blockedByAnim) {
      this.blockedByAnim = true;
      this.animStepStartMs = nowMs;
    }

    const elapsed = nowMs - this.animStepStartMs;

    switch (step.kind) {
      case 'move_tween': {
        const t   = Math.min(1, elapsed / step.durationMs);
        const eased = easeOut(t);
        const worldX = step.fromWorld.x + (step.toWorld.x - step.fromWorld.x) * eased;
        const worldY = step.fromWorld.y + (step.toWorld.y - step.fromWorld.y) * eased;
        const es = this.findEnemySystem(step.enemyId);
        const record = this.combatState?.participants.find((p) => p.id === step.enemyId);
        if (es && record) {
          const facingRight = step.toWorld.x > step.fromWorld.x;
          es.applyVisualUpdate(worldX, worldY, facingRight, record.hp, step.visualState ?? 'moving', nowMs);
        }
        if (t >= 1) {
          if (es && record) {
            es.applyVisualUpdate(step.toWorld.x, step.toWorld.y, false, record.hp, 'idle', nowMs);
          }
          this.shiftAnimQueue();
        }
        break;
      }

      case 'attack_flash': {
        const targetEs = this.findEnemySystem(step.targetId);
        if (targetEs) {
          const record = this.combatState?.participants.find((p) => p.id === step.targetId);
          const pos = targetEs.getWorldPosition();
          if (record && pos) {
            targetEs.applyVisualUpdate(pos.x, pos.y, false, record.hp, 'hurt', nowMs);
          }
        }
        if (elapsed >= step.durationMs) this.shiftAnimQueue();
        break;
      }

      case 'hit_flash': {
        const es = this.findEnemySystem(step.targetId);
        if (es) es.flashHit(nowMs);
        this.shiftAnimQueue();
        break;
      }

      case 'delay':
        if (elapsed >= step.durationMs) this.shiftAnimQueue();
        break;
    }
  }

  private shiftAnimQueue(): void {
    this.animQueue.shift();
    this.blockedByAnim = false;
  }

  // ─── Private: combat end ──────────────────────────────────────────────────

  private finalizeCombat(reason: CombatEndReason): void {
    const killedIds: string[] = [];

    const playerP = this.combatState?.participants.find((p) => p.id === 'player');
    if (playerP) {
      this.persistedPlayerHp = reason === 'player_died' ? 0 : playerP.hp;
    }

    for (const es of this.enemySystems) {
      if (es.inCombat) {
        es.setInCombat(false);
        if (!es.isAlive()) killedIds.push(es.getSpawnId() ?? '');
      }
    }

    this.combatState   = null;
    this.animQueue     = [];
    this.blockedByAnim = false;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.previewRenderer.clear();
    this.onCombatEnd?.({ reason, killedSpawnIds: killedIds.filter(Boolean) });
  }

  private endCombatImmediately(): void {
    if (this.combatState) this.finalizeCombat('player_fled');
    this.combatState   = null;
    this.animQueue     = [];
    this.blockedByAnim = false;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
  }

  // ─── Private: helpers ─────────────────────────────────────────────────────

  private canAcceptPlayerInput(): boolean {
    return (
      !!this.combatState &&
      this.combatState.phase === 'player_turn' &&
      !this.blockedByAnim &&
      this.animQueue.length === 0 &&
      !this.isPlayerMovementAnimating()
    );
  }

  private isPlayerMovementAnimating(): boolean {
    return this.playerController?.hasClickMoveTarget() ?? false;
  }

  private updatePlayerHpRegen(nowMs: number): void {
    if (this.persistedPlayerHp === null || this.persistedPlayerMaxHp === null) return;
    const livePlayer = this.combatState?.participants.find((p) => p.id === 'player') ?? null;
    const currentHp = livePlayer?.hp ?? this.persistedPlayerHp;
    const maxHp = livePlayer?.maxHp ?? this.persistedPlayerMaxHp;
    if (currentHp <= 0 || currentHp >= maxHp) {
      this.lastPlayerHpRegenMs = nowMs;
      return;
    }

    if (this.lastPlayerHpRegenMs <= 0) {
      this.lastPlayerHpRegenMs = nowMs;
      return;
    }

    const ticks = Math.floor((nowMs - this.lastPlayerHpRegenMs) / PLAYER_HP_REGEN_INTERVAL_MS);
    if (ticks <= 0) return;

    const nextHp = Math.min(maxHp, currentHp + ticks);
    if (livePlayer && this.combatState) {
      this.combatState = {
        ...this.combatState,
        participants: this.combatState.participants.map((p) =>
          p.id === 'player' ? { ...p, hp: nextHp } : p,
        ),
      };
    }
    this.persistedPlayerHp = nextHp;
    this.lastPlayerHpRegenMs += ticks * PLAYER_HP_REGEN_INTERVAL_MS;
  }

  private findEnemySystem(participantId: string): EnemySystem | null {
    return this.enemySystems.find((es) => es.getSpawnId() === participantId) ?? null;
  }

  private syncEnemyCombatHp(participantId: string): void {
    const es = this.findEnemySystem(participantId);
    const participant = this.combatState?.participants.find((p) => p.id === participantId);
    if (es && participant) es.setCombatHp(participant.hp);
  }

  private handleForcedMovementVisual(pushed: {
    targetId: string;
    fromTile: { x: number; y: number };
    toTile: { x: number; y: number };
  }): void {
    if (!this.currentTilemap) return;

    const to = this.currentTilemap.getTileCenterWorld(pushed.toTile.x, pushed.toTile.y);
    if (pushed.targetId === 'player') {
      this.playerController?.setClickMoveTarget(to.x, to.y);
      return;
    }

    const es = this.findEnemySystem(pushed.targetId);
    if (!es) return;

    const from = this.currentTilemap.getTileCenterWorld(pushed.fromTile.x, pushed.fromTile.y);
    es.setCombatTile(pushed.toTile.x, pushed.toTile.y, false);
    this.animQueue.push({
      kind: 'move_tween',
      enemyId: pushed.targetId,
      fromWorld: from,
      toWorld: to,
      durationMs: getTileMoveDurationMs(pushed.fromTile, pushed.toTile),
    });
  }

  private handleTelegraphActorMoveVisual(moved: {
    targetId: string;
    fromTile: { x: number; y: number };
    toTile: { x: number; y: number };
  }): void {
    if (!this.currentTilemap) return;

    const es = this.findEnemySystem(moved.targetId);
    if (!es) return;

    const from = this.currentTilemap.getTileCenterWorld(moved.fromTile.x, moved.fromTile.y);
    const to = this.currentTilemap.getTileCenterWorld(moved.toTile.x, moved.toTile.y);
    es.setCombatTile(moved.toTile.x, moved.toTile.y, false);
    this.animQueue.push({
      kind: 'move_tween',
      enemyId: moved.targetId,
      fromWorld: from,
      toWorld: to,
      durationMs: 320,
      visualState: 'attacking',
    });
  }

  private queueEnemyMove(
    enemyId: string,
    fromTile: { x: number; y: number },
    path: { x: number; y: number }[],
  ): void {
    if (!this.currentTilemap) return;

    let previousTile = fromTile;
    for (const tile of path) {
      const fromWorld = this.currentTilemap.getTileCenterWorld(previousTile.x, previousTile.y);
      const toWorld = this.currentTilemap.getTileCenterWorld(tile.x, tile.y);
      this.animQueue.push({
        kind: 'move_tween',
        enemyId,
        fromWorld,
        toWorld,
        durationMs: ENEMY_MOVE_TWEEN_MS,
      });
      previousTile = tile;
    }
  }

  private handleStatusTickVisual(outcome: {
    targetId: string;
    effectKind: 'bleeding' | 'damage_over_time' | string;
    damage: number;
    killed: boolean;
  }, delayMs = 0): void {
    const label = outcome.effectKind === 'bleeding' ? 'Bleed' : 'Dot';
    const targetEs = this.findEnemySystem(outcome.targetId);
    if (targetEs) {
      this.syncEnemyCombatHp(outcome.targetId);
      const pos = targetEs.getWorldPosition();
      if (pos) this.hitsplatRenderer.show(pos.x, pos.y, outcome.damage, delayMs, label, '#fb7185');
      if (outcome.killed) targetEs.recordDeath(this.scene.time.now);
      return;
    }

    if (outcome.targetId === 'player') {
      const feet = this.playerController?.getFeetPoint();
      if (feet) this.hitsplatRenderer.show(feet.x, feet.y, outcome.damage, delayMs, label, '#fb7185');
      if (outcome.damage > 0) {
        this.playerController?.requestCombatVisualState('hurt', this.scene.time.now, 240);
      }
    }
  }

  private buildTileCtx(): TurnTileContext {
    const tilemap = this.currentTilemap;
    if (!tilemap) {
      return {
        isTileWalkable: () => false,
        mapWidth: 0,
        mapHeight: 0,
      };
    }
    return {
      isTileWalkable: (tx, ty) => tilemap.isTileWalkable(tx, ty),
      mapWidth:  tilemap.width,
      mapHeight: tilemap.height,
    };
  }

  destroy(): void {
    this.endCombatImmediately();
    this.previewRenderer.destroy();
    this.hitsplatRenderer.destroy();
    for (const es of this.enemySystems) es.destroy();
    this.enemySystems = [];
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function getTileMoveDurationMs(
  fromTile: { x: number; y: number },
  toTile: { x: number; y: number },
): number {
  const tileDistance = Math.max(Math.abs(toTile.x - fromTile.x), Math.abs(toTile.y - fromTile.y));
  return ENEMY_MOVE_TWEEN_MS * Math.max(1, tileDistance);
}

function buildPlayerTurnAttacks(stats: PlayerDerivedStats): TurnAttack[] {
  const minRangeTiles = getPlayerMinRangeTiles(stats);
  const maxRangeTiles = Math.max(minRangeTiles, Math.max(1, Math.ceil(stats.reachTiles)));
  const hitCount = stats.attackShape.kind === 'thrust' && stats.attackShape.doubleHit ? 2 : 1;
  const styles = getWeaponAttackStyles(stats.weaponArchetype);

  return styles.map((style) => ({
    id: `${stats.weaponArchetype}_${style.damageType}`,
    displayName: style.displayName,
    apCost: 1,
    minRangeTiles,
    maxRangeTiles: maxRangeTiles + style.rangeBonus,
    damage: Math.max(1, stats.attack + style.damageBonus),
    damageType: style.damageType,
    hitCount: style.damageType === stats.damageType ? hitCount : 1,
    oncePerTurn: true,
    hitChance: Math.max(10, stats.accuracy + style.accuracyBonus),
    staggerDamage: style.staggerDamage,
    statusEffect: style.statusEffect,
    forcedMovement: style.forcedMovement,
    cooldownTurns: 0,
  }));
}

function getPlayerMinRangeTiles(stats: PlayerDerivedStats): number {
  if (stats.attackShape.kind !== 'arc') return 0;
  return Math.max(0, Math.ceil(stats.attackShape.minRangeTiles ?? 0));
}

function getWeaponAttackStyles(archetype: PlayerDerivedStats['weaponArchetype']): Array<{
  damageType: TurnDamageType;
  displayName: string;
  accuracyBonus: number;
  damageBonus: number;
  rangeBonus: number;
  staggerDamage: number;
  statusEffect?: TurnAttack['statusEffect'];
  forcedMovement?: TurnAttack['forcedMovement'];
}> {
  switch (archetype) {
    case 'dagger':
      return [
        { damageType: 'pierce', displayName: 'Stab',  accuracyBonus: 8, damageBonus: 0, rangeBonus: 0, staggerDamage: 2 },
        { damageType: 'slash',  displayName: 'Slash', accuracyBonus: 0, damageBonus: 0, rangeBonus: 0, staggerDamage: 2 },
      ];
    case 'spear':
      return [
        {
          damageType: 'pierce',
          displayName: 'Stab',
          accuracyBonus: 5,
          damageBonus: 0,
          rangeBonus: 0,
          staggerDamage: 4,
          forcedMovement: { kind: 'push', distance: 1 },
        },
      ];
    case 'axe':
      return [
        { damageType: 'slash', displayName: 'Slash', accuracyBonus: 0,  damageBonus: 1, rangeBonus: 0, staggerDamage: 4 },
        {
          damageType: 'crush',
          displayName: 'Crush',
          accuracyBonus: -6,
          damageBonus: 2,
          rangeBonus: 0,
          staggerDamage: 5,
          statusEffect: { kind: 'slowed', turns: 2, value: 2 },
        },
      ];
    case 'hammer':
      return [
        {
          damageType: 'crush',
          displayName: 'Crush',
          accuracyBonus: -4,
          damageBonus: 2,
          rangeBonus: 0,
          staggerDamage: 7,
          forcedMovement: { kind: 'push', distance: 1 },
        },
      ];
    case 'sword':
    default:
      return [
        { damageType: 'slash',  displayName: 'Slash', accuracyBonus: 0, damageBonus: 0, rangeBonus: 0, staggerDamage: 3 },
        { damageType: 'pierce', displayName: 'Stab',  accuracyBonus: 3, damageBonus: 0, rangeBonus: 0, staggerDamage: 3 },
      ];
  }
}
