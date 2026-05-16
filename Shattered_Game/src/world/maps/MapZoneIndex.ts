import type { MapZone, MapZoneTag } from './MapTypes';

export class MapZoneIndex {
  constructor(private readonly zones: readonly MapZone[]) {}

  getTagsAtTile(tileX: number, tileY: number): MapZoneTag[] {
    const tags = new Set<MapZoneTag>();

    this.zones.forEach((zone) => {
      if (!isTileInsideZone(zone, tileX, tileY)) {
        return;
      }

      zone.tags.forEach((tag) => tags.add(tag));
    });

    return Array.from(tags);
  }
}

function isTileInsideZone(zone: MapZone, tileX: number, tileY: number): boolean {
  return (
    tileX >= zone.tileX &&
    tileY >= zone.tileY &&
    tileX < zone.tileX + zone.width &&
    tileY < zone.tileY + zone.height
  );
}
