import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
const layout=readFileSync(new URL("../src/original-layout.css",import.meta.url),"utf8");
test("repeating an active train category clears the filter to show all",()=>{
 assert.match(main,/selected=selected===choice\?"ALL":choice/);
});
test("seven operator-type filters fit the mobile toolbar without Todos",()=>{
 assert.match(layout,/\.type\[data-type="ALL"\]/);
 assert.match(layout,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});
test("scheduled estimates use service color but retain dashed non-GPS edge",()=>{
 assert.match(main,/style="--service-color:/);
 assert.match(layout,/\.estimateMarker\.scheduleOnly[\s\S]*?border:2px dashed #ffe09c/);
 assert.match(layout,/\.estimateMarker\.cpAnchor[\s\S]*?border:2px dashed #d7b4ff/);
});
