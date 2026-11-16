// RJP 2.0 - last-resort, third-party recovery only.
// Not an independent sensor/GPS data source. Never silently merge into TML GPS.
export const RUI_DIRECT_URL="https://comboios.ruicosta.pt/api/cache/trains/active";
export const RUI_WORKER_RELAY="https://rjp-train-live-api.rjpedro.workers.dev/api/trains/active";
const NUM=/^\d{1,6}$/;
const TERMINAL=new Set(["COMPLETED","CANCELLED","CANCELED","SUPPRESSED"]);
const str=x=>String(x??"").trim();
const text=x=>str(x).slice(0,150);
const value=x=>x==null||x===""?null:Number(x);
function category(raw) {
 const s=str(raw).toUpperCase();
 if(s==="FT"||/FERTAGUS/.test(s))return "FT";
 if(s==="AP"||/ALFA PENDULAR/.test(s))return "AP";
 if(s==="IC"||/INTERCIDADES/.test(s))return "IC";
 if(s==="IR"||/INTERREGIONAL/.test(s))return "IR";
 if(s==="SUD"||/SUDEXPRESSO|SUD EXPRESSO/.test(s))return "SUD";
 if(s==="U"||/URBANO|SUBURBANO/.test(s))return "U";
 if(s==="R"||/REGIONAL/.test(s))return "R";
 return "CP";
}
export function shouldUseRuiFallback({dateCurrent=false,independentCPPositions=0,gtfsEstimates=0,checkedTml=false,checkedGtfs=false}={}){
 return !!(dateCurrent&&checkedTml&&checkedGtfs&&
  independentCPPositions===0&&gtfsEstimates===0);
}
function rows(value){
 if(Array.isArray(value))return value;
 if(Array.isArray(value?.data))return value.data;
 if(Array.isArray(value?.trains))return value.trains;
 if(Array.isArray(value?.results))return value.results;
 return [];
}
export function normalizeRuiFallback(payload,{fetchedAt=Date.now()}={}){
 const output=[],seen=new Set();
 for(const x of rows(payload).slice(0,2000)){
  const nested=x?.data?.status??{};
  const fixed=x?.fixed??{};
  const db=x?.db??{};
  const num=str(nested.trainNumber??fixed.trainNumber??db.trainNumber??x?.trainNumber??x?.train_id);
  if(!NUM.test(num)||seen.has(num))continue;
  const status=str(nested.status??fixed.status??x?.status).toUpperCase();
  if(TERMINAL.has(status))continue;
  const coords=[value(nested.latitude??fixed.latitude??x?.latitude??x?.lat),
   value(nested.longitude??fixed.longitude??x?.longitude??x?.lng??x?.lon)];
  if(coords.some(v=>v===null||!Number.isFinite(v))||coords[0]<36||coords[0]>43||
     coords[1]<-10||coords[1]>-6)continue;
  const service=db?.trainService?.designation??fixed?.trainService?.designation??
   x?.service?.designation??x?.service??x?.type;
  const type=category(service);
  if(type==="FT")continue; // Fertagus keeps its own TML-only source priority.
  const stops=Array.isArray(fixed.trainStops)?fixed.trainStops:[];
  const origin=db?.trainOrigin?.designation??stops[0]?.station?.designation??x?.origin??null;
  const destination=db?.trainDestination?.designation??stops.at(-1)?.station?.designation??x?.destination??null;
  const lastCode=str(nested.lastStation??fixed.lastStationCode);
  const index=stops.findIndex(s=>str(s?.station?.code)===lastCode);
  const lastStation=index>=0?stops[index]?.station?.designation:x?.lastStation??lastCode;
  const nextStation=index>=0?stops[index+1]?.station?.designation:x?.nextStop??null;
  const delaySeconds=value(nested.delay);
  const delayMinutes=delaySeconds==null?value(x?.delayMinutes):Math.round(delaySeconds/60);
  seen.add(num);
  output.push({
   kind:"third-party-fallback",source:"Comboios Live — Rui Costa",
   type,number:num,origin:text(origin)||"Não indicada",destination:text(destination)||"Não indicado",
   latitude:coords[0],longitude:coords[1],lastStation:text(lastStation)||null,
   nextStation:text(nextStation)||null,status:text(status)||null,
   delayMinutes:Number.isFinite(delayMinutes)?delayMinutes:null,
   checkedAt:fetchedAt,positionTimestamp:null,isGps:false,isOperatorReported:false,
   note:"Posição indicada por serviço externo. Origem/precisão e hora original da coordenada não verificadas pela RJP. NÃO é GPS confirmado."
  });
 }
 return output;
}
