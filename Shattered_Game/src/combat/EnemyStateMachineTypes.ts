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
};

export type EnemyAdvanceResult<TState> = {
  state: TState;
  events: EnemyUpdateEvent[];
};
