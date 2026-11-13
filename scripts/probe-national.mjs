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
   // Never print the actual values.
  }
  console.log("NATIONAL SOURCE",JSON.stringify(result));
 }catch(e){
  console.log("NATIONAL SOURCE",JSON.stringify({label,status:"unavailable",reason:String(e?.name||"network-error")}));
 }finally{clearTimeout(timer)}
}
console.log("NATIONAL LIMITATION: Timetables and stop passage indicators do not prove GPS positions.");
