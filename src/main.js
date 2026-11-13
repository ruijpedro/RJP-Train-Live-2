import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import {CP_AGENCY,FT_AGENCY,TML_URL,FT_FALLBACK_URL,normalizePositions,asRows} from "./live-positions.js";
import {buildUnifiedFeed} from "./unified-feed.js";
import {fetchTmlJson,fetchRemoteJson,transportLabel} from "./native-http.js";
import {lookupCpOperational} from "./cp-operational.js";

const BASE = import.meta.env.BASE_URL;
const TYPES = ["U","R","IR","IC","AP","SUD","CP","FT"];
const COLORS = {U:"#3b82f6",R:"#22c55e",IR:"#a78bfa",IC:"#fb923c",AP:"#fb7185",SUD:"#2dd4bf",CP:"#94a3b8",FT:"#06b6d4"};
const el = document.getElementById("app");
el.innerHTML = `
<header>
 <div class="brand"><div class="brandIcon">🚆</div><div><h1>RJP TRAIN LIVE <span>2.0</span></h1><p>Laboratório de fontes ferroviárias • CP + TML + IP</p></div></div>
 <div class="headRight"><strong>FONTES UNIFICADAS</strong><small>2.0.4-beta.1 · consulta operacional CP</small></div>
</header>
<div class="sourceNote"><strong>CP GTFS + posições TML</strong><span>Marcadores: coordenadas reportadas recentemente, nunca horários interpolados. Identificamos o número CP apenas quando corresponde a uma circulação única no GTFS. ETA e alertas ainda são diagnósticos, não informação operacional confirmada.</span></div>
<div class="controls">
 <label><span>Data</span><select id="day"><option>A carregar…</option></select></label>
 <label class="searchBox"><span>Pesquisar comboio ou estação</span><input id="q" placeholder="Número, origem, destino ou paragem" autocomplete="off"/></label>
 <button id="reload">Atualizar horários e GPS</button><button id="focusGps" type="button" class="focusBtn">Ver todos os GPS</button>
</div>
<div class="types" id="types"></div>
<div class="stats"><span id="count">A carregar horários CP…</span><span id="freshness"></span><span id="gpsStatus" aria-live="polite">TML: a consultar posições…</span></div>
<section class="cpNationalLab" aria-label="Consulta operacional nacional CP">
 <div class="cpLabHead"><div><h2>CP nacional — estado de circulação</h2><p>Consulta direta por número de comboio. Paragens, atrasos e estado operacional; <strong>não são coordenadas GPS</strong>.</p></div><span class="operationalBadge">LAB • SEM GPS</span></div>
 <div class="cpLookupLine">
  <label for="cpNumber">N.º comboio<input id="cpNumber" inputmode="numeric" value="26450" maxlength="6" placeholder="26450"/></label>
  <button id="cpLookup" type="button">Consultar CP diretamente</button>
 </div>
 <div id="cpResult" class="cpResult" aria-live="polite">A consulta só é executada quando carregas no botão; não afeta o mapa GPS.</div>
</section>
<section class="labAudit" aria-label="Diagnóstico de fontes">
 <div class="labAuditMetrics"><div><small>CP localizados</small><b id="cpLive">—</b></div><div><small>CP identificados</small><b id="cpMatched">—</b></div><div><small>Fertagus</small><b id="ftLive">—</b></div><div><small>GTFS CP</small><b id="scheduled">—</b></div></div>
 <p id="auditText">A aguardar diagnóstico de fontes…</p>
 <p id="buildAudit">Registo da compilação: a carregar…</p>
</section>
<div class="workspace">
 <div id="map" aria-label="Mapa de estações CP"></div>
 <section class="results"><h2>Posições reais reportadas pela TML</h2><p class="legendLab">Fonte + hora de posição · só aparece o número do comboio quando validado no GTFS da CP</p><div id="liveTrains" class="gpsResults"></div><h2>Horários CP programados (sem GPS)</h2><div id="trains"></div></section>
</div>
<footer><b>RJP Train Live 2.0 — laboratório.</b> A Trains original não é modificada. Coordenadas TML reportadas pelos operadores, com validade máxima de 3 minutos; GTFS CP = horários programados. Sem confirmação de atrasos, supressões ou cobertura nacional. Não utilizar para segurança da exploração.</footer>
`;

const dom = Object.fromEntries(["q","day","types","reload","focusGps","count","freshness","trains","gpsStatus","liveTrains","cpLive","cpMatched","ftLive","scheduled","auditText","buildAudit","cpNumber","cpLookup","cpResult"].map(id=>[id,document.getElementById(id)]));
let manifest=null,data=null,selected="ALL",stationMarkers=L.layerGroup(),routeLayer=L.layerGroup(),stationIndex=new Map(),gpsMarkers=L.layerGroup(),gpsVehicles=[],didFocusGps=false,lastGpsStatus="",latestTmlRows=[],lastTmlError=null,ftProxyUsed=false;
const map=L.map("map",{zoomControl:true}).setView([39.65,-8.15],7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
L.tileLayer("https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",{maxZoom:19,opacity:.88,attribution:"OpenRailwayMap"}).addTo(map);
stationMarkers.addTo(map);
routeLayer.addTo(map);
gpsMarkers.addTo(map);

function safeText(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function sameLocation(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);}
function setMessage(msg){dom.count.textContent=msg;}
function renderTypes(){
 dom.types.innerHTML=["ALL",...TYPES].map(t=>`<button class="type ${selected===t?"active":""}" data-type="${t}" style="--type-color:${COLORS[t]||"#38bdf8"}">${t==="ALL"?"Todos":t}</button>`).join("");
 dom.types.querySelectorAll("button").forEach(b=>b.onclick=()=>{selected=b.dataset.type;renderTypes();renderTrains();renderGps();});
}

function focusGpsMarkers(){
 if(!gpsVehicles.length){dom.gpsStatus.textContent=lastGpsStatus+" · sem posições para centrar";return}
 selected="ALL";
 dom.q.value="";
 renderTypes();
 renderTrains();
 renderGps();
 const bounds=L.latLngBounds(gpsVehicles.map(v=>[v.latitude,v.longitude]));
 if(bounds.isValid()){
  map.invalidateSize();
  map.fitBounds(bounds.pad(.15),{maxZoom:11,animate:false});
 }
}

function gpsIcon(type){
 const color=COLORS[type]||COLORS.CP;
 return L.divIcon({className:"gpsMarkerIcon",html:'<span class="gpsMarker" style="--color:'+color+'">'+safeText(type)+'</span>',iconSize:[34,34],iconAnchor:[17,17]});
}
function renderGps(){
 gpsMarkers.clearLayers();
 const q=dom.q.value.trim().toLocaleLowerCase("pt-PT");
 const visible=gpsVehicles.filter(v=>(selected==="ALL"||v.type===selected||(v.agency===CP_AGENCY&&selected==="CP"))&&
   (!q||[v.vehicleId,v.trainNumber,v.tripId,v.route,v.origin,v.destination,v.operator,v.type]
    .some(s=>String(s||"").toLocaleLowerCase("pt-PT").includes(q))));
 dom.liveTrains.innerHTML=visible.length?visible.map((v,i)=>{
  const title=v.trainNumber?v.type+" "+v.trainNumber:v.operator+" · veículo "+v.vehicleId;
  const journey=v.origin&&v.destination?v.origin+" → "+v.destination:"Percurso CP ainda não associado";
  return '<button class="train gpsRow" data-gps="'+i+'"><span class="pill" style="--type-color:'+(COLORS[v.type]||COLORS.CP)+'">'+safeText(v.type)+'</span>'+
    '<span class="trainInfo"><strong>'+safeText(title)+'</strong><small>'+safeText(journey)+'</small><small>Origem: TML · '+safeText(v.matchMethod)+'</small></span>'+
    '<span class="hours"><b>POSIÇÃO</b><small>'+new Date(v.timestamp).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})+'</small></span></button>';
 }).join(""):'<p class="empty">Sem posições recentes para estes filtros. Os horários GTFS estão disponíveis abaixo; não são localizações reais.</p>';
 for(const v of visible){
  const marker=L.marker([v.latitude,v.longitude],{icon:gpsIcon(v.type)}).addTo(gpsMarkers);
  marker.bindTooltip(safeText((v.trainNumber?v.type+" "+v.trainNumber:v.operator+" "+v.vehicleId)+" · TML"));
  marker.bindPopup('<b>'+safeText(v.trainNumber?v.type+" "+v.trainNumber:v.operator+" "+v.vehicleId)+'</b>'+
   '<p>'+safeText(v.origin&&v.destination?v.origin+" → "+v.destination:"Percurso não validado")+'</p>'+
   '<p>Latitude '+v.latitude.toFixed(5)+' · Longitude '+v.longitude.toFixed(5)+'</p>'+
   '<p>Observado: '+new Date(v.timestamp).toLocaleString("pt-PT")+'</p>'+
   '<small>Fonte TML · correspondência '+safeText(v.matchMethod)+' · não interpolado</small>');
 }
 dom.liveTrains.querySelectorAll("button[data-gps]").forEach(b=>b.onclick=()=>{
  const v=visible[Number(b.dataset.gps)];
  map.setView([v.latitude,v.longitude],12);
  gpsMarkers.eachLayer(m=>{const p=m.getLatLng();if(p.lat===v.latitude&&p.lng===v.longitude)m.openPopup()});
 });
}

function refreshUnified(){
 const snapshot=buildUnifiedFeed({
  cpDay:data,positionsPayload:{data:latestTmlRows},now:Date.now(),
  sourceResults:{positions:{status:lastTmlError?"unavailable":"ok"}}
 });
 gpsVehicles=snapshot.vehicles.map(v=>({
  agency:v.agencyId,vehicleId:v.vehicleId,operator:v.operator,trainNumber:v.trainNumber,
  type:v.serviceType,tripId:v.tripId,route:v.route,origin:v.journey?.origin??null,
  destination:v.journey?.destination??null,
  matchMethod:v.match?.method??"unmatched",
  latitude:v.position.latitude,longitude:v.position.longitude,
  timestamp:Date.parse(v.position.observedAt)
 }));
 const c=snapshot.coverage;
 dom.cpLive.textContent=c.cpFreshPositions;
 dom.cpMatched.textContent=c.cpMatchedToGtfs+" / "+c.cpFreshPositions;
 dom.ftLive.textContent=c.ftFreshPositions;
 dom.scheduled.textContent=c.cpScheduledToday;
 const source=ftProxyUsed?" · Fertagus via proxy TML":"";
 const problem=lastTmlError?" · Erro TML: "+lastTmlError:"";
 dom.gpsStatus.textContent="TML: CP "+c.cpFreshPositions+" ("+c.cpMatchedToGtfs+" identificados) · FT "+c.ftFreshPositions+" · "+transportLabel()+source+problem;
 lastGpsStatus=dom.gpsStatus.textContent;
 dom.auditText.textContent="Recolha atual: "+new Date(snapshot.generatedAt).toLocaleTimeString("pt-PT")+
   " · "+c.cpUnmatched+" CP por identificar · cobertura TML parcial, não nacional"+(lastTmlError?" · consulta direta indisponível":"");
 renderGps();
 if(!didFocusGps&&gpsVehicles.length){didFocusGps=true;focusGpsMarkers()}
}
async function queryCpNational(){
 const number=dom.cpNumber.value.trim(),date=dom.day.value;
 dom.cpLookup.disabled=true;
 dom.cpResult.textContent="A consultar a CP para o comboio "+number+"…";
 try{
  const r=await lookupCpOperational({number,date,transport:fetchRemoteJson});
  const delay=r.delayMinutes===null?"sem indicação de atraso":(r.delayMinutes+" min reportados");
  const stops=r.stops.slice(0,60).map(s=>
   '<div class="cpStop"><span>'+safeText(s.station)+'</span><span>'+
   safeText([s.scheduledArrival||s.scheduledDeparture||"—",
    s.eta?"ETA "+s.eta:null,s.etd?"ETD "+s.etd:null].filter(Boolean).join(" · "))+
   '</span></div>').join("");
  dom.cpResult.innerHTML='<div class="cpStatus"><strong>'+
   safeText(r.type+" "+r.number)+'</strong><span>'+safeText(r.status)+
   '</span><span>Atraso CP: '+safeText(delay)+'</span></div>'+
   '<p>Origem: CP · consultado às '+safeText(new Date(r.obtainedAt).toLocaleTimeString("pt-PT"))+
   ' · última estação indicada: '+safeText(r.lastReportedStation||"não indicada")+'</p>'+
   (r.hasDisruptions===true?'<p class="cpWarning">A CP sinaliza perturbações.</p>':"")+
   r.messages.map(m=>'<p class="cpWarning">'+safeText(m.text)+'</p>').join("")+
   '<details><summary>Ver '+r.stops.length+' paragens devolvidas pela CP</summary>'+
   stops+'</details><p class="cpNoGps">Sem GPS do veículo. Nenhum marcador é criado com estes dados.</p>';
 }catch(e){
  const message=String(e?.message||e).replace(/https?:\/\/[^ ]+/g,"[URL]");
  dom.cpResult.textContent="CP operacional indisponível: "+message+
   ". A TML e os horários GTFS continuam independentes desta consulta.";
 }finally{dom.cpLookup.disabled=false}
}
dom.cpLookup.onclick=queryCpNational;

async function loadBuildAudit(){
 try{
  const r=await fetch(BASE+"data/unified/diagnostics.json",{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();
  const eta=d.sources?.tmlEta?.status??"não testado",alerts=d.sources?.tmlAlerts?.status??"não testado";
  dom.buildAudit.textContent="Compilação "+new Date(d.checkedAt).toLocaleString("pt-PT")+
   " (histórico, NÃO ao vivo) · ETA TML "+eta+" · Alertas "+alerts+
   " · IP e CP operacional: integração pendente";
 }catch(e){dom.buildAudit.textContent="Diagnóstico da compilação indisponível: "+e.message}
}
async function loadGps(){
 dom.gpsStatus.textContent="TML: a consultar posições atuais…";
 let rows=[],directError=null;
 try{
  const response=await fetchTmlJson(TML_URL);
  rows=asRows(response);
 }catch(e){directError=String(e?.message||e)}
 let ftError=null;ftProxyUsed=false;
 if(!normalizePositions({data:rows},{agencyAllowlist:[FT_AGENCY]}).length){
  try{
   const response=await fetchTmlJson(FT_FALLBACK_URL);
   const ftRows=asRows(response).filter(p=>String(p.agency_id)==FT_AGENCY);
   rows=rows.concat(ftRows);
   ftProxyUsed=ftRows.length>0;
  }catch(e){ftError=String(e?.message||e);console.warn("Fertagus fallback",e)}
 }
 latestTmlRows=rows;
 lastTmlError=directError?(directError+(ftError?" · FT "+ftError:"")):null;
 refreshUnified();
}

function renderStations(){
 stationMarkers.clearLayers();
 stationIndex=new Map();
 for(const station of data?.stations||[]){
  if(!sameLocation(station.location))continue;
  stationIndex.set(station.id,station);
  const mk=L.circleMarker(station.location,{radius:3.5,weight:1,color:"#60a5fa",fillColor:"#c4e9ff",fillOpacity:.85});
  mk.bindTooltip(safeText(station.name),{direction:"top"});
  mk.on("click",()=>{dom.q.value=station.name;renderTrains();});
  mk.addTo(stationMarkers);
 }
}
function viewTrain(t){
 routeLayer.clearLayers();
 const points=(t.stops||[]).filter(s=>sameLocation(s.location)).map(s=>s.location);
 if(points.length>=2){
  L.polyline(points,{color:COLORS[t.type]||COLORS.CP,weight:3,opacity:.8,dashArray:"6 7"}).addTo(routeLayer);
  map.fitBounds(L.latLngBounds(points).pad(.12),{maxZoom:11});
 }else if(points.length===1)map.setView(points[0],12);
 const panel=document.createElement("div");
 panel.className="details";
 panel.innerHTML=`<div><strong>${safeText(t.type)} ${safeText(t.number)}</strong> · ${safeText(t.origin)} → ${safeText(t.destination)}</div><p>Paragens programadas (não há confirmação de passagem em direto)</p>`+
 (t.stops||[]).map(s=>`<div class="stop"><span>${safeText(s.name)}</span><span>${safeText(s.departure||s.arrival)}</span></div>`).join("");
 const existing=document.querySelector(".details");if(existing)existing.remove();
 document.querySelector(".results").append(panel);
 panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function renderTrains(){
 if(!data){renderGps();return;}
 const q=dom.q.value.trim().toLocaleLowerCase("pt-PT");
 const matches=data.trains.filter(t=>(selected==="ALL"||t.type===selected)&&(!q||[t.number,t.route,t.headsign,t.origin,t.destination,...(t.stops||[]).map(s=>s.name)].some(v=>String(v||"").toLocaleLowerCase("pt-PT").includes(q))));
 dom.count.textContent=`${matches.length} circulações programadas de ${data.trains.length} no dia ${data.date}`;
 const visible=matches.slice(0,100);
 dom.trains.innerHTML=visible.map((t,i)=>`<button class="train" data-index="${i}">
 <span class="pill" style="--type-color:${COLORS[t.type]||COLORS.CP}">${safeText(t.type)}</span>
 <span class="trainInfo"><strong>${safeText(t.number)}</strong><small>${safeText(t.origin)} → ${safeText(t.destination)}</small></span>
 <span class="hours"><b>${safeText(t.departure)} → ${safeText(t.arrival)}</b><small>previsto</small></span></button>`).join("");
 if(matches.length>100)dom.trains.innerHTML+=`<p class="limit">A mostrar 100 resultados. Pesquisa um comboio ou uma estação para restringir.</p>`;
 if(!matches.length)dom.trains.innerHTML='<p class="empty">Nenhuma circulação programada corresponde aos filtros.</p>';
 dom.trains.querySelectorAll("button[data-index]").forEach(b=>b.onclick=()=>viewTrain(visible[Number(b.dataset.index)]));
 document.querySelector(".details")?.remove();
 routeLayer.clearLayers();
 renderGps();
}
async function fetchJson(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{
  const r=await fetch(BASE+"data/cp/"+path,{cache:"no-store",signal:controller.signal});
  if(!r.ok)throw Error("HTTP "+r.status+" em "+path);
  return await r.json();
 }finally{clearTimeout(timer);}
}
async function loadDay(date){
 setMessage("A ler horários CP…");
 try{
  data=await fetchJson(date+".json");
  if(data.realtime!==false||data.gps!==false)throw Error("Tipo de dados inesperado");
  dom.freshness.textContent="GTFS importado: "+new Date(data.generatedAt).toLocaleString("pt-PT");
  renderStations();renderTrains();refreshUnified();map.invalidateSize();
 }catch(e){setMessage("Horários indisponíveis: "+e.message);dom.trains.innerHTML="<p class='empty'>A importação GTFS tem de terminar com sucesso no GitHub Actions.</p>";}
}
async function load(){
 setMessage("A consultar índice oficial…");
 try{
  manifest=await fetchJson("manifest.json");
  if(!manifest?.days?.length||manifest.realtime!==false)throw Error("Índice GTFS inválido");
  dom.day.innerHTML=manifest.days.map(d=>`<option value="${safeText(d.date)}">${safeText(d.date)} · ${d.trains} comboios</option>`).join("");
  await loadDay(dom.day.value);
 }catch(e){setMessage("Não foi possível obter a base CP: "+e.message);dom.trains.innerHTML="<p class='empty'>Sem base GTFS importada. Compila o projeto através do workflow da versão 2.0.</p>";}
}
dom.q.addEventListener("input",()=>{renderTrains();renderGps()});
dom.day.addEventListener("change",()=>loadDay(dom.day.value));
dom.reload.onclick=()=>{load();loadGps()};
dom.focusGps.onclick=()=>focusGpsMarkers();
renderTypes();
loadBuildAudit();
load();
loadGps();
setInterval(loadGps,30000);
