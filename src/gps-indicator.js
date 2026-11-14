// Whether recent, reported TML coordinates are available for a CP scheduled train.
// GTFS alone cannot establish actual vehicle position; absence of data is not
// proof that the train has no GPS transmitter.
import {CP_AGENCY} from "./live-positions.js";
export const GPS_MAX_AGE_MS=180000;
export function serviceDateLisbon(now=Date.now()){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",
   year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
}
export function gpsIndicator({number,tripId=null,date,vehicles=[],now=Date.now(),
 checked=false,sourceError=false,maxAgeMs=GPS_MAX_AGE_MS}={}){
 const ref=String(number??"").trim();
 const selectedDate=String(date??"");
 if(!checked)return {state:"checking",label:"A verificar GPS",detail:"À espera da primeira consulta TML."};
 if(!selectedDate||selectedDate!==serviceDateLisbon(now))
  return {state:"not-current",label:"GPS não disponível para esta data",
   detail:"O GPS só pode ser atribuído a posições atuais, nunca a horários de outra data."};
 const match=(vehicles??[]).filter(v=>{
  if(v?.gpsVerified===false||v?.positionSource==="Comboios Live")return false;
  if(String(v?.agency)!==CP_AGENCY||!ref||String(v?.trainNumber??"")!==ref)return false;
  // If GTFS trip identity is available, avoid attributing a second same-number
  // train's location to this service.
  if(tripId&&v?.gtfsTripId&&String(v.gtfsTripId)!==String(tripId))return false;
  const lat=Number(v?.latitude),lon=Number(v?.longitude),ts=Number(v?.timestamp);
  const fresh=Number.isFinite(ts)&&ts<=now+30000&&now-ts<=maxAgeMs&&now-ts>=-30000;
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180&&fresh;
 });
 if(match.length){
  const latest=match.reduce((a,b)=>a.timestamp>b.timestamp?a:b);
  return {state:"available",label:"GPS disponível",source:"TML",
   observedAt:new Date(latest.timestamp).toISOString(),
   detail:"Posição recente publicada pela TML, não interpolada."};
 }
 const live=(vehicles??[]).find(v=>{
  if(v?.positionSource!=="Comboios Live"||v?.gpsVerified!==false||
    String(v?.trainNumber??"")!==ref||!ref||v?.agency!==CP_AGENCY)return false;
  const lat=Number(v?.latitude),lon=Number(v?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=36&&lat<=43&&lon>=-10&&lon<=-6;
 });
 if(live)return {state:"live-location",label:"Localização Live · GPS por confirmar",
  source:"Comboios Live",observedAt:Number.isFinite(live.timestamp)?new Date(live.timestamp).toISOString():null,
  detail:"Coordenadas disponibilizadas pelo Comboios Live / Rui Costa. A origem GPS e a hora da posição não estão necessariamente confirmadas."};
 if(sourceError)return {state:"unknown",label:"GPS não verificado",
   detail:"Fonte TML indisponível: não foi possível confirmar se existe posição."};
 return {state:"not-received",label:"Sem GPS recebido",
   detail:"Não foi publicada uma posição recente para este comboio; pode existir informação operacional sem localização."};
}
