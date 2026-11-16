import test from "node:test";import assert from "node:assert/strict";
import {upsertAlert,validateAlert,alertCandidates,filterUnsent} from "../src/editable-alerts.js";
test("editing a beta alert retains ID, replaces fields and does not duplicate",()=>{
 const a={id:"abc",scope:"train",target:"6450",station:"",event:"arrival",lead:10,scheduleType:"weekly",days:[0,1],enabled:true,notifyBefore:true};
 const b={...a,target:"6451",lead:15,event:"both",scheduleType:"monthly",monthDay:23};
 const saved=upsertAlert([a],b);assert.equal(saved.length,1);
 assert.equal(saved[0].id,"abc");assert.equal(saved[0].target,"6451");
 assert.equal(saved[0].lead,15);assert.equal(saved[0].monthDay,23);
});
test("editable alert also accepts exact date and weekday; rejects invalid fields",()=>{
 const a={id:"xyz",scope:"station",target:"Leiria",event:"departure",lead:0,scheduleType:"date",date:"2026-11-16",enabled:true,notifyBefore:true};
 assert.equal(validateAlert(a),true);assert.equal(validateAlert({...a,lead:-1}),false);
 assert.equal(validateAlert({...a,scheduleType:"weekly",days:[]}),false);
});
test("timetable-only beta alert does not claim detected passage",()=>{
 const rule={id:"a",scope:"station",target:"Leiria",event:"arrival",lead:10,scheduleType:"weekly",days:[0,1,2,3,4,5,6],enabled:true,notifyBefore:true};
 const now=Date.parse("2026-11-16T15:55:00Z");
 const candidates=alertCandidates([{number:"6450",stops:[{name:"Leiria",arrival:"16:00:00"}]}],[rule],{date:"2026-11-16",now});
 assert.equal(candidates.length,1);assert.equal(candidates[0].event,"arrival");
 assert.equal("detected" in candidates[0],false);
});
test("notification duplicate filter suppresses multiple checks in same service",()=>{
 const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const c={key:"abc",number:"6450"};
 assert.equal(filterUnsent([c],{storage,now:100}).length,1);
 assert.equal(filterUnsent([c],{storage,now:200}).length,0);
});
