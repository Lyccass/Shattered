import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../../render/RenderLayers';
import type { TurnCombatState } from './TurnCombatTypes';
import {
  getAttackableTargets,
  getReachableTiles,
  type TurnTileContext,
} from './TurnActionValidator';
import { getActiveParticipant } from './TurnCombatEngine';

const MOVE_FILL   = 0x3b82f6; // blue
const ATTACK_FILL = 0xef4444; // red
const DANGER_FILL = 0xdc2626; // strong telegraph
const WARNING_FILL = 0xf97316; // weak telegraph
const ALPHA_FILL  = 0.22;
const ALPHA_LINE  = 0.70;
const ALPHA_DANGER_FILL = 0.34;

export class TurnActionPreviewRenderer {
  private readonly previewGraphics: Phaser.GameObjects.Graphics;
  private readonly telegraphGraphics: Phaser.GameObjects.Graphics;
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
  ): void {
    this.previewGraphics.clear();
    this.telegraphGraphics.clear();

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

    // Attack range — red (only when AP > 0)
    if (active.apRemaining > 0) {
      const attackTargets = getAttackableTargets(active, state);
      this.previewGraphics.fillStyle(ATTACK_FILL, ALPHA_FILL);
      this.previewGraphics.lineStyle(1, ATTACK_FILL, ALPHA_LINE);
      for (const target of attackTargets) {
        this.drawDiamond(this.previewGraphics, target.tileX, target.tileY);
      }
    }
  }

  clear(): void {
    this.previewGraphics.clear();
    this.telegraphGraphics.clear();
  }

  destroy(): void {
    this.previewGraphics.destroy();
    this.telegraphGraphics.destroy();
  }

  private drawDiamond(graphics: Phaser.GameObjects.Graphics, tileX: number, tileY: number): void {
    const pts = this.getTileDiamondPoints(tileX, tileY);
    graphics.fillPoints(pts, true);
    graphics.strokePoints(pts, true);
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
