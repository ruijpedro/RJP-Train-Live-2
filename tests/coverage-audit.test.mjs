import test from "node:test";
import assert from "node:assert/strict";
import {coverageAudit,operationalIndicators} from "../src/coverage-audit.js";
import {CP_AGENCY,FT_AGENCY} from "../src/live-positions.js";
const date="2026-11-13";
const trains=[
 {number:"26450",type:"R"},{number:"530",type:"IC"},{number:"120",type:"AP"},
 {number:"18451",type:"U"},{number:"18452",type:"U"},
];
const gps=(agency,number,type)=>({agency,trainNumber:number,type,latitude:38.7,longitude:-9.1});

test("distinct CP scheduled, TML coordinates, and CP direct replies",()=>{
 const a=coverageAudit({date,trains,vehicles:[
  gps(CP_AGENCY,"18451","U"),gps(CP_AGENCY,null,"CP"),gps(FT_AGENCY,null,"FT")
 ],queries:[
  {date,number:"26450",success:true,result:{status:"não indicado",stops:[{station:"Coimbra-B"}]}},
  {date,number:"530",success:false},
  {date,number:"120",success:true,result:{status:"RUNNING",lastStationCode:"94-1",stops:[]}}
 ]});
 assert.deepEqual([a.scheduled,a.cpPositions,a.cpMatched,a.cpUnmatched,a.fertagusPositions],[5,2,1,1,1]);
 assert.equal(a.cpAnswered,2);
 assert.equal(a.cpErrors,1);
 assert.equal(a.cpIndicators,1);
 assert.equal(a.byType.find(r=>r.type==="U").scheduled,2);
 assert.equal(a.byType.find(r=>r.type==="U").withPosition,1);
 assert.equal(a.byType.find(r=>r.type==="AP").withIndicators,1);
 assert.equal(a.byType.find(r=>r.type==="R").withIndicators,0);
});

test("repeat same train query does not increase number of CP trains verified",()=>{
 const q=[
  {date,number:"26450",success:false},
  {date,number:"26450",success:true,result:{status:"SCHEDULED",stops:[]}},
  {date,number:"26450",success:true,result:{status:"SCHEDULED",stops:[{station:"Teste"}]}},
  {date:"2026-11-14",number:"530",success:true,result:{status:"RUNNING"}}
 ];
 const a=coverageAudit({date,trains,queries:q});
 assert.equal(a.cpAnswered,1);
 assert.equal(a.cpErrors,0);
 assert.equal(a.cpIndicators,0);
});

test("planned stops alone are not operational movement evidence",()=>{
 assert.equal(operationalIndicators({status:"não indicado",stops:[{station:"A",scheduledArrival:"10:00"}]}),false);
 assert.equal(operationalIndicators({status:"SCHEDULED",stops:[]}),false);
 assert.equal(operationalIndicators({status:"RUNNING",stops:[]}),true);
 assert.equal(operationalIndicators({status:"não indicado",stops:[{eta:"10:04"}]}),true);
 assert.equal(operationalIndicators({status:"não indicado",delayMinutes:0}),true);
});

test("never classify schedules as GPS or all CP services as queried",()=>{
 const a=coverageAudit({date,trains});
 assert.equal(a.scheduled,5);
 assert.equal(a.cpPositions,0);
 assert.equal(a.cpAnswered,0);
 assert.equal(a.cpIndicators,0);
 assert.equal(a.byType.reduce((acc,v)=>acc+v.withPosition,0),0);
});

test("a successful CP query outside GTFS is labelled CP, not a fabricated service type",()=>{
 const a=coverageAudit({date,trains,queries:[{date,number:"99999",success:true,result:{type:"R",status:"não indicado",stops:[]}}]});
 assert.equal(a.cpAnswered,1);
 assert.equal(a.byType.find(v=>v.type==="CP").cpAnswered,0);
 assert.equal(a.byType.find(v=>v.type==="R").cpAnswered,1);
});
