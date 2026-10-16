/* Learning pathway: the Software Developer and Tester PTT subject groups,
   with the school's technology choices and year sequence supplied by the teacher.
   The Python/C#/React snippets illustrate future learning, not this app's stack. */
(() => {
  'use strict';
  const titles = {
    discover: 'Kutyakozmetika, odafigyeléssel',
    build: 'Ápolt bunda, jó közérzet',
    future: 'Szőrápolás, nyugodt környezetben'
  };
  const labels = {try: 'Időpontot kérek', join: 'Időpontkérés', discover: 'Kérek egy időpontot'};
  const colors = {violet: '#6e5470', mint: '#42634b', amber: '#a55231'};
  const periods = ['Most', '9.', '10.', '11–12.', '13.'];
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = (name) => {
    const paths = {
      code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
      web: '<rect x="2" y="3" width="20" height="18" rx="3"/><path d="M2 8h20M6 5.5h.01M9 5.5h.01M6 12h6M6 16h11"/>',
      team: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4"/>',
      arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-14 5h3m4 0h3"/>'
    };
    return `<svg class="learning-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.code}</svg>`;
  };
  const subject = (title, detail='', cls='') => `<div class="learning-subject ${cls}"><strong>${title}</strong>${detail ? `<span>${detail}</span>` : ''}</div>`;
  const codeWindow = (label, body, result='') => `<div class="learning-code-window"><div class="learning-window-bar"><span aria-hidden="true">● ● ●</span><b>${label}</b></div><pre class="learning-code"><code>${body}</code></pre>${result ? `<div class="learning-code-result">${result}</div>` : ''}</div>`;
  const screenButton = (label, color) => `<span class="learning-example-button" style="--learning-choice:${color}">${safe(label)} ${icon('arrow')}</span>`;

  function contents(page, c) {
    const title=titles[c.title] || titles.discover;
    const label=labels[c.buttonLabel] || labels.try;
    const color=colors[c.theme] || colors.violet;
    const actualButton=window.KandoSite?.source?.(c,'html')?.code || `<button type="button"\n  class="ks-primary"\n  data-action="hero">\n  ${label}\n</button>`;
    if(page===0) return {
      title:'Ma választasz, később megírod', lead:'A gomb mögött HTML, CSS és JavaScript dolgozik.',
      visual:`<div class="learning-build-flow"><div class="learning-flow-choice"><span class="learning-step-number">1</span><div><span class="learning-visual-label">Egy választás</span><div class="learning-choice-line"><i style="background:${color}"></i><strong>${safe(label)}</strong></div></div></div>${codeWindow('A valódi gomb kódja',safe(actualButton))}<div class="learning-browser-result"><span class="learning-visual-label">A weboldalon</span><h3>${safe(title)}</h3>${screenButton(label,color)}</div></div>`,
      copy:`<div class="learning-outcomes">${subject('Választasz','Szöveget, színt, működést')}${subject('A kód megjeleníti','A döntésed láthatóvá válik')}${subject('Tesztelsz','Kipróbálod az eredményt')}</div><p class="learning-takeaway">Nálunk azt is megtanulod, hogyan írd meg.</p>`
    };
    if(page===1) return {
      title:'Az első saját weboldalad', lead:'Programozási alapok: megírod a főcímet, megformázod a gombot.',
      visual:`${codeWindow('HTML · tanulási példa',`<span class="learning-token">&lt;h1&gt;</span>Tücsök<span class="learning-token">&lt;/h1&gt;</span>\n<span class="learning-token">&lt;button&gt;</span>${safe(label)}<span class="learning-token">&lt;/button&gt;</span>`)}<div class="learning-browser-result"><span class="learning-visual-label">A böngészőben</span><h3>Tücsök</h3>${screenButton(label,color)}</div>`,
      copy:`<div class="learning-subjects learning-web-subjects">${subject('HTML','Tartalom')}${subject('CSS','Megjelenés')}${subject('Bootstrap','Rendezett elrendezés')}${subject('JavaScript alapok','A gomb reagál')}</div><div class="learning-team-note">${icon('team')}<span><strong>IKT projektmunka I.</strong><br>Együtt terveztek és alkottok</span></div>`
    };
    if(page===2) return {
      title:'A program dönteni tanul', lead:'Programozási alapok: szabad az időpont? Akkor foglalható.',
      visual:`<div class="learning-slots"><span class="learning-slot learning-slot-busy"><b>09:00</b><span>Foglalt</span></span><span class="learning-slot learning-slot-free"><b>10:30</b><span>Szabad ${icon('check')}</span></span></div>${codeWindow('Python · tanulási példa',`<span class="learning-token">if</span> szabad_idopont:\n    <span class="learning-function">print</span>(<span class="learning-string">"Foglalható"</span>)\n<span class="learning-token">else</span>:\n    <span class="learning-function">print</span>(<span class="learning-string">"Foglalt"</span>)`,`<span class="learning-terminal-mark">›</span> Foglalható`)}`,
      copy:`<div class="learning-subjects">${subject('Python','Feltételek, ismétlés, adatok')}${subject('IKT projektmunka I.','Közösen oldotok meg feladatokat')}</div><div class="learning-milestone">${icon('check')}<div><span>10. évfolyam végén</span><strong>Ágazati alapvizsga</strong></div></div>`
    };
    if(page===3) return {
      title:'A foglalásból valódi adat lesz', lead:'Elmented az adatot, majd ellenőrzöd a működést.',
      visual:`${codeWindow('C# · tanulási példa',`<span class="learning-type">Foglalas</span> uj = <span class="learning-token">new</span>();\nuj.Kutya = <span class="learning-string">"Buksi"</span>;\nuj.Idopont = <span class="learning-string">"10:30"</span>;\n\n<span class="learning-function">Mentes</span>(uj);`)}<div class="learning-data-row">${icon('database')}<span><strong>Buksi</strong><span>10:30 · Fürdetés</span></span><span class="learning-data-saved">Elmentve</span></div><div class="learning-test-row">${icon('check')}<span>Megjelent a foglalás?</span><strong>Igen</strong></div>`,
      copy:`<div class="learning-subjects learning-professional">${subject('Fejlesztés','C# · asztali alkalmazások<br>Adatbázis-kezelés I. · Webprogramozás')}${subject('Szoftvertesztelés','Kipróbálod, keresed és javítod a hibát')}${subject('Csapatmunka','IKT projektmunka II.<br>Szakmai angol')}</div>`
    };
    return {
      title:'Egy Kódlaborhoz hasonló játék', lead:'Cél: egy ilyen közös játék megépítése.',
      visual:`<div class="learning-system"><div class="learning-system-screen"><div class="learning-window-bar"><span aria-hidden="true">● ● ●</span><b>Egy közös játék terve</b></div><div class="learning-device-pair"><div class="learning-monitor">${icon('web')}<strong>Élő oldal</strong></div><div class="learning-mobile">${icon('calendar')}<strong>Mobil</strong></div></div><p>Mobilos feladatok · közös, élő weboldal</p></div><div class="learning-system-link" aria-hidden="true">↓ ↑</div><div class="learning-system-nodes"><div>${icon('code')}<strong>Szerver</strong><span>Közös játékállapot</span></div><span class="learning-node-arrow" aria-hidden="true">↔</span><div>${icon('database')}<strong>Adatbázis</strong><span>Eredmények tárolása</span></div></div></div>`,
      copy:`<div class="learning-subjects learning-final-subjects">${subject('Asztali és mobil','Alkalmazások fejlesztése és tesztelése','learning-subject-wide')}${subject('Adatbázis-kezelés II.')}${subject('Frontend + tesztelés','React')}${subject('Backend + tesztelés')}${subject('Munkavállalói idegen nyelv')}</div><p class="learning-takeaway">A felület, a szerver és az adatbázis együtt működik.</p>`
    };
  }

  function navButton(index, current, interactive) {
    const attrs=interactive ? `data-learning-page="${index}"` : 'disabled';
    return `<button type="button" class="learning-tab ${current===index?'is-current':''}" ${attrs} ${current===index?'aria-current="step"':''} aria-label="${index===0?'A mostani játék':periods[index]+' évfolyam'}"><span class="learning-tab-marker" aria-hidden="true">${index===0?'●':index}</span><span>${periods[index]}</span></button>`;
  }
  function render(page,config={},interactive=true) {
    const current=Math.min(4,Math.max(0,Number.isFinite(Number(page))?Math.floor(Number(page)):0));
    const data=contents(current,config && typeof config==='object' ? config : {});
    const back=current>0&&interactive ? `data-learning-page="${current-1}"` : 'disabled';
    const next=current<4&&interactive ? `data-learning-page="${current+1}"` : 'disabled';
    return `<section class="learning-deck" data-learning-index="${current}" aria-label="Így tanulsz tovább a Kandóban"><header class="learning-header"><div class="learning-identity">${icon('code')}<span>A következő lépésed</span></div><nav class="learning-nav" aria-label="Tanulási út">${periods.map((_,index)=>navButton(index,current,interactive)).join('')}</nav></header><div class="learning-body"><div class="learning-visual learning-visual-${current}">${data.visual}</div><div class="learning-copy"><span class="learning-grade">${current===0?'Közös projekt':periods[current]+' évfolyam'}</span><h2>${data.title}</h2><p class="learning-lead">${data.lead}</p>${data.copy}</div></div><footer class="learning-footer"><button type="button" class="learning-back" ${back}>← Vissza</button><span class="learning-page-position">${current+1} / 5</span><button type="button" class="learning-next" ${next}>${current===4?'Megérkeztünk':'Tovább →'}</button></footer></section>`;
  }
  window.KandoLearning={count:5,render};
})();
