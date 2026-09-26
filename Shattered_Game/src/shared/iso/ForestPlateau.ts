export const FOREST_PLATEAU_TILE='forest_grass_19';
export const FOREST_PLATEAU_HEIGHT=96;
/** Front-facing boundary ownership for one modular isometric plateau tile. */
export function plateauFaces(x:number,y:number,sample:(x:number,y:number)=>string|null):Array<'x'|'y'>{
 if(sample(x,y)!==FOREST_PLATEAU_TILE)return [];
 const faces:Array<'x'|'y'>=[];
 if(sample(x+1,y)!==FOREST_PLATEAU_TILE)faces.push('x');
 if(sample(x,y+1)!==FOREST_PLATEAU_TILE)faces.push('y');
 return faces;
}
