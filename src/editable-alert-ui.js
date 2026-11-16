import {loadAlerts,saveAlerts,upsertAlert,validateAlert,alertCandidates,filterUnsent} from "./editable-alerts.js";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function installEditableAlertUI({getCatalogue=()=>[],getDate=()=>null,requestPermission=async()=>false,notify=async()=>false}={}){
 const by=id=>document.getElementById(id);
 const overlay=by("rjpAlertsOverlay"),form=by("rjpAlertForm"),list=by("rjpAlertRules"),state=by("rjpAlertStatus");
 let rules=loadAlerts();
 function message(s){state.textContent=s}
 function scheduleFields(){
  const kind=by("rjpAlertSchedule").value;
  by("rjpAlertDays").hidden=kind!=="weekly";
  by("rjpAlertDateWrap").hidden=kind!=="date";
  by("rjpAlertMonthWrap").hidden=kind!=="monthly";
 }
 function scopeFields(){by("rjpAlertStationWrap").hidden=by("rjpAlertScope").value!=="combined";}
 function reset(){
  form.reset();by("rjpAlertEditId").value="";
  by("rjpAlertSave").textContent="+ Guardar alerta";
  by("rjpAlertCancel").hidden=true;
  scheduleFields();scopeFields();
 }
 const schedule=a=>a.scheduleType==="date"?"Data "+a.date:
  a.scheduleType==="monthly"?"Dia "+a.monthDay+" de cada mês":
  "Semanal: "+(a.days??[]).map(i=>["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][i]).join(", ");
 function render(){
  by("rjpAlertCount").textContent=String(rules.length);
  list.innerHTML=rules.length?rules.map(a=>
   '<div class="rjpAlertRule" data-rule="'+esc(a.id)+'"><div><strong>'+
   esc(a.scope==="station"?"Estação: "+a.target:a.scope==="train"?"Comboio: "+a.target:
    "Comboio: "+a.target+" · "+a.station)+'</strong><small>'+
   esc((a.event==="arrival"?"Chegada":a.event==="departure"?"Partida":"Chegada/partida")+
    " · "+a.lead+" min · "+schedule(a))+'</small>'+
   '<span class="'+(a.enabled?"rjpAlertEnabled":"rjpAlertDisabled")+'">'+
   (a.enabled?"Ativo":"Desativado")+'</span></div>'+
   '<div class="rjpAlertRuleActions"><button type="button" data-edit="'+esc(a.id)+'">Editar</button>'+
   '<button type="button" data-toggle="'+esc(a.id)+'">'+(a.enabled?"Desativar":"Ativar")+'</button>'+
   '<button type="button" data-delete="'+esc(a.id)+'">Eliminar</button></div></div>'
  ).join(""):'<p>Ainda não existem alertas guardados.</p>';
 }
 const persist=()=>{rules=saveAlerts(rules);render()};
 function edit(id){
  const a=rules.find(x=>x.id===id);if(!a)return;
  by("rjpAlertEditId").value=a.id;
  by("rjpAlertScope").value=a.scope;by("rjpAlertTarget").value=a.target;
  by("rjpAlertStation").value=a.station??"";
  by("rjpAlertEvent").value=a.event;by("rjpAlertLead").value=String(a.lead);
  by("rjpAlertSchedule").value=a.scheduleType;
  by("rjpAlertDate").value=a.date??"";
  by("rjpAlertMonth").value=String(a.monthDay??1);
  by("rjpAlertBefore").checked=a.notifyBefore!==false;
  by("rjpAlertDays").querySelectorAll("input[type=checkbox]").forEach(el=>{
   el.checked=(a.days??[]).includes(Number(el.value));
  });
  by("rjpAlertSave").textContent="Guardar alterações";
  by("rjpAlertCancel").hidden=false;
  scopeFields();scheduleFields();
  form.scrollIntoView({behavior:"smooth",block:"start"});
  message("A editar alerta existente. Ao guardar, mantém o mesmo registo.");
 }
 function open(){overlay.hidden=false;render();by("rjpAlertTarget").focus();}
 function close(){overlay.hidden=true;reset();}
 by("rjpAlertOpen").onclick=open;
 by("rjpAlertClose").onclick=close;
 overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
 by("rjpAlertScope").onchange=scopeFields;
 by("rjpAlertSchedule").onchange=scheduleFields;
 by("rjpAlertCancel").onclick=()=>{reset();message("Edição cancelada.")};
 form.addEventListener("submit",e=>{
  e.preventDefault();
  const id=by("rjpAlertEditId").value;
  const rule={
   id:id||("rjp2-"+Date.now().toString(36)+"-"+Math.floor(Math.random()*10000)),
   scope:by("rjpAlertScope").value,
   target:by("rjpAlertTarget").value.trim(),
   station:by("rjpAlertStation").value.trim(),
   event:by("rjpAlertEvent").value,
   lead:Number(by("rjpAlertLead").value),
   scheduleType:by("rjpAlertSchedule").value,
   days:[...by("rjpAlertDays").querySelectorAll("input:checked")].map(x=>Number(x.value)),
   date:by("rjpAlertDate").value,monthDay:Number(by("rjpAlertMonth").value),
   enabled:id?(rules.find(x=>x.id===id)?.enabled??true):true,
   notifyBefore:by("rjpAlertBefore").checked
  };
  if(!validateAlert(rule)){message("Verifica estação/combóio, evento, antecedência e calendário.");return;}
  const editing=!!id;
  rules=upsertAlert(rules,rule);persist();reset();
  message(editing?"Alerta atualizado sem duplicar a regra.":"Alerta guardado.");
 });
 list.addEventListener("click",e=>{
  const button=e.target.closest("button");if(!button)return;
  const editId=button.dataset.edit,toggleId=button.dataset.toggle,deleteId=button.dataset.delete;
  if(editId)edit(editId);
  if(toggleId){rules=rules.map(a=>a.id===toggleId?{...a,enabled:!a.enabled}:a);persist();message("Estado do alerta atualizado.");}
  if(deleteId){rules=rules.filter(a=>a.id!==deleteId);persist();reset();message("Alerta eliminado.");}
 });
 by("rjpAlertPermission").onclick=async()=>{try{message(await requestPermission()?"Notificações autorizadas.":"Permissão não concedida neste dispositivo.")}catch(e){message("Autorização indisponível: "+e.message)}};
 by("rjpAlertTest").onclick=async()=>{try{
  message(await notify({number:"TESTE",station:"RJP Train Live",event:"arrival",time:"agora"})?"Notificação de teste enviada.":"Não foi possível apresentar a notificação. Verifica as permissões.");
 }catch(e){message("Falha no teste: "+e.message)}};
 function poll(){
  const matches=alertCandidates(getCatalogue(),rules,{date:getDate(),now:Date.now()});
  const unique=filterUnsent(matches);
  unique.forEach(item=>notify(item).catch(e=>console.warn("Alerta beta:",e)));
 }
 render();reset();
 return {poll,open,close,render,count:()=>rules.length};
}
