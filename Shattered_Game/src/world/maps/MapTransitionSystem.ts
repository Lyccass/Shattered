import type { GridFootprint } from '../../objects/ObjectTypes';
import type { MapTransition } from './MapTypes';

type TilePosition = {
  x: number;
  y: number;
};

export class MapTransitionSystem {
  private transitions: MapTransition[] = [];
  private activeTransition: MapTransition | null = null;

  setTransitions(transitions: MapTransition[]): void {
    this.transitions = transitions;
    this.activeTransition = null;
  }

  updateActiveTransition(tileX: number, tileY: number): MapTransition | null {
    this.activeTransition = this.getTransitionAtTile(tileX, tileY);
    return this.activeTransition;
  }

  getActiveTransition(): MapTransition | null {
    return this.activeTransition;
  }

  getTransitionAtTile(tileX: number, tileY: number): MapTransition | null {
    return this.transitions.find((transition) =>
      isTileInsideTransition(transition, tileX, tileY),
    ) ?? null;
  }
}

export function isTileInsideTransition(
  transition: MapTransition,
  tileX: number,
  tileY: number,
): boolean {
  return getTransitionTiles(transition).some((offset) =>
    transition.fromTile.tileX + offset.x === tileX &&
    transition.fromTile.tileY + offset.y === tileY,
  );
}

export function getTransitionTiles(transition: MapTransition): GridFootprint {
  return transition.triggerFootprint && transition.triggerFootprint.length > 0
    ? transition.triggerFootprint
    : [{ x: 0, y: 0 }];
}

export function getTransitionFootprintTiles(transition: MapTransition): TilePosition[] {
  return getTransitionTiles(transition).map((offset) => ({
    x: transition.fromTile.tileX + offset.x,
    y: transition.fromTile.tileY + offset.y,
  }));
}
