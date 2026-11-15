import test from "node:test";
import assert from "node:assert/strict";
import {timeMinutes,currentLisbon,estimateTrain,buildEstimatedPositions} from "../src/estimated-positions.js";
const day="2026-11-14";
const at=s=>Date.parse(day+"T"+s+"Z");
const train={id:"881",number:"881",type:"IR",origin:"A",destination:"C",stops:[
 {id:"94_100",name:"A",arrival:"12:00:00",departure:"12:00:00",location:[40,-8]},
 {id:"94_200",name:"B",arrival:"12:20:00",departure:"12:22:00",location:[40.2,-8.2]},
 {id:"94_300",name:"C",arrival:"12:40:00",departure:"12:40:00",location:[40.4,-8.4]}
]};
test("clock uses Lisbon and GTFS accepts seconds and 24+ hours",()=>{
 assert.equal(timeMinutes("25:15:00"),1515);
 assert.deepEqual(currentLisbon(at("12:10:00")).date,day);
});
test("schedule interpolation is explicitly non-GPS and between stops",()=>{
 const p=estimateTrain(train,{date:day,now:at("12:10:00")});
 assert.equal(p.level,"timetable");assert.equal(p.isGps,false);
 assert.equal(p.latitude,40.1);assert.equal(p.longitude,-8.1);
 assert.match(p.note,/APROXIMADA/);
});
test("CP anchor normalizes GTFS underscores and CP hyphens",()=>{
 const cp={status:"IN_TRANSIT",lastStationCode:"94-200",lastReportedStation:"B",delayMinutes:2,obtainedAt:new Date(at("12:30:00")).toISOString()};
 const p=estimateTrain(train,{date:day,now:at("12:30:00"),cp});
 assert.equal(p.level,"cp-anchored");
 assert.equal(p.fromStation,"B");assert.equal(p.toStation,"C");
 assert.ok(p.latitude>40.2&&p.latitude<40.4);
 assert.equal(p.isGps,false);
});
test("AT_STATION anchors to station without claiming GPS",()=>{
 const cp={status:"AT_STATION",lastStationCode:"94-200",obtainedAt:new Date(at("12:21:00")).toISOString()};
 const p=estimateTrain(train,{date:day,now:at("12:21:00"),cp});
 assert.equal(p.latitude,40.2);assert.equal(p.level,"cp-anchored");
});
test("completed or future CP services are not plotted as running",()=>{
 const cp={status:"COMPLETED",lastStationCode:"94-300",obtainedAt:new Date(at("12:30:00")).toISOString()};
 assert.equal(estimateTrain(train,{date:day,now:at("12:30:00"),cp}),null);
 assert.equal(estimateTrain(train,{date:day,now:at("11:00:00")}),null);
 assert.equal(estimateTrain(train,{date:day,now:at("13:00:00")}),null);
});
test("GPS takes precedence over any estimate for known number",()=>{
 const output=buildEstimatedPositions({trains:[train],date:day,now:at("12:10:00"),
  gpsVehicles:[{agency:"N18KL",trainNumber:"881"}]});
 assert.equal(output.length,0);
});
test("never borrow yesterday CP status or draw on a different date",()=>{
 assert.equal(estimateTrain(train,{date:"2026-11-13",now:at("12:10:00")}),null);
 const cp={status:"COMPLETED",lastStationCode:"94-300",obtainedAt:new Date(at("11:00:00")).toISOString()};
 const p=estimateTrain(train,{date:day,now:at("12:10:00"),cp});
 assert.equal(p.level,"timetable");
});
test("missing coordinates do not generate estimate",()=>{
 const x=structuredClone(train);x.stops.forEach(s=>s.location=null);
 assert.equal(estimateTrain(x,{date:day,now:at("12:10:00")}),null);
});

test("previous-day trips with GTFS times 24:xx remain visible after midnight",()=>{
 const past={...train,number:"529",id:"overnight-529",stops:[
  {id:"a",name:"A",arrival:"23:45:00",departure:"23:45:00",location:[40,-8]},
  {id:"b",name:"B",arrival:"24:30:00",departure:"24:30:00",location:[40.3,-8.3]},
  {id:"c",name:"C",arrival:"25:25:00",departure:"25:25:00",location:[40.5,-8.5]}
 ]};
 const midnight=Date.parse("2026-11-15T00:15:00Z");
 const p=estimateTrain(past,{date:"2026-11-14",now:midnight});
 assert.ok(p);assert.equal(p.date,"2026-11-14");assert.equal(p.isGps,false);
 assert.ok(p.latitude>40&&p.latitude<40.3);
 const both=buildEstimatedPositions({date:"2026-11-15",now:midnight,
  trains:[],previousDay:{date:"2026-11-14",trains:[past]}});
 assert.equal(both.length,1);
});
test("previous day not displayed outside overnight window",()=>{
 const past={...train,number:"529",stops:[
  {name:"A",departure:"23:45:00",arrival:"23:45:00",location:[40,-8]},
  {name:"B",departure:"24:30:00",arrival:"24:30:00",location:[40.3,-8.3]}
 ]};
 assert.equal(estimateTrain(past,{date:"2026-11-14",now:Date.parse("2026-11-15T08:00:00Z")}),null);
});
test("forecast for yesterday is not shown just because yesterday remains selected",()=>{
 const out=buildEstimatedPositions({date:"2026-11-14",now:Date.parse("2026-11-15T00:30:00Z"),
  trains:[train]});
 assert.deepEqual(out,[]);
});
