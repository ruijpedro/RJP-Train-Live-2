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
