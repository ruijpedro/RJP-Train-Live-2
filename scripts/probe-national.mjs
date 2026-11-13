#!/usr/bin/env node
// Read-only, low-rate national source verification. No tokens or secrets logged.
// Report operational train status separately from genuinely observed GPS.
const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const sources=[
 ["IP Oeste R26450","https://www.infraestruturasdeportugal.pt/negocios-e-servicos/horarios-ncombio/26450/"+date],
 ["IP Intercidades 530","https://www.infraestruturasdeportugal.pt/negocios-e-servicos/horarios-ncombio/530/"+date],
 ["CP public website configuration","https://www.cp.pt/fe-config.json"]
];
for(const [label,url] of sources){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(url,{headers:{Accept:"application/json","User-Agent":"RJP-Train-Live-2-National-Diagnostics/1.0"},signal:ctrl.signal});
  let payload=null;
  if(r.ok){try{payload=await r.json()}catch{}}
  const result={label,status:r.status,json:payload!==null};
  if(label.startsWith("IP")&&payload){
   const journey=payload.response??payload;
   const stops=Array.isArray(journey?.NodesPassagemComboio)?journey.NodesPassagemComboio:[];
   result.stops=stops.length;
   result.hasPassageEvidence=stops.some(x=>x.ComboioPassou===true);
   result.hasOperationalStatus=typeof journey?.SituacaoComboio==="string";
   result.hasReportedVehicleCoordinates=
     typeof journey?.latitude==="number"&&typeof journey?.longitude==="number";
  }
  if(label.startsWith("CP")&&payload){
   result.hasTravelApiUrl=typeof payload?.travelApiUrl==="string";
   result.hasApiConfiguration=typeof payload?.travelApiKey==="string";
   // Credentials are only used in-memory for two read-only requests, and
   // are never logged, persisted, exported or forwarded to any third party.
   const base=String(payload?.travelApiUrl||"").replace(/\/+$/,"");
   if(base.startsWith("https://")&&result.hasApiConfiguration&&payload.xcck&&payload.xccs){
    const root=base.endsWith("/services/travel-api")?base:base+"/services/travel-api";
    for(const trainNumber of ["26450","530"]){
     const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),12000);
     try{
      const resp=await fetch(root+"/trains/"+trainNumber+"/timetable/"+date,{
       headers:{"Accept":"application/json","Origin":"https://www.cp.pt",
        "Referer":"https://www.cp.pt/",
        "x-api-key":payload.travelApiKey,
        "x-cp-connect-id":payload.xcck,
        "x-cp-connect-secret":payload.xccs},
       signal:ac.signal
      });
      let journey=null;
      if(resp.ok){try{journey=await resp.json()}catch{}}
      const hasCoords=Number.isFinite(journey?.latitude)&&Number.isFinite(journey?.longitude);
      const stops=Array.isArray(journey?.trainStops)?journey.trainStops:[];
      console.log("CP NATIONAL JOURNEY",JSON.stringify({
       trainNumber,status:resp.status,
       hasTrainData:!!journey,stopCount:stops.length,
       hasLastStationCode:!!journey?.lastStationCode,
       hasDelay:Number.isFinite(journey?.delay),
       hasReportedVehicleGps:hasCoords
      }));
     }catch(e){console.log("CP NATIONAL JOURNEY",JSON.stringify({trainNumber,status:"unavailable",error:String(e?.name||"network-error")}))}
     finally{clearTimeout(tm)}
    }
   }
   // Never print API key, ID, secret, or response headers.
  }
  console.log("NATIONAL SOURCE",JSON.stringify(result));
 }catch(e){
  console.log("NATIONAL SOURCE",JSON.stringify({label,status:"unavailable",reason:String(e?.name||"network-error")}));
 }finally{clearTimeout(timer)}
}
console.log("NATIONAL LIMITATION: Timetables and stop passage indicators do not prove GPS positions.");
