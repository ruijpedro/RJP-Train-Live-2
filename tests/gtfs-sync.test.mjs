import test from "node:test";
import assert from "node:assert/strict";
import {usableManifest} from "../src/gtfs-sync.js";
const now=Date.parse("2026-11-15T10:00:00Z");
const recent={date:"2026-11-15",file:"2026-11-15.json",trains:858};
const m={gps:false,realtime:false,generatedAt:"2026-11-15T04:17:00+00:00",days:[recent]};
test("accepts fresh GTFS day with non-GPS flags",()=>{
 assert.equal(usableManifest(m,{date:"2026-11-15",now}),true);
});
test("rejects missing day, stale or GPS-flagged manifest",()=>{
 assert.equal(usableManifest(m,{date:"2026-11-16",now}),false);
 assert.equal(usableManifest({...m,generatedAt:"2026-10-01T00:00:00Z"},{date:"2026-11-15",now}),false);
 assert.equal(usableManifest({...m,gps:true},{date:"2026-11-15",now}),false);
});
