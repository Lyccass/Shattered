import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {createForestPackSample}=await server.ssrLoadModule('/src/shared/editor/ForestPackSample.ts');
  const {createCoastalForestSample}=await server.ssrLoadModule('/src/shared/editor/CoastalForestSample.ts');
  const {FOREST_COASTAL_DEFINITIONS}=await server.ssrLoadModule('/src/objects/ForestCoastalDefinitions.ts');
  await writeFile('public/assets/forest-painterly/coastal-prefabs.json',JSON.stringify(FOREST_COASTAL_DEFINITIONS,null,2)+'\n');
  const {FOREST_GROUND_DETAILS}=await server.ssrLoadModule('/src/objects/ForestGroundDetails.ts');
  await writeFile('public/assets/forest-painterly/ground-detail-prefabs.json',JSON.stringify(FOREST_GROUND_DETAILS,null,2)+'\n');
  const {serializeEditorMap}=await server.ssrLoadModule('/src/shared/editor/EditorMapSerializer.ts');
  await writeFile('art/forest-painterly/coastal-forest-sample.json',serializeEditorMap(createCoastalForestSample()));
  await writeFile('art/forest-painterly/forest-pack-sample.json',serializeEditorMap(createForestPackSample()));
} finally { await server.close(); }
