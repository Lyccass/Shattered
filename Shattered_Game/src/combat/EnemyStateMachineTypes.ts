import type { TelegraphShape } from './TelegraphTypes';

export type EnemyUpdateEvent =
  | {
      kind: 'telegraph_show';
      telegraphId: string;
      worldX: number;
      worldY: number;
      shape: TelegraphShape;
      tiles?: Array<{ x: number; y: number }>;
      durationMs: number;
      attackKind: string;
    }
  | {
      kind: 'telegraph_remove';
      telegraphId: string;
    }
  | {
      kind: 'attack_result';
      attackId: string;
      damage: number;
      hit: boolean;
      reason: 'hit' | 'outside' | 'invulnerable';
      knockbackDirX?: number;
      knockbackDirY?: number;
      knockbackDistanceWorld?: number;
    };

export type EnemyUpdateContext = {
  nowMs: number;
  deltaMs: number;
  playerWorldX: number;
  playerWorldY: number;
  playerInvulnerable: boolean;
  playerOccupiedTiles: Array<{ x: number; y: number }>;
  tileWidth: number;
  tileHeight: number;
  mapWidth: number;
  mapHeight: number;
  worldToTile: (worldX: number, worldY: number) => { x: number; y: number };
  getTileCenterWorld: (tileX: number, tileY: number) => { x: number; y: number };
  getTileDiamondPoints: (tileX: number, tileY: number) => Array<{ x: number; y: number }>;
  isTileWalkable: (tileX: number, tileY: number) => boolean;
  playerEngagedWithEnemyId: string | null; // id of the enemy currently in combat with player; null if no combat
  playerTier: number; // current player combat tier (1–10); enemies ≤ playerTier-2 will never aggro
  /**
   * 0–100. Drives two threat-level mechanics:
   * - Aggro range scales up to ×1.5 at 100.
   * - Passive enemies become aggressive at 60+.
   */
  threatLevel: number;
};

export type EnemyAdvanceResult<TState> = {
  state: TState;
  events: EnemyUpdateEvent[];
};
