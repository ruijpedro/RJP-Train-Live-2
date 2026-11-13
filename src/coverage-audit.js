// Coverage accounting for the Train Live 2 LAB.
// Scheduled CP services, TML coordinate reports, and CP journey API replies
// are independent evidence classes. Never infer a running train from GTFS.
import {CP_AGENCY,FT_AGENCY} from "./live-positions.js";

export const CP_TYPES=["U","R","IR","IC","AP","SUD","CP"];
const known=new Set(CP_TYPES);
const typeOf=v=>known.has(String(v??"").toUpperCase())?String(v).toUpperCase():"CP";
const name=v=>String(v??"").trim();

export function operationalIndicators(response){
 if(!response||typeof response!=="object")return false;
 if(name(response.lastStationCode))return true;
 if(Number.isFinite(response.delayMinutes))return true;
 if(response.hasDisruptions===true)return true;
 if((response.messages??[]).some(m=>name(m?.text)))return true;
 if((response.stops??[]).some(s=>Number.isFinite(s?.delayMinutes)||name(s?.eta)||name(s?.etd)))return true;
 const status=name(response.status).toUpperCase();
 return !!status&&!["SCHEDULED","NÃO INDICADO","NAO INDICADO","UNKNOWN","NOT INDICATED"].includes(status);
}

export function coverageAudit({date=null,trains=[],vehicles=[],queries=[]}={}){
 const rows=Object.fromEntries(CP_TYPES.map(t=>[t,{
  type:t,scheduled:0,withPosition:0,cpAnswered:0,withIndicators:0
 }]));
 const idToType=new Map();
 for(const train of trains){
  const type=typeOf(train?.type);
  rows[type].scheduled++;
  const number=name(train?.number);
  if(number&&!idToType.has(number))idToType.set(number,type);
 }
 let cpPositions=0,cpMatched=0,fertagusPositions=0;
 for(const vehicle of vehicles){
  const agency=name(vehicle?.agency);
  if(agency===FT_AGENCY){fertagusPositions++;continue}
  if(agency!==CP_AGENCY)continue;
  cpPositions++;
  const number=name(vehicle?.trainNumber);
  if(number)cpMatched++;
  const typ=typeOf(vehicle?.type??idToType.get(number));
  rows[typ].withPosition++;
 }
 const relevant=queries.filter(q=>q&&q.date===date);
 const latest=new Map();
 for(const q of relevant){
  const number=name(q.number);
  if(number)latest.set(number,q);
 }
 let cpAnswered=0,cpErrors=0,cpIndicators=0;
 for(const [number,q] of latest){
  if(!q.success){cpErrors++;continue}
  // A successful CP response is not evidence that the train is circulating.
  cpAnswered++;
  const type=idToType.get(number)||typeOf(q.result?.type);
  rows[type].cpAnswered++;
  if(operationalIndicators(q.result)){
   cpIndicators++;
   rows[type].withIndicators++;
  }
 }
 return {
  date,scheduled:trains.length,cpPositions,cpMatched,
  cpUnmatched:cpPositions-cpMatched,
  fertagusPositions,cpAnswered,cpIndicators,cpErrors,
  cpQueried:cpAnswered+cpErrors,
  sourceRules:{
   scheduled:"GTFS CP: serviço programado, não circulação confirmada",
   cpPositions:"TML GO Hub: coordenadas recentes publicadas, cobertura parcial",
   cpAnswered:"CP: consultas individuais bem-sucedidas nesta sessão",
   cpIndicators:"Indicadores disponíveis na resposta CP; não provam GPS nem circulação efetiva"
  },
  byType:CP_TYPES.map(t=>rows[t])
 };
}
