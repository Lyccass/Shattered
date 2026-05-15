import type { ObjectPlacementSystem } from './ObjectPlacementSystem';

type Placement = { definitionId: string; tileX: number; tileY: number };

// ObjectTestArea is a temporary bootstrap that places a small cluster of test
// objects so we can visually verify alignment, depth, blocking and gaps before
// any real placement UI exists. Coordinates are GRID tiles only — no pixel math.
//
// Cluster origin is south-east of spawn (90, 90) so the player can walk into it.
// All placements use ObjectPlacementSystem; this file owns NO rendering or
// collision logic of its own.
export class ObjectTestArea {
  private readonly placedIds: string[] = [];
  private removableId?: string;

  constructor(private readonly placement: ObjectPlacementSystem) {}

  build(): void {
    const cluster: Placement[] = [
      ...centralForest(),
      ...forestGroundDetail(),

      // Prototype props kept near the forest edge for object/depth testing without marker blocks.
      { definitionId: 'small_rock', tileX: 95, tileY: 88 },
      { definitionId: 'large_rock', tileX: 98, tileY: 88 },
      { definitionId: 'barrel',        tileX: 94, tileY: 91 },
      { definitionId: 'log',           tileX: 96, tileY: 91 },
      { definitionId: 'fence_segment', tileX: 99, tileY: 91 },
      { definitionId: 'small_rock', tileX: 94, tileY: 96 },
      { definitionId: 'small_rock', tileX: 96, tileY: 96 },
    ];

    for (const p of cluster) {
      const instance = this.placement.placeObject(p.definitionId, p.tileX, p.tileY);
      if (!instance) {
        console.log(`[ObjectTestArea] rejected ${p.definitionId} at (${p.tileX}, ${p.tileY}) — terrain or already blocked`);
        continue;
      }
      this.placedIds.push(instance.id);
      // First tree is the convenient candidate for the "remove one to verify unblocking" debug key.
      if (this.removableId === undefined && instance.definitionId === 'tree_test') {
        this.removableId = instance.id;
      }
    }
  }

  // Removes one known test object so the debug overlay shows the object-blocked
  // count dropping and the player can walk onto the freed tile.
  removeOneTestObject(): boolean {
    if (!this.removableId) return false;
    const removed = this.placement.removeObject(this.removableId);
    if (removed) {
      console.log(`[ObjectTestArea] removed test object ${this.removableId}`);
      this.removableId = undefined;
    }
    return removed;
  }

  getPlacedInstanceIds(): string[] {
    return [...this.placedIds];
  }
}

function centralForest(): Placement[] {
  return [
    // Keep (90,90) clear because that is the prototype spawn tile.
    { definitionId: 'tree_dark', tileX: 78, tileY: 86 },
    { definitionId: 'tree_test', tileX: 81, tileY: 82 },
    { definitionId: 'tree_tall', tileX: 85, tileY: 79 },
    { definitionId: 'tree_dark', tileX: 90, tileY: 78 },
    { definitionId: 'tree_test', tileX: 95, tileY: 80 },
    { definitionId: 'tree_tall', tileX: 100, tileY: 84 },
    { definitionId: 'tree_dark', tileX: 103, tileY: 89 },
    { definitionId: 'tree_test', tileX: 80, tileY: 92 },
    { definitionId: 'tree_tall', tileX: 84, tileY: 96 },
    { definitionId: 'tree_dark', tileX: 88, tileY: 100 },
    { definitionId: 'tree_test', tileX: 94, tileY: 101 },
    { definitionId: 'tree_tall', tileX: 99, tileY: 97 },
    { definitionId: 'tree_dark', tileX: 104, tileY: 94 },
    { definitionId: 'tree_test', tileX: 75, tileY: 95 },
    { definitionId: 'tree_tall', tileX: 82, tileY: 103 },
    { definitionId: 'tree_dark', tileX: 91, tileY: 106 },
    { definitionId: 'tree_test', tileX: 101, tileY: 103 },
    { definitionId: 'tree_tall', tileX: 108, tileY: 96 },
  ];
}

function forestGroundDetail(): Placement[] {
  const placements: Placement[] = [];
  const detailTiles = [
    [83, 84], [86, 84], [88, 84], [92, 83], [97, 83],
    [80, 87], [84, 87], [87, 87], [91, 87], [94, 87], [98, 87], [101, 87],
    [78, 90], [82, 90], [85, 90], [88, 90], [92, 90], [96, 90], [100, 90], [104, 90],
    [80, 93], [83, 93], [86, 93], [90, 93], [93, 93], [97, 93], [101, 93],
    [82, 96], [87, 96], [91, 96], [95, 96], [99, 96], [103, 96],
    [85, 99], [89, 99], [93, 99], [97, 99], [101, 99],
  ] as const;

  detailTiles.forEach(([tileX, tileY], index) => {
    const definitionId = index % 5 === 0
      ? 'flower_patch'
      : index % 3 === 0
        ? 'pebble_patch'
        : 'wild_grass';

    placements.push({ definitionId, tileX, tileY });
  });

  return placements;
}
