import test from "node:test";
import assert from "node:assert/strict";
import {buildUnifiedFeed} from "../src/unified-feed.js";
import {CP_AGENCY,FT_AGENCY} from "../src/live-positions.js";
const now=1794579000000;
const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
const train={id:"26450_20261110",number:"26450",type:"R",origin:"Coimbra-B",destination:"Caldas da Rainha",departure:"05:15:00",arrival:"07:34:00"};
const pos=(agency,vehicle,trip)=>({agency_id:agency,vehicle_id:vehicle,latitude:39.7,longitude:-8.8,received_at:now-25000,trip_id:trip,route_short_name:"R"});
test("merge valid CP trip and Fertagus with explicit original provenance",()=>{
 const f=buildUnifiedFeed({now,cpDay:{date:day,trains:[train]},positionsPayload:{data:[pos(CP_AGENCY,"unit-17",train.id),pos(FT_AGENCY,"unit-18","ft-trip")]}});
 assert.equal(f.coverage.cpFreshPositions,1);
 assert.equal(f.coverage.ftFreshPositions,1);
 assert.equal(f.coverage.cpMatchedToGtfs,1);
 assert.equal(f.vehicles[0].trainNumber,"26450");
 assert.equal(f.vehicles[0].position.isInterpolated,false);
 assert.equal(f.vehicles[0].delayMinutes,null);
 assert.equal(f.vehicles[1].trainNumber,null);
});
test("unknown CP vehicle ID never becomes an invented train number",()=>{
 const f=buildUnifiedFeed({now,cpDay:{date:day,trains:[train]},positionsPayload:{data:[pos(CP_AGENCY,"26450","unknown-trip")]}});
 assert.equal(f.coverage.cpUnmatched,1);
 assert.equal(f.vehicles[0].trainNumber,null);
 assert.equal(f.vehicles[0].match.validated,false);
});
test("stale TML positions excluded, schedules retained",()=>{
 const p={...pos(CP_AGENCY,"v1",train.id),received_at:now-3600000};
 const f=buildUnifiedFeed({now,cpDay:{date:day,trains:[train]},positionsPayload:{data:[p]}});
 assert.equal(f.vehicles.length,0);
 assert.equal(f.coverage.cpScheduledToday,1);
});
test("ETA and alerts never masquerade as GPS or confirmed delay",()=>{
 const f=buildUnifiedFeed({now,cpDay:{date:day,trains:[train]},
 positionsPayload:{data:[pos(CP_AGENCY,"unit-17",train.id)]},
 etaPayload:{data:[{trip_id:train.id,vehicle_id:"unit-17",stop_id:"test",stop_name:"Coimbra-B",eta_at:now+60000}]},
 alertsPayload:{data:[{_id:"alert1",agency_id:CP_AGENCY,title:"Aviso",description:"Obras"}]}});
 assert.equal(f.vehicles[0].eta.length,1);
 assert.equal(f.vehicles[0].delayMinutes,null);
 assert.equal(f.alerts.length,1);
 assert.equal(f.vehicles[0].position.kind,"operator_reported_coordinates");
});

test("namespaced CP trip id resolves to a unique GTFS train number",()=>{
 const t={id:"18851_20251101",number:"18851",type:"U",origin:"Sintra",destination:"Lisboa",departure:"10:10:00",arrival:"10:50:00"};
 const f=buildUnifiedFeed({now,cpDay:{date:day,trains:[t]},positionsPayload:{data:[{
  ...pos(CP_AGENCY,"[N18KL]18851","[76XA2][N18KL]18851_20251214"),route_short_name:"Sintra"
 }]}});
 assert.equal(f.coverage.cpMatchedToGtfs,1);
 assert.equal(f.vehicles[0].trainNumber,"18851");
 assert.equal(f.vehicles[0].match.method,"trip-id-number");
});
test("duplicate CP GTFS train number remains unmatched",()=>{
 const t1={...train,id:"26450_20261101"};
 const t2={...train,id:"26450_20261113"};
 const f=buildUnifiedFeed({now,cpDay:{date:day,trains:[t1,t2]},positionsPayload:{data:[
  pos(CP_AGENCY,"[N18KL]26450","[76XA2][N18KL]26450_20251214")
 ]}});
 assert.equal(f.coverage.cpMatchedToGtfs,0);
 assert.equal(f.vehicles[0].trainNumber,null);
});

test("non-rail ETA never enters combined railway feed",()=>{
 const payload={data:[
  {trip_id:train.id,vehicle_id:"unit-17",stop_id:"coimbra",eta_at:now+30000},
  {trip_id:"bus-trip",vehicle_id:"bus-456",stop_id:"bus-stop",eta_at:now+30000}
 ]};
 const f=buildUnifiedFeed({now,cpDay:{date:day,trains:[train]},
   positionsPayload:{data:[pos(CP_AGENCY,"unit-17",train.id)]},
   etaPayload:payload});
 assert.equal(f.coverage.tmlEtaPublishedTotal,2);
 assert.equal(f.coverage.tmlRailEtaRecords,1);
 assert.equal(f.vehicles[0].eta.length,1);
});
