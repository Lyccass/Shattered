import type { ObjectPlacementEvaluation } from '../objects/ObjectPlacementPolicy';
import type { MapSpaceType, MapZoneTag } from '../world/maps/MapTypes';
import type { ItemDefinition } from './ItemTypes';

export type ItemPlacementFailureCode =
  | 'not_placeable'
  | 'out_of_bounds'
  | 'terrain_blocked'
  | 'tile_blocked'
  | 'not_allowed_zone'
  | 'forbidden_zone'
  | 'too_close_to_transition'
  | 'max_active_reached';

export type ItemPlacementFailure = {
  code: ItemPlacementFailureCode;
};

export type ItemPlacementEvaluation =
  | {
      ok: true;
    }
  | {
      ok: false;
      failure: ItemPlacementFailure;
    };

export type ItemPlacementQuery = {
  tileX: number;
  tileY: number;
  mapSpaceType: MapSpaceType;
  zoneTags: MapZoneTag[];
  activePlacedCount: number;
  isTileInBounds(tileX: number, tileY: number): boolean;
  isTerrainBlocked(tileX: number, tileY: number): boolean;
  isObjectBlocked(tileX: number, tileY: number): boolean;
  isTileWalkable(tileX: number, tileY: number): boolean;
  isNearTransition(tileX: number, tileY: number, minDistanceTiles: number): boolean;
  objectPlacementEvaluation: ObjectPlacementEvaluation;
};

export function evaluateItemPlacement(
  itemDefinition: ItemDefinition,
  query: ItemPlacementQuery,
): ItemPlacementEvaluation {
  if (!itemDefinition.placementObjectDefinitionId) {
    return {
      ok: false,
      failure: {
        code: 'not_placeable',
      },
    };
  }

  if (!query.isTileInBounds(query.tileX, query.tileY)) {
    return {
      ok: false,
      failure: {
        code: 'out_of_bounds',
      },
    };
  }

  const rules = itemDefinition.placementRules;

  if (rules?.allowedSpaceTypes && rules.allowedSpaceTypes.length > 0) {
    const inAllowedSpace = rules.allowedSpaceTypes.includes(query.mapSpaceType);

    if (!inAllowedSpace) {
      return {
        ok: false,
        failure: {
          code: 'not_allowed_zone',
        },
      };
    }
  }

  if (rules?.forbiddenSpaceTypes && rules.forbiddenSpaceTypes.length > 0) {
    const inForbiddenSpace = rules.forbiddenSpaceTypes.includes(query.mapSpaceType);

    if (inForbiddenSpace) {
      return {
        ok: false,
        failure: {
          code: 'forbidden_zone',
        },
      };
    }
  }

  if (rules?.minTransitionDistanceTiles !== undefined) {
    if (query.isNearTransition(query.tileX, query.tileY, rules.minTransitionDistanceTiles)) {
      return {
        ok: false,
        failure: {
          code: 'too_close_to_transition',
        },
      };
    }
  }

  if (rules?.allowedZoneTags && rules.allowedZoneTags.length > 0) {
    const inAllowedZone = rules.allowedZoneTags.some((tag) => query.zoneTags.includes(tag));

    if (!inAllowedZone) {
      return {
        ok: false,
        failure: {
          code: 'not_allowed_zone',
        },
      };
    }
  }

  if (rules?.forbiddenZoneTags && rules.forbiddenZoneTags.length > 0) {
    const inForbiddenZone = rules.forbiddenZoneTags.some((tag) => query.zoneTags.includes(tag));

    if (inForbiddenZone) {
      return {
        ok: false,
        failure: {
          code: 'forbidden_zone',
        },
      };
    }
  }

  if (rules?.mustBeWalkable && !query.isTileWalkable(query.tileX, query.tileY)) {
    return {
      ok: false,
      failure: {
        code: query.isTerrainBlocked(query.tileX, query.tileY)
          ? 'terrain_blocked'
          : 'tile_blocked',
      },
    };
  }

  if (rules?.mustNotBeBlocked && query.isObjectBlocked(query.tileX, query.tileY)) {
    return {
      ok: false,
      failure: {
        code: 'tile_blocked',
      },
    };
  }

  if (rules?.maxActivePerSession !== undefined && query.activePlacedCount >= rules.maxActivePerSession) {
    return {
      ok: false,
      failure: {
        code: 'max_active_reached',
      },
    };
  }

  if (!query.objectPlacementEvaluation.ok) {
    return {
      ok: false,
      failure: {
        code: query.objectPlacementEvaluation.failure.code === 'terrain_blocked'
          ? 'terrain_blocked'
          : query.objectPlacementEvaluation.failure.code === 'out_of_bounds'
            ? 'out_of_bounds'
            : 'tile_blocked',
      },
    };
  }

  return { ok: true };
}

export function describeItemPlacementFailure(failure: ItemPlacementFailure): string {
  switch (failure.code) {
    case 'not_placeable':
      return 'Cannot place that item.';
    case 'out_of_bounds':
      return 'Cannot place here.';
    case 'terrain_blocked':
      return 'Cannot place on water.';
    case 'tile_blocked':
      return 'Tile is blocked.';
    case 'not_allowed_zone':
      return 'Not in a build/camp zone.';
    case 'forbidden_zone':
      return 'Cannot place here.';
    case 'too_close_to_transition':
      return 'Too close to a transition.';
    case 'max_active_reached':
      return 'Too many of that item are already active.';
  }
}
