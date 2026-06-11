import Phaser from 'phaser';
import { EnemySystem } from '../EnemySystem';
import { HitsplatRenderer } from '../HitsplatRenderer';
import type { EnemySpawnDefinition } from '../EnemyTypes';
import type { IsoTilemap } from '../../world/IsoTilemap';
import type { PlayerController } from '../../player/PlayerController';
import type { PlayerFacingDirection } from '../../player/PlayerFacing';
import type { GameEventBus } from '../../events/GameEventBus';
import type { SkillXpDelta, LevelUpEvent } from '../../skills/SkillTypes';
import { levelToRankStage } from '../../skills/SkillTypes';
import type { PlayerDerivedStats } from '../../equipment/EquipmentTypes';
import { TurnActionPreviewRenderer } from './TurnActionPreviewRenderer';
import {
  applyAction,
  buildUiSnapshot,
  createCombatState,
  getActiveParticipant,
  resolvePendingTelegraphsForActor,
} from './TurnCombatEngine';
import { resolveEnemyTurnStep } from './TurnEnemyAi';
import { getCompanionDefinition } from '../../companions/CompanionRegistry';
import { CompanionVisualController } from '../../companions/CompanionVisualController';
import type { CompanionSlot, EquippedCompanionSlots } from '../../companions/CompanionTypes';
import type {
  ActionOutcome,
  CombatEndReason,
  TurnAttack,
  TurnAction,
  TurnCombatAbility,
  TurnCombatState,
  TurnCombatUiSnapshot,
  TurnParticipant,
  TurnAttackOutcome,
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
const AUTO_FLEE_DISTANCE = 8;
const PLAYER_BASE_MAGIC_RESOURCE_MAX = 4;
const PLAYER_BASE_DEVOTION_RESOURCE_MAX = 4;

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
  private pendingMoveReactions: TurnAttackOutcome[] = [];
  private pendingCombatEndReason: CombatEndReason | null = null;

  /** Persistent player HP across combats. Null until first combat entry. */
  private persistedPlayerHp: number | null = null;
  private persistedPlayerMaxHp: number | null = null;
  private persistedMagicResource: number | null = null;
  private persistedDevotionResource: number | null = null;
  private magicResourceMax = PLAYER_BASE_MAGIC_RESOURCE_MAX;
  private devotionResourceMax = PLAYER_BASE_DEVOTION_RESOURCE_MAX;
  private lastPlayerHpRegenMs = 0;
  private _isSprinting = false;
  /** Whether the player has activated "pick a target" attack mode. */
  private _isAttackMode = false;
  private selectedPlayerAttackId: string | null = null;
  private selectedPlayerAbilityId: string | null = null;
  private equippedTurnAbilities: TurnCombatAbility[] = [];
  private equippedCompanions: EquippedCompanionSlots = {};
  private companionVisuals: Map<string, CompanionVisualController> = new Map();

  private readonly previewRenderer: TurnActionPreviewRenderer;
  private readonly hitsplatRenderer: HitsplatRenderer;

  private onConsumeItemCallback: ((itemId: string) => boolean) | null = null;

  // Callbacks
  private onCombatEnd?: (event: CombatEndEvent) => void;
  private onCombatXp?: (delta: SkillXpDelta) => LevelUpEvent[];
  private onEnemyKilledForLoot?: (spawnId: string, areaId: string | undefined, lootTableId: string | undefined, worldX: number, worldY: number) => void;
  private onCombatLog?: (line: string) => void;

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

  getEnemyTiles(): Array<{ tileX: number; tileY: number }> {
    return this.enemySystems.flatMap((es) => {
      if (!es.isAlive()) return [];
      const t = es.getCurrentTile();
      return t ? [{ tileX: t.x, tileY: t.y }] : [];
    });
  }

  setDerivedStats(stats: PlayerDerivedStats): void {
    this.derivedStats = stats;
    this.persistedPlayerMaxHp = stats.maxHp;
    if (this.persistedPlayerHp === null) this.persistedPlayerHp = stats.maxHp;
    else this.persistedPlayerHp = Math.min(this.persistedPlayerHp, stats.maxHp);
    if (this.persistedMagicResource === null) this.persistedMagicResource = this.magicResourceMax;
    else this.persistedMagicResource = Math.min(this.persistedMagicResource, this.magicResourceMax);
    if (this.persistedDevotionResource === null) this.persistedDevotionResource = this.devotionResourceMax;
    else this.persistedDevotionResource = Math.min(this.persistedDevotionResource, this.devotionResourceMax);
  }

  setCombatSkillLevels(levels: { magic: number; devotion: number }): void {
    this.magicResourceMax = getPersistentResourceMax(levels.magic, PLAYER_BASE_MAGIC_RESOURCE_MAX);
    this.devotionResourceMax = getPersistentResourceMax(levels.devotion, PLAYER_BASE_DEVOTION_RESOURCE_MAX);
    if (this.persistedMagicResource === null) this.persistedMagicResource = this.magicResourceMax;
    else this.persistedMagicResource = Math.min(this.persistedMagicResource, this.magicResourceMax);
    if (this.persistedDevotionResource === null) this.persistedDevotionResource = this.devotionResourceMax;
    else this.persistedDevotionResource = Math.min(this.persistedDevotionResource, this.devotionResourceMax);
  }

  /** Call after the player respawns so HP is reset to full. */
  resetPlayerHp(): void {
    const maxHp = this.derivedStats?.maxHp ?? null;
    this.persistedPlayerHp = maxHp;
    this.persistedPlayerMaxHp = maxHp;
    this.persistedMagicResource = this.magicResourceMax;
    this.persistedDevotionResource = this.devotionResourceMax;
  }

  setEquippedCompanions(slots: EquippedCompanionSlots): void {
    this.equippedCompanions = slots;
  }

  setEquippedTurnAbilities(abilities: TurnCombatAbility[]): void {
    this.equippedTurnAbilities = abilities.map((ability) => ({ ...ability }));
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

  onLog(cb: (line: string) => void): void {
    this.onCombatLog = cb;
  }

  setConsumeCallback(cb: (itemId: string) => boolean): void {
    this.onConsumeItemCallback = cb;
  }

  /** Restore HP outside of combat (eating/drinking in explore mode). */
  applyHpHeal(amount: number): void {
    if (this.persistedPlayerHp === null || this.persistedPlayerMaxHp === null) return;
    this.persistedPlayerHp = Math.min(this.persistedPlayerMaxHp, this.persistedPlayerHp + amount);
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

    // Update previews every frame — must reflect attack-mode selection immediately,
    // even while the anim queue is draining (e.g. post-enemy-turn delay).
    this.previewRenderer.update(
      this.combatState,
      this.buildTileCtx(),
      this._isAttackMode,
      this.selectedPlayerAttackId,
      this.selectedPlayerAbilityId,
    );

    // Process animation queue first — block all logic until animations settle
    if (this.animQueue.length > 0) {
      this.processAnimQueue(nowMs);
      return;
    }
    this.blockedByAnim = false;

    const activeDuringPlayerPhase = this.combatState.phase === 'player_turn'
      ? getActiveParticipant(this.combatState)
      : null;
    if (activeDuringPlayerPhase?.kind === 'player' && this.isPlayerMovementAnimating()) {
      return;
    }

    if (this.pendingMoveReactions.length > 0) {
      this.processPendingMoveReactions();
      return;
    }

    if (this.pendingCombatEndReason) {
      const reason = this.pendingCombatEndReason;
      this.pendingCombatEndReason = null;
      this.finalizeCombat(reason);
      return;
    }

    // Auto-flee when all enemies are far enough away
    if (this.combatState.phase === 'player_turn' && this.animQueue.length === 0 && !this.blockedByAnim) {
      const playerP = this.combatState.participants.find((p) => p.id === 'player');
      const livingEnemies = this.combatState.participants.filter((p) => p.kind === 'enemy' && p.hp > 0);
      if (playerP && livingEnemies.length > 0) {
        const allFar = livingEnemies.every(
          (e) => Math.max(Math.abs(e.tileX - playerP.tileX), Math.abs(e.tileY - playerP.tileY)) >= AUTO_FLEE_DISTANCE,
        );
        if (allFar) {
          this.submitPlayerAction({ kind: 'flee' });
          return;
        }
      }
    }

    // Auto-advance turn when the active unit (player or companion) has exhausted all actions
    if (this.combatState.phase === 'player_turn') {
      const active = getActiveParticipant(this.combatState);
      if (active && (active.kind === 'player' || active.kind === 'companion')) {
        const resolved = resolvePendingTelegraphsForActor(this.combatState, active.id, this.buildTileCtx());
        if (resolved.outcomes.length > 0) {
          this.combatState = resolved.state;
          for (const outcome of resolved.outcomes) {
            this.handleOutcome(outcome);
            if (outcome.kind === 'combat_ended' || outcome.kind === 'fled') break;
          }
          if (this.combatState?.phase === 'combat_ended' && this.combatState.endReason) {
            this.deferOrFinalizeCombat(this.combatState.endReason);
          }
          return;
        }
      }

      if (
        (active?.kind === 'player' || active?.kind === 'companion') &&
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
    this.selectedPlayerAbilityId = null;
    return this.submitPlayerAction({ kind: 'attack', targetId, attackId });
  }

  tryPlayerEndTurn(): void {
    if (!this.canAcceptPlayerInput()) return;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.selectedPlayerAbilityId = null;
    this.submitPlayerAction({ kind: 'end_turn' });
  }

  tryPlayerFlee(): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.selectedPlayerAbilityId = null;
    return this.submitPlayerAction({ kind: 'flee' });
  }

  tryPlayerGuard(): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.selectedPlayerAbilityId = null;
    return this.submitPlayerAction({ kind: 'guard' });
  }

  tryPlayerCleanse(): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.selectedPlayerAbilityId = null;
    return this.submitPlayerAction({ kind: 'cleanse' });
  }

  tryPlayerConsumeItem(itemId: string, healAmount: number): ActionOutcome | null {
    if (!this.canAcceptPlayerInput()) return null;
    const consumed = this.onConsumeItemCallback?.(itemId) ?? false;
    if (!consumed) return null;
    return this.submitPlayerAction({ kind: 'consume_item', itemId, healAmount });
  }

  trySpendPlayerMainAction(reason = 'Equip item'): { ok: true } | { ok: false; reason: string } {
    if (!this.canAcceptPlayerInput() || !this.combatState) {
      return { ok: false, reason: 'You can only do that on your turn.' };
    }
    const active = getActiveParticipant(this.combatState);
    if (!active || active.kind !== 'player') {
      return { ok: false, reason: 'Only the player can equip items.' };
    }
    if (active.apRemaining <= 0) {
      return { ok: false, reason: `${reason} needs a Main Action.` };
    }

    this.combatState = {
      ...this.combatState,
      participants: this.combatState.participants.map((participant) =>
        participant.id === active.id
          ? { ...participant, apRemaining: Math.max(0, participant.apRemaining - 1) }
          : participant,
      ),
    };
    this.emitCombatLog(`${active.name} spends a Main Action: ${reason}.`);
    return { ok: true };
  }

  /** Select which attack to use next. Clicking the same button again keeps it selected. */
  toggleAttackMode(attackId?: string): void {
    if (!this.canAcceptPlayerInput()) return;
    this._isAttackMode = true;
    this.selectedPlayerAttackId = attackId ?? null;
    this.selectedPlayerAbilityId = null;
  }

  selectMoveMode(): void {
    if (!this.canAcceptPlayerInput()) return;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.selectedPlayerAbilityId = null;
  }

  activateAbility(abilityId: string): ActionOutcome | null {
    if (!this.canAcceptPlayerInput() || !this.combatState) return null;

    const active = getActiveParticipant(this.combatState);
    const ability = active?.abilities?.find((entry) => entry.id === abilityId);
    if (!active || !ability) return null;

    this.selectedPlayerAttackId = null;

    if (ability.target === 'self') {
      this._isAttackMode = false;
      this.selectedPlayerAbilityId = null;
      return this.submitPlayerAction({ kind: 'use_ability', abilityId });
    }

    this._isAttackMode = true;
    this.selectedPlayerAbilityId = abilityId;
    return null;
  }

  /**
   * Click a tile in combat.
   * Clicking an enemy always resolves the currently selected attack (or the default).
   * If out of range, auto-moves toward the enemy instead.
   * Clicking an empty tile moves the player.
   */
  handleTileClick(tileX: number, tileY: number): ActionOutcome | null {
    if (!this.canAcceptPlayerInput() || !this.combatState) return null;

    const targetParticipant = this.combatState.participants.find(
      (p) => p.kind === 'enemy' && p.hp > 0 && p.tileX === tileX && p.tileY === tileY,
    );

    if (targetParticipant) {
      const savedMode = this._isAttackMode;
      const savedId   = this.selectedPlayerAttackId;
      const savedAbilityId = this.selectedPlayerAbilityId;
      if (savedMode && savedAbilityId) {
        const abilityResult = this.submitPlayerAction({
          kind: 'use_ability',
          abilityId: savedAbilityId,
          targetId: targetParticipant.id,
        });
        if (abilityResult?.kind !== 'invalid') {
          this._isAttackMode = false;
          this.selectedPlayerAbilityId = null;
          return abilityResult;
        }
        this._isAttackMode = savedMode;
        this.selectedPlayerAbilityId = savedAbilityId;
        return abilityResult;
      }

      const attackId  = savedMode ? (savedId ?? undefined) : undefined;
      const attackResult = this.tryPlayerAttack(targetParticipant.id, attackId);
      if (attackResult?.kind !== 'invalid') {
        return attackResult;
      }
      // Attack invalid (out of range / on cooldown) — restore selection and move closer
      this._isAttackMode = savedMode;
      this.selectedPlayerAttackId = savedId;
      this.selectedPlayerAbilityId = savedAbilityId;
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

    // Empty tile: just move. Attack selection persists so the player can position
    // then click the enemy without re-selecting the attack.
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
      playerMagicResourceCurrent: base.playerMagicResourceCurrent ?? this.persistedMagicResource,
      playerMagicResourceMax: base.playerMagicResourceMax ?? this.magicResourceMax,
      playerDevotionResourceCurrent: base.playerDevotionResourceCurrent ?? this.persistedDevotionResource,
      playerDevotionResourceMax: base.playerDevotionResourceMax ?? this.devotionResourceMax,
      isSprinting: this._isSprinting,
      isAttackMode: this._isAttackMode,
      selectedAttackId: this.selectedPlayerAttackId,
      selectedAbilityId: this.selectedPlayerAbilityId,
    };
  }

  getMovementRangeTiles(): { x: number; y: number }[] {
    if (!this.combatState || this.combatState.phase !== 'player_turn') return [];
    const active = getActiveParticipant(this.combatState);
    if (!active || (active.kind !== 'player' && active.kind !== 'companion')) return [];
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
    if (this.persistedMagicResource === null) this.persistedMagicResource = this.magicResourceMax;
    if (this.persistedDevotionResource === null) this.persistedDevotionResource = this.devotionResourceMax;
    const playerAttacks = buildPlayerTurnAttacks(this.derivedStats);
    const playerAbilities = this.equippedTurnAbilities.map((ability) => ({ ...ability }));
    const playerFacing = playerFacingToTurnVector(
      this.playerController?.getFacingDirection() ?? 'down',
    );

    const playerParticipant: TurnParticipant = {
      id:              'player',
      kind:            'player',
      name:            'You',
      tileX:           playerTileX,
      tileY:           playerTileY,
      facingX:         playerFacing.facingX,
      facingY:         playerFacing.facingY,
      hp:              this.persistedPlayerHp,
      maxHp:           maxHp,
      apMax:           PLAYER_MAIN_ACTIONS_PER_TURN,
      mpMax:           PLAYER_MOVE_POINTS_PER_TURN,
      apRemaining:     PLAYER_MAIN_ACTIONS_PER_TURN,
      secondaryActionMax: PLAYER_SECONDARY_ACTIONS_PER_TURN,
      secondaryActionRemaining: PLAYER_SECONDARY_ACTIONS_PER_TURN,
      mpRemaining:     PLAYER_MOVE_POINTS_PER_TURN,
      magicResourceMax: this.magicResourceMax,
      magicResourceRemaining: this.persistedMagicResource ?? this.magicResourceMax,
      devotionResourceMax: this.devotionResourceMax,
      devotionResourceRemaining: this.persistedDevotionResource ?? this.devotionResourceMax,
      reactionRemaining: 1,
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
      abilities:       playerAbilities,
      abilityCooldowns: {},
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
        const facing = getTurnFacingFromDelta(playerTileX - record.tileX, playerTileY - record.tileY);
        return {
          id:              record.id,
          kind:            'enemy' as const,
          name:            def.displayName,
          tileX:           record.tileX,
          tileY:           record.tileY,
          facingX:         facing.facingX,
          facingY:         facing.facingY,
          hp:              record.hp,
          maxHp:           record.maxHp,
          apMax:           def.apPerTurn,
          mpMax:           def.mpPerTurn,
          apRemaining:     def.apPerTurn,
          mpRemaining:     def.mpPerTurn,
          magicResourceMax: 0,
          magicResourceRemaining: 0,
          devotionResourceMax: 0,
          devotionResourceRemaining: 0,
          reactionRemaining: 1,
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

    const companionParticipants = this.buildCompanionParticipants(
      playerTileX, playerTileY, enemyParticipants,
    );

    this.combatState = createCombatState([
      playerParticipant,
      ...companionParticipants,
      ...enemyParticipants,
    ]);

    // Spawn a sprite for each companion at their starting tile
    for (const p of companionParticipants) {
      if (!this.currentTilemap) continue;
      const slotData = this.equippedCompanions[p.companionSlot!];
      if (!slotData) continue;
      const world = this.currentTilemap.getTileCenterWorld(p.tileX, p.tileY);
      const vc = new CompanionVisualController(this.scene, slotData.definitionId);
      vc.spawn(world.x, world.y);
      vc.update(world.x, world.y, p.hp, p.maxHp, this.scene.time.now);
      this.companionVisuals.set(p.id, vc);
    }

    this.eventBus.emitSfx('combat_hit');
  }

  private buildCompanionParticipants(
    playerTileX: number,
    playerTileY: number,
    enemyParticipants: TurnParticipant[],
  ): TurnParticipant[] {
    const occupied = new Set<string>(
      enemyParticipants.map((p) => `${p.tileX},${p.tileY}`),
    );
    occupied.add(`${playerTileX},${playerTileY}`);

    // Preferred spawn offsets per slot (beside and behind the player)
    const SLOT_OFFSETS: [number, number][][] = [
      [[-1, 0], [0, 1], [-1, 1], [1, 0], [-1, -1]],
      [[1, 0], [0, 1], [1, 1], [-1, 0], [1, -1]],
      [[0, 1], [-1, 1], [1, 1], [0, 2], [-1, 0]],
    ];

    const slotKeys: CompanionSlot[] = ['companion_1', 'companion_2', 'companion_3'];
    const result: TurnParticipant[] = [];

    for (let i = 0; i < slotKeys.length; i++) {
      const slotKey = slotKeys[i];
      const slotData = this.equippedCompanions[slotKey];
      if (!slotData || slotData.durability <= 0) continue;

      const def = getCompanionDefinition(slotData.definitionId);
      if (!def) continue;

      let spawnTile: { x: number; y: number } | null = null;
      for (const [dx, dy] of SLOT_OFFSETS[i]) {
        const tx = playerTileX + dx;
        const ty = playerTileY + dy;
        const key = `${tx},${ty}`;
        if (!occupied.has(key)) {
          spawnTile = { x: tx, y: ty };
          occupied.add(key);
          break;
        }
      }
      if (!spawnTile) continue;
      const facing = getFacingTowardNearestEnemy(spawnTile, enemyParticipants);

      result.push({
        id: slotKey,
        kind: 'companion',
        name: def.displayName,
        tileX: spawnTile.x,
        tileY: spawnTile.y,
        facingX: facing.facingX,
        facingY: facing.facingY,
        hp: def.maxHp,
        maxHp: def.maxHp,
        apMax: def.apPerTurn,
        mpMax: def.mpPerTurn,
        apRemaining: def.apPerTurn,
        mpRemaining: def.mpPerTurn,
        magicResourceMax: 0,
        magicResourceRemaining: 0,
        devotionResourceMax: 0,
        devotionResourceRemaining: 0,
        reactionRemaining: 1,
        initiative: def.initiative,
        attackPower: def.attackPower,
        defensePower: def.defensePower,
        attackRangeTiles: def.attackRangeTiles,
        attacks: def.attacks.map((a) => ({ ...a })),
        attackCooldowns: {},
        stagger: 0,
        staggerThreshold: def.staggerThreshold,
        companionSlot: slotKey,
        statusEffects: [],
      });
    }

    return result;
  }

  // ─── Private: action submission ───────────────────────────────────────────

  private submitPlayerAction(action: TurnAction): ActionOutcome | null {
    if (!this.combatState) return null;

    const { outcome, state: next } = applyAction(this.combatState, action, this.buildTileCtx());
    this.combatState = next;
    this.handleOutcome(outcome);
    if (next.phase === 'combat_ended' && next.endReason) {
      this.deferOrFinalizeCombat(next.endReason);
    }
    return outcome;
  }

  private emitCombatLog(line: string): void {
    this.onCombatLog?.(line);
  }

  private logOutcome(outcome: ActionOutcome): void {
    switch (outcome.kind) {
      case 'attacked': {
        const actor = this.getParticipantName(outcome.actorId);
        const target = this.getParticipantName(outcome.targetId);
        const suffix = outcome.killed ? ' Defeated.' : '';
        const prefix = outcome.reaction ? 'Reaction: ' : '';
        const context = formatHitContext(outcome.hitChance, outcome.positionalModifier);
        this.emitCombatLog(outcome.hit
          ? `${prefix}${actor} uses ${outcome.attackName} on ${target} for ${outcome.damage} damage${context}.${suffix}`
          : `${prefix}${actor} uses ${outcome.attackName} on ${target}, but misses${context}.`);
        break;
      }
      case 'ability_used': {
        const actor = this.getParticipantName(outcome.actorId);
        const target = this.getParticipantName(outcome.targetId);
        if ((outcome.damage ?? 0) > 0) {
          const suffix = outcome.killed ? ' Defeated.' : '';
          const context = formatHitContext(outcome.hitChance, outcome.positionalModifier);
          this.emitCombatLog(`${actor} casts ${outcome.abilityName} on ${target} for ${outcome.damage} damage${context}.${suffix}`);
        } else if ((outcome.healAmount ?? 0) > 0) {
          this.emitCombatLog(`${actor} uses ${outcome.abilityName} and restores ${outcome.healAmount} HP.`);
        } else if (outcome.statusApplied) {
          this.emitCombatLog(`${actor} uses ${outcome.abilityName}.`);
        }
        break;
      }
      case 'telegraph_prepared':
        this.emitCombatLog(`${this.getParticipantName(outcome.actorId)} prepares ${outcome.attackName}.`);
        break;
      case 'telegraph_resolved': {
        const actor = this.getParticipantName(outcome.actorId);
        const target = this.getParticipantName(outcome.targetId);
        if (!outcome.targetWasInArea) {
          this.emitCombatLog(`${target} avoids ${actor}'s ${outcome.attackName}.`);
        } else if (outcome.hit) {
          const suffix = outcome.killed ? ' Defeated.' : '';
          const context = formatHitContext(outcome.hitChance, outcome.positionalModifier);
          this.emitCombatLog(`${actor}'s ${outcome.attackName} hits ${target} for ${outcome.damage} damage${context}.${suffix}`);
        } else {
          const context = formatHitContext(outcome.hitChance, outcome.positionalModifier);
          this.emitCombatLog(`${actor}'s ${outcome.attackName} misses ${target}${context}.`);
        }
        break;
      }
      case 'status_tick':
        if (outcome.damage > 0) {
          const suffix = outcome.killed ? ' Defeated.' : '';
          this.emitCombatLog(`${this.getParticipantName(outcome.targetId)} takes ${outcome.damage} ${outcome.effectKind} damage.${suffix}`);
        }
        break;
      case 'guarded':
        this.emitCombatLog(`${this.getParticipantName(outcome.actorId)} guards.`);
        break;
      case 'cleansed':
        this.emitCombatLog(`${this.getParticipantName(outcome.actorId)} cleanses ${outcome.removedEffect.kind}.`);
        break;
      case 'item_consumed':
        this.emitCombatLog(`${this.getParticipantName(outcome.actorId)} consumes an item and restores ${outcome.healAmount} HP.`);
        break;
      case 'fled':
        this.emitCombatLog(`${this.getParticipantName(outcome.actorId)} flees combat.`);
        break;
      case 'combat_ended':
        this.emitCombatLog(outcome.reason === 'victory' ? 'Combat won.' : 'Combat ended.');
        break;
    }
  }

  private getParticipantName(participantId: string): string {
    const participant = this.combatState?.participants.find((p) => p.id === participantId);
    if (participant?.id === 'player') return 'You';
    return participant?.name ?? participantId;
  }

  private handleOutcome(outcome: ActionOutcome): void {
    this.logOutcome(outcome);

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
        } else {
          // Companion was hit
          const companionVc = this.companionVisuals.get(outcome.targetId);
          if (companionVc && this.currentTilemap) {
            const p = this.combatState?.participants.find((pp) => pp.id === outcome.targetId);
            if (p) {
              const world = this.currentTilemap.getTileCenterWorld(p.tileX, p.tileY);
              if (outcome.hit) companionVc.flashHit(this.scene.time.now);
              this.hitsplatRenderer.show(world.x, world.y, outcome.damage);
              companionVc.update(world.x, world.y, p.hp, p.maxHp, this.scene.time.now);
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
          // Hide companion sprite when it's killed
          const killedVc = this.companionVisuals.get(outcome.targetId);
          if (killedVc) killedVc.destroy();
          this.companionVisuals.delete(outcome.targetId);
        }
        if (outcome.pushed) this.handleForcedMovementVisual(outcome.pushed);
        break;
      }

      case 'ability_used': {
        const targetEs = this.findEnemySystem(outcome.targetId);
        if (targetEs) {
          this.syncEnemyCombatHp(outcome.targetId);
          const pos = targetEs.getWorldPosition();
          if (pos) this.hitsplatRenderer.show(pos.x, pos.y, outcome.damage ?? 0);
          if (outcome.hit) targetEs.flashHit(this.scene.time.now);
        } else if (outcome.targetId === 'player') {
          const feet = this.playerController?.getFeetPoint();
          if (feet) {
            if ((outcome.healAmount ?? 0) > 0) {
              this.hitsplatRenderer.show(feet.x, feet.y, outcome.healAmount ?? 0, 0, '+HP', '#86efac');
            } else if (outcome.statusApplied) {
              this.hitsplatRenderer.show(feet.x, feet.y, 0, 0, outcome.abilityName, '#a0c4ff');
            }
          }
        } else {
          const companionVc = this.companionVisuals.get(outcome.targetId);
          const p = this.combatState?.participants.find((pp) => pp.id === outcome.targetId);
          if (companionVc && p && this.currentTilemap) {
            const world = this.currentTilemap.getTileCenterWorld(p.tileX, p.tileY);
            companionVc.update(world.x, world.y, p.hp, p.maxHp, this.scene.time.now);
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
        if (outcome.actorId === 'player') {
          const xpAmount = Math.max(
            4,
            ((outcome.damage ?? 0) + (outcome.healAmount ?? 0)) * 4,
          );
          if (outcome.abilityKind === 'combat_spell') {
            this.onCombatXp?.({ magic: xpAmount });
          } else {
            this.onCombatXp?.({ devotion: xpAmount });
          }
        }
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
          const companionVc = this.companionVisuals.get(outcome.actorId);
          if (companionVc && this.currentTilemap) {
            const world = this.currentTilemap.getTileCenterWorld(outcome.toTile.x, outcome.toTile.y);
            const p = this.combatState?.participants.find((pp) => pp.id === outcome.actorId);
            companionVc.update(world.x, world.y, p?.hp ?? 0, p?.maxHp ?? 1, this.scene.time.now);
          } else {
            const es = this.findEnemySystem(outcome.actorId);
            if (es && this.currentTilemap) {
              es.setCombatTile(outcome.toTile.x, outcome.toTile.y, false);
              this.queueEnemyMove(outcome.actorId, outcome.fromTile, outcome.path ?? [outcome.toTile]);
              this.animQueue.push({ kind: 'delay', durationMs: ENEMY_TURN_DELAY_MS });
            }
          }
        }
        const reactions = outcome.reactions ?? [];
        if (reactions.length > 0) {
          this.pendingMoveReactions.push(...reactions);
          this.animQueue.push({ kind: 'delay', durationMs: 260 });
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

      case 'item_consumed':
        if (outcome.actorId === 'player' && outcome.healAmount > 0) {
          const feet = this.playerController?.getFeetPoint();
          if (feet) this.hitsplatRenderer.show(feet.x, feet.y, outcome.healAmount, 0, '+HP', '#86efac');
          if (this.combatState) {
            this.persistedPlayerHp = outcome.newHp;
          }
        }
        break;

      case 'turn_ended':
        for (const tick of outcome.statusTicks ?? []) this.handleStatusTickVisual(tick, 360);
        break;

      case 'combat_ended':
        for (const tick of outcome.statusTicks ?? []) this.handleStatusTickVisual(tick, 360);
        this.deferOrFinalizeCombat(outcome.reason);
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
    this.previewRenderer.update(
      this.combatState,
      this.buildTileCtx(),
      this._isAttackMode,
      this.selectedPlayerAttackId,
      this.selectedPlayerAbilityId,
    );

    if (this.combatState?.phase === 'combat_ended' && this.combatState.endReason) {
      this.deferOrFinalizeCombat(this.combatState.endReason);
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

  private processPendingMoveReactions(): void {
    const reactions = this.pendingMoveReactions.splice(0);
    for (const reaction of reactions) {
      this.handleOutcome(reaction);
    }
    if (this.pendingCombatEndReason && this.animQueue.length === 0 && !this.isPlayerMovementAnimating()) {
      const reason = this.pendingCombatEndReason;
      this.pendingCombatEndReason = null;
      this.finalizeCombat(reason);
    }
  }

  private deferOrFinalizeCombat(reason: CombatEndReason): void {
    if (this.animQueue.length > 0 || this.pendingMoveReactions.length > 0 || this.isPlayerMovementAnimating()) {
      this.pendingCombatEndReason = reason;
      return;
    }
    this.finalizeCombat(reason);
  }

  // ─── Private: combat end ──────────────────────────────────────────────────

  private finalizeCombat(reason: CombatEndReason): void {
    const killedIds: string[] = [];

    const playerP = this.combatState?.participants.find((p) => p.id === 'player');
    if (playerP) {
      this.persistedPlayerHp = reason === 'player_died' ? 0 : playerP.hp;
      this.persistedMagicResource = playerP.magicResourceRemaining ?? this.persistedMagicResource;
      this.persistedDevotionResource = playerP.devotionResourceRemaining ?? this.persistedDevotionResource;
    }

    for (const es of this.enemySystems) {
      if (es.inCombat) {
        es.setInCombat(false);
        if (!es.isAlive()) killedIds.push(es.getSpawnId() ?? '');
      }
    }

    // Drain companion durability: 1 per fight participated + flat penalty if knocked out
    if (this.combatState) {
      for (const p of this.combatState.participants) {
        if (p.kind !== 'companion' || !p.companionSlot) continue;
        const slotData = this.equippedCompanions[p.companionSlot];
        if (!slotData) continue;
        const knockedOut = p.hp <= 0;
        const drain = 1 + (knockedOut ? 2 : 0); // 1 per fight, +2 if knocked out
        slotData.durability = Math.max(0, slotData.durability - drain);
      }
    }

    for (const vc of this.companionVisuals.values()) vc.destroy();
    this.companionVisuals.clear();

    this.combatState   = null;
    this.animQueue     = [];
    this.blockedByAnim = false;
    this.pendingMoveReactions = [];
    this.pendingCombatEndReason = null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.selectedPlayerAbilityId = null;
    this.previewRenderer.clear();
    this.onCombatEnd?.({ reason, killedSpawnIds: killedIds.filter(Boolean) });
  }

  private endCombatImmediately(): void {
    if (this.combatState) this.finalizeCombat('player_fled');
    this.combatState   = null;
    this.animQueue     = [];
    this.blockedByAnim = false;
    this.pendingMoveReactions = [];
    this.pendingCombatEndReason = null;
    this._isAttackMode = false;
    this.selectedPlayerAttackId = null;
    this.selectedPlayerAbilityId = null;
  }

  // ─── Private: helpers ─────────────────────────────────────────────────────

  private canAcceptPlayerInput(): boolean {
    if (!this.combatState || this.combatState.phase !== 'player_turn') return false;
    if (this.blockedByAnim || this.animQueue.length > 0) return false;
    // Only wait for player walk animation during the player's own turn, not companion turns
    const active = getActiveParticipant(this.combatState);
    if (active?.kind === 'player' && this.isPlayerMovementAnimating()) return false;
    return true;
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
    if (!es || !participant) return;
    es.setCombatHp(participant.hp);
    const pos = es.getWorldPosition();
    if (pos) es.applyVisualUpdate(pos.x, pos.y, false, participant.hp, 'idle', this.scene.time.now);
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

    const companionVc = this.companionVisuals.get(pushed.targetId);
    if (companionVc) {
      const p = this.combatState?.participants.find((pp) => pp.id === pushed.targetId);
      companionVc.update(to.x, to.y, p?.hp ?? 0, p?.maxHp ?? 1, this.scene.time.now);
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

    const companionVc = this.companionVisuals.get(moved.targetId);
    if (companionVc) {
      const to = this.currentTilemap.getTileCenterWorld(moved.toTile.x, moved.toTile.y);
      const p = this.combatState?.participants.find((pp) => pp.id === moved.targetId);
      companionVc.update(to.x, to.y, p?.hp ?? 0, p?.maxHp ?? 1, this.scene.time.now);
      return;
    }

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
  const style = getWeaponPrimaryStyle(stats.weaponArchetype);

  const basicAttack: TurnAttack = {
    id: `${stats.weaponArchetype}_${style.damageType}`,
    displayName: style.displayName,
    apCost: 1,
    minRangeTiles,
    maxRangeTiles: maxRangeTiles + style.rangeBonus,
    damage: Math.max(1, stats.attack + style.damageBonus),
    damageType: style.damageType,
    hitCount: hitCount,
    oncePerTurn: true,
    hitChance: Math.max(10, stats.accuracy + style.accuracyBonus),
    staggerDamage: style.staggerDamage,
    statusEffect: style.statusEffect,
    forcedMovement: style.forcedMovement,
    cooldownTurns: 0,
  };

  const heavyHit: TurnAttack = {
    id: `${stats.weaponArchetype}_special`,
    displayName: 'Heavy Hit',
    apCost: 1,
    minRangeTiles,
    maxRangeTiles,
    damage: Math.max(2, Math.round(stats.attack * 2)),
    damageType: style.damageType,
    hitChance: Math.max(10, stats.accuracy - 15),
    staggerDamage: (style.staggerDamage ?? 0) + 4,
    cooldownTurns: 1,
  };

  return [basicAttack, heavyHit];
}

function getPlayerMinRangeTiles(stats: PlayerDerivedStats): number {
  if (stats.attackShape.kind !== 'arc') return 0;
  return Math.max(0, Math.ceil(stats.attackShape.minRangeTiles ?? 0));
}

type WeaponStyle = {
  damageType: TurnDamageType;
  displayName: string;
  accuracyBonus: number;
  damageBonus: number;
  rangeBonus: number;
  staggerDamage: number;
  statusEffect?: TurnAttack['statusEffect'];
  forcedMovement?: TurnAttack['forcedMovement'];
};

function getWeaponPrimaryStyle(archetype: PlayerDerivedStats['weaponArchetype']): WeaponStyle {
  switch (archetype) {
    case 'fists':
      return { damageType: 'crush',  displayName: 'Punch', accuracyBonus: 0,  damageBonus: 0, rangeBonus: 0, staggerDamage: 1 };
    case 'dagger':
      return { damageType: 'pierce', displayName: 'Stab',  accuracyBonus: 8,  damageBonus: 0, rangeBonus: 0, staggerDamage: 2 };
    case 'spear':
      return { damageType: 'pierce', displayName: 'Stab',  accuracyBonus: 5,  damageBonus: 0, rangeBonus: 0, staggerDamage: 4, forcedMovement: { kind: 'push', distance: 1 } };
    case 'axe':
      return { damageType: 'slash',  displayName: 'Slash', accuracyBonus: 0,  damageBonus: 1, rangeBonus: 0, staggerDamage: 4 };
    case 'hammer':
      return { damageType: 'crush',  displayName: 'Crush', accuracyBonus: -4, damageBonus: 2, rangeBonus: 0, staggerDamage: 7, forcedMovement: { kind: 'push', distance: 1 } };
    case 'sword':
    default:
      return { damageType: 'slash',  displayName: 'Slash', accuracyBonus: 0,  damageBonus: 0, rangeBonus: 0, staggerDamage: 3 };
  }
}

function playerFacingToTurnVector(facing: PlayerFacingDirection): Pick<TurnParticipant, 'facingX' | 'facingY'> {
  switch (facing) {
    case 'up': return { facingX: 0, facingY: -1 };
    case 'down': return { facingX: 0, facingY: 1 };
    case 'left': return { facingX: -1, facingY: 0 };
    case 'right': return { facingX: 1, facingY: 0 };
  }
}

function getFacingTowardNearestEnemy(
  fromTile: { x: number; y: number },
  enemies: TurnParticipant[],
): Pick<TurnParticipant, 'facingX' | 'facingY'> {
  let nearest: TurnParticipant | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const dist = Math.max(Math.abs(enemy.tileX - fromTile.x), Math.abs(enemy.tileY - fromTile.y));
    if (dist < nearestDist) {
      nearest = enemy;
      nearestDist = dist;
    }
  }
  if (!nearest) return { facingX: 0, facingY: 1 };
  return getTurnFacingFromDelta(nearest.tileX - fromTile.x, nearest.tileY - fromTile.y);
}

function getTurnFacingFromDelta(dx: number, dy: number): Pick<TurnParticipant, 'facingX' | 'facingY'> {
  return {
    facingX: dx < 0 ? -1 : dx > 0 ? 1 : 0,
    facingY: dy < 0 ? -1 : dy > 0 ? 1 : 0,
  };
}

function formatHitContext(hitChance: number | undefined, positionalModifier: number | undefined): string {
  const parts: string[] = [];
  if (hitChance !== undefined) parts.push(`${hitChance}%`);
  if (positionalModifier && positionalModifier !== 0) {
    parts.push(`${positionalModifier > 0 ? '+' : ''}${positionalModifier} position`);
  }
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function getPersistentResourceMax(skillLevel: number, baseMax: number): number {
  const rank = levelToRankStage(skillLevel).rank;
  return baseMax + Math.max(0, rank - 1);
}
