import Phaser from 'phaser';
import {
  EDITOR_ZONE_COLORS,
  getEditorTerrainElevationAt,
  getEditorTerrainWalkabilityAt,
  getEditorTerrainZoneAt,
  type EditorMapDefinition,
} from '../../shared/editor/EditorMapModel';
import { getTileDiamondPoints, type IsoTransformConfig } from '../../shared/iso/IsoCoordinates';
import type { EditorEncounterSelection } from '../encounters/EditorEncounterToolController';
import type { EditorToolMode } from '../input/EditorInputController';

type TileCoord = { x: number; y: number };

type OverlayRenderParams = {
  graphics: Phaser.GameObjects.Graphics;
  isTileInBounds: (tileX: number, tileY: number) => boolean;
  map: EditorMapDefinition;
  transform: IsoTransformConfig;
};

export function drawEditorOverlay({
  dragStart,
  encounterSelection,
  graphics,
  hoverFootprint,
  hoverTile,
  isTileInBounds,
  map,
  toolMode,
  transform,
}: OverlayRenderParams & {
  dragStart: TileCoord | null;
  encounterSelection: EditorEncounterSelection;
  hoverFootprint: TileCoord[];
  hoverTile: TileCoord | null;
  toolMode: EditorToolMode;
}): void {
  graphics.clear();
  graphics.setDepth(9_000);

  drawEditorTileDataOverlay({ graphics, map, toolMode, transform });
  drawEditorConnectionOverlay({ graphics, map, transform });

  if (toolMode === 'encounter') {
    drawEditorEncounterOverlay({
      dragStart,
      encounterSelection,
      graphics,
      hoverTile,
      isTileInBounds,
      map,
      transform,
    });
  }

  drawEditorNpcOverlay({
    graphics,
    isNpcMode: toolMode === 'npc',
    isTileInBounds,
    map,
    transform,
  });

  drawEditorHoverOverlay({
    graphics,
    hoverFootprint,
    hoverTile,
    isTileInBounds,
    transform,
  });
}

function drawEditorConnectionOverlay({
  graphics,
  map,
  transform,
}: Omit<OverlayRenderParams, 'isTileInBounds'>): void {
  for (const transition of map.transitions) {
    const points = getTileDiamondPoints(transform, transition.fromTile.tileX, transition.fromTile.tileY)
      .map((point) => new Phaser.Geom.Point(point.x, point.y));

    graphics.fillStyle(0x38bdf8, 0.18);
    graphics.fillPoints(points, true);
    graphics.lineStyle(2, 0x38bdf8, 0.82);
    graphics.strokePoints(points, true);
  }
}

function drawEditorTileDataOverlay({
  graphics,
  map,
  toolMode,
  transform,
}: Omit<OverlayRenderParams, 'isTileInBounds'> & {
  toolMode: EditorToolMode;
}): void {
  if (toolMode !== 'walkability' && toolMode !== 'elevation' && toolMode !== 'zone') {
    return;
  }

  for (let tileY = 0; tileY < map.height; tileY += 1) {
    for (let tileX = 0; tileX < map.width; tileX += 1) {
      const points = getTileDiamondPoints(transform, tileX, tileY)
        .map((point) => new Phaser.Geom.Point(point.x, point.y));

      if (toolMode === 'walkability') {
        const walkable = getEditorTerrainWalkabilityAt(map, tileX, tileY) ?? true;
        graphics.fillStyle(walkable ? 0x22c55e : 0xef4444, walkable ? 0.08 : 0.28);
        graphics.fillPoints(points, true);
        continue;
      }

      if (toolMode === 'zone') {
        const zone = getEditorTerrainZoneAt(map, tileX, tileY);
        if (zone) {
          const color = EDITOR_ZONE_COLORS[zone];
          graphics.fillStyle(color, 0.30);
          graphics.fillPoints(points, true);
          graphics.lineStyle(1, color, 0.15);
          graphics.strokePoints(points, true);
        }
        continue;
      }

      const elevation = getEditorTerrainElevationAt(map, tileX, tileY) ?? 0;

      if (elevation <= 0) {
        continue;
      }

      graphics.fillStyle(0x60a5fa, Math.min(0.42, 0.1 + elevation * 0.055));
      graphics.fillPoints(points, true);
    }
  }
}

function drawEditorEncounterOverlay({
  dragStart,
  encounterSelection,
  graphics,
  hoverTile,
  isTileInBounds,
  map,
  transform,
}: OverlayRenderParams & {
  dragStart: TileCoord | null;
  encounterSelection: EditorEncounterSelection;
  hoverTile: TileCoord | null;
}): void {
  for (const area of map.encounterAreas) {
    const selected = area.id === encounterSelection.selectedAreaId;
    const fillColor = selected ? 0xf97316 : 0xfb923c;
    const outlineColor = selected ? 0xfef3c7 : 0xf97316;

    const x1 = area.tileX;
    const y1 = area.tileY;
    const x2 = area.tileX + area.width - 1;
    const y2 = area.tileY + area.height - 1;

    const outerPoints = [
      getTileDiamondPoints(transform, x1, y1)[0],
      getTileDiamondPoints(transform, x2, y1)[1],
      getTileDiamondPoints(transform, x2, y2)[2],
      getTileDiamondPoints(transform, x1, y2)[3],
    ].map((point) => new Phaser.Geom.Point(point.x, point.y));

    graphics.fillStyle(fillColor, selected ? 0.22 : 0.12);
    graphics.fillPoints(outerPoints, true);
    graphics.lineStyle(2, outlineColor, selected ? 0.95 : 0.55);
    graphics.strokePoints(outerPoints, true);

    for (const spawn of area.manualSpawns) {
      if (!isTileInBounds(spawn.tileX, spawn.tileY)) {
        continue;
      }

      const points = getTileDiamondPoints(transform, spawn.tileX, spawn.tileY)
        .map((point) => new Phaser.Geom.Point(point.x, point.y));
      graphics.fillStyle(0xef4444, 0.32);
      graphics.fillPoints(points, true);
      graphics.lineStyle(2, 0xfca5a5, 0.9);
      graphics.strokePoints(points, true);
    }
  }

  if (!dragStart || !hoverTile) {
    return;
  }

  const x1 = Math.min(dragStart.x, hoverTile.x);
  const y1 = Math.min(dragStart.y, hoverTile.y);
  const x2 = Math.max(dragStart.x, hoverTile.x);
  const y2 = Math.max(dragStart.y, hoverTile.y);

  const previewPoints = [
    getTileDiamondPoints(transform, x1, y1)[0],
    getTileDiamondPoints(transform, x2, y1)[1],
    getTileDiamondPoints(transform, x2, y2)[2],
    getTileDiamondPoints(transform, x1, y2)[3],
  ].map((point) => new Phaser.Geom.Point(point.x, point.y));

  graphics.fillStyle(0xf97316, 0.18);
  graphics.fillPoints(previewPoints, true);
  graphics.lineStyle(2, 0xfef3c7, 0.85);
  graphics.strokePoints(previewPoints, true);
}

function drawEditorNpcOverlay({
  graphics,
  isNpcMode,
  isTileInBounds,
  map,
  transform,
}: OverlayRenderParams & {
  isNpcMode: boolean;
}): void {
  for (const anchor of map.npcAnchors) {
    if (!isTileInBounds(anchor.tileX, anchor.tileY)) {
      continue;
    }

    const points = getTileDiamondPoints(transform, anchor.tileX, anchor.tileY)
      .map((point) => new Phaser.Geom.Point(point.x, point.y));

    graphics.fillStyle(0xa855f7, isNpcMode ? 0.28 : 0.14);
    graphics.fillPoints(points, true);
    graphics.lineStyle(2, 0xe9d5ff, isNpcMode ? 0.9 : 0.5);
    graphics.strokePoints(points, true);
  }
}

function drawEditorHoverOverlay({
  graphics,
  hoverFootprint,
  hoverTile,
  isTileInBounds,
  transform,
}: {
  graphics: Phaser.GameObjects.Graphics;
  hoverFootprint: TileCoord[];
  hoverTile: TileCoord | null;
  isTileInBounds: (tileX: number, tileY: number) => boolean;
  transform: IsoTransformConfig;
}): void {
  if (!hoverTile || !isTileInBounds(hoverTile.x, hoverTile.y)) {
    return;
  }

  for (const tile of hoverFootprint) {
    if (!isTileInBounds(tile.x, tile.y)) {
      continue;
    }

    const isCenter = tile.x === hoverTile.x && tile.y === hoverTile.y;
    const points = getTileDiamondPoints(transform, tile.x, tile.y)
      .map((point) => new Phaser.Geom.Point(point.x, point.y));

    graphics.fillStyle(0xfacc15, isCenter ? 0.22 : 0.12);
    graphics.fillPoints(points, true);
    graphics.lineStyle(isCenter ? 2 : 1, 0xf8fafc, isCenter ? 0.95 : 0.45);
    graphics.strokePoints(points, true);
  }
}
