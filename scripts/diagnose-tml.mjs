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
 }
}catch(e){console.log("TML position diagnostic unavailable: "+String(e?.message||e));}
finally{clearTimeout(timeout)}
