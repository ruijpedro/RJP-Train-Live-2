import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./original-layout.css";
import {Capacitor} from "@capacitor/core";
import {LocalNotifications} from "@capacitor/local-notifications";
import {installOriginalLayout} from "./original-layout.js";
import {installEditableAlertUI} from "./editable-alert-ui.js";
import {CP_AGENCY,FT_AGENCY,TML_URL,FT_FALLBACK_URL,normalizePositions,asRows} from "./live-positions.js";
import {buildUnifiedFeed} from "./unified-feed.js";
import {fetchTmlJson,fetchRemoteJson,transportLabel} from "./native-http.js";
import {lookupCpOperational,CP_CONFIG_URL} from "./cp-operational.js";
import {filterCatalogue,pageCatalogue,PAGE_SIZE,cpLookupNumber,sampleCpByType} from "./train-catalog.js";
import {coverageAudit} from "./coverage-audit.js";
import {gpsIndicator,GPS_MAX_AGE_MS} from "./gps-indicator.js";
import {buildEstimatedPositions,currentLisbon,previousServiceDate} from "./estimated-positions.js";
import {REMOTE_CP_GTFS,usableManifest} from "./gtfs-sync.js";
import {detailStopTimes,detailStopProgress,detailStatusText,detailServiceLabel,detailKindSource,etaCountdownMinutes} from "./train-detail.js";
import {RUI_DIRECT_URL,RUI_WORKER_RELAY,shouldUseRuiFallback,normalizeRuiFallback} from "./rui-fallback.js";

const BASE = import.meta.env.BASE_URL;
const LOCAL_CP_BASE=BASE+"data/cp/";
let cpSourceBase=LOCAL_CP_BASE,cpSourceLabel="APK";
const TYPES = ["U","R","IR","IC","AP","SUD","CP","FT"];
// Original RJP Train Live palette, copied from source v2.12.x.
const COLORS = {U:"#2563eb",R:"#16a34a",IR:"#7c3aed",IC:"#ea580c",AP:"#b91c1c",SUD:"#0f766e",CP:"#2563eb",FT:"#0891b2"};
const el = document.getElementById("app");
el.innerHTML = `
<header>
 <div class="brand"><div class="brandIcon">🚆</div><div><h1>RJP TRAIN LIVE <span>2.0</span></h1><p>Laboratório de fontes ferroviárias • CP + TML + IP</p></div></div>
 <div class="headRight"><strong>FONTES UNIFICADAS</strong><small>2.0.15-beta.1 · ícones originais e ETA</small></div>
</header>
<div class="sourceNote"><strong>GPS real e estimativas nacionais</strong><span>Marcadores cheios: coordenadas reais TML. Marcadores ≈ tracejados: NÃO GPS. Roxo: estimativa ancorada na última estação CP; âmbar: previsão só pelo horário GTFS. As estimativas podem afastar-se muito da localização real.</span></div>
<div class="controls">
 <label><span>Data</span><select id="day"><option>A carregar…</option></select></label>
 <label class="searchBox"><span>Pesquisar comboio ou estação</span><input id="q" placeholder="Número, origem, destino ou paragem" autocomplete="off"/></label>
 <button id="reload">Atualizar horários e GPS</button><button id="focusGps" type="button" class="focusBtn">Ver todos os GPS</button><button id="focusEstimated" type="button" class="estimatedBtn">Ver estimativas nacionais</button><button id="showNational" type="button" class="catalogBtn">Ver todos os CP (GTFS)</button>
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
<section class="cpNationalSample" aria-label="Amostra de circulação nacional CP">
 <div class="sampleHeader"><div><h2>CP nacional — consulta por categoria</h2><p>Seleciona cinco comboios pelo horário oficial e consulta diretamente a CP. Os estados não são GPS nem confirmam que todos estão em circulação.</p></div><button id="sampleNational" type="button">Consultar U · R · IR · IC · AP</button></div>
 <div id="sampleResult" class="sampleResult" aria-live="polite">Consulta manual, limitada a cinco serviços, sem recolha contínua de toda a rede.</div>
</section>
<section class="labAudit" aria-label="Diagnóstico de fontes">
 <div class="labAuditMetrics"><div><small>CP com posição TML</small><b id="cpLive">—</b></div><div><small>CP identificados</small><b id="cpMatched">—</b></div><div><small>Fertagus com posição</small><b id="ftLive">—</b></div><div><small>CP programados (GTFS)</small><b id="scheduled">—</b></div><div><small>Respostas CP nesta sessão</small><b id="cpAnswered">0</b></div><div><small>Com indicadores CP</small><b id="cpEvidence">0</b></div></div>
 <p id="auditText">A aguardar diagnóstico de fontes…</p><div id="coverageTypes" class="coverageTypes" aria-label="Cobertura por tipo de comboio"></div><p id="coverageNote" class="coverageNote">GTFS ≠ circulação confirmada; indicadores CP ≠ localização GPS.</p>
 <p id="buildAudit">Registo da compilação: a carregar…</p>
 <p id="ruiFallbackStatus">Contingência Comboios Live: reserva, desativada.</p>
</section>
<div class="estimatePanel">
 <div><strong>Localizações CP no mapa</strong><span id="estimateStats">A calcular posições aproximadas…</span><span id="mapTotals">A contar GPS e estimativas…</span></div>
 <label><input id="showCpEstimates" type="checkbox" checked/> Estimativa CP + GTFS</label>
 <label><input id="showScheduleEstimates" type="checkbox" checked/> Previsão só GTFS</label>
 <label><input id="showStations" type="checkbox"/> Mostrar estações</label>
 <small>Uma estimativa não comprova circulação ou passagem. As retas entre estações podem divergir do traçado ferroviário.</small>
 <span id="cpAutoStatus" aria-live="polite">CP nacional: a preparar consultas limitadas.</span>
 <span id="serviceDayNotice" aria-live="polite"></span>
</div>
<div class="workspace">
 <div id="map" aria-label="Mapa de estações CP"></div>
 <section class="results"><h2>Posições reais reportadas pela TML</h2><p class="legendLab">Fonte + hora de posição · só aparece o número do comboio quando validado no GTFS da CP</p><div id="liveTrains" class="gpsResults"></div><h2>Comboios estimados — NÃO GPS</h2><p class="legendLab">≈ Roxo = CP + GTFS; ≈ âmbar = apenas horário, circulação não confirmada. Abre o comboio para ver fonte, estimativa e incerteza.</p><div id="estimatedTrains" class="estimateResults"></div>
 <section id="ruiFallbackSection" class="ruiFallbackSection" hidden><h2>Contingência — Comboios Live (Rui Costa)</h2><p class="legendLab">Fonte externa de ÚLTIMO RECURSO. Coordenadas não verificadas como GPS pela RJP; nunca substituem CP/TML/GTFS quando disponíveis.</p><div id="ruiFallbackTrains"></div></section>
 <h2 id="catalogHeading">Catálogo nacional CP — serviços programados</h2><p class="legendLab">Pesquisa nacional no GTFS. Cada comboio indica «GPS disponível» ou «Sem GPS recebido». Quando não há GPS, podemos desenhar uma previsão APROXIMADA, identificada como estimativa, nunca como GPS.</p><div id="catalogCount" class="catalogCount">A carregar catálogo…</div><div id="trains"></div></section>
</div>
<footer><b>RJP Train Live 2.0 — laboratório.</b> A Trains original não é modificada. GPS TML (máx. 3 minutos) é distinto das estimativas CP + GTFS ou só GTFS. Estimativas não são localizações exatas nem confirmação de circulação. Não utilizar para segurança da exploração.</footer>
`;
installOriginalLayout({version:"2.0.13-beta.1",base:BASE});

const dom = Object.fromEntries(["q","day","types","reload","focusGps","count","freshness","trains","gpsStatus","liveTrains","cpLive","cpMatched","ftLive","scheduled","auditText","buildAudit","cpNumber","cpLookup","cpResult","showNational","catalogCount","catalogHeading","cpAnswered","cpEvidence","coverageTypes","coverageNote","sampleNational","sampleResult","focusEstimated","showCpEstimates","showScheduleEstimates","estimatedTrains","estimateStats","cpAutoStatus","showStations","mapTotals","serviceDayNotice","ruiFallbackStatus","ruiFallbackSection","ruiFallbackTrains"].map(id=>[id,document.getElementById(id)]));
let manifest=null,data=null,selected="ALL",stationMarkers=L.layerGroup(),routeLayer=L.layerGroup(),stationIndex=new Map(),gpsMarkers=L.layerGroup(),estimatedMarkers=L.layerGroup(),ruiMarkers=L.layerGroup(),gpsVehicles=[],estimatedVehicles=[],didFocusGps=false,lastGpsStatus="",latestTmlRows=[],lastTmlError=null,tmlChecked=false,ftProxyUsed=false,listLimit=PAGE_SIZE,operationalQueries=new Map(),coverageDate=null,cpAutoBusy=false,cpAutoLastBatch=0,cpConfigCache=null,cpConfigCachedAt=0,previousDayData=null,didInitialAutoFit=false,manualDateSelection=false,dayRequestSeq=0,lastLocalServiceDate=currentLisbon().date,
 gtfsLoadAttempted=false,ruiFallbackVehicles=[],ruiLastFetch=0,ruiFetchBusy=false,ruiLastError=null,didRuiAutoFit=false;
const map=L.map("map",{zoomControl:true}).setView([39.65,-8.15],7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
L.tileLayer("https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",{maxZoom:19,opacity:.88,attribution:"OpenRailwayMap"}).addTo(map);
// Hide station dots by default: they previously obscured nationwide trains.
dom.showStations.onchange=()=>dom.showStations.checked?stationMarkers.addTo(map):map.removeLayer(stationMarkers);
routeLayer.addTo(map);
gpsMarkers.addTo(map);
estimatedMarkers.addTo(map);
ruiMarkers.addTo(map);

function safeText(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function statusGps(number,tripId=null,date=data?.date){
 return gpsIndicator({number,tripId,date,vehicles:gpsVehicles,checked:tmlChecked,
  sourceError:!!lastTmlError,now:Date.now(),maxAgeMs:GPS_MAX_AGE_MS});
}
function gpsChip(s){
 return '<span class="gpsChip '+safeText(s.state)+'" title="'+safeText(s.detail)+'">'+
  (s.state==="available"?"● ":"○ ")+safeText(s.label)+'</span>';
}
function refreshGpsChips(){
 dom.trains.querySelectorAll("[data-gps-chip]").forEach(el=>{
  const status=statusGps(el.dataset.trainNumber,el.dataset.tripId||null);
  el.innerHTML=gpsChip(status);
 });
 const details=document.querySelector("[data-gps-detail-number]");
 if(details){details.innerHTML=gpsChip(statusGps(details.dataset.gpsDetailNumber,details.dataset.gpsDetailTrip||null));}
}
function sameLocation(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);}
function setMessage(msg){dom.count.textContent=msg;}
function renderTypes(){
 dom.types.innerHTML=["ALL",...TYPES].map(t=>`<button class="type ${selected===t?"active":""}" data-type="${t}" style="--type-color:${COLORS[t]||"#38bdf8"}">${t==="ALL"?"Todos":t}</button>`).join("");
 dom.types.querySelectorAll("button").forEach(b=>b.onclick=()=>{const choice=b.dataset.type;selected=selected===choice?"ALL":choice;listLimit=PAGE_SIZE;renderTypes();renderTrains();renderGps();renderEstimates();renderRuiFallback();});
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

function trainMapIcon(type,kind="gps"){
 const t=Object.hasOwn(COLORS,String(type))?String(type):"CP";
 const color=COLORS[t],estimated=kind==="cp-anchored"||kind==="timetable";
 const state=estimated?" rjp-marker-estimated "+(kind==="cp-anchored"?"rjp-marker-anchored":"rjp-marker-timetable"):
  kind==="backup"?" rjp-marker-backup":" rjp-marker-real";
 // No extra floating icons: the original app uses plain category circles.
 // Provenance stays available on tap and in the train details.
 const badge="";
 const label=(estimated?"Posição estimada, não GPS: ":kind==="backup"?"Fonte de reserva: ":"GPS real TML: ")+t;
 return L.divIcon({className:"rjpTrainMarkerIcon",html:'<span class="rjpTrainMapCircle'+state+
  '" style="--rjp-service-color:'+color+'" title="'+safeText(label)+'">'+safeText(t)+badge+'</span>',
  iconSize:[32,32],iconAnchor:[16,16]});
}
function gpsIcon(type){return trainMapIcon(type,"gps");}

// Original-style dark modal for EVERY map marker. The GPS/estimate source remains
// prominent. CP status is requested on tap, not guessed from a scheduled train.
let detailDialogSequence=0;
function findCatalogueJourney(kind,v){
 if(kind==="scheduled")return v;
 const number=String(kind==="gps"?(v.trainNumber??""):v.number??"");
 const dated=kind==="estimated"&&v.date!==data?.date?previousDayData:data;
 const trains=dated?.trains??[];
 if(kind==="estimated"){
  return trains.find(t=>String(t.id)===String(v.tripId)&&String(t.number)===number)??null;
 }
 return trains.find(t=>String(t.number)===number)??null;
}
function sourceTime(ms){
 if(ms===null||ms===undefined||ms==="")return null;
 const d=new Date(ms);
 return Number.isFinite(d.getTime())?d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):null;
}
function trainDetailsMarkup(kind,v,train,cp,{loading=false,error=""}={}){
 const num=String(kind==="gps"?(v.trainNumber??v.vehicleId??""):v.number??"");
 const type=train?.type??v.type??"CP";
 const origin=train?.origin??v.origin??"não indicada";
 const destination=train?.destination??v.destination??"não indicado";
 const source=detailKindSource(kind,v.level);
 const confirmedGps=kind==="gps";
 const reported=!!cp;
 const delay=reported&&Number.isFinite(cp.delayMinutes)?cp.delayMinutes:null;
 const fallbackDelay=kind==="rui"&&Number.isFinite(v.delayMinutes)?v.delayMinutes:null;
 const delayText=delay!==null?(delay>0?"+"+delay+" min":delay<0?delay+" min":"0 min"):
  (fallbackDelay!==null?(fallbackDelay>0?"+":"")+fallbackDelay+" min":"Não comunicado");
 const delayEvidence=delay!==null?"Atraso comunicado pela CP":
  fallbackDelay!==null?"Atraso indicado por Comboios Live, não confirmado pela CP":"";
 const stops=detailStopTimes(train,cp);
 const progress=detailStopProgress(stops,cp);
 const last=cp?.lastReportedStation??(kind==="rui"?v.lastStation:kind==="estimated"?v.lastCpStation:null);
 const next=progress.nextIndex!==null?stops[progress.nextIndex]?.name??null:
  (kind==="rui"?v.nextStation:kind==="estimated"?v.toStation:null);
 const status=cp?detailStatusText(cp):
  kind==="gps"?"Posição TML recebida; estado CP não confirmado":
  kind==="rui"?(v.status??"Estado não confirmado pela CP"):
  "Circulação não confirmada";
 const stamp=cp?.obtainedAt?sourceTime(cp.obtainedAt):kind==="gps"?sourceTime(v.timestamp):
  kind==="rui"?sourceTime(v.checkedAt):sourceTime(v.updatedAt);
 const badge=confirmedGps?"GPS REAL · TML":kind==="estimated"?
  "≈ "+(v.level==="cp-anchored"?"ESTIMATIVA CP + GTFS":"PREVISÃO POR HORÁRIO")+" · NÃO GPS":
  kind==="rui"?"FONTE DE RESERVA · NÃO GPS VERIFICADO":"HORÁRIO PROGRAMADO · NÃO GPS";
 const evidence=confirmedGps?"real":kind==="rui"?"backup":kind==="estimated"?"estimated":"scheduled";
 const stateLabel=loading?"A consultar o estado e as paragens diretamente à CP…":
  error?"Consulta CP indisponível: "+error:
  reported?"CP consultada às "+(sourceTime(cp.obtainedAt)??"—"):
  "Sem consulta CP recente.";
 const current=stops.filter(s=>s.eta!==null).length;
 // Countdowns are shown only with current-day CP-supported ETA, never GTFS alone.
 const serviceDate=kind==="estimated"?v.date:data?.date;
 const clock=currentLisbon();
 const rows=stops.length?stops.slice(0,85).map((s,i)=>{
  const label=s.etaSource==="cp-reported"?"ETA informado pela CP":
   s.etaSource==="cp-delay"?"Calculado com o atraso CP":"Horário programado";
  const highlighted=progress.lastIndex===i?" passed":progress.nextIndex===i?" upcoming":"";
  const countdown=serviceDate===clock.date&&cp&&s.etaSource!=="unknown"?
   etaCountdownMinutes(s.eta,clock.minutes):null;
  const countdownText=countdown===0?"Agora (previsto)":countdown!==null?"Dentro de "+countdown+" min*":null;
  return '<div class="rjpEtaStop'+highlighted+'"><div class="rjpEtaStation">'+
   '<b>'+safeText(s.name)+'</b>'+
   (progress.nextIndex===i?'<span class="rjpNextStop">Próxima paragem</span>':"")+
   (countdownText?'<span class="rjpEtaCountdown">'+safeText(countdownText)+'</span>':"")+
   '<small>'+safeText(label)+'</small></div>'+
   '<div class="rjpEtaHours"><span>Horário: '+safeText(s.scheduled??"—")+'</span>'+
   '<strong>ETA: '+safeText(s.eta??"indisponível")+'</strong></div></div>';
 }).join(""):'<p class="rjpEtaUnavailable">Sem paragens disponíveis para este comboio.</p>';
 let positionNote="";
 if(kind==="estimated"){
  positionNote='<p>Localização aproximada entre <b>'+safeText(v.fromStation??"—")+
   '</b> e <b>'+safeText(v.toStation??"—")+'</b>. '+
   'O cálculo por horário pode afastar-se da via real e não comprova a passagem.</p>';
 }else if(kind==="gps"){
  positionNote='<p>Coordenadas recebidas da TML às '+safeText(sourceTime(v.timestamp)??"—")+
   '; correspondência '+safeText(v.matchMethod??"não indicada")+'.</p>';
 }else if(kind==="rui"){
  positionNote='<p>Dados de último recurso, sem validação própria da localização GPS ou da hora original da posição.</p>';
 }else{
  positionNote='<p>GTFS corresponde a horários programados; não confirma a circulação ou a localização do veículo.</p>';
 }
 return '<div class="rjpTrainDetails"><div class="rjpTrainHeader">'+
  '<div class="rjpTrainNumber"><img alt="" src="'+safeText(BASE+'icons/icon-192.png')+
  '"><h2>'+safeText(type+" "+num)+'</h2></div><span class="rjpTrainEvidence '+evidence+'">'+safeText(badge)+'</span></div>'+
  '<div class="rjpTrainJourney"><strong>'+safeText(origin)+'</strong> <span>→</span> <strong>'+safeText(destination)+'</strong></div>'+
  '<p class="rjpTrainDelay">Atraso: <strong class="'+(delay!==null||fallbackDelay!==null?"known":"unknown")+'">'+safeText(delayText)+'</strong>'+
   (delayEvidence?'<small>'+safeText(delayEvidence)+'</small>':"")+'</p>'+
  '<p class="rjpTrainFacts">Serviço: <b>'+safeText(cp?.serviceName??detailServiceLabel(type))+'</b></p>'+
  '<p class="rjpTrainFacts">Estado: <b>'+safeText(status)+'</b></p>'+
  '<p class="rjpTrainFacts">Última: <b>'+safeText(last??"Não indicada")+'</b></p>'+
  '<p class="rjpTrainFacts">Próxima: <b>'+safeText(next??"Não confirmada")+'</b>'+
   (kind==="estimated"&&!cp?'<small> Estimada pelo horário</small>':"")+'</p>'+
  '<section class="rjpEtaSection"><h3>🕒 Chegadas estimadas (ETA)</h3>'+
  '<p class="rjpEtaIntro">Atualizado: '+safeText(stamp??"—")+
  ' · '+safeText(loading?"Consulta em curso":current?current+" horas previstas/estimadas": "sem ETA operacional")+'</p>'+
  '<p class="rjpEtaIntro">Horário previsto + atraso comunicado pela CP, quando disponível. '+
  'ETA e contagem de minutos são previsões, não passagens confirmadas.</p>'+
  '<div class="rjpEtaList">'+rows+'</div></section>'+
  '<section class="rjpSourceDetails"><p>Fonte: <strong>'+safeText(source)+'</strong></p>'+
  '<details><summary>Mais informação · Fonte e precisão</summary>'+
  '<p class="rjpCpDetailStatus">'+safeText(stateLabel)+'</p>'+positionNote+
  '<p>'+safeText(kind==="estimated"?v.basis:kind==="gps"?"Posição reportada pela TML, sem interpolação":
   kind==="rui"?v.note:"Horário fornecido pelo GTFS CP")+'</p>'+
  '<p>* Tempo restante aproximado. As estimativas e os ETA não são adequados para segurança da exploração ferroviária.</p>'+
  '</details></section></div>';
}
function openTrainDetails(kind,v){
 const overlay=document.getElementById("rjpTrainOverlay");
 const slot=document.getElementById("rjpTrainDialogContent");
 const token=++detailDialogSequence;
 // Any Leaflet information balloons must not overlap the modal.
 map.closePopup();
 const train=findCatalogueJourney(kind,v);
 const number=String(kind==="gps"?(v.trainNumber??""):v.number??"");
 const date=kind==="estimated"?v.date:data?.date;
 const stored=operationalQueries.get(number);
 const cacheValid=stored?.success&&stored.date===date&&
  Date.now()-Date.parse(stored.result?.obtainedAt??0)<120000;
 const cp=cacheValid?stored.result:null;
 overlay.hidden=false;
 slot.innerHTML=trainDetailsMarkup(kind,v,train,cp,{loading:!cacheValid&&/^\d{1,6}$/.test(number)&&date===currentLisbon().date});
 slot.closest(".rjpTrainDialog")?.scrollTo(0,0);
 if(!/^\d{1,6}$/.test(number)||date!==currentLisbon().date||cacheValid)return;
 const transport=async(url,opts)=>{
  if(url===CP_CONFIG_URL&&cpConfigCache&&Date.now()-cpConfigCachedAt<120000)return cpConfigCache;
  const p=await fetchRemoteJson(url,opts);
  if(url===CP_CONFIG_URL){cpConfigCache=p;cpConfigCachedAt=Date.now();}
  return p;
 };
 lookupCpOperational({number,date,transport}).then(result=>{
  if(token!==detailDialogSequence||overlay.hidden)return;
  operationalQueries.set(number,{date,number,success:true,checkedAt:result.obtainedAt,result});
  slot.innerHTML=trainDetailsMarkup(kind,v,train,result);
  renderCoverage();
  refreshEstimates();
 }).catch(e=>{
  if(token!==detailDialogSequence||overlay.hidden)return;
  slot.innerHTML=trainDetailsMarkup(kind,v,train,null,{
   error:"serviço temporariamente indisponível"
  });
 });
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
  const signal={state:"available",label:"GPS disponível",detail:"Posição recente publicada pela TML."};
  return '<button class="train gpsRow" data-gps="'+i+'"><span class="pill" style="--type-color:'+(COLORS[v.type]||COLORS.CP)+'">'+safeText(v.type)+'</span>'+
    '<span class="trainInfo"><strong>'+safeText(title)+'</strong><small>'+safeText(journey)+'</small>'+gpsChip(signal)+'<small>Origem: TML · '+safeText(v.matchMethod)+'</small></span>'+
    '<span class="hours"><b>POSIÇÃO</b><small>'+new Date(v.timestamp).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})+'</small></span></button>';
 }).join(""):'<p class="empty">Sem posições recentes para estes filtros. Os horários GTFS estão disponíveis abaixo; não são localizações reais.</p>';
 for(const v of visible){
  const marker=L.marker([v.latitude,v.longitude],{icon:gpsIcon(v.type)}).addTo(gpsMarkers);
  marker.bindTooltip(safeText((v.trainNumber?v.type+" "+v.trainNumber:v.operator+" "+v.vehicleId)+" · TML"));
  marker.on("click",()=>openTrainDetails("gps",v));
 }
 dom.liveTrains.querySelectorAll("button[data-gps]").forEach(b=>b.onclick=()=>{
  const v=visible[Number(b.dataset.gps)];
  map.setView([v.latitude,v.longitude],12);
  openTrainDetails("gps",v);
 });
}


// Posicionamento ESTIMADO (não GPS): cada ficha e popup expõe origem e método.
function estimatedLabel(v){
 return v.level==="cp-anchored"?"Estimativa CP + GTFS":"Previsão só horário GTFS";
}
function estimatedBadge(v){
 return '<span class="estimateChip '+safeText(v.level)+'">≈ '+safeText(estimatedLabel(v))+' · NÃO GPS</span>';
}
function estimatedDetails(v){
 const cpTime=v.updatedAt?new Date(v.updatedAt).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}):"CP não consultada";
 const pct=v.progress==null?"não aplicável":Math.round(v.progress*100)+"% teórico do troço";
 return '<div class="estimateDetail"><p><strong>≈ POSIÇÃO ESTIMADA · NÃO GPS</strong></p>'+
  '<p>'+safeText(v.type+" "+v.number)+" · "+safeText(v.origin)+" → "+safeText(v.destination)+'</p>'+
  '<p>Classificação: '+safeText(estimatedLabel(v))+'</p>'+
  '<p>Estimado entre: '+safeText((v.fromStation??"—")+" → "+(v.toStation??"—"))+'</p>'+
  '<p>Avanço calculado: '+safeText(pct)+'</p>'+
  '<p>Fonte: '+safeText(v.source)+'</p>'+
  '<p>Método: '+safeText(v.basis)+'</p>'+
  '<p>CP: '+safeText(v.cpStatus??"não consultada")+
  ' · atraso: '+safeText(v.cpDelayMinutes==null?"não indicado":v.cpDelayMinutes+" min")+'</p>'+
  '<p>Última estação informada pela CP: '+safeText(v.lastCpStation??"não indicada")+
  ' · consulta CP: '+safeText(cpTime)+'</p>'+
  '<p><strong>INCERTEZA ELEVADA:</strong> '+safeText(v.note)+'</p></div>';
}
function estimatedIcon(v){return trainMapIcon(v.type,v.level);}
function renderEstimates(){
 estimatedMarkers.clearLayers();
 const cpOn=dom.showCpEstimates.checked,gtfsOn=dom.showScheduleEstimates.checked;
 const q=dom.q.value.trim().toLocaleLowerCase("pt-PT");
 const visible=estimatedVehicles.filter(v=>
  ((v.level==="cp-anchored"&&cpOn)||(v.level==="timetable"&&gtfsOn))&&
  (selected==="ALL"||selected==="CP"||selected===v.type)&&
  (!q||[v.number,v.type,v.origin,v.destination,v.fromStation,v.toStation,v.lastCpStation]
   .some(s=>String(s??"").toLocaleLowerCase("pt-PT").includes(q))));
 const anchored=estimatedVehicles.filter(v=>v.level==="cp-anchored").length;
 dom.estimateStats.textContent="≈ "+estimatedVehicles.length+" previsões de circulação";
 dom.mapTotals.textContent=gpsVehicles.length+" coordenadas TML · "+anchored+
  " estimativas apoiadas na CP · "+(estimatedVehicles.length-anchored)+" só pelo horário";
 dom.estimatedTrains.innerHTML=visible.length?
  visible.slice(0,120).map((v,i)=>
   '<button type="button" class="train estimatedRow '+safeText(v.level)+'" data-est-index="'+i+'">'+
   '<span class="estimateSymbol" style="--service-color:'+(COLORS[v.type]||COLORS.CP)+'">≈</span><span class="trainInfo">'+
   '<strong>'+safeText(v.type+" "+v.number)+'</strong>'+
   '<small>'+safeText(v.origin+" → "+v.destination)+'</small>'+
   estimatedBadge(v)+'<small>Entre '+safeText((v.fromStation??"—")+" e "+(v.toStation??"—"))+'</small>'+
   '<small>'+safeText(v.cpStatus?"Estado CP: "+v.cpStatus:"Circulação não confirmada")+'</small>'+
   '</span></button>').join("")+
   (visible.length>120?'<p class="limit">A mostrar 120 de '+visible.length+
   ' estimativas; usa a pesquisa para encontrar mais.</p>':""):
   '<p class="empty">Sem estimativas nestes filtros. Ativa «Previsão só GTFS» para ver horários projetados.</p>';
 const markerMap=new Map();
 for(const v of visible){
  const marker=L.marker([v.latitude,v.longitude],{icon:estimatedIcon(v),zIndexOffset:-700}).addTo(estimatedMarkers);
  marker.bindTooltip("≈ "+safeText(v.type+" "+v.number)+" · NÃO GPS");
  marker.on("click",()=>openTrainDetails("estimated",v));
  markerMap.set(v.date+":"+v.tripId,marker);
 }
 dom.estimatedTrains.querySelectorAll("[data-est-index]").forEach(b=>b.onclick=()=>{
  const v=visible[Number(b.dataset.estIndex)];
  map.setView([v.latitude,v.longitude],11);
  openTrainDetails("estimated",v);
 });
 const byTrip=new Map(estimatedVehicles.map(v=>[v.date+":"+v.tripId,v]));
 dom.trains.querySelectorAll("[data-estimate-chip]").forEach(x=>{
  const v=byTrip.get(data.date+":"+x.dataset.estimateTrip);
  x.innerHTML=v?estimatedBadge(v):"";
 });
 const detail=document.querySelector("[data-estimate-detail]");
 if(detail){
  const v=byTrip.get(data.date+":"+detail.dataset.estimateDetailTrip);
  detail.innerHTML=v?estimatedBadge(v)+'<p>Fonte '+safeText(v.source)+' · '+safeText(v.basis)+
   ' · '+safeText(v.fromStation??"—")+' → '+safeText(v.toStation??"—")+'</p>':"";
 }
}
function refreshEstimates(){
 estimatedVehicles=buildEstimatedPositions({trains:data?.trains??[],date:data?.date,previousDay:previousDayData,now:Date.now(),
  queries:[...operationalQueries.values()],gpsVehicles});
 renderEstimates();
 autoFitNationalOnce();
 maybeRuiFallback();
}
function focusEstimatedMarkers(){
 const visible=estimatedVehicles.filter(v=>v.level==="cp-anchored"?
  dom.showCpEstimates.checked:dom.showScheduleEstimates.checked);
 if(!visible.length){dom.estimateStats.textContent="Não há estimativas para centrar.";return}
 selected="ALL";dom.q.value="";
 renderTypes();renderTrains();renderGps();renderEstimates();
 const bounds=L.latLngBounds(visible.map(v=>[v.latitude,v.longitude]));
 if(bounds.isValid()){map.invalidateSize();map.fitBounds(bounds.pad(.12),{maxZoom:9,animate:false})}
}
dom.focusEstimated.onclick=focusEstimatedMarkers;
dom.showCpEstimates.onchange=renderEstimates;
dom.showScheduleEstimates.onchange=renderEstimates;

// CP direct queries restricted to 6 scheduled candidates per 5-minute batch,
// only while application is open. No bulk scraping and no secret persistence.
async function limitedCpNationalRefresh(){
 if(cpAutoBusy||!tmlChecked||!data?.trains||data.date!==currentLisbon().date)return;
 const now=Date.now();
 if(now-cpAutoLastBatch<5*60*1000)return;
 const choices=[],seen=new Set();
 const pool=estimatedVehicles.filter(v=>v.date===data.date&&v.level==="timetable"&&/^\d{1,6}$/.test(v.number));
 for(const type of ["IR","IC","AP","R","U","R","IR","IC","AP","R"]){
  const next=pool.find(v=>v.type===type&&!seen.has(v.number)&&
   (!operationalQueries.has(v.number)||now-Date.parse(operationalQueries.get(v.number)?.checkedAt??0)>12*60*1000));
  if(next){choices.push(next);seen.add(next.number);}
  if(choices.length>=6)break;
 }
 if(!choices.length)return;
 cpAutoBusy=true;cpAutoLastBatch=now;
 dom.cpAutoStatus.textContent="CP nacional: a consultar "+choices.length+" comboios (amostra limitada)…";
 const transport=async (url,options)=>{
  if(url===CP_CONFIG_URL&&cpConfigCache&&Date.now()-cpConfigCachedAt<120000)return cpConfigCache;
  const payload=await fetchRemoteJson(url,options);
  if(url===CP_CONFIG_URL){cpConfigCache=payload;cpConfigCachedAt=Date.now()}
  return payload;
 };
 let ok=0,failed=0;
 try{
  for(const v of choices){
   if(data.date!==currentLisbon().date)break;
   try{
    const result=await lookupCpOperational({number:v.number,date:data.date,transport});
    operationalQueries.set(v.number,{date:data.date,number:v.number,
     checkedAt:new Date().toISOString(),success:true,result});
    ok++;
   }catch(e){
    operationalQueries.set(v.number,{date:data.date,number:v.number,
     checkedAt:new Date().toISOString(),success:false});
    failed++;
   }
   await new Promise(resolve=>setTimeout(resolve,650));
  }
  renderCoverage();refreshEstimates();
  dom.cpAutoStatus.textContent="CP nacional: "+ok+" respostas, "+failed+
    " indisponíveis (lote limitado; não representa toda a rede).";
 }finally{cpAutoBusy=false}
}


function renderRuiFallback(){
 ruiMarkers.clearLayers();
 dom.ruiFallbackSection.hidden=ruiFallbackVehicles.length===0;
 if(!ruiFallbackVehicles.length){dom.ruiFallbackTrains.innerHTML="";return}
 const q=dom.q.value.trim().toLocaleLowerCase("pt-PT");
 const visible=ruiFallbackVehicles.filter(v=>
   (selected==="ALL"||selected==="CP"||v.type===selected)&&
   (!q||[v.number,v.origin,v.destination,v.type,v.lastStation,v.nextStation]
     .some(s=>String(s??"").toLocaleLowerCase("pt-PT").includes(q))));
 dom.ruiFallbackTrains.innerHTML=visible.slice(0,125).map((v,i)=>
  '<button class="train ruiFallbackRow" type="button" data-rc-index="'+i+'">'+
  '<span class="pill" style="--type-color:'+(COLORS[v.type]||COLORS.CP)+'">'+safeText(v.type)+'</span>'+
  '<span class="trainInfo"><strong>'+safeText(v.type+" "+v.number)+'</strong>'+
  '<small>'+safeText(v.origin+" → "+v.destination)+'</small>'+
  '<span class="ruiFallbackChip">Fonte de emergência: Rui Costa · NÃO GPS verificado</span>'+
  '<small>Última estação indicada: '+safeText(v.lastStation??"não indicada")+'</small></span></button>'
 ).join("")+(visible.length>125?'<p class="limit">Mostrados 125 de '+visible.length+' resultados; usa a pesquisa.</p>':"");
 const markers=new Map();
 for(const v of visible){
  const marker=L.marker([v.latitude,v.longitude],{
   icon:trainMapIcon(v.type,"backup"),zIndexOffset:-800
  }).addTo(ruiMarkers);
  const updated=new Date(v.checkedAt).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"});
  marker.bindTooltip("Rui Costa · contingência · "+safeText(v.type+" "+v.number));
  marker.on("click",()=>openTrainDetails("rui",v));
  markers.set(v.number,marker);
 }
 dom.ruiFallbackTrains.querySelectorAll("[data-rc-index]").forEach(b=>b.onclick=()=>{
  const v=visible[Number(b.dataset.rcIndex)];
  map.setView([v.latitude,v.longitude],11);
  openTrainDetails("rui",v);
 });
}
function clearRuiFallback(){
 const had=ruiFallbackVehicles.length>0;
 ruiFallbackVehicles=[];ruiLastError=null;
 renderRuiFallback();
 dom.ruiFallbackStatus.textContent="Comboios Live: em reserva · fontes independentes disponíveis.";
 if(had)didRuiAutoFit=false;
}
async function maybeRuiFallback(){
 if(ruiFetchBusy||!tmlChecked||!gtfsLoadAttempted)return;
 const clock=currentLisbon();
 const dateCurrent=(!manualDateSelection||data?.date===clock.date);
 const tmlCp=gpsVehicles.filter(v=>v.agency===CP_AGENCY).length;
 const active=shouldUseRuiFallback({dateCurrent,checkedTml:tmlChecked,
  checkedGtfs:gtfsLoadAttempted,independentCPPositions:tmlCp,
  gtfsEstimates:estimatedVehicles.length});
 if(!active){if(ruiFallbackVehicles.length)clearRuiFallback();else
  dom.ruiFallbackStatus.textContent="Comboios Live: em reserva · CP/TML/GTFS continuam prioritários.";
  return}
 const now=Date.now();
 if(ruiLastFetch&&now-ruiLastFetch<60000){
  if(ruiFallbackVehicles.length&&now-ruiLastFetch>90000){
   ruiFallbackVehicles=[];renderRuiFallback();
  }
  return;
 }
 ruiFetchBusy=true;ruiLastFetch=now;
 dom.ruiFallbackStatus.textContent="Fontes próprias sem posições CP: a ativar recurso de emergência Comboios Live…";
 try{
  let normalized=[],reason="indisponível";
  for(const url of [RUI_DIRECT_URL,RUI_WORKER_RELAY]){
   try{
    const payload=await fetchRemoteJson(url,{timeoutMs:12000});
    normalized=normalizeRuiFallback(payload,{fetchedAt:Date.now()});
    if(normalized.length)break;
    reason="resposta sem comboios válidos";
   }catch(e){reason=String(e?.message||e).slice(0,90)}
  }
  // The independent sources may recover while the secondary request is in flight.
  if(gpsVehicles.some(v=>v.agency===CP_AGENCY)||estimatedVehicles.length){
   clearRuiFallback();return;
  }
  ruiFallbackVehicles=normalized;
  ruiLastError=normalized.length?null:reason;
  renderRuiFallback();
  dom.ruiFallbackStatus.textContent=normalized.length?
   "CONTINGÊNCIA ATIVA · "+normalized.length+
   " comboios de Comboios Live (Rui Costa) · dados externos, não GPS comprovado":
   "Contingência Comboios Live indisponível; sem posições CP independentes.";
  if(normalized.length&&!didRuiAutoFit){
   didRuiAutoFit=true;
   const bounds=L.latLngBounds(normalized.map(v=>[v.latitude,v.longitude]));
   if(bounds.isValid()){map.invalidateSize();map.fitBounds(bounds.pad(.1),{animate:false,maxZoom:8})}
  }
 }finally{ruiFetchBusy=false}
}

function renderCoverage(){
 const day=data?.date??null;
 const report=coverageAudit({
  date:day,trains:data?.trains??[],vehicles:gpsVehicles,
  queries:[...operationalQueries.values()]
 });
 dom.cpAnswered.textContent=report.cpAnswered;
 dom.cpEvidence.textContent=report.cpIndicators;
 const showTypes=report.byType.filter(row=>row.scheduled||row.withPosition||row.cpAnswered);
 dom.coverageTypes.innerHTML='<table><thead><tr>'+
   '<th scope="col">Tipo</th><th scope="col">GTFS</th>'+
   '<th scope="col">Posição TML</th><th scope="col">Respostas CP</th>'+
   '<th scope="col">Indicadores CP</th></tr></thead><tbody>'+
   showTypes.map(r=>'<tr><th scope="row">'+safeText(r.type)+'</th>'+
    '<td>'+r.scheduled+'</td><td>'+r.withPosition+'</td>'+
    '<td>'+r.cpAnswered+'</td><td>'+r.withIndicators+'</td></tr>').join("")+
   '</tbody><tfoot><tr><th>Total CP</th><td>'+report.scheduled+'</td>'+
   '<td>'+report.cpPositions+'</td><td>'+report.cpAnswered+'</td>'+
   '<td>'+report.cpIndicators+'</td></tr></tfoot></table>';
 dom.coverageNote.textContent=
  'GTFS = programados, não circulação confirmada · TML = coordenadas recentes (cobertura parcial) · '+
  'CP = '+report.cpQueried+' comboios consultados nesta sessão ('+report.cpAnswered+
  ' respostas, '+report.cpErrors+' falhas) · '+report.cpIndicators+
  ' respostas com indicadores, sem comprovação GPS. Não foi consultada automaticamente toda a rede.';
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
  gtfsTripId:v.journey?.gtfsTripId??null,
  timestamp:Date.parse(v.position.observedAt)
 }));
 const c=snapshot.coverage;
 dom.cpLive.textContent=c.cpFreshPositions;
 dom.cpMatched.textContent=c.cpMatchedToGtfs+" / "+c.cpFreshPositions;
 dom.ftLive.textContent=c.ftFreshPositions;
 dom.scheduled.textContent=c.cpScheduledToday;
 renderCoverage();
 refreshGpsChips();
 const source=ftProxyUsed?" · Fertagus via proxy TML":"";
 const problem=lastTmlError?" · Erro TML: "+lastTmlError:"";
 dom.gpsStatus.textContent="TML: CP "+c.cpFreshPositions+" ("+c.cpMatchedToGtfs+" identificados) · FT "+c.ftFreshPositions+" · "+transportLabel()+source+problem;
 lastGpsStatus=dom.gpsStatus.textContent;
 dom.auditText.textContent="Recolha atual: "+new Date(snapshot.generatedAt).toLocaleTimeString("pt-PT")+
   " · "+c.cpUnmatched+" CP por identificar · cobertura TML parcial, não nacional"+(lastTmlError?" · consulta direta indisponível":"");
 renderGps();
 refreshEstimates();
 limitedCpNationalRefresh();
 maybeRuiFallback();
}
async function queryCpNational(){
 const number=dom.cpNumber.value.trim(),date=dom.day.value;
 dom.cpLookup.disabled=true;
 dom.cpResult.textContent="A consultar a CP para o comboio "+number+"…";
 try{
  const r=await lookupCpOperational({number,date,transport:fetchRemoteJson});
  if(date!==dom.day.value){dom.cpResult.textContent="Data alterada; resposta anterior não foi contabilizada.";return;}
  operationalQueries.set(number,{date,number,success:true,result:r});
  renderCoverage();
  refreshEstimates();
  const signal=statusGps(number);
  const signalHtml=gpsChip(signal);
  const delay=r.delayMinutes===null?"sem indicação de atraso":(r.delayMinutes+" min reportados");
  const stops=r.stops.slice(0,60).map(s=>
   '<div class="cpStop"><span>'+safeText(s.station)+'</span><span>'+
   safeText([s.scheduledArrival||s.scheduledDeparture||"—",
    s.eta?"ETA "+s.eta:null,s.etd?"ETD "+s.etd:null].filter(Boolean).join(" · "))+
   '</span></div>').join("");
  dom.cpResult.innerHTML='<div class="cpStatus"><strong>'+
   safeText(r.type+" "+r.number)+'</strong><span>'+safeText(r.status)+
   '</span><span>Atraso CP: '+safeText(delay)+'</span>'+signalHtml+'</div>'+
   '<p>Origem: CP · consultado às '+safeText(new Date(r.obtainedAt).toLocaleTimeString("pt-PT"))+
   ' · última estação indicada: '+safeText(r.lastReportedStation||"não indicada")+'</p>'+
   (r.hasDisruptions===true?'<p class="cpWarning">A CP sinaliza perturbações.</p>':"")+
   r.messages.map(m=>'<p class="cpWarning">'+safeText(m.text)+'</p>').join("")+
   '<details><summary>Ver '+r.stops.length+' paragens devolvidas pela CP</summary>'+
   stops+'</details><p class="cpNoGps">A resposta operacional da CP não inclui coordenadas neste laboratório. O indicador GPS acima vem apenas da TML; nunca criamos posições a partir do horário.</p>';
 }catch(e){
  if(date===dom.day.value&&/^\d{1,6}$/.test(number)){
   operationalQueries.set(number,{date,number,success:false});
   renderCoverage();
   refreshEstimates();
  }
  const message=String(e?.message||e).replace(/https?:\/\/[^ ]+/g,"[URL]");
  dom.cpResult.textContent="CP operacional indisponível: "+message+
   ". A TML e os horários GTFS continuam independentes desta consulta.";
 }finally{dom.cpLookup.disabled=false}
}
dom.cpLookup.onclick=queryCpNational;

async function queryNationalSamples(){
 if(!data?.trains?.length){dom.sampleResult.textContent="Carrega primeiro os horários CP.";return;}
 const date=dom.day.value;
 if(date!==serviceDateLisbon()){
  dom.sampleResult.textContent="Esta consulta é apenas para a data de hoje. Seleciona a data atual no catálogo.";
  return;
 }
 const clock=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
 const picked=sampleCpByType(data.trains,{clock});
 if(!picked.length){dom.sampleResult.textContent="Sem amostras GTFS válidas nesta data.";return;}
 const responses=[],errors=[];
 let cachedConfig=null;
 const transport=async (url,options)=>{
  if(url===CP_CONFIG_URL){
   if(cachedConfig)return cachedConfig;
   cachedConfig=await fetchRemoteJson(url,options);
   return cachedConfig;
  }
  return fetchRemoteJson(url,options);
 };
 dom.sampleNational.disabled=true;
 dom.sampleResult.textContent="A consultar até "+picked.length+" comboios diretamente à CP…";
 try{
  for(const train of picked){
   if(dom.day.value!==date){dom.sampleResult.textContent="Data alterada. Consulta interrompida.";return}
   const number=String(train.number);
   try{
    const result=await lookupCpOperational({number,date,transport});
    operationalQueries.set(number,{date,number,success:true,result});
    responses.push({train,result});
   }catch(e){
    operationalQueries.set(number,{date,number,success:false});
    errors.push({train,error:String(e?.message??e).replace(/https?:\/\/\S+/g,"[URL]").slice(0,130)});
   }
   renderCoverage();
   refreshEstimates();
  }
  const pieces=responses.map(({train,result})=>{
   const delay=result.delayMinutes==null?"Atraso não indicado":result.delayMinutes+" min de atraso";
   const signal=statusGps(result.number);
   return '<div class="sampleTrain"><strong>'+safeText(result.type+" "+result.number)+'</strong>'+
    '<span>'+safeText(result.status)+'</span><small>'+safeText(train.origin+" → "+train.destination)+'</small>'+
    '<small>Última estação indicada: '+safeText(result.lastReportedStation??"não disponível")+'</small>'+
    '<small>'+safeText(delay)+'</small>'+gpsChip(signal)+'</div>';
  });
  pieces.push(...errors.map(({train})=>'<div class="sampleTrain"><strong>'+safeText(train.type+" "+train.number)+'</strong><small>Consulta CP indisponível.</small></div>'));
  dom.sampleResult.innerHTML='<p>'+responses.length+' respostas CP de '+picked.length+
   ' consultas. Seleção pelo horário, sem GPS derivado da CP nem posições inventadas.</p>'+
   pieces.join("")+'<p>Fonte: sistema de informação ao passageiro da CP. Consultas pontuais, não uma contagem de todos os comboios em circulação.</p>';
 }finally{dom.sampleNational.disabled=false}
}
dom.sampleNational.onclick=queryNationalSamples;


async function loadBuildAudit(){
 try{
  const r=await fetch(BASE+"data/unified/diagnostics.json",{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();
  const eta=d.sources?.tmlEta?.status??"não testado",alerts=d.sources?.tmlAlerts?.status??"não testado";
  dom.buildAudit.textContent="Compilação "+new Date(d.checkedAt).toLocaleString("pt-PT")+
   " (histórico, NÃO ao vivo) · ETA TML "+eta+" · Alertas "+alerts+
   " · consulta operacional nacional CP: disponível na app, não é GPS";
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
 tmlChecked=true;
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
 const points=(t.stops??[]).filter(s=>sameLocation(s.location)).map(s=>s.location);
 if(points.length>=2){
  L.polyline(points,{color:COLORS[t.type]||COLORS.CP,weight:3,opacity:.8,dashArray:"6 7"}).addTo(routeLayer);
  map.fitBounds(L.latLngBounds(points).pad(.12),{maxZoom:11});
 }
 openTrainDetails("scheduled",t);
}
function renderTrains(){
 if(!data){renderGps();return;}
 const matches=filterCatalogue(data.trains,{type:selected,query:dom.q.value});
 dom.count.textContent=matches.length+" circulações programadas de "+data.trains.length+" no dia "+data.date;
 const {visible,more}=pageCatalogue(matches,listLimit);
 dom.catalogCount.textContent="A mostrar "+visible.length+" de "+matches.length+" serviços CP encontrados ("+data.trains.length+" no GTFS nacional).";
 dom.trains.innerHTML=visible.map((t,i)=>{
  const number=cpLookupNumber(t);
  const status=statusGps(t.number,t.id);
  return '<div class="train scheduledRow">'+
   '<button type="button" class="trainMain" data-index="'+i+'">'+
   '<span class="pill" style="--type-color:'+(COLORS[t.type]||COLORS.CP)+'">'+safeText(t.type)+'</span>'+
   '<span class="trainInfo"><strong>'+safeText(t.number)+'</strong><small>'+safeText(t.origin)+" → "+safeText(t.destination)+'</small><span data-gps-chip data-train-number="'+safeText(t.number)+'" data-trip-id="'+safeText(t.id)+'">'+gpsChip(status)+'</span><span data-estimate-chip data-estimate-trip="'+safeText(t.id)+'"></span></span>'+
   '<span class="hours"><b>'+safeText(t.departure)+" → "+safeText(t.arrival)+'</b><small>GTFS previsto</small></span></button>'+
   (number?'<button type="button" class="trainLookup" data-cp-index="'+i+'" aria-label="Consultar CP '+safeText(number)+' diretamente">Consultar CP</button>':'')+
   '</div>';
 }).join("");
 if(more)dom.trains.innerHTML+='<button type="button" id="loadMoreTrains" class="loadMore">Ver mais '+Math.min(PAGE_SIZE,more)+' comboios · '+more+' ainda por mostrar</button>';
 if(!matches.length)dom.trains.innerHTML='<p class="empty">Não há serviços CP programados correspondentes a estes filtros nesta data.</p>';
 dom.trains.querySelectorAll("button[data-index]").forEach(b=>b.onclick=()=>viewTrain(visible[Number(b.dataset.index)]));
 dom.trains.querySelectorAll("button[data-cp-index]").forEach(b=>b.onclick=()=>{
  const t=visible[Number(b.dataset.cpIndex)];
  const number=cpLookupNumber(t);
  if(!number)return;
  dom.cpNumber.value=number;
  queryCpNational();
  dom.cpResult.scrollIntoView({behavior:"smooth",block:"center"});
 });
 const moreButton=dom.trains.querySelector("#loadMoreTrains");
 if(moreButton)moreButton.onclick=()=>{
  listLimit+=PAGE_SIZE;
  renderTrains();
 };
 document.querySelector(".details")?.remove();
 routeLayer.clearLayers();
 renderGps();
 renderEstimates();
 renderRuiFallback();
}
async function fetchSourceJson(base,path,timeoutMs=16000){
 const url=base+path;
 if(base===REMOTE_CP_GTFS)return fetchRemoteJson(url,{timeoutMs});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetch(url,{cache:"no-store",signal:controller.signal});
  if(!r.ok)throw Error("HTTP "+r.status+" em "+path);
  return await r.json();
 }finally{clearTimeout(timer)}
}
async function fetchJson(path){
 if(cpSourceBase===REMOTE_CP_GTFS){
  try{return await fetchSourceJson(REMOTE_CP_GTFS,path)}
  catch(e){console.warn("GTFS remoto indisponível, a tentar dados locais:",e?.message)}
 }
 return fetchSourceJson(LOCAL_CP_BASE,path);
}

// Only fit when BOTH today's GTFS and TML response have been considered.
// Earlier versions zoomed into Lisbon before national forecasts were ready.
function autoFitNationalOnce(){
 if(didInitialAutoFit||!tmlChecked||data?.date!==currentLisbon().date)return;
 const valid=v=>Number.isFinite(v.latitude)&&Number.isFinite(v.longitude);
 const points=[...gpsVehicles.filter(valid),...estimatedVehicles.filter(valid)]
  .map(v=>[v.latitude,v.longitude]);
 if(!points.length)return;
 didInitialAutoFit=true;
 map.invalidateSize();
 const bounds=L.latLngBounds(points);
 if(bounds.isValid())map.fitBounds(bounds.pad(.12),{animate:false,maxZoom:8});
}
function serviceDayWarning(){
 const clock=currentLisbon();
 if(data?.date===clock.date){
  dom.serviceDayNotice.textContent="Horários do dia "+clock.date+
    (previousDayData?" · inclui comboios da véspera que chegam após a meia-noite":"");
 }else{
  dom.serviceDayNotice.textContent="Atenção: data selecionada "+(data?.date??"indisponível")+
   "; hoje é "+clock.date+". As estimativas atuais só aparecem com o GTFS de hoje.";
 }
}
async function loadDay(date){
 const request=++dayRequestSeq;
 setMessage("A ler horários CP…");
 try{
  const today=currentLisbon().date;
  const payload=await fetchJson(date+".json");
  let previousDay=null;
  const prevDate=previousServiceDate(date);
  if(date===today&&manifest?.days?.some(d=>d.date===prevDate)){
   try{previousDay=await fetchJson(prevDate+".json")}
   catch(e){console.warn("GTFS da véspera indisponível:",e?.message)}
  }
  if(request!==dayRequestSeq)return;
  data=payload;
  previousDayData=previousDay;
  if(data.realtime!==false||data.gps!==false)throw Error("Tipo de dados inesperado");
  if(coverageDate!==data.date){operationalQueries.clear();coverageDate=data.date;}
  dom.freshness.textContent="GTFS CP "+cpSourceLabel+" · atualizado: "+new Date(data.generatedAt).toLocaleString("pt-PT");
  serviceDayWarning();
  renderStations();renderTrains();refreshUnified();map.invalidateSize();
  gtfsLoadAttempted=true;maybeRuiFallback();
 }catch(e){
  if(request!==dayRequestSeq)return;
  setMessage("Horários indisponíveis: "+e.message);
  dom.trains.innerHTML="<p class='empty'>A importação GTFS tem de terminar com sucesso.</p>";
  data=null;gtfsLoadAttempted=true;refreshEstimates();maybeRuiFallback();
 }
}
async function load(){
 setMessage("A consultar índice oficial…");
 try{
  cpSourceBase=LOCAL_CP_BASE;cpSourceLabel="APK";manifest=null;
  const today=currentLisbon().date;
  try{
   const online=await fetchSourceJson(REMOTE_CP_GTFS,"manifest.json",6500);
   if(usableManifest(online,{date:today})){
    manifest=online;cpSourceBase=REMOTE_CP_GTFS;cpSourceLabel="online (atualização independente)";
   }
  }catch(e){console.warn("GTFS CP online não disponível, a usar o pacote da APK:",e?.message)}
  if(!manifest)manifest=await fetchSourceJson(LOCAL_CP_BASE,"manifest.json");
  if(!manifest?.days?.length||manifest.realtime!==false||manifest.gps!==false)throw Error("Índice GTFS inválido");
  dom.day.innerHTML=manifest.days.map(d=>'<option value="'+safeText(d.date)+'">'+
   safeText(d.date)+' · '+d.trains+' comboios</option>').join("");
  const wanted=manualDateSelection?dom.day.value:today;
  if(manifest.days.some(d=>d.date===wanted))dom.day.value=wanted;
  else{
   const available=manifest.days.map(d=>d.date).filter(d=>d<=today);
   dom.day.value=available.at(-1)??manifest.days[0].date;
  }
  await loadDay(dom.day.value);
 }catch(e){
  setMessage("Não foi possível obter a base CP: "+e.message);
  dom.trains.innerHTML="<p class='empty'>Sem base GTFS importada. É necessária uma importação atualizada.</p>";
  data=null;gtfsLoadAttempted=true;refreshEstimates();maybeRuiFallback();
 }
}
function checkServiceDayRollover(){
 const today=currentLisbon().date;
 if(today===lastLocalServiceDate)return;
 lastLocalServiceDate=today;
 if(!manualDateSelection&&manifest?.days?.some(d=>d.date===today)){
  didInitialAutoFit=false;
  dom.day.value=today;
  loadDay(today);
 }else if(!manualDateSelection){
  // Refresh the online rolling horizon if an app stays open for many days.
  load();
 }else{
  serviceDayWarning();
 }
}

dom.q.addEventListener("input",()=>{listLimit=PAGE_SIZE;renderTrains();renderGps();renderEstimates();renderRuiFallback()});
dom.day.addEventListener("change",()=>{manualDateSelection=true;listLimit=PAGE_SIZE;loadDay(dom.day.value)});
dom.reload.onclick=()=>{didInitialAutoFit=false;gtfsLoadAttempted=false;load();loadGps();cpAutoLastBatch=0;};
dom.focusGps.onclick=()=>focusGpsMarkers();
dom.showNational.onclick=()=>{
 const catalog=document.getElementById("rjpCatalogGroup");
 catalog.hidden=!catalog.hidden;
 if(!catalog.hidden){
  selected="ALL";dom.q.value="";listLimit=PAGE_SIZE;
  renderTypes();renderTrains();renderGps();
  dom.catalogHeading.scrollIntoView({behavior:"smooth",block:"start"});
 }
};
renderTypes();
loadBuildAudit();
load();
loadGps();
setInterval(loadGps,30000);

setInterval(refreshEstimates,30000);
setInterval(limitedCpNationalRefresh,5*60*1000);

setInterval(checkServiceDayRollover,30000);

setInterval(maybeRuiFallback,60000);


// Summary mirrors the original's three compact metrics rather than LAB tables.
function updateOriginalOverview(){
 const all=gpsVehicles.length+estimatedVehicles.length+ruiFallbackVehicles.length;
 const delays=[...operationalQueries.values()].filter(q=>q.success&&Number(q.result?.delayMinutes)>0).length;
 const by=id=>document.getElementById(id);
 by("rjpCount").textContent=String(all);
 by("rjpDelays").textContent=String(delays);
 by("rjpUpdated").textContent=tmlChecked?new Date().toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}):"—";
 const status=by("rjpLiveStatus"),dot=by("rjpLiveDot");
 const emergency=ruiFallbackVehicles.length>0;
 status.textContent=emergency?"Contingência Comboios Live":all?
  "Online · "+all+" posições/estimativas":"A consultar fontes ferroviárias…";
 dot.classList.toggle("on",all>0);
}
async function authorizeLocalAlerts(){
 if(Capacitor.isNativePlatform()){
  const r=await LocalNotifications.requestPermissions();
  return r.display==="granted";
 }
 if(typeof Notification==="undefined")return false;
 return (await Notification.requestPermission())==="granted";
}
async function showLocalAlert(candidate){
 const arrival=candidate.event==="departure"?"partida":"chegada";
 const title=candidate.number==="TESTE"?
  "RJP Train Live 2.0 · Teste de notificação":
  "Comboio "+candidate.number+" · "+arrival+" prevista";
 const body=candidate.number==="TESTE"?
  "A aplicação pode apresentar notificações locais":
  candidate.station+" · "+candidate.time+" · previsão GTFS, não passagem confirmada";
 if(Capacitor.isNativePlatform()){
  const p=await LocalNotifications.checkPermissions();
  if(p.display!=="granted")return false;
  const id=Math.max(1,Math.floor(Math.random()*2147480000));
  await LocalNotifications.schedule({notifications:[{
   id,title,body,
   schedule:{at:new Date(Date.now()+1000)},
   extra:{source:"CP GTFS · previsão local",rjpBeta:true}
  }]});
  return true;
 }
 if(typeof Notification!=="undefined"&&Notification.permission==="granted"){
  new Notification(title,{body});return true;
 }
 return false;
}
const editableAlerts=installEditableAlertUI({
 getCatalogue:()=>data?.trains??[],
 getDate:()=>data?.date??null,
 requestPermission:authorizeLocalAlerts,
 canNotify:async()=>Capacitor.isNativePlatform()?
  (await LocalNotifications.checkPermissions()).display==="granted":
  (typeof Notification!=="undefined"&&Notification.permission==="granted"),
 notify:showLocalAlert
});
const otaCheck=document.getElementById("rjpOtaCheck");
otaCheck.onclick=async()=>{
 const output=document.getElementById("rjpOtaMessage");
 output.hidden=false;output.textContent="A verificar a versão experimental…";
 try{
  const remote=await fetchRemoteJson("https://raw.githubusercontent.com/ruijpedro/RJP-Train-Live-2/main/package.json",{timeoutMs:9000});
  output.textContent="Versão instalada: 2.0.13-beta.1 · Código do laboratório: "+String(remote.version??"indisponível")+
   ". A beta 2.0 ainda não tem OTA próprio. A OTA da Trains original continua intacta.";
 }catch(e){output.textContent="Não foi possível verificar a versão online. A OTA original não foi alterada."}
};
updateOriginalOverview();
setInterval(updateOriginalOverview,10000);
setInterval(()=>editableAlerts.poll(),30000);
