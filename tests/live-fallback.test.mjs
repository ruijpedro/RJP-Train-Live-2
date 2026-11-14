import test from "node:test";
import assert from "node:assert/strict";
import {asLiveRows,normalizeLiveLocations,mergeCoordinateSources} from "../src/live-fallback.js";
import {gpsIndicator,serviceDateLisbon} from "../src/gps-indicator.js";
import {CP_AGENCY} from "../src/live-positions.js";
const now=Date.parse("2026-11-14T09:45:00Z");
const date=serviceDateLisbon(now);
const raw=(number,latitude=39.7,longitude=-8.1)=>({
 train_id:number,
 data:{status:{trainNumber:number,latitude,longitude,runDate:date}},
 fixed:{trainService:{code:"IC"},trainStops:[]}
});
test("Comboios Live normalises only provided coordinates, not inferred or fixed points",()=>{
 const missing={train_id:530,fixed:{latitude:39.7,longitude:-8.1}};
 const out=normalizeLiveLocations([raw(120),missing,raw(121,null,-8.1)],{now});
 assert.equal(out.length,1);
 assert.equal(out[0].trainNumber,"120");
 assert.equal(out[0].positionSource,"Comboios Live");
 assert.equal(out[0].gpsVerified,false);
 assert.equal(out[0].timestamp,null);
});
test("A proxy response and a direct raw feed are supported",()=>{
 const original=[raw(2700)];
 assert.equal(asLiveRows(original),original);
 assert.equal(asLiveRows({trains:original}),original);
 assert.equal(normalizeLiveLocations({trains:original},{now}).length,1);
});
test("Rejects stale explicit timestamps, future timestamps, dates and invalid coordinates",()=>{
 const stale={...raw(100),data:{status:{...raw(100).data.status,positionTimestamp:now-400000}}};
 const future={...raw(101),data:{status:{...raw(101).data.status,positionTimestamp:now+90000}}};
 const yesterday={...raw(102),data:{status:{...raw(102).data.status,runDate:"2026-11-13"}}};
 assert.equal(normalizeLiveLocations([stale,future,yesterday,raw(103,40,-7)],{now}).length,1);
});
test("TML coordinates take priority over fallback Live coordinates",()=>{
 const tml={agency:CP_AGENCY,trainNumber:"120",latitude:39.1,longitude:-9.0,timestamp:now-10000};
 const live=normalizeLiveLocations([raw(120),raw(530)],{now});
 const merged=mergeCoordinateSources([tml],live);
 assert.equal(merged.length,2);
 assert.equal(merged.find(v=>v.trainNumber==="120").positionSource,"TML");
 assert.equal(merged.find(v=>v.trainNumber==="120").gpsVerified,true);
 assert.equal(merged.find(v=>v.trainNumber==="530").gpsVerified,false);
});
test("GPS badge distinguishes verified TML GPS from Live unverified position",()=>{
 const live=normalizeLiveLocations([raw(530)],{now});
 const state=gpsIndicator({number:"530",date,vehicles:live,checked:true,now});
 assert.equal(state.state,"live-location");
 assert.match(state.label,/GPS por confirmar/);
 const all=mergeCoordinateSources([{agency:CP_AGENCY,trainNumber:"530",gtfsTripId:"530",latitude:39.2,
  longitude:-8.6,timestamp:now-10000}],live);
 const valid=gpsIndicator({number:"530",date,vehicles:all,checked:true,now});
 assert.equal(valid.state,"available");
 assert.equal(valid.source,"TML");
});
test("Old dates cannot inherit a current position",()=>{
 const live=normalizeLiveLocations([raw(530)],{now});
 assert.equal(gpsIndicator({number:"530",date:"2026-11-13",vehicles:live,checked:true,now}).state,"not-current");
});
test("No positions and source failure cannot be reported as GPS available",()=>{
 assert.equal(gpsIndicator({number:"530",date,vehicles:[],checked:true,now}).state,"not-received");
 assert.equal(gpsIndicator({number:"530",date,vehicles:[],checked:true,now,sourceError:true}).state,"unknown");
});
