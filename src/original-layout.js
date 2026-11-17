// The experimental RJP 2.0 engine is kept; only the user-facing DOM order
// follows the RJP Train Live original. Move existing nodes BEFORE Leaflet init.
export function installOriginalLayout({version="2.0.15-beta.1",base="./"}={}){
 const app=document.getElementById("app");
 const find=id=>app.querySelector("#"+id);
 const old={
  q:find("q"),reload:find("reload"),focusGps:find("focusGps"),
  focusEstimated:find("focusEstimated"),showNational:find("showNational"),
  types:find("types"),map:find("map"),results:app.querySelector(".workspace .results"),
  legacyControls:app.querySelector(".controls"),stats:app.querySelector(".stats"),
  cpNationalLab:app.querySelector(".cpNationalLab"),
  cpNationalSample:app.querySelector(".cpNationalSample"),
  labAudit:app.querySelector(".labAudit"),estimatePanel:app.querySelector(".estimatePanel"),
  sourceNote:app.querySelector(".sourceNote")
 };
 if(Object.values(old).some(x=>!x))throw Error("RJP 2.0: layout original incompleto");
 const shell=document.createElement("div");
 shell.innerHTML="\n<div class=\"rjpOriginalShell\">\n<header class=\"rjpTop\">\n <div class=\"rjpBrandGroup\"><img class=\"rjpBrandIcon\" alt=\"RJP Train Live\" id=\"rjpBrandIcon\">\n  <div><h1>RJP TRAIN LIVE <small>v__VERSION__</small></h1><p>Tráfego Ferroviário em Portugal · Rede · Comboios · Estações · Atrasos</p></div></div>\n <div class=\"rjpSourceSummary\"><div class=\"rjpLive\"><i id=\"rjpLiveDot\"></i><span id=\"rjpLiveStatus\">A consultar fontes ferroviárias…</span></div><small>CP: <b>GTFS + estado CP</b> · GPS: <b>TML</b> · Rui Costa: <b>reserva</b></small></div>\n</header>\n<nav class=\"rjpToolbar\" aria-label=\"Pesquisa e ações\"><div id=\"rjpSearchSlot\"></div><div id=\"rjpReloadSlot\"></div>\n <button id=\"rjpAlertOpen\" type=\"button\">🔔 Alertas (<span id=\"rjpAlertCount\">0</span>)</button>\n <button id=\"rjpOtaCheck\" type=\"button\">↓ Verificar OTA</button>\n <button id=\"rjpInfoToggle\" type=\"button\">ⓘ Informação</button>\n</nav>\n<p id=\"rjpOtaMessage\" class=\"rjpMessage\" role=\"status\" hidden></p>\n<div id=\"rjpTypesSlot\"></div>\n<div class=\"rjpOverview\"><div><strong id=\"rjpCount\">—</strong><span>comboios no mapa</span></div><div><strong id=\"rjpDelays\">—</strong><span>com atraso conhecido</span></div><div><strong id=\"rjpUpdated\">—</strong><span>última atualização</span></div></div>\n<div class=\"rjpMainArea\">\n <section class=\"rjpMapArea\" aria-label=\"Mapa nacional\"><div id=\"rjpMapSlot\"></div>\n  <div class=\"rjpMapLegend\"><span><i class=\"rjpDot real\"></i> TML</span><span><i class=\"rjpDot approx\"></i> ≈ Estimado</span><span><i class=\"rjpDot backup\"></i> Reserva</span></div></section>\n <aside class=\"rjpTrainsArea\"><div class=\"rjpAsideTop\"><h2>Comboios</h2><div id=\"rjpFocusGpsSlot\"></div><div id=\"rjpFocusEstimatedSlot\"></div><div id=\"rjpShowNationalSlot\"></div></div>\n <div id=\"rjpResultsSlot\"></div></aside>\n</div>\n<details id=\"rjpAdvanced\" class=\"rjpAdvanced\"><summary>ⓘ Informação avançada · Fontes · Diagnóstico · Horários</summary><div id=\"rjpAdvancedSlot\"></div></details>\n<footer class=\"rjpFooter\">RJP Train Live 2.0 · CP + TML + estimativas independentes · Comboios Live apenas em contingência · Não utilizar para segurança ferroviária.</footer>\n<div id=\"rjpAlertsOverlay\" class=\"rjpOverlay\" hidden><section class=\"rjpAlertsDialog\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Alertas ferroviários\">\n <div class=\"rjpDialogHeader\"><h2>🔔 Alertas ferroviários</h2><button type=\"button\" id=\"rjpAlertClose\" aria-label=\"Fechar alertas\">×</button></div>\n <p>Alertas editáveis. Pré-avisos baseados nos horários CP; na beta, as notificações locais requerem a aplicação ativa. Push remoto em segundo plano ainda não está integrado.</p>\n <form id=\"rjpAlertForm\" class=\"rjpAlertForm\">\n  <input id=\"rjpAlertEditId\" type=\"hidden\">\n  <label>Monitorizar<select id=\"rjpAlertScope\"><option value=\"station\">Estação</option><option value=\"train\">Comboio</option><option value=\"combined\">Comboio + estação</option></select></label>\n  <label>Estação ou número<input id=\"rjpAlertTarget\" placeholder=\"Ex.: Leiria ou 6450\" required></label>\n  <label id=\"rjpAlertStationWrap\" hidden>Estação do comboio<input id=\"rjpAlertStation\" placeholder=\"Ex.: Monte Real\"></label>\n  <label>Evento<select id=\"rjpAlertEvent\"><option value=\"both\">Chegada e partida</option><option value=\"arrival\">Chegada</option><option value=\"departure\">Partida</option></select></label>\n  <label>Antecedência (minutos)<input id=\"rjpAlertLead\" type=\"number\" min=\"0\" max=\"1440\" required value=\"10\"></label>\n  <label>Periodicidade<select id=\"rjpAlertSchedule\"><option value=\"weekly\">Dias da semana</option><option value=\"date\">Data específica</option><option value=\"monthly\">Dia do mês</option></select></label>\n  <label id=\"rjpAlertDateWrap\" hidden>Data<input id=\"rjpAlertDate\" type=\"date\"></label>\n  <label id=\"rjpAlertMonthWrap\" hidden>Dia do mês<input id=\"rjpAlertMonth\" type=\"number\" value=\"1\" min=\"1\" max=\"31\"></label>\n  <fieldset id=\"rjpAlertDays\"><legend>Dias da semana</legend>\n    <label><input type=\"checkbox\" value=\"0\" checked>Seg</label><label><input type=\"checkbox\" value=\"1\" checked>Ter</label>\n    <label><input type=\"checkbox\" value=\"2\" checked>Qua</label><label><input type=\"checkbox\" value=\"3\" checked>Qui</label>\n    <label><input type=\"checkbox\" value=\"4\" checked>Sex</label><label><input type=\"checkbox\" value=\"5\" checked>Sáb</label>\n    <label><input type=\"checkbox\" value=\"6\" checked>Dom</label>\n  </fieldset>\n  <label class=\"rjpWide\"><input id=\"rjpAlertBefore\" type=\"checkbox\" checked> Pré-aviso antes do evento previsto</label>\n  <label class=\"rjpWide\"><input type=\"checkbox\" disabled> Avisar à passagem detetada (necessita de confirmação operacional)</label>\n  <div class=\"rjpFormActions\"><button id=\"rjpAlertSave\" type=\"submit\">+ Guardar alerta</button><button id=\"rjpAlertCancel\" type=\"button\" hidden>Cancelar edição</button></div>\n </form>\n <div class=\"rjpFormActions\"><button id=\"rjpAlertPermission\" type=\"button\">Autorizar notificações</button><button id=\"rjpAlertTest\" type=\"button\">Testar aviso</button></div>\n <p id=\"rjpAlertStatus\" role=\"status\"></p><div id=\"rjpAlertRules\" class=\"rjpAlertRules\"></div>\n</section></div>\n<div id=\"rjpTrainOverlay\" class=\"rjpOverlay\" hidden><section class=\"rjpTrainDialog\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Detalhes do comboio\"><button id=\"rjpTrainClose\" type=\"button\" aria-label=\"Fechar detalhes\">×</button><div id=\"rjpTrainDialogContent\"></div></section></div>\n</div>";
 shell.querySelector(".rjpBrandIcon").src=base+"icons/icon-192.png";
 shell.querySelector(".rjpBrandGroup h1 small").textContent="v"+version;
 old.types.classList.add("originalTypeFilters");
 const put=(id,node)=>shell.querySelector("#"+id).append(node);
 put("rjpSearchSlot",old.q);old.q.placeholder="Pesquisar comboio, estação ou linha…";
 put("rjpReloadSlot",old.reload);old.reload.textContent="↻ Atualizar agora";
 put("rjpTypesSlot",old.types);
 put("rjpMapSlot",old.map);
 put("rjpFocusGpsSlot",old.focusGps);old.focusGps.textContent="GPS";
 put("rjpFocusEstimatedSlot",old.focusEstimated);old.focusEstimated.textContent="Estimados";
 put("rjpShowNationalSlot",old.showNational);old.showNational.textContent="Todos os CP";
 put("rjpResultsSlot",old.results);
 const advanced=shell.querySelector("#rjpAdvancedSlot");
 const dayLabel=old.legacyControls.querySelector("label:first-child");
 if(dayLabel)advanced.append(dayLabel);
 advanced.append(old.sourceNote,old.stats,old.estimatePanel,old.cpNationalLab,old.cpNationalSample,old.labAudit);
 const heading=old.results.querySelector("#catalogHeading");
 if(heading){
  const group=document.createElement("div");
  group.id="rjpCatalogGroup";group.hidden=true;
  const description=heading.nextElementSibling;
  const count=old.results.querySelector("#catalogCount");
  const trains=old.results.querySelector("#trains");
  group.append(heading);
  if(description?.classList.contains("legendLab"))group.append(description);
  if(count)group.append(count);
  if(trains)group.append(trains);
  old.results.append(group);
 }
 app.replaceChildren(shell);
 shell.querySelector("#rjpInfoToggle").onclick=()=>{
  const target=shell.querySelector("#rjpAdvanced");
  target.open=!target.open;
  if(target.open)target.scrollIntoView({behavior:"smooth",block:"start"});
 };
 shell.querySelector("#rjpTrainClose").onclick=()=>shell.querySelector("#rjpTrainOverlay").hidden=true;
 shell.querySelector("#rjpTrainOverlay").onclick=e=>{if(e.target.id==="rjpTrainOverlay")e.currentTarget.hidden=true};
 return shell;
}
