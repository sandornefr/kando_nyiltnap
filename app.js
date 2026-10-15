'use strict';
const $=s=>document.querySelector(s), app=$('#app'), params=new URLSearchParams(location.search);
const API_BASE=(['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'':window.KANDO_CONFIG?.apiBase||'').replace(/\/$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return JSON.parse(sessionStorage.getItem(k));}catch{return null;}},set(k,v){sessionStorage.setItem(k,JSON.stringify(v));},remove(k){sessionStorage.removeItem(k);}};
const KEYS={admin:'kando-nyiltnap-admin',host:'kando-nyiltnap-host',player:'kando-nyiltnap-player'};
const roleLabels={designer:'Tervező',developer:'Fejlesztő',tester:'Tesztelő'};
const phaseLabels={brief:'Megbízás',build:'Közös munka',review:'Próba és javítás',handover:'Átadás'};
const commissionSource='https://www.facebook.com/tucsokkutyakozmetika/posts/pfbid02YMSGtLsJ8vtuLedCZYrDQnaoDaMYdjWQQ5akXzkTjsWf7rksoaNCFs4iXtdU1umjl';
const prompts={brief:'Kinek készül az oldal? Mit szeretne megtalálni rajta?',build:'Nézzétek: a döntéseitekből épül az oldal.',review:'Próbáljuk ki úgy, mintha most érkeznénk az oldalra!',handover:'Ki mit tett hozzá? Ezen dolgozik a fejlesztő és a tesztelő.'};
let view=params.get('view')||'join',code=params.get('code')||'',token='',admin=sessionStorage.getItem(KEYS.admin)||'';
let state=null,busy=false,polling=false,structuralKey='',activeTask='',expandedTask=false;
let pane='tasks',page=0,mobilePane='project',previewOpen=false,modalTask='',localProbe=null,previewInteracted=false,mountedRevision='',taskSignature='';
let demoAllTasks=false,helpPage=0;
let dismissSourceDialog=()=>{};
const drafts={}, pendingRequests=new Map();
const pageURL=q=>new URL('./'+q,location.href).href;
const fmt=n=>{n=Math.max(0,Math.ceil(n||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const taskById=id=>state?.tasks?.find(t=>t.id===id);
const button=(label,action,classes='')=>`<button type="button" class="button ${classes}" data-action="${action}">${label}</button>`;
const pageSize=kind=>innerWidth<=700&&innerHeight>innerWidth?(kind==='tasks'&&innerHeight<=620?1:2):innerHeight<=460?(kind==='people'?4:2):(kind==='people'?5:4);
function notify(text){$('#notice').textContent=text;$('#notice').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#notice').hidden=true,5000);}
function sessionSave(){store.set(view==='host'?KEYS.host:KEYS.player,{code,token});}
function recoverSession(){const old=store.get(view==='host'?KEYS.host:KEYS.player);if(old&&(view==='host'||view==='join'&&(!code||code===old.code))){code=old.code;token=old.token;if(view==='join')view='player';}}
async function api(path,data){
  const key=['create','join','control'].includes(path)?path+JSON.stringify(data):'';
  if(key){if(!pendingRequests.has(key))pendingRequests.set(key,crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));data={...data,requestId:pendingRequests.get(key)};}
  let r;try{r=await fetch(API_BASE+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}catch{throw Error('Nincs kapcsolat. A munkád megmaradt; próbáld újra!');}
  const result=await r.json();if(key)pendingRequests.delete(key);
  if(!r.ok){if(r.status===401&&view==='host'){admin='';sessionStorage.removeItem(KEYS.admin);code='';token='';state=null;previewOpen=false;hostStart();}throw Error(result.error||'Most nem sikerült. Próbáld újra!');}return result;
}
async function act(fn){if(busy)return;busy=true;app.setAttribute('aria-busy','true');try{await fn();}catch(e){notify(e.message);}finally{busy=false;app.removeAttribute('aria-busy');}}
function receive(data){const entering=!state;state=data;if(entering&&isDemo())mobilePane='team';$('#connection').hidden=true;render();syncCodeReveal();}
async function poll(){
  if(!code||polling||(!token&&view!=='screen'))return;polling=true;const requestCode=code,requestToken=token;
  try{
    const r=await fetch(API_BASE+'/api/state?code='+encodeURIComponent(code),{headers:token?{Authorization:'Bearer '+token}:{}});const data=await r.json();if(code!==requestCode||token!==requestToken)return;
    if(!r.ok){if([404,410].includes(r.status)){store.remove(view==='host'?KEYS.host:KEYS.player);code='';token='';state=null;view=view==='player'?'join':view;notify(data.error);renderStart();return;}throw Error(data.error);}
    if(!data.project){state=null;code='';token='';store.remove(view==='host'?KEYS.host:KEYS.player);view=view==='player'?'join':view;notify('Új Kódlabor-projekt indítható. A korábbi játék lezárult.');renderStart();return;}
    if(view==='host'&&!data.host){token='';code='';store.remove(KEYS.host);renderStart();return;}
    if(view==='player'&&!data.self){token='';store.remove(KEYS.player);view='join';renderStart();return;}
    receive(data);
  }catch(e){$('#connection').textContent='Kapcsolat helyreállítása… A munkád megmaradt.';$('#connection').hidden=false;}finally{polling=false;}
}
function welcomeCode(){return `<div class="welcome-code" role="img" aria-label="Helló, Kandó! A jövő veled kezdődik."><div class="welcome-editor"><div class="welcome-editor-bar"><span class="welcome-editor-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>az-elso-oldalam.html</span></div><div class="welcome-code-lines" aria-hidden="true"><span class="welcome-wrapper">&lt;html&gt;</span><span><i>&lt;title&gt;</i>Helló, Kandó!<i>&lt;/title&gt;</i></span><span><i>&lt;jövő&gt;</i><b>Veled kezdődik.</b><i>&lt;/jövő&gt;</i></span><span class="welcome-wrapper">&lt;/html&gt;</span></div></div><span class="welcome-sticker" aria-hidden="true">✦</span></div>`;}
function entry(){
  $('#context').textContent='Egy közös oldal. A ti munkátok.';
  app.innerHTML=`<section class="screen entry welcome-entry"><div class="entry-art">${welcomeCode()}<p>Tervezés · Fejlesztés · Tesztelés</p></div><form class="entry-form form-stack" id="join-form"><span class="eyebrow">KANDÓ KÓDLABOR</span><h1>Csatlakozz!</h1><label class="field">Játékkód<input id="join-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" value="${esc(code)}" placeholder="123456" required autocomplete="off"></label><label class="field">Beceneved<input id="join-name" maxlength="18" placeholder="Hogyan szólítsunk?" required autocomplete="off"></label><button class="button primary" type="submit">Belépek →</button><p class="muted">A kódot a kivetítőn találod.</p><a class="text-link" href="?view=host">Tanári belépés</a></form></section>`;
}
function hostStart(){
  dismissSourceDialog();
  $('#code-modal')?.remove();
  $('#help').hidden=false;
  $('#context').textContent='Tanári irányítópult';
  if(!admin){app.innerHTML=`<section class="screen entry login-screen welcome-entry"><div class="entry-art">${welcomeCode()}</div><form class="entry-form form-stack" id="login-form"><span class="eyebrow">KANDÓ KÓDLABOR</span><h1>Tanári belépés</h1><label class="field">Jelszó<input id="password" type="password" autocomplete="current-password" required></label><button type="submit" class="button primary">Belépés →</button></form></section>`;return;}
  app.innerHTML=`<section class="screen host-intro"><div class="intro-top"><div class="intro-heading"><span class="eyebrow">ÜDV A KANDÓ KÓDLABORBAN</span><h1>Egy weboldal. Egy csapat.</h1><p>Mai megbízás: egy kutyakozmetika oldala.</p></div>${welcomeCode()}</div><div class="workflow-overview"><div class="workflow-card"><b>01</b><h2>Te indítasz</h2><p>A megbízást a kivetítőn mutatod.</p></div><div class="workflow-card"><b>02</b><h2>A diákok alkotnak</h2><p>Telefonon kapnak saját feladatot.</p></div><div class="workflow-card"><b>03</b><h2>Az oldal változik</h2><p>Együtt látjátok és kipróbáljátok.</p></div></div><div class="mode-options">${button('<b>Kipróbálom egyedül →</b><span>Végigvezetés · nincs időkorlát</span>','create-demo','mode-option mode-option-primary primary')}${button('<b>Csoporttal indítok →</b><span>4–35 fő · kb. 8 perc beszélgetéssel</span>','create-group','mode-option secondary')}</div><p class="intro-footnote">Első alkalom? Kezdd az egyedüli kipróbálással.</p></section>`;
}
function renderStart(){dismissSourceDialog();$('#code-modal')?.remove();structuralKey='';mountedRevision='';if(view==='host')hostStart();else if(view==='screen')app.innerHTML='<section class="screen waiting-panel"><h1>Nyisd meg a kivetítőt<br>a tanári felületről.</h1></section>';else entry();}
async function create(mode){
  if(state&&state.status!=='closed'&&!confirm('Új csoportot indítasz? A jelenlegi projektet lezárjuk.'))return;
  if(state&&state.status!=='closed')await api('control',{code,token,action:'close'});
  const r=await api('create',{admin,mode});code=r.code;token=r.token;state=null;structuralKey='';activeTask='';modalTask='';previewOpen=false;view='host';page=0;demoAllTasks=false;mobilePane=mode==='demo'?'team':'project';sessionSave();
  if(mode==='demo')await control('start');else await poll();
}
async function control(action){receive(await api('control',{code,token,action}));}
function pager(total,count){const pages=Math.max(1,Math.ceil(total/count));return `<div class="pager"><button class="button quiet" data-action="page-prev" ${page===0?'disabled':''} aria-label="Előző oldal">←</button><span>${page+1} / ${pages}</span><button class="button quiet" data-action="page-next" ${page+1>=pages?'disabled':''} aria-label="Következő oldal">→</button></div>`;}
function personRows(){
  const list=state.players||[],count=pageSize('people');page=Math.min(page,Math.max(0,Math.ceil(list.length/count)-1));
  return `<div class="people-list">${list.slice(page*count,page*count+count).map(p=>`<div class="list-item person"><span class="avatar" aria-hidden="true">${esc(p.name.slice(0,1))}</span><div><strong>${esc(p.name)}</strong><span class="role">${esc(p.roleLabel||roleLabels[p.role]||'Csatlakozott')}</span></div><span class="status">${p.total?`${p.done}/${p.total}`:'✓'}</span></div>`).join('')||'<div class="empty-state">A csatlakozók itt jelennek meg.</div>'}</div>${pager(list.length,count)}`;
}
const taskStatus=t=>({done:'Elkészült',ready:'Dolgozhatsz',locked:'Hamarosan',issue:'Javítás'})[t.status]||t.status;
function tasksPanel(){
  const list=[...(state.tasks||[])].sort((a,b)=>({issue:0,ready:1,locked:2,done:3}[a.status]-{issue:0,ready:1,locked:2,done:3}[b.status])),count=pageSize('tasks');page=Math.min(page,Math.max(0,Math.ceil(list.length/count)-1));
  return `<div class="task-list">${list.slice(page*count,page*count+count).map(t=>`<button type="button" class="list-item task-row" data-task="${esc(t.id)}"><div><span class="role">${esc(t.ownerName||'Tanári feladat')}</span><strong class="task-title">${esc(t.title)}</strong></div><span class="status ${esc(t.status)}">${taskStatus(t)}</span></button>`).join('')}</div>${pager(list.length,count)}`;
}
function teamPanel(){return `<div class="team-tabs">${button('Feladatok','pane-tasks',pane==='tasks'?'primary':'quiet')}${button('Csapat','pane-people',pane==='people'?'primary':'quiet')}</div><div id="team-content">${pane==='people'?personRows():tasksPanel()}</div>`;}
function phaseStrip(){return `<div class="phase-strip">${Object.entries(phaseLabels).map(([k,v],i)=>`<div class="phase-step ${k===state.phase?'current':''}"><span>${i+1}</span>${v}</div>`).join('')}</div>`;}
function hostControls(){
  if(['finished','closed'].includes(state.status))return (state.status==='finished'&&!isDemo()?button('A kód mögötte','code-reveal','secondary'):'')+button('Új csoport','new-group','primary');
  if(state.status==='lobby')return `<button class="button primary" data-action="start" ${state.mode!=='demo'&&state.players.length<4?'disabled':''}>${state.mode==='demo'?'Bemutató indítása':state.players.length<4?'Még '+(4-state.players.length)+' csatlakozó kell':'Megbízás bemutatása →'}</button>`+button('Új csoport','new-group','quiet');
  if(state.mode==='demo')return button('Új csoport','new-group','quiet');
  return (state.phase==='handover'?button('A kód mögötte','code-reveal','secondary'):button(state.paused?'Folytatás':'Megbeszélés / szünet','pause','secondary'))+button(({brief:'Munka indítása →',build:'Teszteléshez →',review:'Közös bemutató →',handover:'Lezárás'})[state.phase],state.phase==='handover'?'finish':'next','primary');
}
const isDemo=()=>view==='host'&&state?.mode==='demo';
function nextDemoTask(){return state.tasks.find(t=>t.status==='issue')||state.tasks.find(t=>t.kind!=='test'&&t.status==='ready')||state.tasks.find(t=>t.status==='ready');}
function demoGuide(){
  const t=nextDemoTask(),end=['finished','closed'].includes(state.status)||state.phase==='handover',brief=state.phase==='brief';
  const title=end?'Ezt készítetted el.':brief?'Próbáld ki a három szerepet!':t?.title||'Minden feladat elkészült!';
  const note=end?'Színt választottál, működést állítottál be, majd tesztelted az oldalt.':brief?'Most mindent te próbálsz ki. A csoportban ezeket a feladatokat a diákok kapják.':!t?'A két próba is sikerült. Jöhet a közös oldal bemutatása!':t.status==='issue'?'A tesztelő visszajelzett. Javítsd a működést, majd próbáld ki újra!':t.kind==='test'?'Most látogatóként próbálod ki az oldalt. Ha hibát találsz, visszaadod javításra.':t.kind==='code'?'Most megadod, mit csináljon az oldal egy kattintásra.':t.key==='theme'?'Válassz például erdőzöldet! Mentés után nézd meg, hogyan változott a közös oldal.':'Válassz címet! Mentés után már a közös oldalon látod.';
  return `<div class="demo-guide"><span class="eyebrow">${brief?'VEZETETT BEMUTATÓ':end||!t?'BEMUTATÓ KÉSZ':`MOST TE VAGY A ${esc(t.roleLabel.toLocaleUpperCase('hu'))}`}</span><div class="demo-roles">${Object.entries(roleLabels).map(([k,v])=>`<span class="${t?.role===k&&!brief&&!end?'active':''}">${v}</span>`).join('')}</div><h2>${esc(title)}</h2><p>${esc(note)}</p><div class="demo-progress" aria-label="${state.progress.done} / ${state.progress.total} feladat kész">${state.tasks.map(x=>`<span class="${x.status==='done'?'done':''}"></span>`).join('')}</div>${end&&state.status!=='closed'?button('Mi van a gombok mögött?','code-reveal','primary'):''}${button(end?'Vissza az indításhoz →':brief?'Kezdem a színválasztást →':t?'Kipróbálom ezt a feladatot →':'Megnézem az eredményt →',end?'new-group':'demo-next',end?'quiet':'primary')}${!brief&&!end?button(demoAllTasks?'Vissza a vezetéshez':'Összes feladat','show-demo-tasks','quiet'):''}</div>`;
}
function teacherCue(){
  if(isDemo())return '<b>Vezetett bemutató</b><span>Választasz → az oldal változik → kipróbálod.</span>';
  const texts={brief:'Ismertesd a megbízást a kivetítőről!',build:'Figyeljétek, mit változtatnak a diákok!',review:'Beszéljétek meg, mit találtak a tesztelők!',handover:'Mutassátok be a közösen készített oldalt!'};
  return `<b>Most te:</b><span>${state.paused?'Beszélgessetek! Folytatáskor újra dolgozhatnak.':state.status==='finished'?'Zárd le a beszélgetést, majd indíts új csoportot.':texts[state.phase]}</span>`;
}
function groupCue(){return `<div class="group-cue"><b>A diákok a telefonon dolgoznak.</b><span>${state.phase==='brief'?'A munka kezdetén magától megnyílik a feladatuk.':'A feladatkiosztás és a szakaszváltás automatikus.'}</span></div>`;}
async function demoNext(){
  if(state.paused)await control('resume');
  if(state.phase==='brief'){await control('next');const first=nextDemoTask();if(first)showTeacherTask(first.id);return;}
  const t=nextDemoTask();
  if(!t){if(state.phase==='build')await control('next');if(state.phase==='review')await control('next');return;}
  if(t.kind==='test'&&state.phase==='build')await control('next');
  showTeacherTask(t.id);
}
function lobby(){
  const host=view==='host',url=new URL(state.joinUrl||pageURL(''));
  app.innerHTML=`<section class="screen host-screen lobby-screen"><div class="session-top"><div><span class="eyebrow">${state.mode==='demo'?'BEMUTATÓ':'CSAPATGYŰJTÉS'}</span><h1>Ma ti vagytok a fejlesztőcsapat.</h1></div>${host?`<div class="session-controls">${button('Kivetítő ↗','projector','secondary')}</div>`:''}</div><div class="lobby-layout"><div class="brief-pane"><span class="eyebrow">CSATLAKOZZ A TELEFONODON</span><div class="join-code">${esc(state.code)}</div><div class="join-address">${esc(url.host+url.pathname)}</div><h2>Tücsök Kutyakozmetika</h2><p>Az oldal tervezése, fejlesztése és tesztelése a ti feladatotok.</p><div class="lobby-summary"><b id="player-count">${state.players.length}</b> csatlakozó <span>· ${state.mode==='demo'?'tanári bemutató':'4–35 fő'}</span></div></div><div class="people-pane"><div class="pane-heading"><h2>A csapat</h2></div><div id="lobby-roster">${personRows()}</div></div></div><div class="host-footer"><span class="muted">${state.mode==='demo'?'A tanár minden szerepet kipróbálhat.':'1 perc belépés · 6 perc projekt · 1 perc közös zárás'}</span>${host?`<div class="session-controls" id="host-controls">${hostControls()}</div>`:'<span>A tanár indítja a projektet.</span>'}</div></section>`;
}
function hostShell(){
  const host=view==='host',demo=isDemo();
  app.innerHTML=`<section class="screen host-screen ${demo?'guided-demo':host?'':'projection'}"><div class="session-top"><div><span class="eyebrow">${demo?'KIPRÓBÁLÁS EGYEDÜL':'TÜCSÖK KUTYAKOZMETIKA · TANULÓI TERV'}</span><h1 id="phase-title">${state.status==='finished'?'Ezt együtt készítettük.':phaseLabels[state.phase]||'Közös projekt'}</h1></div><div class="session-controls">${demo?'':`<span class="session-code">${esc(code)}</span>`}<span id="clock" class="timer"></span>${host&&!demo?button('Kivetítő ↗','projector','quiet'):''}</div></div>${phaseStrip()}<div class="host-view-switch">${button('Közös oldal','view-project','secondary')}${button(demo?'Következő lépés':'A csapat','view-team','secondary')}</div><div class="host-layout" data-view="${mobilePane}"><div class="project-pane"><div class="pane-heading"><strong>${state.phase==='brief'?'Ezt a megbízást kapja a csapat':'Ezt az oldalt alakítja a csapat'}</strong><span id="contribution-count"></span></div><div id="shared-site" class="site-mount"></div><div id="event-line" class="event-line" aria-live="polite"></div></div>${host?demo?`<aside class="team-pane demo-pane"><div id="demo-content">${demoGuide()}</div></aside>`:`<aside class="team-pane">${groupCue()}${teamPanel()}</aside>`:`<aside class="team-pane projection-note"><span class="eyebrow">KÖZÖS MEGTEKINTÉS</span><h2>${esc(prompts[state.phase]||'Ezt együtt készítettük.')}</h2><div id="screen-progress"></div></aside>`}</div><div class="host-footer"><div class="teacher-cue">${host?teacherCue():esc(prompts[state.phase])}</div>${host?`<div class="session-controls" id="host-controls">${hostControls()}</div>`:''}</div></section>`;
  demoAllTasks=false;
  mountedRevision='';patchHost();
}
function mountSite(el,compact=false,onAction){if(!el)return;el.innerHTML=KandoSite.html(state.project.config,{compact});KandoSite.bind(el,state.project.config,onAction);}
function commission(){return `<div class="commission-brief"><span class="eyebrow">TÜCSÖK KUTYAKOZMETIKA · MEGBÍZÁS</span><h2>Legyen egyszerű<br>időpontot kérni!</h2><div class="brief-requirements"><div class="brief-requirement"><b>01</b><span>Látszódjanak a kezelések és a nyitvatartás!</span></div><div class="brief-requirement"><b>02</b><span>Működjön az időpontkérés próbája!</span></div><div class="brief-requirement"><b>03</b><span>Telefonon is könnyű legyen használni!</span></div></div>${view==='host'?button('Megnézzük a valódi hirdetést','commission-source','secondary source-trigger'):'<p>Ti tervezitek. Ti fejlesztitek. Ti tesztelitek.</p>'}</div>`;}
function patchHost(){
  if(state.status==='lobby'){if($('#player-count'))$('#player-count').textContent=state.players.length;if($('#lobby-roster'))$('#lobby-roster').innerHTML=personRows();if($('#host-controls'))$('#host-controls').innerHTML=hostControls();return;}
  if($('#clock'))$('#clock').textContent=state.mode==='demo'?'Saját tempó':state.paused?'Szünet':'Váltás: '+fmt(state.remaining);
  if($('#demo-content')&&!demoAllTasks&&!modalTask){const html=demoGuide();if($('#demo-content').innerHTML!==html)$('#demo-content').innerHTML=html;}
  if($('#contribution-count'))$('#contribution-count').textContent=`${state.progress?.done||0} / ${state.progress?.total||0} feladat`;
  // Stable controls and workspace stay mounted during polling.
  if($('#team-content')&&!modalTask){const html=pane==='people'?personRows():tasksPanel();if($('#team-content').innerHTML!==html)$('#team-content').innerHTML=html;}
  const latest=(state.events||[]).slice(-1)[0];if($('#event-line'))$('#event-line').textContent=latest?.text||'A változások itt jelennek meg.';
  if($('#screen-progress'))$('#screen-progress').textContent=`${state.progress?.done||0} közös hozzájárulás`;
  if(state.phase==='brief'){const markup=commission();if($('#shared-site').innerHTML!==markup)$('#shared-site').innerHTML=markup;return;}
  if(mountedRevision!==String(state.project.revision)){mountSite($('#shared-site'));mountedRevision=String(state.project.revision);}
}
const myTasks=()=> (state?.self?.taskIds||[]).map(taskById).filter(Boolean);
function chooseTask(){const list=myTasks(),current=taskById(activeTask),ready=list.find(t=>t.status==='issue')||list.find(t=>t.status==='ready');if(current&&list.includes(current)&&(current.status!=='done'||expandedTask)&&!(current.status==='locked'&&ready))return current;return ready||list.find(t=>t.status==='locked')||list[0];}
function playerTop(){return `<div class="player-top"><div><strong>${esc(state.self?.name||'Tanár')}</strong><span class="role">${esc(state.self?.roleLabel||roleLabels[state.self?.role]||'A csapat tagja')}</span></div><span>${state.paused?'Szünet':esc(phaseLabels[state.phase]||'Csatlakozás')}</span></div>`;}
function playerWaiting(title,text,action=''){app.innerHTML=`<section class="screen player-screen">${playerTop()}<div class="waiting-panel"><span class="role-mark" aria-hidden="true">&lt;/&gt;</span><h1>${title}</h1><p>${text}</p>${action}</div><div class="task-actions">${button('Kilépek a csoportból','leave','quiet')}</div></section>`;}
function choiceVisual(t,o){
  const value=String(o.value),palettes={violet:'#6e5470',mint:'#42634b',amber:'#a55231'};
  if(t.key==='theme')return `<span class="choice-sample sample-theme" style="--sample-color:${palettes[value]||'#b5a0f7'}"><i></i><i></i><i></i></span>`;
  if(t.key==='layout')return `<span class="choice-sample sample-layout ${value==='split'?'split':''}"><i></i><i></i></span>`;
  if(t.key==='hero')return `<span class="choice-sample sample-photo"><img src="assets/${{code:'grooming',network:'bath',team:'dog'}[value]||'dog'}.jpg" alt="${esc(o.label)}"></span>`;
  if(t.key==='borderStyle')return `<span class="choice-sample sample-shape ${value==='square'?'square':''}"></span>`;
  if(t.key==='headingSize')return `<span class="choice-sample sample-type ${value==='large'?'large':''}">Aa</span>`;
  return `<span class="choice-sample sample-text">${esc(o.label)}</span>`;
}
const codeEvent=t=>({buttonTarget:'Kattintás az időpontkérésre',formRule:'Időpontkérés elküldése',navTarget:'Kattintás a Szolgáltatásokra',feedback:'Sikeres időpontkérés',menuRule:'Kattintás a menüre',counterRule:'Kattintás a + gombra',filterRule:'Kezelés kiválasztása'})[t.key]||'A látogató használja az oldalt';
function taskInstruction(t){return ({formRule:'Kutyusnév nélkül ne lehessen időpontot kérni.',theme:'Válassz színt, majd alkalmazd a közös oldalon!'})[t.key]||t.hint?.split('. ')[0]||'Válassz, majd mentsd el!';}
function taskMarkup(t,teacher=false){
  const readOnly=state.paused||!['build','review'].includes(state.phase)||['finished','closed'].includes(state.status);
  if(t.status==='locked')return `<div class="task-card"><span class="eyebrow">${esc(t.roleLabel||roleLabels[t.role])}</span><div class="waiting-panel"><h2>Előbb elkészül,<br>utána teszteled.</h2><p>${esc(t.title)}</p><span class="muted">${esc(t.issue||'A feladat magától megnyílik.')}</span></div></div>`;
  if(readOnly)return `<div class="task-card"><div class="waiting-panel"><h2>${state.paused?'Közös megbeszélés':state.phase==='brief'?'Hallgasd meg a megbízást!':'Közös bemutató'}</h2><p>${esc(t.title)}</p></div></div>`;
  if(t.kind==='test')return `<div class="task-card"><div class="task-heading"><span class="eyebrow">TESZTELŐ</span><h1>${esc(t.title)}</h1></div><div class="task-body test-brief"><div class="test-symbol" aria-hidden="true">✓</div><p>${esc(t.hint||'Próbáld ki a közös oldalt!')}</p>${t.issue?`<p class="feedback">${esc(t.issue)}</p>`:''}</div><div class="task-actions"><button type="button" class="button primary" data-open-test="${esc(t.id)}">Megnyitom a próbát →</button></div></div>`;
  const value=drafts[t.id]??t.value??t.options?.[0]?.value;
  const body=t.kind==='code'?`<div class="code-block"><div class="code-event"><span>HA</span><strong>${esc(codeEvent(t))}</strong></div><label class="code-action"><span>AKKOR</span><select data-draft="${esc(t.id)}" aria-label="Mit csináljon az oldal?">${t.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label></div>`:`<div class="choice-grid">${t.options.map(o=>`<button type="button" class="choice-button ${String(o.value)===String(value)?'selected':''}" data-choice="${esc(t.id)}" data-value="${esc(o.value)}" aria-pressed="${String(o.value)===String(value)}">${choiceVisual(t,o)}<span>${esc(o.label)}</span></button>`).join('')}</div>`;
  return `<div class="task-card"><div class="task-heading"><span class="eyebrow">${teacher?'MOST TE VAGY A ':''}${esc(t.roleLabel||roleLabels[t.role])}</span><h1>${esc(t.title)}</h1><p class="task-hint">${esc(taskInstruction(t))}</p></div><div class="task-body">${t.issue?`<div class="feedback" role="status">${esc(t.issue)}</div>`:''}${body}</div><div class="task-actions"><button type="button" class="button primary" data-save="${esc(t.id)}">${t.kind==='code'&&!isDemo()?'Mentem és kipróbálom':'Alkalmazom az oldalon'}</button></div></div>`;
}
function renderPlayer(force=false){
  if(previewOpen){patchPreview();return;}
  if(state.status==='lobby'){if(structuralKey!=='player-lobby'){playerWaiting('Benne vagy a csapatban.','A tanár indítása után megkapod a feladatod.');structuralKey='player-lobby';}return;}
  if(['finished','closed'].includes(state.status)||state.phase==='handover'){const key='player-end'+state.status;if(structuralKey!==key){playerWaiting('Ezt együtt készítettük.',`${state.self?.name?esc(state.self.name)+', ':''}nézd meg a közös oldalunkat!`,button('Megnézem az oldalt','preview','primary'));structuralKey=key;}return;}
  if(state.paused||state.phase==='brief'){const key='player-pause'+state.paused+state.phase;if(structuralKey!==key){playerWaiting(state.paused?'Nézz a kivetítőre!':'Készítsetek oldalt a Tücsök Kutyakozmetikának!',state.paused?'Most a csapat egyeztet.':`A te szereped: ${esc(state.self?.roleLabel||roleLabels[state.self?.role]||'csapattag')}.`);structuralKey=key;}return;}
  const t=chooseTask();if(!t){playerWaiting('Már dolgozik a csapat.','A tanár tud feladatot adni.',button('Megnézem az oldalt','preview','primary'));return;}activeTask=t.id;
  if(myTasks().every(x=>x.status==='done')&&!expandedTask){const key='player-done';if(structuralKey!==key){playerWaiting('A te részed elkészült.','Most figyeld, hogyan épül tovább az oldal.',button('Megnézem az oldalt','preview','primary')+button('Finomítok rajta','edit-own','quiet'));structuralKey=key;}return;}
  const signature=JSON.stringify([t.id,t.status,t.issue,state.phase,state.paused,expandedTask]);if(!force&&taskSignature===signature&&structuralKey==='task')return;taskSignature=signature;structuralKey='task';
  app.innerHTML=`<section class="screen player-screen">${playerTop()}${taskMarkup(t)}<div class="player-task-nav">${myTasks().length>1?myTasks().map((x,i)=>`<button type="button" class="button quiet ${x.id===t.id?'selected':''}" data-own-task="${esc(x.id)}">${i+1}. ${x.status==='done'?'✓':x.kind==='test'?'Próba':'Feladat'}</button>`).join(''):''}${button('Közös oldal','preview','quiet')}</div></section>`;
}
function recordPreviewAction(event){
  if(!previewOpen)return;
  const test=taskById(previewOpen.testId),seen=previewOpen.seen;seen.push(event);
  if(!test){previewInteracted=true;return;}
  const matches={
    buttonTarget:()=>seen.some(e=>e.action==='cta'),
    navTarget:()=>seen.some(e=>e.action==='nav'&&e.detail?.source==='programs'),
    formRule:()=>seen.some(e=>e.action==='submit'&&e.detail?.empty===true)&&seen.some(e=>e.action==='submit'&&e.detail?.empty===false),
    feedback:()=>seen.some(e=>e.action==='submit'&&e.detail?.empty===false),
    menuRule:()=>seen.filter(e=>e.action==='menu').length>=2,
    counterRule:()=>seen.some(e=>e.action==='counter'&&e.detail?.delta>0),
    filterRule:()=>seen.some(e=>e.action==='filter'&&e.detail?.selected==='code')
  };
  previewInteracted=matches[test.key]?matches[test.key]():true;patchPreview();
}
function openPreview(testId=''){
  previewOpen={testId,revision:state.project.revision,value:state.project.config[taskById(testId)?.key],seen:[]};localProbe=null;previewInteracted=false;taskSignature='';
  app.innerHTML=`<section class="screen player-preview"><div class="backbar">${button('← Vissza','back','quiet')}<strong>${esc(testId?taskById(testId)?.title:'A közös oldal')}</strong></div><div id="player-site" class="site-mount"></div><div class="task-actions" id="preview-actions"></div></section>`;
  mountSite($('#player-site'),true,recordPreviewAction);patchPreview();
}
function patchPreview(){
  if(!previewOpen||!$('#preview-actions'))return;const test=taskById(previewOpen.testId);
  if((!test&&previewOpen.revision!==state.project.revision)||(test&&previewOpen.value!==state.project.config[test.key])){
    previewOpen.revision=state.project.revision;previewOpen.value=state.project.config[test?.key];previewOpen.seen=[];localProbe=null;previewInteracted=false;
    mountSite($('#player-site'),true,recordPreviewAction);delete $('#preview-actions').dataset.key;
  }
  if(!test){$('#preview-actions').innerHTML=button('Vissza a munkámhoz','back','primary');return;}
  if(test.status==='locked'||state.paused||!['build','review'].includes(state.phase)||['finished','closed'].includes(state.status)){localProbe=null;delete $('#preview-actions').dataset.key;$('#preview-actions').innerHTML='<span>A próba most szünetel.</span>'+button('Vissza','back','secondary');return;}
  const key=JSON.stringify([localProbe?.passed,localProbe?.observed,previewInteracted,test.status,state.paused]);if($('#preview-actions').dataset.key===key)return;$('#preview-actions').dataset.key=key;
  if(localProbe)$('#preview-actions').innerHTML=`<div class="probe-result" role="status"><strong>${esc(localProbe.observed)}</strong><span>${esc(localProbe.hint||'')}</span></div><button type="button" class="button primary" data-confirm-test="${esc(test.id)}">${localProbe.passed?'Rögzítem: működik ✓':'Jelzem a fejlesztőnek →'}</button>`;
  else $('#preview-actions').innerHTML=`<span class="test-instruction">${esc(test.hint||'Próbáld ki az oldalt!')}</span><button type="button" class="button primary" data-probe="${esc(test.id)}" ${previewInteracted||!['buttonTarget','formRule','navTarget','feedback','menuRule','counterRule','filterRule'].includes(test.key)?'':'disabled'}>Ellenőrzés</button>`;
}
function closePreview(){previewOpen=false;localProbe=null;structuralKey='';taskSignature='';if(view==='host'){const id=modalTask;modalTask='';render();if(id)showTeacherTask(id);}else render();}
function showTeacherTask(id){
  const t=taskById(id);if(!t)return;modalTask=id;$('#task-modal')?.remove();const shade=document.createElement('div');shade.className='modal-shade';shade.id='task-modal';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label',t.title);
  shade.innerHTML=`<div class="modal-panel"><div class="modal-head"><span>${isDemo()?'Diáknézet · '+esc(t.roleLabel):esc(t.ownerName||'Tanári feladat')}</span>${button('Bezárás ×','close-modal','quiet')}</div>${taskMarkup(t,true)}</div>`;app.append(shade);shade.querySelector('button')?.focus();
}
function render(){
  $('#help').hidden=view!=='host';
  if(!state)return renderStart();$('#context').textContent=view==='host'?'Tanári irányítópult':view==='screen'?'Közös projekt':'A fejlesztőcsapat tagja vagy.';
  if(previewOpen){patchPreview();return;}if(view==='player'){renderPlayer();return;}
  const key=[state.status==='lobby'?'lobby':'project',state.phase,state.status,state.paused].join(':');if(structuralKey!==key){structuralKey=key;modalTask='';state.status==='lobby'?lobby():hostShell();}else patchHost();
}
app.addEventListener('submit',e=>{
  if(!['join-form','login-form'].includes(e.target.id))return;e.preventDefault();if(busy)return;
  if(e.target.id==='join-form')act(async()=>{const r=await api('join',{code:$('#join-code').value,name:$('#join-name').value,avatar:0});code=r.code;token=r.token;view='player';sessionSave();structuralKey='';await poll();});
  if(e.target.id==='login-form')act(async()=>{const r=await api('login',{password:$('#password').value});admin=r.token;sessionStorage.setItem(KEYS.admin,admin);hostStart();});
});
app.addEventListener('change',e=>{if(e.target.dataset.draft)drafts[e.target.dataset.draft]=e.target.value;});
app.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled||busy)return;
  if(b.dataset.choice){drafts[b.dataset.choice]=b.dataset.value;app.querySelectorAll('[data-choice]').forEach(x=>{const chosen=x.dataset.choice===b.dataset.choice&&x.dataset.value===b.dataset.value;x.classList.toggle('selected',chosen);x.setAttribute('aria-pressed',String(chosen));});return;}
  if(b.dataset.task){showTeacherTask(b.dataset.task);return;}
  if(b.dataset.ownTask){activeTask=b.dataset.ownTask;expandedTask=true;taskSignature='';renderPlayer(true);return;}
  if(b.dataset.openTest){openPreview(b.dataset.openTest);return;}
  if(b.dataset.save){act(async()=>{const t=taskById(b.dataset.save),value=drafts[t.id]??t.value??t.options[0].value;const r=await api('task',{code,token,taskId:t.id,value});expandedTask=false;modalTask='';$('#task-modal')?.remove();receive(r);notify('A változásod megjelent a közös oldalon.');if(isDemo()){$('.project-pane')?.classList.remove('just-updated');requestAnimationFrame(()=>$('.project-pane')?.classList.add('just-updated'));}else if(t.kind==='code')openPreview();});return;}
  if(b.dataset.probe){act(async()=>{const r=await api('probe',{code,token,taskId:b.dataset.probe});localProbe=r;if(r.state)state=r.state;patchPreview();});return;}
  if(b.dataset.confirmTest){act(async()=>{const r=await api('task',{code,token,taskId:b.dataset.confirmTest,value:localProbe.passed?'confirm':'report'});previewOpen=false;localProbe=null;modalTask='';expandedTask=false;structuralKey='';taskSignature='';receive(r);notify('A visszajelzésed megérkezett a csapathoz.');});return;}
  const action=b.dataset.action;if(!action)return;
  if(action==='commission-source'){act(showCommissionSource);return;}
  if(action==='code-reveal'){act(()=>control('code-html'));return;}
  if(action==='demo-next'){act(demoNext);return;}
  if(action==='show-demo-tasks'){demoAllTasks=!demoAllTasks;$('#demo-content').innerHTML=demoAllTasks?button('← Vissza a vezetéshez','show-demo-tasks','secondary')+teamPanel():demoGuide();return;}
  if(action==='create-group'||action==='create-demo'){act(()=>create(action==='create-demo'?'demo':'group'));return;}
  if(['start','next','pause','finish'].includes(action)){act(()=>control(action));return;}
  if(action==='new-group'){if(state&&state.status!=='finished'&&!confirm('Lezárod a jelenlegi csoportot?'))return;act(async()=>{if(state?.status!=='closed')await api('control',{code,token,action:'close'});state=null;code='';token='';store.remove(KEYS.host);hostStart();});return;}
  if(action==='projector'){window.open(pageURL('?view=screen&code='+code),'kando-projector');return;}
  if(action==='pane-tasks'||action==='pane-people'){pane=action==='pane-tasks'?'tasks':'people';page=0;if(isDemo())$('#demo-content').innerHTML=button('← Vissza a vezetéshez','show-demo-tasks','secondary')+teamPanel();else $('.team-pane').innerHTML=groupCue()+teamPanel();return;}
  if(action==='page-prev'||action==='page-next'){const kind=state.status==='lobby'||pane==='people'?'people':'tasks',total=kind==='people'?state.players.length:state.tasks.length,count=pageSize(kind);page=Math.max(0,Math.min(Math.max(0,Math.ceil(total/count)-1),page+(action==='page-next'?1:-1)));patchHost();return;}
  if(action==='view-project'||action==='view-team'){mobilePane=action==='view-team'?'team':'project';$('.host-layout').dataset.view=mobilePane;return;}
  if(action==='preview'){openPreview();return;}if(action==='back'){closePreview();return;}
  if(action==='edit-own'){expandedTask=true;activeTask=myTasks()[0]?.id;taskSignature='';renderPlayer(true);return;}
  if(action==='close-modal'){modalTask='';$('#task-modal')?.remove();return;}
  if(action==='leave'){if(!confirm('Kilépsz a csoportból ezen az eszközön?'))return;store.remove(KEYS.player);token='';code='';state=null;view='join';renderStart();}
});
$('#full').addEventListener('click',async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen();}catch{notify('Használd a böngésző teljes képernyős módját.');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalTask){modalTask='';$('#task-modal')?.remove();}});
const helpPages=[
  {title:'Te vezeted a csapatot.',visual:['Tanári gép','→','Kivetítő'],heading:'Indíts csoportot, mutasd a kódot!',text:'A diákok belépnek a telefonjukon. Te bemutatod a megbízást: készítsünk oldalt a Tücsök kutyakozmetikának.'},
  {title:'Mindenki saját feladatot kap.',visual:['Tervező','Fejlesztő','Tesztelő'],heading:'A rendszer osztja ki a munkát.',text:'Színeket és működést választanak. A tesztelők akkor kezdhetnek, amikor elkészült a rájuk váró rész.'},
  {title:'Egy közös oldal készül.',visual:['Választás','→','Élő változás'],heading:'A kivetítőn követitek az eredményt.',text:'A szakaszok maguktól váltanak. Te szüneteltethetsz megbeszéléshez. Egyedül? A bemutató végigvezet, időkorlát nélkül.'}
];
function showHelp(){
  let shade=$('#help-modal');if(!shade){shade=document.createElement('div');shade.id='help-modal';shade.className='modal-shade';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label','Hogyan működik?');document.body.append(shade);shade.addEventListener('click',e=>{const a=e.target.closest('button')?.dataset.help;if(a==='close'){$('#help-modal').remove();$('#help').focus();}else if(a){helpPage=Math.max(0,Math.min(2,helpPage+(a==='next'?1:-1)));showHelp();}});}
  const p=helpPages[helpPage];shade.innerHTML=`<div class="modal-panel guide-modal"><div class="modal-head"><span>Hogyan működik?</span><button class="button quiet" data-help="close">Bezárás ×</button></div><div class="guide-content"><span class="eyebrow">KANDÓ KÓDLABOR</span><h1>${p.title}</h1><div class="guide-visual">${p.visual.map(v=>`<b>${v}</b>`).join('')}</div><h2>${p.heading}</h2><p>${p.text}</p></div><div class="guide-footer"><button class="button secondary" data-help="prev" ${helpPage===0?'disabled':''}>← Előző</button><span>${helpPage+1} / 3</span><button class="button primary" data-help="${helpPage===2?'close':'next'}">${helpPage===2?'Értem ✓':'Tovább →'}</button></div></div>`;shade.querySelector('[data-help="'+(helpPage===2?'close':'next')+'"]').focus();
}
$('#help').addEventListener('click',()=>{helpPage=0;showHelp();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#help-modal')){$('#help-modal').remove();$('#help').focus();}});
async function showCommissionSource(){
  if(view!=='host'||$('#source-modal'))return;
  const roomCode=code,resume=state?.status==='working'&&state.mode!=='demo'&&!state.paused;
  if(resume)await control('pause');
  const shade=document.createElement('div');shade.id='source-modal';shade.className='modal-shade';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label','Valódi hirdetésből weboldal');
  shade.innerHTML=`<div class="modal-panel source-modal"><div class="modal-head"><span>Valódi példa</span><button type="button" class="button quiet" data-source-close>Bezárás ×</button></div><div class="source-content"><span class="eyebrow">TÜCSÖK KUTYAKOZMETIKA · FACEBOOK</span><h1>Szabad időpontok<br>egy posztban.</h1><p>Ti hogyan tennétek könnyebbé az időpontkérést?</p><a class="button primary" href="${commissionSource}" target="_blank" rel="noopener noreferrer">Megnyitom a Facebook-posztot ↗</a><p class="source-context">A nyilvános hirdetés alapján tanulói weboldaltervet készítünk. A foglaló bemutató, a szalonnak nem küld kérést.</p></div><div class="source-footer"><p>${resume?'A játék ideje közben szünetel.':'A poszt új lapon nyílik meg.'}</p><button type="button" class="button secondary" data-source-close>${resume?'Vissza és folytatás →':'Vissza a Kódlaborhoz →'}</button></div></div>`;
  const close=async()=>{if(resume&&code===roomCode&&state?.status==='working')await control('resume');dismissSourceDialog();app.querySelector('[data-action="commission-source"]')?.focus();};
  const escape=e=>{if(e.key==='Escape')act(close);};
  dismissSourceDialog=()=>{shade.remove();document.removeEventListener('keydown',escape);dismissSourceDialog=()=>{};};
  shade.addEventListener('click',e=>{if(e.target.closest('[data-source-close]'))act(close);});document.addEventListener('keydown',escape);document.body.append(shade);shade.querySelector('a').focus();
}
function syncCodeReveal(){
  const shown=(view==='host'||view==='screen')&&['working','finished'].includes(state?.status)&&(state.phase==='handover'||state.status==='finished')&&state.presentation;
  let shade=$('#code-modal');
  if(!shown){shade?.remove();return;}
  const key=JSON.stringify([shown,state.project.revision,view]);
  if(shade?.dataset.key===key)return;
  const priorFocus=shade?.contains(document.activeElement)?document.activeElement.dataset.code:null;
  if(!shade){
    shade=document.createElement('div');shade.id='code-modal';shade.className='modal-shade';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label','A választásaitok mögötti kód');document.body.append(shade);
    shade.addEventListener('click',e=>{const action=e.target.closest('button')?.dataset.code;if(action&&view==='host')act(()=>control('code-'+action));});
  }
  const sample=KandoSite.source(state.project.config,shown.tab),host=view==='host';shade.dataset.key=key;
  shade.innerHTML=`<div class="modal-panel code-modal" data-reveal="${shown.path?'path':'code'}"><div class="modal-head"><span>A választásaitok mögötti kód</span>${host?'<button class="button quiet" data-code="close">Bezárás ×</button>':''}</div><div class="code-tabs" role="tablist" aria-label="Kódrészletek">${['html','css','javascript'].map(t=>`<button class="button ${t===shown.tab?'active':''}" role="tab" aria-selected="${t===shown.tab}" data-code="${t}" ${host?'':'disabled'}>${t==='javascript'?'JavaScript':t.toUpperCase()}</button>`).join('')}</div><div class="code-reveal-body"><div class="code-explanation"><h2>${esc(sample.label)}</h2><p>${esc(sample.explanation)}</p></div><pre class="code-sample"><code>${esc(sample.code)}</code></pre></div><div class="learning-path"><div><b>9. évfolyam</b><span>HTML · CSS · Bootstrap<br>Alap JavaScript</span></div><div><b>11. évfolyamtól</b><span>C# · asztali alkalmazások<br>Adatbázis · webprogramozás</span></div><div><b>13. évfolyam</b><span>React frontend<br>Backendfejlesztés</span></div></div><div class="code-reveal-footer"><p>Ennek az alapjait már 9.-ben megtanulod.</p>${host?`<button class="button secondary" data-code="path">${shown.path?'Vissza a kódhoz':'Merre tovább?'}</button>`:''}</div></div>`;
  if(host)shade.querySelector(`[data-code="${priorFocus||shown.tab}"]`)?.focus();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#code-modal')&&view==='host')act(()=>control('code-close'));});
recoverSession();if(code&&(token||view==='screen')){app.innerHTML='<section class="screen waiting-panel"><h1>Kapcsolódás…</h1></section>';poll();}else renderStart();
setInterval(()=>{if(!document.hidden)poll();},1600);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
addEventListener('resize',()=>{if(state&&!previewOpen&&view!=='player')patchHost();});
