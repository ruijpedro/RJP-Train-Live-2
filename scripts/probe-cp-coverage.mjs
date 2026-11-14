#!/usr/bin/env node
// Read-only national CP exploration: <=6 explicit services, sequential 0.6s apart.
// No GPS is attributed to trains without fresh, explicit vehicle-coordinate evidence.
// No credentials, response bodies, vehicle coordinates, or raw keys are logged/exported.
import {readFile} from "node:fs/promises";
const now=new Date();
const dt=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
const clock=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit",hour12:false}).format(now);
const mins=s=>{const m=String(s??"").match(/^(\d{1,2}):(\d{2})/);return m?+m[1]*60+(+m[2]):NaN};
const today=mins(clock);
const types=["U","R","IR","IC","AP"];
const candidates=[];
try{
 const day=JSON.parse(await readFile("public/data/cp/"+dt+".json","utf8"));
 for(const type of types){
  const pool=day.trains.filter(t=>t.type===type&&/^\d{1,6}$/.test(String(t.number))&&Number.isFinite(mins(t.departure))&&Number.isFinite(mins(t.arrival)));
  // Prefer a service running now, using the schedule only to choose a sample.
  const train=pool.find(t=>{
   const dep=mins(t.departure),arr=mins(t.arrival);
   return dep<=today&&today<=arr+(arr<dep?1440:0);
  })??pool.find(t=>mins(t.departure)>today)??pool[0];
  if(train)candidates.push({number:String(train.number),type,selection:"GTFS sample, not running confirmation"});
 }
}catch(e){console.log("CP NATIONAL SAMPLING",JSON.stringify({date:dt,reason:String(e?.code??e?.name??"unavailable")}))}
if(!candidates.some(c=>c.number==="26450"))candidates.push({number:"26450",type:"R",selection:"Oeste reference"});
const samples=candidates.slice(0,6);
const summary={date:dt,clock,checked:0,ok:0,errors:0,vehicleCoordinateFields:0,withVehicleTimestamp:0,byType:[]};
let config;
try{
 const r=await fetch("https://www.cp.pt/fe-config.json",{signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("configuration HTTP "+r.status);
 config=await r.json();
}catch(e){console.log("CP NATIONAL SAMPLE",JSON.stringify({status:"configuration-unavailable",reason:String(e?.name??"error")}));process.exit(0)}
const url=new URL(String(config?.travelApiUrl??""));
if(url.protocol!=="https:"||url.hostname!=="api-gateway.cp.pt"||!config?.travelApiKey||!config?.xcck||!config?.xccs){
 console.log("CP NATIONAL SAMPLE",JSON.stringify({status:"configuration-validation-failed"}));process.exit(0)
}
const root=url.href.replace(/\/+$/,"").replace(/\/services\/travel-api$/,"")+"/services/travel-api";
for(const train of samples){
 await new Promise(resolve=>setTimeout(resolve,600));
 const out={number:train.number,type:train.type,http:null};
 try{
  const r=await fetch(root+"/trains/"+train.number+"/timetable/"+dt,{
   headers:{Accept:"application/json",Origin:"https://www.cp.pt",Referer:"https://www.cp.pt/",
    "x-api-key":config.travelApiKey,"x-cp-connect-id":config.xcck,"x-cp-connect-secret":config.xccs},
   signal:AbortSignal.timeout(14000)});
  out.http=r.status;
  if(r.ok){
   const j=await r.json();
   out.stops=Array.isArray(j?.trainStops)?j.trainStops.length:0;
   out.status=typeof j?.status==="string"?j.status.slice(0,35):"unreported";
   out.lastStation=!!j?.lastStationCode;
   out.delayField=Number.isFinite(j?.delay);
   const coords=[
    [j?.latitude,j?.longitude,"top-level"],
    [j?.position?.latitude,j?.position?.longitude,"position"],
    [j?.location?.latitude,j?.location?.longitude,"location"]
   ].filter(([a,b])=>typeof a==="number"&&typeof b==="number"&&a>=36&&a<=43&&b>=-10&&b<=-6);
   out.coordinateField=coords[0]?.[2]??null;
   out.hasPositionTimestamp=!!(j?.position?.timestamp||j?.receivedAt||j?.position?.observedAt);
   out.hasGpsProof=false; // A coordinate alone is not proof of GPS measurement.
   summary.vehicleCoordinateFields+=Number(!!out.coordinateField);
   summary.withVehicleTimestamp+=Number(out.hasPositionTimestamp&&!!out.coordinateField);
   summary.ok++;
  }else summary.errors++;
 }catch(e){out.http="network-error";out.reason=String(e?.name??"unknown");summary.errors++;}
 summary.checked++;
 summary.byType.push({type:train.type,http:out.http,hasReportedCoordinates:!!out.coordinateField});
 console.log("CP NATIONAL SAMPLE",JSON.stringify(out));
}
console.log("CP NATIONAL SUMMARY",JSON.stringify(summary));
