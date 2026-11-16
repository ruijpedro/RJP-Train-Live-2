// Presentation model for the original-style Train Live details dialog.
// CP stop timings are operational evidence. GTFS-only times are scheduled,
// never proof that the service ran or passed through a station.
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export const parseClock=s=>{
 const m=String(s??"").match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
 return m&&+m[1]<=47?(+m[1]*60+ +m[2]):null;
};
export const clockLabel=minutes=>{
 if(!Number.isFinite(minutes))return null;
 const n=(Math.round(minutes)%1440+1440)%1440;
 return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
};
const cpStopTime=v=>parseClock(v);
const findReported=(rows,s,index)=>{
 const name=norm(s.name);
 if(!name)return null;
 const choices=rows.filter(x=>norm(x.station)===name);
 if(choices.length===1)return choices[0];
 // Names can be ambiguous across multiple stops; do not guess.
 return null;
};
export function detailStopTimes(train,cp){
 const cpRows=Array.isArray(cp?.stops)?cp.stops:[];
 const stops=Array.isArray(train?.stops)&&train.stops.length?train.stops:
  cpRows.map(s=>({name:s.station,id:s.stationCode,arrival:s.scheduledArrival,
   departure:s.scheduledDeparture}));
 const delay=Number.isFinite(cp?.delayMinutes)?cp.delayMinutes:null;
 return stops.map((s,i)=>{
  const report=findReported(cpRows,s,i);
  const scheduled=cpStopTime(report?.scheduledArrival??report?.scheduledDeparture)??
   cpStopTime(s.arrival??s.departure);
  const reported=cpStopTime(report?.eta??report?.etd);
  const stopDelay=Number.isFinite(report?.delayMinutes)?report.delayMinutes:delay;
  const eta=reported!==null?reported:scheduled!==null&&stopDelay!==null?scheduled+stopDelay:null;
  return {
   name:String(s.name??"Estação"),scheduled:clockLabel(scheduled),eta:clockLabel(eta),
   etaSource:reported!==null?"cp-reported":eta!==null?"cp-delay":"unknown",
   stationCode:String(s.id??""),isReported:!!report
  };
 });
}
export function detailStopProgress(rows,cp){
 const last=norm(cp?.lastReportedStation);
 if(!last)return {lastIndex:-1,nextIndex:null};
 const ix=rows.findIndex(s=>norm(s.name)===last);
 return {lastIndex:ix,nextIndex:ix>=0&&ix+1<rows.length?ix+1:null};
}
export function detailStatusText(cp){
 if(!cp)return "Circulação não confirmada";
 const states={
 IN_TRANSIT:"Em circulação (informação CP)",AT_STATION:"Na estação (informação CP)",
 AT_ORIGIN:"Na origem (informação CP)",NEAR_NEXT:"A aproximar-se da estação seguinte (CP)",
 COMPLETED:"Viagem concluída (CP)",ARRIVED:"Chegou ao destino (CP)",
 CANCELLED:"Suprimido (CP)",CANCELED:"Suprimido (CP)",SUPPRESSED:"Suprimido (CP)"
 };
 return states[String(cp.status??"").toUpperCase()]||String(cp.status??"Não indicado pela CP");
}
export function detailServiceLabel(type){
 return ({U:"Urbano",R:"Regional",IR:"InterRegional",IC:"Intercidades",
 AP:"Alfa Pendular",SUD:"Sud Expresso",FT:"Fertagus"})[type]??"CP";
}
export function detailKindSource(kind,level){
 if(kind==="gps")return "Posição real comunicada pela TML";
 if(kind==="rui")return "Comboios Live — Rui Costa (contingência)";
 if(kind==="estimated"&&level==="cp-anchored")return "Estimativa a partir de CP + GTFS";
 if(kind==="estimated")return "Previsão pelo horário GTFS CP";
 return "Horário programado GTFS CP";
}
