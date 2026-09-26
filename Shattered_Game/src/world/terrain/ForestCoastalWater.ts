const clamp=(n:number)=>Math.max(0,Math.min(1,n));

/** A continuous shoreline field, sampled in world tile coordinates (never tile-local). */
export function coastalWaterFinish(x:number,y:number,coverage:number):{foam:number;shallow:number} {
 if(coverage<=0||coverage>=1)return {foam:0,shallow:0};
 const ripple=.012*Math.sin(x*9+y*5)+.007*Math.sin(y*17-x*3);
 const distance=Math.abs(coverage-(.58+ripple));
 const band=clamp(1-distance/.04);
 return {foam:band*band*.65,shallow:clamp((coverage-.45)/.16)*clamp((1-coverage)/.3)*.28};
}
