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
const ALPHA_FILL  = 0.22;
const ALPHA_LINE  = 0.70;

export class TurnActionPreviewRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private getTileDiamondPoints: (
    tileX: number,
    tileY: number,
  ) => Array<{ x: number; y: number }>;

  constructor(
    scene: Phaser.Scene,
    getTileDiamondPoints: (tileX: number, tileY: number) => Array<{ x: number; y: number }>,
  ) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(RENDER_DEPTHS.GRID + 2);
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
    this.graphics.clear();

    if (!state || state.phase !== 'player_turn') return;

    const active = getActiveParticipant(state);
    if (!active || active.kind !== 'player') return;

    if (!attackMode) {
      // Normal mode: show reachable movement tiles in blue
      const moveTiles = getReachableTiles(active, state, tileCtx);
      this.graphics.fillStyle(MOVE_FILL, ALPHA_FILL);
      this.graphics.lineStyle(1, MOVE_FILL, ALPHA_LINE);
      for (const tile of moveTiles) {
        this.drawDiamond(tile.x, tile.y);
      }
    }

    // Attack range — red (only when AP > 0)
    if (active.apRemaining > 0) {
      const attackTargets = getAttackableTargets(active, state);
      this.graphics.fillStyle(ATTACK_FILL, ALPHA_FILL);
      this.graphics.lineStyle(1, ATTACK_FILL, ALPHA_LINE);
      for (const target of attackTargets) {
        this.drawDiamond(target.tileX, target.tileY);
      }
    }
  }

  clear(): void {
    this.graphics.clear();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private drawDiamond(tileX: number, tileY: number): void {
    const pts = this.getTileDiamondPoints(tileX, tileY);
    this.graphics.fillPoints(pts, true);
    this.graphics.strokePoints(pts, true);
  }
}
