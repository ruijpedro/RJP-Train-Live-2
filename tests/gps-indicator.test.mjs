import test from "node:test";
import assert from "node:assert/strict";
import {gpsIndicator,serviceDateLisbon} from "../src/gps-indicator.js";
import {CP_AGENCY,FT_AGENCY} from "../src/live-positions.js";
const now=Date.parse("2026-11-13T17:20:00Z"), date=serviceDateLisbon(now);
const cp={agency:CP_AGENCY,trainNumber:"26450",latitude:39.4,longitude:-8.9,
 timestamp:now-42000,gtfsTripId:"26450_20261113"};
const state=args=>gpsIndicator({number:"26450",tripId:"26450_20261113",date,now,checked:true,...args});
test("recent TML CP coordinate yields GPS available, with source and timestamp",()=>{
 const s=state({vehicles:[cp]});
 assert.equal(s.state,"available");
 assert.equal(s.source,"TML");
 assert.equal(s.label,"GPS disponível");
 assert.ok(s.observedAt);
});
test("stale, incomplete, or wrong service id never becomes GPS available",()=>{
 assert.equal(state({vehicles:[{...cp,timestamp:now-300000}]}).state,"not-received");
 assert.equal(state({vehicles:[{...cp,latitude:NaN}]}).state,"not-received");
 assert.equal(state({vehicles:[{...cp,gtfsTripId:"other-service"}]}).state,"not-received");
 assert.equal(state({vehicles:[{...cp,agency:FT_AGENCY}]}).state,"not-received");
 assert.equal(state({vehicles:[]}).state,"not-received");
});
test("no GPS report is not a claim the vehicle lacks a sensor",()=>{
 const s=state({vehicles:[]});
 assert.match(s.detail,/Não foi publicada uma posição recente/);
 assert.equal(s.label,"Sem GPS recebido");
});
test("network errors must not be mislabeled as no-signal",()=>{
 const s=state({vehicles:[],sourceError:true});
 assert.equal(s.state,"unknown");
 assert.equal(s.label,"GPS não verificado");
});
test("before a TML check the badge remains a pending state",()=>{
 const s=gpsIndicator({number:"26450",date,now,checked:false});
 assert.equal(s.state,"checking");
});
test("GPS coordinates cannot be mapped onto yesterday or tomorrow's schedule",()=>{
 for(const d of ["2026-11-12","2026-11-14"]){
  const s=state({date:d,vehicles:[cp]});
  assert.equal(s.state,"not-current");
 }
});
test("same-number service without a validated GTFS id may be matched by number",()=>{
 const s=state({tripId:null,vehicles:[cp]});
 assert.equal(s.state,"available");
});
