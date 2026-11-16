import test from "node:test";
import assert from "node:assert/strict";
import {detailStopTimes,detailStopProgress,detailKindSource,detailStatusText,clockLabel,parseClock} from "../src/train-detail.js";
const train={type:"IR",number:"800",stops:[
 {name:"Coimbra-B",departure:"08:45:00"},{name:"Verride",arrival:"09:16:00"},
 {name:"Martingança - Maceira",arrival:"10:06:00"},{name:"Valado - Nazaré - Alcobaça",arrival:"10:25:00"}]};
test("GTFS alone never manufactures an ETA or a real-time delay",()=>{
 const p=detailStopTimes(train,null);
 assert.equal(p[1].scheduled,"09:16");
 assert.equal(p[1].eta,null);
 assert.equal(p[1].etaSource,"unknown");
 assert.equal(detailStatusText(null),"Circulação não confirmada");
});
test("CP delay provides clearly calculated ETA, separately from reported CP ETA",()=>{
 const cp={delayMinutes:13,stops:[{station:"Verride",eta:"09:27",scheduledArrival:"09:16"}],
 lastReportedStation:"Martingança - Maceira"};
 const p=detailStopTimes(train,cp);
 assert.deepEqual([p[1].eta,p[1].etaSource],["09:27","cp-reported"]);
 assert.deepEqual([p[2].eta,p[2].etaSource],["10:19","cp-delay"]);
 assert.deepEqual(detailStopProgress(p,cp),{lastIndex:2,nextIndex:3});
});
test("GTFS time 24:30 rolls over but remains a schedule",()=>{
 assert.equal(parseClock("24:30:00"),1470);
 assert.equal(clockLabel(1470),"00:30");
});
test("UI labels keep evidence source explicit",()=>{
 assert.match(detailKindSource("estimated","timetable"),/horário/);
 assert.match(detailKindSource("estimated","cp-anchored"),/CP \+ GTFS/);
 assert.match(detailKindSource("gps"),/TML/);
 assert.match(detailKindSource("rui"),/contingência/);
});
