import type { EditorEncounterArea } from '../../shared/editor/EditorEncounterModel';
import type { RuntimeEnemySpawn } from './MapRuntime';

export function synthesizeEditorAreaSpawns(
  areas: EditorEncounterArea[],
  mapId: string,
): RuntimeEnemySpawn[] {
  return areas.flatMap((area) => [
    ...(area.manualSpawns ?? []).map((spawn) => ({
      id: `editor_${spawn.id}`,
      definitionId: spawn.enemyDefinitionId,
      mapId,
      tileX: spawn.tileX,
      tileY: spawn.tileY,
      respawnMs: spawn.respawnMs,
      areaId: area.id,
      lootTableId: spawn.lootTableId,
    })),
    ...synthesizeAreaRuleSpawns(area, mapId),
  ]);
}

function synthesizeAreaRuleSpawns(
  area: EditorEncounterArea,
  mapId: string,
): RuntimeEnemySpawn[] {
  const totalTiles = area.width * area.height;
  return area.spawnRules.flatMap((rule, ruleIndex) => {
    const count = Math.min(rule.maxPopulation, totalTiles);
    const stride = Math.max(1, Math.floor(totalTiles / count));
    return Array.from({ length: count }, (_, i) => {
      const index = (i * stride + ruleIndex) % totalTiles;
      return {
        id: `editor_rule_${area.id}_${ruleIndex}_${i}`,
        definitionId: rule.enemyDefinitionId,
        mapId,
        tileX: area.tileX + (index % area.width),
        tileY: area.tileY + Math.floor(index / area.width),
        respawnMs: rule.respawnMs,
        areaId: area.id,
        lootTableId: rule.lootTableId,
      };
    });
  });
}
