import type { NpcDefinition, NpcRuntimeState } from './NpcTypes';
import type { IsoTilemap } from '../world/IsoTilemap';

const NPC_MOVE_SPEED_WORLD_PER_MS = 0.035;
const WAYPOINT_WAIT_MIN_MS = 2_000;
const WAYPOINT_WAIT_MAX_MS = 4_000;
const AMBIENT_INTERVAL_MIN_MS = 8_000;
const AMBIENT_INTERVAL_MAX_MS = 16_000;
const BUBBLE_DURATION_MS = 3_500;
const WAYPOINT_ARRIVAL_THRESHOLD = 3;

export class NpcSystem {
  private states: NpcRuntimeState[] = [];
  private definitions = new Map<string, NpcDefinition>();

  spawn(
    instanceId: string,
    definition: NpcDefinition,
    startTileX: number,
    startTileY: number,
    patrolTiles: Array<{ x: number; y: number }>,
    tilemap: IsoTilemap,
    nowMs: number,
  ): void {
    const origin = tilemap.getTileCenterWorld(startTileX, startTileY);
    this.definitions.set(definition.id, definition);
    this.states.push({
      id: instanceId,
      definitionId: definition.id,
      worldX: origin.x,
      worldY: origin.y,
      patrolTiles: patrolTiles.length > 0 ? patrolTiles : [{ x: startTileX, y: startTileY }],
      patrolIndex: 0,
      nextWaypointMs: nowMs + randomBetween(WAYPOINT_WAIT_MIN_MS, WAYPOINT_WAIT_MAX_MS),
      bubbleText: null,
      bubbleUntilMs: 0,
      nextAmbientMs: nowMs + randomBetween(AMBIENT_INTERVAL_MIN_MS, AMBIENT_INTERVAL_MAX_MS),
    });
  }

  update(nowMs: number, deltaMs: number, tilemap: IsoTilemap): void {
    for (const state of this.states) {
      const def = this.definitions.get(state.definitionId);
      if (!def) continue;

      if (state.bubbleText && nowMs >= state.bubbleUntilMs) {
        state.bubbleText = null;
      }

      if (def.behavior === 'patrol') {
        this.updatePatrol(state, nowMs, deltaMs, tilemap);
      }

      if (nowMs >= state.nextAmbientMs && def.ambientLines.length > 0) {
        const line = def.ambientLines[Math.floor(Math.random() * def.ambientLines.length)];
        state.bubbleText = line;
        state.bubbleUntilMs = nowMs + BUBBLE_DURATION_MS;
        state.nextAmbientMs = nowMs + randomBetween(AMBIENT_INTERVAL_MIN_MS, AMBIENT_INTERVAL_MAX_MS);
      }
    }
  }

  getStates(): readonly NpcRuntimeState[] {
    return this.states;
  }

  getDefinition(id: string): NpcDefinition | null {
    return this.definitions.get(id) ?? null;
  }

  showBubble(instanceId: string, text: string, nowMs: number): void {
    const state = this.states.find((s) => s.id === instanceId);
    if (state) {
      state.bubbleText = text;
      state.bubbleUntilMs = nowMs + BUBBLE_DURATION_MS;
    }
  }

  destroy(): void {
    this.states = [];
    this.definitions.clear();
  }

  private updatePatrol(
    state: NpcRuntimeState,
    nowMs: number,
    deltaMs: number,
    tilemap: IsoTilemap,
  ): void {
    if (state.patrolTiles.length <= 1) {
      return;
    }

    if (nowMs < state.nextWaypointMs) {
      return;
    }

    const targetTile = state.patrolTiles[state.patrolIndex % state.patrolTiles.length];
    const targetWorld = tilemap.getTileCenterWorld(targetTile.x, targetTile.y);

    const dx = targetWorld.x - state.worldX;
    const dy = targetWorld.y - state.worldY;
    const dist = Math.hypot(dx, dy);

    if (dist <= WAYPOINT_ARRIVAL_THRESHOLD) {
      const nextIndex = (state.patrolIndex + 1) % state.patrolTiles.length;
      state.patrolIndex = nextIndex;
      state.nextWaypointMs = nowMs + randomBetween(WAYPOINT_WAIT_MIN_MS, WAYPOINT_WAIT_MAX_MS);
      return;
    }

    const step = Math.min(dist, NPC_MOVE_SPEED_WORLD_PER_MS * deltaMs);
    state.worldX += (dx / dist) * step;
    state.worldY += (dy / dist) * step;
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
