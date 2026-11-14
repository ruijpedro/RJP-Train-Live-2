// Complementary source for the independent Train Live 2.0 laboratory.
// Coordinates are supplied by Comboios Live, but their GNSS/GPS origin
// and observation times are NOT verified. Never label them as confirmed GPS.
import {CP_AGENCY,millis} from "./live-positions.js";

export const LIVE_PROXY_URL="https://rjp-train-live-api.rjpedro.workers.dev/api/trains/active";
export const LIVE_DIRECT_URL="https://comboios.ruicosta.pt/api/cache/trains/active";
export const LIVE_SOURCE="Comboios Live / Rui Costa";

export function asLiveRows(payload){
 if(Array.isArray(payload))return payload;
 for(const key of ["trains","data","results"]){
  if(Array.isArray(payload?.[key]))return payload[key];
 }
 return [];
}
function text(v){return String(v??"").trim();}
function typeOf(raw){
 const type=text(raw?.serviceCode??raw?.fixed?.trainService?.code??raw?.db?.trainService?.code).toUpperCase();
 if(["U","R","IR","IC","AP","SUD"].includes(type))return type;
 const s=text(raw?.service??raw?.db?.trainService?.designation??raw?.fixed?.trainService?.designation).toUpperCase();
 if(s.includes("SUD"))return "SUD";
 if(s.includes("ALFA")||s==="AP")return "AP";
 if(s.includes("INTERCIDADES")||s==="IC")return "IC";
 if(s.includes("INTERREGIONAL")||s==="IR")return "IR";
 if(s.includes("URBANO")||s.includes("SUBURBANO")||s==="U")return "U";
 if(s.includes("REGIONAL")||s==="R")return "R";
 return "CP";
}
function locationTime(raw){
 const status=raw?.data?.status??{};
 for(const value of [status.positionTimestamp,status.positionUpdatedAt,status.gpsTimestamp,status.updatedAt,raw.positionTimestamp,raw.observedAt]){
  const parsed=millis(value);
  if(Number.isFinite(parsed))return parsed;
 }
 return null;
}
export function normalizeLiveLocations(payload,{now=Date.now(),maxAgeMs=180000}={}){
 const output=[],seen=new Set();
 for(const raw of asLiveRows(payload)){
  if(!raw||typeof raw!=="object")continue;
  const status=raw.data?.status??{};
  const number=text(status.trainNumber??raw.trainNumber??raw.fixed?.trainNumber??raw.db?.trainNumber??raw.train_id);
  if(!/^\d{1,6}$/.test(number)||seen.has(number))continue;
  // Never use "fixed" coordinates: these can describe a static or modelled location.
  const latRaw=status.latitude??raw.latitude;
  const lonRaw=status.longitude??raw.longitude;
  if(latRaw==null||lonRaw==null||latRaw===""||lonRaw==="")continue;
  const latitude=Number(latRaw),longitude=Number(lonRaw);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||
    latitude<36||latitude>43||longitude< -10||longitude> -6)continue;
  const runDate=text(status.runDate??raw.runDate);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",
   year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
  if(/^\d{4}-\d\d-\d\d/.test(runDate)&&runDate.slice(0,10)!==today)continue;
  const timestamp=locationTime(raw);
  if(timestamp!==null&&(timestamp>now+30000||now-timestamp>maxAgeMs))continue;
  seen.add(number);
  const stops=Array.isArray(raw?.fixed?.trainStops)?raw.fixed.trainStops:[];
  const origin=text(raw.origin??raw?.db?.trainOrigin?.designation??stops[0]?.station?.designation)||null;
  const destination=text(raw.destination??raw?.db?.trainDestination?.designation??stops.at(-1)?.station?.designation)||null;
  output.push({
   agency:CP_AGENCY,vehicleId:number,trainNumber:number,operator:"CP",
   type:typeOf(raw),latitude,longitude,timestamp,
   positionSource:"Comboios Live",gpsVerified:false,
   origin,destination,tripId:null,gtfsTripId:null,
   matchMethod:"número publicado no Comboios Live",
   sourceDetail:LIVE_SOURCE,positionTimeVerified:timestamp!==null
  });
 }
 return output;
}
// Priority is TML (recent operator-reported GPS); Live is supplementary only.
// Do not overwrite a verified coordinate for a train with Live coordinates.
export function mergeCoordinateSources(tml=[],live=[]){
 const output=tml.map(v=>({...v,positionSource:"TML",gpsVerified:true,
  positionTimeVerified:true}));
 const used=new Set(output.filter(v=>v.agency===CP_AGENCY&&v.trainNumber)
  .map(v=>String(v.trainNumber)));
 for(const v of live){
  const number=text(v?.trainNumber);
  if(!number||used.has(number))continue;
  used.add(number);
  output.push({...v,positionSource:"Comboios Live",gpsVerified:false});
 }
 return output;
}
