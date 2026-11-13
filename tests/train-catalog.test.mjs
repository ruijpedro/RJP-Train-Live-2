import test from "node:test";
import assert from "node:assert/strict";
import {filterCatalogue,pageCatalogue,PAGE_SIZE,cpLookupNumber} from "../src/train-catalog.js";
const trains=Array.from({length:1341},(_,i)=>({
 id:"cp-"+i,number:String(20000+i),type:i%3===0?"R":i%3===1?"IC":"AP",
 route:"Serviço nacional",origin:i===1340?"Coimbra-B":"Lisboa Oriente",
 destination:i===1340?"Caldas da Rainha":"Porto Campanhã",stops:[{name:i===1340?"Monte Real":"Aveiro"}]
}));
test("national catalog searches all 1341 CP circulations, including beyond first 100",()=>{
 assert.equal(filterCatalogue(trains,{query:"21340"}).length,1);
 assert.equal(filterCatalogue(trains,{query:"Monte Real"}).length,1);
 assert.equal(filterCatalogue(trains,{query:"Porto Campanha"}).length,1340);
});
test("R, IC and AP filters work and CP means whole CP catalog",()=>{
 assert.equal(filterCatalogue(trains,{type:"CP"}).length,1341);
 assert.equal(filterCatalogue(trains,{type:"FT"}).length,0);
 assert.equal(filterCatalogue(trains,{type:"IC"}).length,447);
});
test("pagination advances across every result without losing the final train",()=>{
 const all=filterCatalogue(trains);
 const first=pageCatalogue(all,PAGE_SIZE);
 assert.equal(first.visible.length,80);
 assert.equal(first.more,1261);
 const last=pageCatalogue(all,2000);
 assert.equal(last.visible.length,1341);
 assert.equal(last.more,0);
 assert.equal(last.visible.at(-1).number,"21340");
});
test("CP on-demand button only accepts a true numeric GTFS train ID",()=>{
 assert.equal(cpLookupNumber({number:"26450"}),"26450");
 assert.equal(cpLookupNumber({number:"R 26450"}),null);
 assert.equal(cpLookupNumber({number:"[N18KL]18474"}),null);
});
