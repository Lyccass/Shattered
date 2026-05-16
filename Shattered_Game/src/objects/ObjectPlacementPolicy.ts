import type { ObjectDefinition } from './ObjectTypes';

export const STATIC_OBJECT_PLACEMENT_POLICY = {
  allowBlockingOverlap: false,
  allowDecorationOverlapWithBlocking: false,
  allowDecorationOverlapWithDecoration: false,
  allowWaterPlacement: false,
  allowOutOfBoundsPlacement: false,
  requireFullFootprintInBounds: true,
} as const;

export type ObjectPlacementFailureCode =
  | 'out_of_bounds'
  | 'terrain_blocked'
  | 'object_overlap';

export type ObjectPlacementFailure = {
  code: ObjectPlacementFailureCode;
  tileX: number;
  tileY: number;
  occupyingObjectId?: string;
};

export type ObjectFootprintTile = {
  x: number;
  y: number;
};

export type ObjectPlacementEvaluation =
  | {
      ok: true;
      footprintTiles: ObjectFootprintTile[];
    }
  | {
      ok: false;
      footprintTiles: ObjectFootprintTile[];
      failure: ObjectPlacementFailure;
    };

export type ObjectPlacementQuery = {
  isTileInBounds(tileX: number, tileY: number): boolean;
  isTerrainBlocked(tileX: number, tileY: number): boolean;
  getOccupyingObjectId(tileX: number, tileY: number): string | null;
};

export function evaluateStaticObjectPlacement(
  query: ObjectPlacementQuery,
  definition: ObjectDefinition,
  tileX: number,
  tileY: number,
): ObjectPlacementEvaluation {
  const footprintTiles = getObjectFootprintTiles(definition, tileX, tileY);

  for (const tile of footprintTiles) {
    if (!query.isTileInBounds(tile.x, tile.y)) {
      return {
        ok: false,
        footprintTiles,
        failure: {
          code: 'out_of_bounds',
          tileX: tile.x,
          tileY: tile.y,
        },
      };
    }

    if (!STATIC_OBJECT_PLACEMENT_POLICY.allowWaterPlacement && query.isTerrainBlocked(tile.x, tile.y)) {
      return {
        ok: false,
        footprintTiles,
        failure: {
          code: 'terrain_blocked',
          tileX: tile.x,
          tileY: tile.y,
        },
      };
    }

    const occupyingObjectId = query.getOccupyingObjectId(tile.x, tile.y);

    if (occupyingObjectId) {
      return {
        ok: false,
        footprintTiles,
        failure: {
          code: 'object_overlap',
          tileX: tile.x,
          tileY: tile.y,
          occupyingObjectId,
        },
      };
    }
  }

  return {
    ok: true,
    footprintTiles,
  };
}

export function getObjectFootprintTiles(
  definition: Pick<ObjectDefinition, 'collisionFootprint'>,
  tileX: number,
  tileY: number,
): ObjectFootprintTile[] {
  const footprint = definition.collisionFootprint.length > 0
    ? definition.collisionFootprint
    : [{ x: 0, y: 0 }];

  return footprint.map((offset) => ({
    x: tileX + offset.x,
    y: tileY + offset.y,
  }));
}

export function describeObjectPlacementFailure(failure: ObjectPlacementFailure): {
  reason: string;
  suggestedFix: string;
} {
  switch (failure.code) {
    case 'out_of_bounds':
      return {
        reason: `footprint tile ${failure.tileX},${failure.tileY} is outside the map bounds`,
        suggestedFix: 'Move the object so its full collision footprint stays inside the map.',
      };
    case 'terrain_blocked':
      return {
        reason: `footprint tile ${failure.tileX},${failure.tileY} is water`,
        suggestedFix: 'Move the object onto non-water terrain or repaint the terrain beneath it.',
      };
    case 'object_overlap':
      return {
        reason: `footprint tile ${failure.tileX},${failure.tileY} is already occupied by object "${failure.occupyingObjectId}"`,
        suggestedFix: 'Move one of the overlapping objects so their collision footprints do not share tiles.',
      };
  }
}

export function formatMapObjectPlacementError(params: {
  mapId: string;
  objectId: string;
  definitionId: string;
  tileX: number;
  tileY: number;
  failure: ObjectPlacementFailure;
}): string {
  const { reason, suggestedFix } = describeObjectPlacementFailure(params.failure);

  return [
    `Map "${params.mapId}": object "${params.objectId}" using definition "${params.definitionId}" cannot be placed at tile ${params.tileX},${params.tileY} because ${reason}.`,
    `Suggested fix: ${suggestedFix}`,
  ].join(' ');
}
