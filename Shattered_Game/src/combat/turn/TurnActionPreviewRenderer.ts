import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../../render/RenderLayers';
import type { TurnCombatState, TurnDamageType } from './TurnCombatTypes';
import {
  chebyshevDist,
  getAttackableTargets,
  getParticipantAttacks,
  getReachableTiles,
  type TurnTileContext,
} from './TurnActionValidator';
import { calculateTurnHitChance, getActiveParticipant } from './TurnCombatEngine';

const MOVE_FILL   = 0x3b82f6; // blue
const ATTACK_FILL = 0xef4444; // red
const ABILITY_FILL = 0x8cb8e8; // spell blue
const DANGER_FILL = 0xdc2626; // strong telegraph
const WARNING_FILL = 0xf97316; // weak telegraph
const ALPHA_FILL  = 0.22;
const ALPHA_LINE  = 0.70;
const ALPHA_DANGER_FILL = 0.34;

export class TurnActionPreviewRenderer {
  private readonly previewGraphics: Phaser.GameObjects.Graphics;
  private readonly telegraphGraphics: Phaser.GameObjects.Graphics;
  private readonly targetLabels: Phaser.GameObjects.Text[] = [];
  private getTileDiamondPoints: (
    tileX: number,
    tileY: number,
  ) => Array<{ x: number; y: number }>;

  constructor(
    scene: Phaser.Scene,
    getTileDiamondPoints: (tileX: number, tileY: number) => Array<{ x: number; y: number }>,
  ) {
    this.previewGraphics = scene.add.graphics();
    this.previewGraphics.setDepth(RENDER_DEPTHS.GRID + 2);
    this.telegraphGraphics = scene.add.graphics();
    this.telegraphGraphics.setDepth(RENDER_DEPTHS.DEBUG - 250);
    this.getTileDiamondPoints = getTileDiamondPoints;
  }

  /** Swap in the real tilemap diamond function once the map is loaded. */
  setDiamondFn(fn: (tileX: number, tileY: number) => Array<{ x: number; y: number }>): void {
    this.getTileDiamondPoints = fn;
  }

  /**
   * Redraws movement (blue) and/or attack (red) overlays for the active participant.
   * In attack mode only red targets are shown; in normal mode both are shown.
   */
  update(
    state: TurnCombatState | null,
    tileCtx: TurnTileContext,
    attackMode = false,
    selectedAttackId: string | null = null,
    selectedAbilityId: string | null = null,
  ): void {
    this.previewGraphics.clear();
    this.telegraphGraphics.clear();
    this.clearTargetLabels();

    if (state) this.drawPendingTelegraphs(state);
    if (!state || state.phase !== 'player_turn') return;

    const active = getActiveParticipant(state);
    if (!active || (active.kind !== 'player' && active.kind !== 'companion')) return;

    if (!attackMode) {
      // Normal mode: show reachable movement tiles in blue
      const moveTiles = getReachableTiles(active, state, tileCtx);
      this.previewGraphics.fillStyle(MOVE_FILL, ALPHA_FILL);
      this.previewGraphics.lineStyle(1, MOVE_FILL, ALPHA_LINE);
      for (const tile of moveTiles) {
        this.drawDiamond(this.previewGraphics, tile.x, tile.y);
      }
    }

    // Attack/ability range — only when AP > 0
    if (active.apRemaining > 0) {
      const selectedRange = this.getSelectedActionRange(active, selectedAttackId, selectedAbilityId);
      const fill = selectedAbilityId ? ABILITY_FILL : ATTACK_FILL;
      this.previewGraphics.fillStyle(fill, ALPHA_FILL);
      this.previewGraphics.lineStyle(1, fill, ALPHA_LINE);

      if (selectedRange) {
        for (const tile of this.getRangeTiles(active, selectedRange.minRange, selectedRange.maxRange, tileCtx)) {
          this.drawDiamond(this.previewGraphics, tile.x, tile.y);
        }
      }

      const targets = this.getTargetPreviewTiles(active, state, selectedAttackId, selectedAbilityId);
      for (const target of targets) {
        this.drawDiamond(this.previewGraphics, target.tileX, target.tileY);
      }
      if (selectedRange) {
        this.drawTargetLabels(
          active,
          state,
          selectedRange.label,
          selectedRange.minRange,
          selectedRange.maxRange,
          selectedRange.baseHitChance,
          selectedRange.damageType,
        );
      }
    }
  }

  clear(): void {
    this.previewGraphics.clear();
    this.telegraphGraphics.clear();
    this.clearTargetLabels();
  }

  destroy(): void {
    this.clearTargetLabels();
    this.previewGraphics.destroy();
    this.telegraphGraphics.destroy();
  }

  private drawDiamond(graphics: Phaser.GameObjects.Graphics, tileX: number, tileY: number): void {
    const pts = this.getTileDiamondPoints(tileX, tileY);
    graphics.fillPoints(pts, true);
    graphics.strokePoints(pts, true);
  }

  private getSelectedActionRange(
    active: NonNullable<ReturnType<typeof getActiveParticipant>>,
    selectedAttackId: string | null,
    selectedAbilityId: string | null,
  ): { label: string; minRange: number; maxRange: number; baseHitChance: number; damageType?: TurnDamageType } | null {
    if (selectedAbilityId) {
      const ability = active.abilities?.find((entry) => entry.id === selectedAbilityId);
      if (!ability || ability.target !== 'enemy') return null;
      if ((active.abilityCooldowns?.[ability.id] ?? 0) > 0) return null;
      if ((active.magicResourceRemaining ?? 0) < (ability.magicCost ?? 0)) return null;
      if ((active.devotionResourceRemaining ?? 0) < (ability.devotionCost ?? 0)) return null;
      return {
        label: ability.displayName,
        minRange: ability.minRangeTiles ?? 0,
        maxRange: ability.maxRangeTiles ?? 1,
        baseHitChance: ability.hitChance ?? active.hitChance ?? 85,
        damageType: ability.damageType,
      };
    }

    if (selectedAttackId) {
      const attack = getParticipantAttacks(active).find((entry) => entry.id === selectedAttackId);
      if (!attack || (active.attackCooldowns?.[attack.id] ?? 0) > 0 || active.apRemaining < attack.apCost) return null;
      return {
        label: attack.displayName,
        minRange: attack.minRangeTiles,
        maxRange: attack.maxRangeTiles,
        baseHitChance: attack.hitChance ?? active.hitChance ?? 80,
        damageType: attack.damageType,
      };
    }

    return null;
  }

  private getRangeTiles(
    active: NonNullable<ReturnType<typeof getActiveParticipant>>,
    minRange: number,
    maxRange: number,
    tileCtx: TurnTileContext,
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];
    for (let y = active.tileY - maxRange; y <= active.tileY + maxRange; y += 1) {
      for (let x = active.tileX - maxRange; x <= active.tileX + maxRange; x += 1) {
        if (x < 0 || y < 0 || x >= tileCtx.mapWidth || y >= tileCtx.mapHeight) continue;
        if (!tileCtx.isTileWalkable(x, y)) continue;
        const dist = chebyshevDist(active.tileX, active.tileY, x, y);
        if (dist < minRange || dist > maxRange) continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  private drawTargetLabels(
    active: NonNullable<ReturnType<typeof getActiveParticipant>>,
    state: TurnCombatState,
    actionName: string,
    minRange: number,
    maxRange: number,
    baseHitChance: number,
    damageType: TurnDamageType | undefined,
  ): void {
    for (const target of state.participants) {
      if (target.kind === active.kind || (active.kind !== 'enemy' && target.kind !== 'enemy')) continue;
      if (target.hp <= 0) continue;
      if (!this.isPointerOverTile(target.tileX, target.tileY)) continue;
      const dist = chebyshevDist(active.tileX, active.tileY, target.tileX, target.tileY);
      const inRange = dist >= minRange && dist <= maxRange;
      const hitContext = inRange
        ? calculateTurnHitChance(active, target, damageType, baseHitChance)
        : null;
      const labelText = hitContext
        ? `${actionName} • ${hitContext.hitChance}%`
        : 'Out of range';
      const center = this.getDiamondCenter(target.tileX, target.tileY);
      const label = this.previewGraphics.scene.add.text(
        center.x,
        center.y - 38,
        labelText,
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: inRange ? '#fffcc3' : '#ff6b6b',
          backgroundColor: 'rgba(12, 18, 8, 0.82)',
          padding: { left: 5, right: 5, top: 2, bottom: 2 },
        },
      );
      label.setOrigin(0.5, 1);
      label.setDepth(RENDER_DEPTHS.DEBUG - 180);
      this.targetLabels.push(label);
    }
  }

  private isPointerOverTile(tileX: number, tileY: number): boolean {
    const pointer = this.previewGraphics.scene.input.activePointer;
    if (!pointer) return false;
    const polygon = new Phaser.Geom.Polygon(this.getTileDiamondPoints(tileX, tileY));
    return Phaser.Geom.Polygon.Contains(polygon, pointer.worldX, pointer.worldY);
  }

  private getDiamondCenter(tileX: number, tileY: number): { x: number; y: number } {
    const pts = this.getTileDiamondPoints(tileX, tileY);
    return {
      x: pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length,
      y: pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length,
    };
  }

  private clearTargetLabels(): void {
    while (this.targetLabels.length > 0) {
      this.targetLabels.pop()?.destroy();
    }
  }

  private getTargetPreviewTiles(
    active: NonNullable<ReturnType<typeof getActiveParticipant>>,
    state: TurnCombatState,
    selectedAttackId: string | null,
    selectedAbilityId: string | null,
  ) {
    if (selectedAbilityId) {
      const ability = active.abilities?.find((entry) => entry.id === selectedAbilityId);
      if (!ability || ability.target !== 'enemy') return [];
      if ((active.abilityCooldowns?.[ability.id] ?? 0) > 0) return [];
      if ((active.magicResourceRemaining ?? 0) < (ability.magicCost ?? 0)) return [];
      if ((active.devotionResourceRemaining ?? 0) < (ability.devotionCost ?? 0)) return [];

      const minRange = ability.minRangeTiles ?? 0;
      const maxRange = ability.maxRangeTiles ?? 1;
      return state.participants.filter((target) => {
        if (target.kind === active.kind || (active.kind !== 'enemy' && target.kind !== 'enemy')) return false;
        if (target.hp <= 0) return false;
        const dist = chebyshevDist(active.tileX, active.tileY, target.tileX, target.tileY);
        return dist >= minRange && dist <= maxRange;
      });
    }

    if (selectedAttackId) {
      const attack = getParticipantAttacks(active).find((entry) => entry.id === selectedAttackId);
      if (!attack || (active.attackCooldowns?.[attack.id] ?? 0) > 0 || active.apRemaining < attack.apCost) return [];
      return state.participants.filter((target) => {
        if (target.kind === active.kind || (active.kind !== 'enemy' && target.kind !== 'enemy')) return false;
        if (target.hp <= 0) return false;
        const dist = chebyshevDist(active.tileX, active.tileY, target.tileX, target.tileY);
        return dist >= attack.minRangeTiles && dist <= attack.maxRangeTiles;
      });
    }

    return getAttackableTargets(active, state);
  }

  private drawPendingTelegraphs(state: TurnCombatState): void {
    for (const telegraph of state.pendingTelegraphs ?? []) {
      for (const tile of telegraph.tiles) {
        const fill = tile.intensity === 'danger' ? DANGER_FILL : WARNING_FILL;
        this.telegraphGraphics.fillStyle(fill, ALPHA_DANGER_FILL);
        this.telegraphGraphics.lineStyle(2, fill, ALPHA_LINE);
        this.drawDiamond(this.telegraphGraphics, tile.x, tile.y);
      }
    }
  }
}
