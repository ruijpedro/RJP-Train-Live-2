import test from "node:test";
import assert from "node:assert/strict";
import {shouldUseRuiFallback,normalizeRuiFallback} from "../src/rui-fallback.js";

test("last resort not queried if real CP TML position exists",()=>{
 assert.equal(shouldUseRuiFallback({dateCurrent:true,checkedGtfs:true,checkedTml:true,independentCPPositions:1,gtfsEstimates:0}),false);
});
test("last resort not queried if independent CP estimates exist",()=>{
 assert.equal(shouldUseRuiFallback({dateCurrent:true,checkedGtfs:true,checkedTml:true,independentCPPositions:0,gtfsEstimates:5}),false);
});
test("last resort only after both primary attempts complete and no independent CP map",()=>{
 assert.equal(shouldUseRuiFallback({dateCurrent:true,checkedGtfs:true,checkedTml:true}),true);
 assert.equal(shouldUseRuiFallback({dateCurrent:true,checkedGtfs:false,checkedTml:true}),false);
 assert.equal(shouldUseRuiFallback({dateCurrent:true,checkedGtfs:true,checkedTml:false}),false);
 assert.equal(shouldUseRuiFallback({dateCurrent:false,checkedGtfs:true,checkedTml:true}),false);
});
test("normalize Comboios Live payload as non GPS verified fallback with attribution",()=>{
 const sample={data:[{train_id:730,data:{status:{trainNumber:730,status:"IN_TRANSIT",latitude:40.25,longitude:-8.5,delay:600}},
   db:{trainOrigin:{designation:"Lisboa"},trainDestination:{designation:"Porto"},trainService:{designation:"Intercidades"}},
   fixed:{trainStops:[{station:{code:"1",designation:"Lisboa"}},{station:{code:"2",designation:"Coimbra"}}]}}]};
 const out=normalizeRuiFallback(sample,{fetchedAt:1770000000000});
 assert.equal(out.length,1);assert.equal(out[0].number,"730");assert.equal(out[0].type,"IC");
 assert.equal(out[0].source,"Comboios Live — Rui Costa");
 assert.equal(out[0].isGps,false);assert.equal(out[0].positionTimestamp,null);
 assert.equal(out[0].delayMinutes,10);
});
test("invalid coordinates, duplicates, terminal and Fertagus excluded",()=>{
 const rows={trains:[
  {train_id:101,latitude:0,longitude:0},
  {train_id:200,latitude:39.3,longitude:-8.2,status:"COMPLETED"},
  {train_id:201,latitude:39.3,longitude:-8.2,type:"FT"},
  {train_id:202,latitude:39.3,longitude:-8.2,service:"Regional"},
  {train_id:202,latitude:39.1,longitude:-8.1,service:"Regional"}
 ]};
 const out=normalizeRuiFallback(rows);
 assert.deepEqual(out.map(x=>x.number),["202"]);
 assert.equal(out[0].type,"R");
});
