import { TERRAIN_TILE_DEFINITIONS } from './TerrainTileDefinitions';
import { TERRAIN_TRANSITION_DEFINITIONS } from './TerrainTransitionDefinitions';
import {
  ISO_CORNER_KEYS,
  ISO_EDGE_KEYS,
  getRenderTerrainFamily,
  type IsoCornerKey,
  type IsoEdgeKey,
  type RenderTerrainFamily,
  type ResolvedTerrainTile,
  type ResolvedTerrainTransition,
  type TerrainFamily,
  type TerrainNeighbourFamilies,
  type TerrainTileDefinition,
  type TerrainTransitionDefinition,
  type TerrainTransitionKind,
} from './TerrainTypes';
import {
  selectTerrainTransform,
  selectTerrainTransitionTransform,
  selectWeightedTerrainVariant,
} from './TerrainVariantSelector';

type TerrainResolverInput = {
  family: TerrainFamily;
  gridX: number;
  gridY: number;
  neighbours?: TerrainNeighbourFamilies;
};

const TERRAIN_PRIORITY: Record<RenderTerrainFamily, number> = {
  grass: 1,
  dirt: 2,
  stone: 3,
  water: 4,
};

const OUTER_CORNER_EDGE_PAIRS: Record<IsoCornerKey, [IsoEdgeKey, IsoEdgeKey]> = {
  xPlusYPlus: ['xPlus', 'yPlus'],
  xPlusYMinus: ['xPlus', 'yMinus'],
  xMinusYPlus: ['xMinus', 'yPlus'],
  xMinusYMinus: ['xMinus', 'yMinus'],
};

export class TerrainResolver {
  private readonly transitionIndex: Map<string, TerrainTransitionDefinition>;

  constructor(
    private readonly definitions: TerrainTileDefinition[] = TERRAIN_TILE_DEFINITIONS,
    transitionDefinitions: TerrainTransitionDefinition[] = TERRAIN_TRANSITION_DEFINITIONS,
  ) {
    this.transitionIndex = new Map(
      transitionDefinitions.map((def) => [
        transitionKey(def.fromFamily, def.toFamily, def.kind, def.direction),
        def,
      ]),
    );
  }

  resolve({
    family,
    gridX,
    gridY,
    neighbours = createFallbackNeighbours(family),
  }: TerrainResolverInput): ResolvedTerrainTile {
    const renderFamily = getRenderTerrainFamily(family);
    const candidates = this.getCandidateDefinitions(renderFamily, neighbours);
    const baseTileDefinition = selectWeightedTerrainVariant(candidates, gridX, gridY, family);
    const baseTransform = selectTerrainTransform(baseTileDefinition, gridX, gridY, family);
    const edgeCandidates = this.detectEdgeTransitions(renderFamily, neighbours, gridX, gridY);
    const outerCornerCandidates = this.detectOuterCornerTransitions(renderFamily, neighbours, gridX, gridY);
    const innerCornerCandidates = this.detectInnerCornerTransitions(renderFamily, neighbours, gridX, gridY);
    const transitionOverlays = this.prioritiseTransitionOverlays([
      ...edgeCandidates,
      ...outerCornerCandidates,
      ...innerCornerCandidates,
    ]);
    const shorelineCandidates = transitionOverlays.filter((overlay) =>
      overlay.definition.kind === 'shorelineEdge' || overlay.definition.kind === 'shorelineCorner',
    );

    return {
      baseTileDefinition,
      baseTransform,
      transitionOverlays,
      debugInfo: {
        neighbourFamilies: neighbours,
        edgeCandidates,
        outerCornerCandidates,
        innerCornerCandidates,
        shorelineCandidates,
      },
    };
  }

  private getCandidateDefinitions(
    renderFamily: RenderTerrainFamily,
    neighbours: TerrainNeighbourFamilies,
  ): TerrainTileDefinition[] {
    const baseCandidates = this.definitions.filter(
      (definition) =>
        definition.family === renderFamily &&
        definition.weight > 0 &&
        (definition.role === 'full' || definition.role === 'decorated'),
    );

    // Transition readiness: once mixed-edge transition tiles exist, this is
    // where neighbour families will decide whether a grass_dirt edge piece
    // should beat a plain full grass tile.
    const hasDifferentNeighbour = ISO_EDGE_KEYS.some((edgeKey) => {
      const neighbourFamily = neighbours.edges[edgeKey];
      return getRenderTerrainFamily(neighbourFamily) !== renderFamily;
    });

    if (!hasDifferentNeighbour) {
      return baseCandidates;
    }

    return baseCandidates;
  }

  private detectEdgeTransitions(
    currentFamily: RenderTerrainFamily,
    neighbours: TerrainNeighbourFamilies,
    gridX: number,
    gridY: number,
  ): ResolvedTerrainTransition[] {
    return ISO_EDGE_KEYS.flatMap((direction) => {
      const targetFamily = getRenderTerrainFamily(neighbours.edges[direction]);

      if (!this.shouldRenderTransitionOnCurrentTile(currentFamily, targetFamily)) {
        return [];
      }

      const kind: TerrainTransitionKind =
        currentFamily === 'water' || targetFamily === 'water' ? 'shorelineEdge' : 'edge';
      const transition = this.createTransition(currentFamily, targetFamily, kind, direction, gridX, gridY);

      return transition ? [transition] : [];
    });
  }

  private detectOuterCornerTransitions(
    currentFamily: RenderTerrainFamily,
    neighbours: TerrainNeighbourFamilies,
    gridX: number,
    gridY: number,
  ): ResolvedTerrainTransition[] {
    return ISO_CORNER_KEYS.flatMap((direction) => {
      const [firstEdge, secondEdge] = OUTER_CORNER_EDGE_PAIRS[direction];
      const edgeTargets = [
        getRenderTerrainFamily(neighbours.edges[firstEdge]),
        getRenderTerrainFamily(neighbours.edges[secondEdge]),
      ].filter((targetFamily) => targetFamily !== currentFamily);
      const targetFamily = this.getHighestPriorityFamily(edgeTargets);

      if (!targetFamily || !this.shouldRenderTransitionOnCurrentTile(currentFamily, targetFamily)) {
        return [];
      }

      const kind: TerrainTransitionKind =
        currentFamily === 'water' || targetFamily === 'water' ? 'shorelineCorner' : 'outerCorner';
      const transition = this.createTransition(currentFamily, targetFamily, kind, direction, gridX, gridY);

      return transition ? [transition] : [];
    });
  }

  private detectInnerCornerTransitions(
    currentFamily: RenderTerrainFamily,
    neighbours: TerrainNeighbourFamilies,
    gridX: number,
    gridY: number,
  ): ResolvedTerrainTransition[] {
    return ISO_CORNER_KEYS.flatMap((direction) => {
      const [firstEdge, secondEdge] = OUTER_CORNER_EDGE_PAIRS[direction];
      const firstEdgeFamily = getRenderTerrainFamily(neighbours.edges[firstEdge]);
      const secondEdgeFamily = getRenderTerrainFamily(neighbours.edges[secondEdge]);
      const targetFamily = getRenderTerrainFamily(neighbours.corners[direction]);

      if (
        firstEdgeFamily !== currentFamily ||
        secondEdgeFamily !== currentFamily ||
        !this.shouldRenderTransitionOnCurrentTile(currentFamily, targetFamily)
      ) {
        return [];
      }

      const kind: TerrainTransitionKind =
        currentFamily === 'water' || targetFamily === 'water' ? 'shorelineCorner' : 'innerCorner';
      const transition = this.createTransition(currentFamily, targetFamily, kind, direction, gridX, gridY);

      return transition ? [transition] : [];
    });
  }

  private createTransition(
    fromFamily: RenderTerrainFamily,
    toFamily: RenderTerrainFamily,
    kind: TerrainTransitionKind,
    direction: IsoEdgeKey | IsoCornerKey,
    gridX: number,
    gridY: number,
  ): ResolvedTerrainTransition | null {
    const definition = this.transitionIndex.get(
      transitionKey(fromFamily, toFamily, kind, direction),
    );

    if (!definition) {
      return null;
    }

    return {
      definition,
      transform: selectTerrainTransitionTransform(definition, gridX, gridY),
    };
  }

  private prioritiseTransitionOverlays(
    overlays: ResolvedTerrainTransition[],
  ): ResolvedTerrainTransition[] {
    const bestByDirection = new Map<string, ResolvedTerrainTransition>();

    overlays.forEach((overlay) => {
      const directionKey = `${overlay.definition.kind}:${overlay.definition.direction}`;
      const existing = bestByDirection.get(directionKey);

      if (!existing || overlay.definition.priority > existing.definition.priority) {
        bestByDirection.set(directionKey, overlay);
      }
    });

    return [...bestByDirection.values()].sort((a, b) => b.definition.priority - a.definition.priority);
  }

  private shouldRenderTransitionOnCurrentTile(
    currentFamily: RenderTerrainFamily,
    targetFamily: RenderTerrainFamily,
  ): boolean {
    // Shoreline art belongs to the water tile so visual water/land edges stay
    // consistent with water's blocked gameplay tile.
    if (currentFamily === 'water' && targetFamily !== 'water') {
      return true;
    }

    return targetFamily !== currentFamily && TERRAIN_PRIORITY[targetFamily] > TERRAIN_PRIORITY[currentFamily];
  }

  private getHighestPriorityFamily(
    families: RenderTerrainFamily[],
  ): RenderTerrainFamily | null {
    if (families.length === 0) {
      return null;
    }

    return families.reduce((best, candidate) =>
      TERRAIN_PRIORITY[candidate] > TERRAIN_PRIORITY[best] ? candidate : best,
    );
  }
}

function transitionKey(
  from: TerrainFamily,
  to: TerrainFamily,
  kind: TerrainTransitionKind,
  direction: IsoEdgeKey | IsoCornerKey | string,
): string {
  return `${from}:${to}:${kind}:${direction}`;
}

function createFallbackNeighbours(family: TerrainFamily): TerrainNeighbourFamilies {
  return {
    edges: {
      xPlus: family,
      xMinus: family,
      yPlus: family,
      yMinus: family,
    },
    corners: {
      xPlusYPlus: family,
      xPlusYMinus: family,
      xMinusYPlus: family,
      xMinusYMinus: family,
    },
  };
}
