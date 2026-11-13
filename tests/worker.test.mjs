import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/worker.js";
test("lab health is independent, and doesn't imply production readiness",async()=>{
 const r=await worker.fetch(new Request("https://lab.invalid/health"),{},{});
 const obj=await r.json();
 assert.equal(r.status,200);
 assert.equal(obj.independentOfRuiCosta,true);
 assert.equal(obj.productionReady,false);
});
test("lab rejects unsupported methods without external fetch",async()=>{
 const r=await worker.fetch(new Request("https://lab.invalid/api/trains/active",{method:"POST"}),{},{});
 assert.equal(r.status,405);
});
