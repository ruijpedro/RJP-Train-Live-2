import test from "node:test";
import assert from "node:assert/strict";
import {normalizePositions,CP_AGENCY,FT_AGENCY} from "../src/live-positions.js";
const now=1794579000000;
const valid=(agency,id,ms=now)=>({agency_id:agency,vehicle_id:id,latitude:38.7,longitude:-9.1,received_at:ms,trip_id:"abc"});
test("accepts fresh TML CP and Fertagus positions only",()=>{
 const v=normalizePositions({data:[valid(CP_AGENCY,"CP1"),valid(FT_AGENCY,"FT1")]},{now});
 assert.equal(v.length,2);assert.deepEqual(v.map(x=>x.type),["CP","FT"]);
});
test("rejects stale, missing timestamp, third parties and invalid coordinates",()=>{
 const v=normalizePositions({data:[
  valid(CP_AGENCY,"old",now-600000),
  {...valid(FT_AGENCY,"no-time"),received_at:null,created_at:null},
  valid("OTHER","bus"), {...valid(CP_AGENCY,"foreign"),longitude:20},
  {...valid(CP_AGENCY,"no-id"),vehicle_id:null}
 ]},{now});
 assert.equal(v.length,0);
});
test("no GPS inferred from timetable",()=>assert.deepEqual(normalizePositions({data:[{agency_id:CP_AGENCY,vehicle_id:"26450",stops:[{departure:"07:34:00"}]}]},{now}),[]));
