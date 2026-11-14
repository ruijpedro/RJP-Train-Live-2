#!/usr/bin/env node
// Diagnostic only: count valid third-party reported coordinates. Do not
// print actual coordinates, source credentials or trains' private data.
import {LIVE_PROXY_URL,asLiveRows,normalizeLiveLocations} from "../src/live-fallback.js";
const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
try{
 const r=await fetch(LIVE_PROXY_URL,{headers:{Accept:"application/json"},signal:controller.signal});
 if(!r.ok)throw Error("HTTP "+r.status);
 const body=await r.json();
 const rows=asLiveRows(body);
 const places=normalizeLiveLocations(rows);
 const withPositionTimestamp=places.filter(x=>Number.isFinite(x.timestamp)).length;
 const typeCounts={};
 for(const p of places)typeCounts[p.type]=(typeCounts[p.type]||0)+1;
 console.log("LIVE FALLBACK DIAGNOSTICS",JSON.stringify({
  source:"Comboios Live / Rui Costa via existing RJP proxy",
  rawTrains:rows.length,coordinateLocations:places.length,
  explicitlyTimestamped:withPositionTimestamp,
  timeNotVerifiable:places.length-withPositionTimestamp,
  byType:typeCounts,gpsConfirmed:0,
  note:"Live coordinates are not certified GNSS/GPS; TML has priority."
 }));
}catch(e){
 console.log("LIVE FALLBACK DIAGNOSTICS",JSON.stringify({
  source:"Comboios Live / Rui Costa",available:false,error:String(e?.message||e).slice(0,160)
 }));
}finally{clearTimeout(timeout)}
