// RJP Train Live 2.0 — ISOLATED Cloudflare Worker LAB.
// Provides evidence-linked TML positions and optional CP GTFS day schedule.
// Never point production Trains at this service until coverage is validated.
import {buildUnifiedFeed,TML_ETA_URL,TML_ALERTS_URL} from "../src/unified-feed.js";
import {TML_URL} from "../src/live-positions.js";

const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Methods":"GET, OPTIONS",
 "Access-Control-Allow-Headers":"Accept, Content-Type",
 "Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff"
};
function json(x,status=200){return new Response(JSON.stringify(x),{
 status,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}
})}
async function safeJson(url,{timeoutMs=12000}={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetch(url,{headers:{Accept:"application/json","User-Agent":"RJP-Train-Live-2-Independent/0.1"},signal:controller.signal,cf:{cacheTtl:0}});
  if(!r.ok)throw Error("HTTP "+r.status);
  return {payload:await r.json(),result:{status:"ok",checkedAt:new Date().toISOString()}};
 }catch(e){return {payload:null,result:{status:"unavailable",error:String(e?.message||e).slice(0,150)}}}
 finally{clearTimeout(timeout)}
}
async function unifiedSnapshot(env){
 const now=Date.now();
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
 let cp={payload:null,result:{status:"not-configured"}};
 if(typeof env?.CP_SCHEDULE_BASE_URL==="string"&&/^https:\/\//.test(env.CP_SCHEDULE_BASE_URL)){
  cp=await safeJson(env.CP_SCHEDULE_BASE_URL.replace(/\/+$/,"")+"/"+day+".json");
 }
 const [positions,eta,alerts]=await Promise.all([
  safeJson(TML_URL),safeJson(TML_ETA_URL),safeJson(TML_ALERTS_URL)
 ]);
 const feed=buildUnifiedFeed({
  cpDay:cp.payload,positionsPayload:positions.payload,etaPayload:eta.payload,
  alertsPayload:alerts.payload,now,
  sourceResults:{positions:positions.result,eta:eta.result,alerts:alerts.result}
 });
 feed.sources.cpGtfs.onlineImport=cp.result;
 return feed;
}
export default {
 async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="GET")return json({ok:false,error:"Method not allowed"},405);
  const url=new URL(request.url),pathname=url.pathname;
  if(pathname==="/health")return json({
   ok:true,service:"RJP Train Live 2 LAB API",version:"0.1.0",
   independentOfRuiCosta:true,scheduleSourceConfigured:!!env?.CP_SCHEDULE_BASE_URL,
   sources:["CP official GTFS (optional published JSON)","TML GO Hub positions","TML ETA","TML alerts"],
   productionReady:false
  });
  if(!["/api/trains/unified","/api/trains/active","/api/trains/diagnostics"].includes(pathname))
   return json({ok:false,error:"Not found"},404);
  const feed=await unifiedSnapshot(env);
  if(pathname==="/api/trains/unified")return json({ok:true,...feed});
  if(pathname==="/api/trains/diagnostics")return json({
   ok:true,checkedAt:feed.generatedAt,expiresAt:feed.expiresAt,
   coverage:feed.coverage,sources:feed.sources,unmatched:feed.diagnostics.cpUnmatchedSample
  });
  return json({
   ok:true,source:"RJP Train Live 2 LAB / TML GO Hub",generatedAt:feed.generatedAt,
   expiresAt:feed.expiresAt,coverage:feed.coverage,
   trains:feed.vehicles.map(v=>({
    id:v.trainNumber??v.vehicleId,trainNumber:v.trainNumber,vehicleId:v.vehicleId,
    operator:v.operator,type:v.serviceType,service:v.serviceType,tripId:v.tripId,
    origin:v.journey?.origin??null,destination:v.journey?.destination??null,
    latitude:v.position.latitude,longitude:v.position.longitude,
    positionTimestamp:v.position.observedAt,positionKind:v.position.kind,
    delayMinutes:null,source:"TML GO Hub",sourceMatch:v.match.method,
    gpsSourcePublished:true,isInterpolated:false
   }))
  });
 }
};
