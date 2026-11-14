import test from "node:test";
import assert from "node:assert/strict";
import {sampleCpByType} from "../src/train-catalog.js";
test("CP national sample chooses unique valid numbers across service classes",()=>{
 const classes=["U","R","IR","IC","AP"];
 const trains=classes.flatMap((type,i)=>[
  {type,number:String(100+i),departure:"10:40",arrival:"12:20"},
  {type,number:String(200+i),departure:"13:30",arrival:"14:30"}
 ]);
 const out=sampleCpByType(trains,{clock:"11:20"});
 assert.deepEqual(out.map(x=>x.type),classes);
 assert.deepEqual(out.map(x=>x.number),classes.map((_,i)=>String(100+i)));
});
test("national sampler does not treat invalid train identifiers as CP services",()=>{
 const out=sampleCpByType([{type:"R",number:"R 500",departure:"10:00",arrival:"11:00"},
  {type:"R",number:"500",departure:"10:00",arrival:"11:00"}],{clock:"10:30",types:["R"]});
 assert.equal(out.length,1);
 assert.equal(out[0].number,"500");
});
test("sampler does not create GPS or report running status",()=>{
 const out=sampleCpByType([{type:"IC",number:"730",departure:"10:00",arrival:"13:00"}],{clock:"11:00",types:["IC"]});
 assert.equal(Object.hasOwn(out[0],"latitude"),false);
 assert.equal(Object.hasOwn(out[0],"gps"),false);
 assert.equal(Object.hasOwn(out[0],"status"),false);
});
