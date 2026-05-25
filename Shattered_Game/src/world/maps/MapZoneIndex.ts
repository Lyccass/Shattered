import type { MapZone, MapZoneTag } from './MapTypes';

export class MapZoneIndex {
  private zones: readonly MapZone[];

  constructor(zones: readonly MapZone[]) {
    this.zones = zones;
  }

  setZones(zones: readonly MapZone[]): void {
    this.zones = zones;
  }

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
