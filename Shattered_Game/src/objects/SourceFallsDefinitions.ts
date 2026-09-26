import type { ObjectDefinition } from './ObjectTypes';

export const SOURCE_FALLS_ASSETS = [{
  key: 'source-falls-waterfall', path: '/assets/forest-painterly/natural-cliffs/waterfall.png',
}];

/** The fall and its banks are one painted silhouette, without rectangular seams. */
export const SOURCE_FALLS_DEFINITIONS: ObjectDefinition[] = [{
  id: 'source_falls_waterfall', displayName: 'Source Falls · Mossy Waterfall',
  category: 'waterfall', blocksMovement: true, fixedElevation: 12,
  collisionFootprint: Array.from({length: 16}, (_, i) => ({x: i % 4, y: Math.floor(i / 4)})),
  visual: {parts: [{shape: 'sprite', textureKey: 'source-falls-waterfall',
    scale: 320 / 1536, originX: .5, originY: .87, localOffsetX: 0, localOffsetY: 48}]},
  shadow: {enabled: false, localOffsetX: 0, localOffsetY: 0, width: 0, height: 0, alpha: 0},
  depth: {anchorMode: 'frontTileCenter', localOffsetX: 0, localOffsetY: 0, depthOffset: .1},
  debug: {color: 0x68c9bd},
}];
