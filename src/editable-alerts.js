// Editable local beta alerts; separate from production RJP Train Live storage.
export const ALERT_STORAGE_KEY="rjp_train2_editable_alerts_v1";
export const ALERT_SENT_KEY="rjp_train2_alerts_sent_v1";
export const alertClean=x=>String(x??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
export function validateAlert(a){
 if(!a||!["station","train","combined"].includes(a.scope)||!String(a.target??"").trim())return false;
 if(a.scope==="combined"&&!String(a.station??"").trim())return false;
 if(!["arrival","departure","both"].includes(a.event)||!Number.isInteger(a.lead)||a.lead<0||a.lead>1440)return false;
 if(!["weekly","monthly","date"].includes(a.scheduleType))return false;
 if(a.scheduleType==="weekly"&&(!Array.isArray(a.days)||!a.days.length||a.days.some(d=>!Number.isInteger(d)||d<0||d>6)))return false;
 if(a.scheduleType==="monthly"&&(!Number.isInteger(a.monthDay)||a.monthDay<1||a.monthDay>31))return false;
 if(a.scheduleType==="date"&&!/^\d{4}-\d{2}-\d{2}$/.test(String(a.date??"")))return false;
 return true;
}
export function upsertAlert(rules,rule){
 if(!validateAlert(rule))throw Error("Alerta inválido");
 const ix=rules.findIndex(x=>x.id===rule.id);
 return ix<0?[...rules,rule]:rules.map((x,i)=>i===ix?{...rule,id:x.id}:x);
}
export function loadAlerts(storage=localStorage){try{const x=JSON.parse(storage.getItem(ALERT_STORAGE_KEY)||"[]");return Array.isArray(x)?x.filter(validateAlert):[]}catch{return []}}
export function saveAlerts(list,storage=localStorage){storage.setItem(ALERT_STORAGE_KEY,JSON.stringify(list));return list}
function lisbon(now){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(now)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 const date=p.year+"-"+p.month+"-"+p.day;
 return {date,minute:+p.hour*60+ +p.minute,weekday:(new Date(date+"T12:00:00Z").getUTCDay()+6)%7,monthDay:+p.day};
}
export function alertCandidates(trains,rules,{date,now=Date.now()}={}){
 const t=lisbon(now);if(t.date!==date)return [];
 const result=[];
 for(const a of rules){
  if(!validateAlert(a)||!a.enabled||!a.notifyBefore)continue;
  if(a.scheduleType==="weekly"&&!a.days.includes(t.weekday))continue;
  if(a.scheduleType==="date"&&a.date!==date)continue;
  if(a.scheduleType==="monthly"&&a.monthDay!==t.monthDay)continue;
  for(const train of trains??[]){
   if((a.scope==="train"||a.scope==="combined")&&alertClean(train.number)!==alertClean(a.target))continue;
   for(const stop of train.stops??[]){
    if(a.scope==="station"&&alertClean(stop.name)!==alertClean(a.target))continue;
    if(a.scope==="combined"&&alertClean(stop.name)!==alertClean(a.station))continue;
    for(const event of ["arrival","departure"]){
     if(a.event!=="both"&&a.event!==event)continue;
     const clock=String(stop[event]??"");
     const m=clock.match(/^(\d{1,2}):(\d{2})/);if(!m)continue;
     const when=+m[1]*60+ +m[2];if(when>1439)continue;
     const remaining=when-t.minute;
     if(remaining<0||remaining>a.lead)continue;
     const key=[t.date,a.id,train.number,stop.id??stop.name,event,clock.slice(0,5)].join("|");
     result.push({key,number:String(train.number),station:stop.name,event,time:clock.slice(0,5),remaining});
    }
   }
  }
 }
 return result;
}
export function filterUnsent(candidates,{storage=localStorage,now=Date.now()}={}){
 let seen={};try{seen=JSON.parse(storage.getItem(ALERT_SENT_KEY)||"{}")||{}}catch{}
 const found=[];
 for(const candidate of candidates){if(seen[candidate.key])continue;seen[candidate.key]=now;found.push(candidate)}
 for(const [key,time] of Object.entries(seen))if(now-time>3*86400000)delete seen[key];
 storage.setItem(ALERT_SENT_KEY,JSON.stringify(seen));return found;
}
