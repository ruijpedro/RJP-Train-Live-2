// Pure national CP GTFS catalog. ALL scheduled entries stay searchable;
// a train in this catalog is NOT evidence that it is circulating or has GPS.
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-PT");
export const PAGE_SIZE=80;
export function filterCatalogue(trains,{query="",type="ALL"}={}){
 const needle=norm(query.trim());
 return (Array.isArray(trains)?trains:[]).filter(t=>{
  if(type!=="ALL"&&type!=="CP"&&t.type!==type)return false;
  if(!needle)return true;
  return [t.number,t.type,t.id,t.route,t.headsign,t.origin,t.destination,
   ...(Array.isArray(t.stops)?t.stops.map(s=>s.name):[])]
   .some(field=>norm(field).includes(needle));
 });
}
export function pageCatalogue(trains,limit=PAGE_SIZE){
 const count=Math.max(0,Math.trunc(Number.isFinite(limit)?limit:PAGE_SIZE));
 return {visible:trains.slice(0,count),total:trains.length,more:Math.max(0,trains.length-count)};
}
export function cpLookupNumber(train){
 const number=String(train?.number??"").trim();
 return /^\d{1,6}$/.test(number)?number:null;
}


// Small, explicit nationwide CP sample. Timetable is used solely to choose
// candidates for a manual API query; it NEVER confirms circulation or GPS.
export function sampleCpByType(trains,{clock="12:00",types=["U","R","IR","IC","AP"]}={}){
 const minute=v=>{const m=String(v??"").match(/^(\d{1,2}):(\d{2})/);return m&&+m[1]<24&&+m[2]<60?(+m[1])*60+(+m[2]):NaN};
 const now=minute(clock);
 if(!Number.isFinite(now)||!Array.isArray(trains))return [];
 const score=t=>{
  const start=minute(t.departure),end=minute(t.arrival);
  if(!Number.isFinite(start)||!Number.isFinite(end))return Infinity;
  const finish=end<start?end+1440:end;
  if(start<=now&&now<=finish)return now-start; // prioritize plausible in-progress schedules
  return start>now?10000+(start-now):20000+(now-finish);
 };
 const used=new Set();
 return types.map(type=>{
  const options=trains.filter(t=>t?.type===type&&/^\d{1,6}$/.test(String(t.number??""))&&!used.has(String(t.number)));
  options.sort((a,b)=>score(a)-score(b));
  const chosen=options.find(t=>Number.isFinite(score(t)))??null;
  if(chosen)used.add(String(chosen.number));
  return chosen;
 }).filter(Boolean);
}
