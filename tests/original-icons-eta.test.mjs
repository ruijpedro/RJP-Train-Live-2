import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/original-layout.css",import.meta.url),"utf8");
test("map categories use exact original RJP Train Live palette",()=>{
 for(const [type,color] of Object.entries({U:"#2563eb",R:"#16a34a",IR:"#7c3aed",IC:"#ea580c",AP:"#b91c1c",SUD:"#0f766e",FT:"#0891b2"}))
  assert.ok(src.includes(type+':"'+color+'"'),type);
 assert.match(css,/width:30px;height:30px/);
 assert.match(css,/border:2px solid #fff/);
});
test("estimated icons retain type and a subtle outline, without floating badges",()=>{
 assert.match(src,/trainMapIcon\(v.type,v.level\)/);
 assert.match(css,/rjp-marker-estimated/);
 assert.doesNotMatch(src,/const badge=estimated\?/);
 assert.match(src,/const badge="";/);
 assert.match(css,/border-style:dashed/);
});
test("ETA is not shown as a countdown for GTFS-only services",()=>{
 assert.match(src,/serviceDate===clock.date&&cp&&s.etaSource!=="unknown"/);
 assert.match(src,/Dentro de /);
 assert.match(src,/Mais informação · Fonte e precisão/);
});
