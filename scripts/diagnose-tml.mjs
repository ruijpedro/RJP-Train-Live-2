#!/usr/bin/env node
// Read-only diagnosis. Does not manufacture or cache positions.
import {normalizePositions,CP_AGENCY,FT_AGENCY,TML_URL} from "../src/live-positions.js";
const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
try{
 const r=await fetch(TML_URL,{headers:{Accept:"application/json"},signal:controller.signal});
 console.log("TML HTTP:",r.status);
 console.log("TML CORS Allow-Origin:",r.headers.get("access-control-allow-origin")||"(absent)");
 if(!r.ok)throw Error("HTTP "+r.status);
 const response=await r.json();
 const rows=Array.isArray(response?.data)?response.data:Array.isArray(response)?response:[];
 console.log("Total TML positions:",rows.length);
 for(const [name,agency] of [["CP",CP_AGENCY],["Fertagus",FT_AGENCY]]){
  const all=rows.filter(p=>String(p?.agency_id)===agency);
  const fresh=normalizePositions({data:all});
  console.log(name+": "+all.length+" published; "+fresh.length+" with recent valid coordinates");
  if(all.length)console.log(name+" fields: "+Object.keys(all[0]).join(", "));
  if(name==="CP"){
   const keys=["vehicle_id","trip_id","ride_id","route_id","route_short_name","pattern_id","operational_date","calendar_date"];
   for(const p of all.slice(0,14)){
    console.log("CP ID CROSSWALK",JSON.stringify(Object.fromEntries(keys.map(k=>[k,p[k]??null]))));
   }
   const distinctRoutes=new Map();
   for(const p of all){const route=String(p.route_short_name??"");distinctRoutes.set(route,(distinctRoutes.get(route)||0)+1)}
   console.log("CP ROUTE SHORT NAMES",JSON.stringify([...distinctRoutes]));
  }
 }
}catch(e){console.log("TML position diagnostic unavailable: "+String(e?.message||e));}
finally{clearTimeout(timeout)}
