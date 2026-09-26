import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createNaturalCliffSample}=await server.ssrLoadModule('/src/shared/editor/NaturalCliffSample.ts');
 const {serializeEditorMap}=await server.ssrLoadModule('/src/shared/editor/EditorMapSerializer.ts');
 await writeFile('art/forest-painterly/cliff-kit/assembly.json',serializeEditorMap(createNaturalCliffSample()));
}finally{await server.close();}
