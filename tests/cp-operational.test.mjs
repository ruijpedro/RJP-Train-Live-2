import test from "node:test";
import assert from "node:assert/strict";
import {CP_CONFIG_URL,validateCpLookup,cpApiRoot,normalizeCpOperational,lookupCpOperational} from "../src/cp-operational.js";

test("CP national on-demand query validates IDs and date",()=>{
 assert.deepEqual(validateCpLookup("26450","2026-11-13"),{number:"26450",date:"2026-11-13"});
 assert.throws(()=>validateCpLookup("26450/../etc","2026-11-13"));
 assert.throws(()=>validateCpLookup("530","2026-13-13"));
});
test("refuses to send website credentials to an unexpected API domain",()=>{
 assert.throws(()=>cpApiRoot({travelApiUrl:"https://evil.example.com/cp"}));
 assert.equal(cpApiRoot({travelApiUrl:"https://api-gateway.cp.pt/cp"}),"https://api-gateway.cp.pt/cp/services/travel-api");
});
test("CP status and delay are not converted into GPS coordinates",()=>{
 const rec=normalizeCpOperational({
  status:"RUNNING",delay:6,serviceCode:{code:"R",designation:"Regional"},
  lastStationCode:"94-01",hasDisruptions:false,messages:[],
  trainStops:[
   {station:{code:"94-01",designation:"Coimbra-B"},departure:"07:00",delay:6},
   {station:{code:"94-02",designation:"Caldas"},arrival:"08:00",ETA:"08:07"}
  ]
 },{number:"26450",date:"2026-11-13",now:1794579000000});
 assert.equal(rec.delayMinutes,6);
 assert.equal(rec.hasRealGps,false);
 assert.equal(rec.gpsCoordinates,null);
 assert.equal(rec.stops[1].eta,"08:07");
 assert.equal(rec.lastReportedStation,"Coimbra-B");
});
test("fetches CP config and a single train on demand without persisting credentials",async()=>{
 const calls=[];
 const fake=async(url,{headers}={})=>{
  calls.push(url);
  if(url===CP_CONFIG_URL)return {travelApiUrl:"https://api-gateway.cp.pt/cp",travelApiKey:"secret",xcck:"id",xccs:"hidden"};
  assert.equal(headers["x-api-key"],"secret");
  return {status:"SCHEDULED",delay:null,serviceCode:{code:"R"},
   trainStops:[{station:{code:"1",designation:"Teste"},arrival:"10:00"}]};
 };
 const response=await lookupCpOperational({number:"26450",date:"2026-11-13",transport:fake});
 assert.equal(calls.length,2);
 assert.equal(response.stops.length,1);
 assert.equal(JSON.stringify(response).includes("secret"),false);
 assert.equal(JSON.stringify(response).includes("hidden"),false);
});
test("rejected API request cannot invent national GPS",async()=>{
 const fake=async(url)=>{
  if(url===CP_CONFIG_URL)return {travelApiUrl:"https://api-gateway.cp.pt/cp",travelApiKey:"secret",xcck:"id",xccs:"hidden"};
  throw new Error("HTTP 500");
 };
 await assert.rejects(lookupCpOperational({number:"530",date:"2026-11-13",transport:fake}),/500/);
});
