#!/usr/bin/env node
// Assemble one independent railway data package; source errors are explicit.
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {buildUnifiedFeed,TML_ETA_URL,TML_ALERTS_URL,CP_GTFS_URL,IP_STATIONS_URL} from "../src/unified-feed.js";
import {TML_URL} from "../src/live-positions.js";

const now=Date.now();
const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
const destination="public/data/unified";
await mkdir(destination,{recursive:true});

async function readSource(key,url){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),16000);
 try{
  const resp=await fetch(url,{headers:{Accept:"application/json"},signal:ctrl.signal});
  if(!resp.ok)throw Error("HTTP "+resp.status);
  return {payload:await resp.json(),result:{status:"ok",checkedAt:new Date(now).toISOString()}};
 }catch(err){
  return {payload:null,result:{status:"unavailable",checkedAt:new Date(now).toISOString(),
    error:String(err?.message||err).slice(0,180)}};
 }finally{clearTimeout(timeout)}
}
let cpDay=null;
try{cpDay=JSON.parse(await readFile("public/data/cp/"+day+".json","utf8"))}
catch(err){console.warn("CP GTFS not available:",err.message)}
const [positions,eta,alerts]=await Promise.all([
 readSource("positions",TML_URL),readSource("eta",TML_ETA_URL),readSource("alerts",TML_ALERTS_URL)
]);
const unified=buildUnifiedFeed({cpDay,positionsPayload:positions.payload,
 etaPayload:eta.payload,alertsPayload:alerts.payload,now,
 sourceResults:{positions:positions.result,eta:eta.result,alerts:alerts.result}});
await writeFile(destination+"/latest.json",JSON.stringify(unified,null,2)+"\n");
const diagnostics={
 schema:"rjp.trains.diagnostics.v1",checkedAt:unified.generatedAt,
 coverage:unified.coverage,sources:unified.sources,unmatched:unified.diagnostics.cpUnmatchedSample,
 note:"Published coordinate count does not imply nationwide CP coverage."
};
await writeFile(destination+"/diagnostics.json",JSON.stringify(diagnostics,null,2)+"\n");
const report=[
 "# RJP Train Live 2.0 — Relatório de fontes independentes",
 "",
 "Gerado: "+unified.generatedAt,
 "Validade do instantâneo: até "+unified.expiresAt+" (não usar depois como posição em tempo real)",
 "",
 "| Fonte | Estado | Papel |",
 "|---|---|---|",
 "| CP GTFS | "+unified.sources.cpGtfs.status+" | Horários programados, sem GPS |",
 "| TML posições | "+positions.result.status+" | Coordenadas publicadas pelo operador |",
 "| TML ETA | "+eta.result.status+" | Estimativas de chegada (não são atrasos confirmados) |",
 "| TML alertas | "+alerts.result.status+" | Avisos de serviço |",
 "| IP | Apenas referência | Partidas/chegadas, interface automática por validar |",
 "",
 "## Cobertura desta recolha",
 "- CP programados hoje: "+unified.coverage.cpScheduledToday,
 "- CP com coordenadas recentes TML: "+unified.coverage.cpFreshPositions+" de "+unified.coverage.cpPositionsPublished+" publicadas",
 "- CP associados ao GTFS de forma verificável: "+unified.coverage.cpMatchedToGtfs,
 "- CP com coordenadas mas número de comboio ainda por identificar: "+unified.coverage.cpUnmatched,
 "- Fertagus com coordenadas recentes TML: "+unified.coverage.ftFreshPositions+" de "+unified.coverage.ftPositionsPublished+" publicadas",
 "- Registos ETA TML: "+unified.coverage.tmlEtaRecords,
 "- Alertas ferroviários TML: "+unified.coverage.railAlerts,
 "",
 "## Integração na Trains original",
 "Apenas após demonstração de cobertura, associação fiável ao número do comboio, disponibilidade constante e atualização sem posições obsoletas.",
 "Este pacote não substitui a fonte atual em produção.",
 "",
 "## Fontes",
 "- CP: "+CP_GTFS_URL,
 "- TML posições: "+TML_URL,
 "- TML ETA: "+TML_ETA_URL,
 "- TML alertas: "+TML_ALERTS_URL,
 "- IP: "+IP_STATIONS_URL,
 "- TML GO Hub licença: https://creativecommons.org/licenses/by/4.0/",
 ""
].join("\n");
await writeFile(destination+"/RELATORIO.md",report);
console.log("RJP UNIFIED PACKAGE",JSON.stringify(unified.coverage));
for(const [name,src] of Object.entries(unified.sources))console.log(name,src.status);
if(!positions.payload)console.warn("TML positions missing; snapshot will contain no GPS (never simulated)");
