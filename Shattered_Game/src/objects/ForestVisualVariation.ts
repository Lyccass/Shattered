import type { ObjectDefinition } from './ObjectTypes';

export type ForestVisualVariation = { width: number; height: number; flipX: boolean };
const UNCHANGED: ForestVisualVariation = {width:1,height:1,flipX:false};

/** Stable per placement, including after chunk eviction. Never changes collision or depth. */
export function getForestVisualVariation(id: string, definition: ObjectDefinition): ForestVisualVariation {
  if (!definition.id.startsWith('forest_') || !['tree','rock','foliage'].includes(definition.category)) return UNCHANGED;
  let hash = 2166136261;
  for (const char of `${definition.id}:${id}`) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  const unit = (hash >>> 0) / 0xffffffff;
  const height = definition.category === 'tree' ? .5 + unit : .85 + unit * .3;
  return {height, width:definition.category === 'tree' ? .8 + unit * .4 : height,
    flipX:((hash >>> 8) & 1) === 1};
}
