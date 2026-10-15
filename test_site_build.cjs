const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadSite() {
  const document = {activeElement:null, getElementById:()=>true};
  const context = {window:{},document,setTimeout:()=>1,clearTimeout:()=>{}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/site.js','utf8'),context);
  return context.window.KandoSite;
}

// A small event/DOM adapter runs the real controller without a browser dependency.
function mounted(api, config={}, options={}) {
  const parts = Object.fromEntries(['.ks-stage','.ks-header','.ks-footer','.ks-menu','.ks-build-note'].map(name=>[name,{innerHTML:'',hidden:true,querySelector:()=>null,classList:{add(){},remove(){}}}]));
  const listeners = {}, events=[];
  const site = {
    dataset:{}, className:'', matches:s=>s==='.ks-site', contains:()=>true,
    querySelector:s=>parts[s]||null, querySelectorAll:()=>[],
    addEventListener:(type,fn)=>listeners[type]=fn,
    removeEventListener:type=>delete listeners[type]
  };
  const controller=api.bind(site,config,event=>events.push(event),options);
  function click(dataset){const control={dataset,disabled:false};listeners.click({target:{closest:()=>control},preventDefault(){}});}
  const inputName=value=>listeners.input({target:{matches:s=>s==='.ks-name',value}});
  const submit=value=>listeners.submit({target:{matches:s=>s==='.ks-form',querySelector:()=>({value})},preventDefault(){}});
  return {controller,parts,events,click,inputName,submit,site};
}

test('an explicit empty build has no default website content',()=>{
  const api=loadSite(),html=api.html({}, {builtKeys:[]});
  assert.match(html,/Ez az oldal még üres/);
  assert.doesNotMatch(html,/class="ks-title"|class="ks-hero-image|class="ks-mini-card|class="ks-brand"|class="ks-primary"/);
  assert.match(html,/ks-theme-pending/);
});

test('each published content key adds its element without leaking other defaults',()=>{
  const api=loadSite();
  const title=api.html({}, {builtKeys:['title']});
  assert.match(title,/class="ks-title"/);
  assert.doesNotMatch(title,/class="ks-hero-image|class="ks-mini-card|class="ks-intro"/);
  const photo=api.html({}, {builtKeys:['hero']});
  assert.match(photo,/class="ks-hero-image/);
  assert.doesNotMatch(photo,/class="ks-title"|class="ks-mini-card/);
  const card=api.html({}, {builtKeys:['cardNetwork'],view:'programs'});
  assert.match(card,/Teljes kozmetika/);
  assert.doesNotMatch(card,/>Fürdetés</);
  const layout=api.html({}, {builtKeys:['layout']});
  assert.match(layout,/Ide kerülnek a szolgáltatások/);
  assert.doesNotMatch(layout,/class="ks-mini-card/);
});

test('the button is first visible, then wired to a still empty page, then gets a form',()=>{
  const api=loadSite(),ui=mounted(api,{}, {builtKeys:['buttonLabel']});
  ui.click({action:'hero'});
  assert.equal(ui.controller.getView(),'home');
  assert.equal(ui.events.at(-1).result,'unbound');
  ui.controller.update({}, {builtKeys:['buttonLabel','buttonTarget']});
  const beforeNavigation=ui.events.length;
  ui.click({action:'hero'});
  assert.equal(ui.controller.getView(),'signup');
  assert.match(ui.parts['.ks-stage'].innerHTML,/Ez az oldal még üres/);
  assert.doesNotMatch(ui.parts['.ks-stage'].innerHTML,/ks-slots/);
  assert.deepEqual(ui.events.slice(beforeNavigation).map(event=>event.action),['view','cta']);
  assert.equal(ui.events.at(-1).result,'signup');
  ui.controller.update({}, {builtKeys:['buttonLabel','buttonTarget','formRule']});
  assert.equal(ui.controller.getView(),'signup');
  assert.match(ui.parts['.ks-stage'].innerHTML,/ks-slots/);
});

test('updating another contribution preserves the active page, selected time and form input',()=>{
  const api=loadSite(),ui=mounted(api,{}, {builtKeys:['formRule','counterRule'],view:'signup'});
  ui.click({action:'slot',slot:'1'}); // Day zero has 10:30 free.
  assert.match(ui.parts['.ks-stage'].innerHTML,/Időpont: 10:30/);
  ui.click({action:'plus'});
  ui.inputName('Buksi');
  assert.match(ui.parts['.ks-stage'].innerHTML,/aria-label="Kutyák száma">2</);
  const eventsBeforeUpdate=ui.events.length;
  ui.controller.update({theme:'mint'},{builtKeys:['formRule','counterRule','theme']});
  assert.equal(ui.controller.getView(),'signup');
  assert.match(ui.parts['.ks-stage'].innerHTML,/Időpont: 10:30/);
  assert.match(ui.parts['.ks-stage'].innerHTML,/aria-label="Kutyák száma">2</);
  assert.match(ui.parts['.ks-stage'].innerHTML,/value="Buksi"/);
  assert.equal(ui.events.length,eventsBeforeUpdate,'an unrelated update must not impersonate a visitor action');
});

test('programmatic route changes report only a view event, never a user action',()=>{
  const api=loadSite(),ui=mounted(api,{}, {builtKeys:['buttonTarget']});
  ui.controller.go('signup');
  assert.deepEqual(ui.events.map(event=>event.action),['view']);
  assert.equal(ui.events[0].result,'signup');
  ui.controller.update({}, {builtKeys:['buttonTarget','cardCode'],view:'programs'});
  assert.deepEqual(ui.events.map(event=>event.action),['view','view']);
  assert.equal(ui.controller.getView(),'programs');
});

test('form validation works before the separate success-feedback contribution',()=>{
  const api=loadSite(),ui=mounted(api,{formRule:'nonempty'}, {builtKeys:['formRule'],view:'signup'});
  ui.click({action:'slot',slot:'1'});
  ui.submit('');
  assert.equal(ui.events.at(-1).result,'empty');
  assert.match(ui.parts['.ks-stage'].innerHTML,/aria-invalid="true"/);
  ui.submit('Buksi');
  assert.equal(ui.events.at(-1).result,'success-hidden');
  assert.match(ui.parts['.ks-stage'].innerHTML,/aria-invalid="false"/);
  ui.controller.update({formRule:'always'},{builtKeys:['formRule']});
  ui.submit('');
  assert.equal(ui.events.at(-1).result,'success-hidden');
  assert.equal(ui.events.at(-1).detail.empty,true);
});

test('counter and success feedback are separate visible contributions',()=>{
  const api=loadSite(),ui=mounted(api,{}, {builtKeys:['formRule'],view:'signup'});
  ui.click({action:'slot',slot:'1'});
  assert.doesNotMatch(ui.parts['.ks-stage'].innerHTML,/class="ks-count-row"/);
  ui.controller.update({}, {builtKeys:['formRule','counterRule']});
  assert.match(ui.parts['.ks-stage'].innerHTML,/class="ks-count-row"/);
  ui.submit('Buksi');
  assert.equal(ui.events.at(-1).result,'success-hidden');
  assert.doesNotMatch(ui.parts['.ks-stage'].innerHTML,/A próbafoglalás sikerült/);
  ui.controller.update({}, {builtKeys:['formRule','counterRule','feedback']});
  assert.match(ui.parts['.ks-stage'].innerHTML,/A próbafoglalás sikerült/);
});

test('legacy callers continue to receive the complete example',()=>{
  const api=loadSite(),html=api.html({});
  assert.match(html,/class="ks-title"/);
  assert.match(html,/class="ks-hero-image/);
  assert.match(html,/data-program="code"/);
  assert.match(html,/data-program="network"/);
  assert.match(html,/ks-theme-violet/);
  assert.doesNotMatch(html,/ks-building/);
});

test('six-person service and back routes wait for their own developer then show both alternatives',()=>{
  const api=loadSite(),plannedKeys=['cardCode','layout','serviceAction','returnTarget'];
  const ui=mounted(api,{}, {builtKeys:['cardCode','layout'],plannedKeys,view:'programs'});
  ui.click({action:'choose',program:'code'});
  assert.equal(ui.controller.getView(),'programs');
  assert.equal(ui.events.at(-1).result,'unbound');
  ui.click({action:'return'});
  assert.equal(ui.events.at(-1).result,'unbound');
  ui.controller.update({serviceAction:'home',returnTarget:'programs'},{builtKeys:plannedKeys});
  ui.click({action:'choose',program:'code'});
  assert.equal(ui.controller.getView(),'home');
  ui.click({action:'return'});
  assert.equal(ui.controller.getView(),'programs');
  ui.controller.update({serviceAction:'signup',returnTarget:'home'},{builtKeys:plannedKeys});
  ui.click({action:'choose',program:'code'});
  assert.equal(ui.controller.getView(),'signup');
  assert.match(ui.parts['.ks-stage'].innerHTML,/Ez az oldal még üres/);
  ui.click({action:'return'});
  assert.equal(ui.controller.getView(),'home');
});

test('groups without extra routing tasks retain usable service and back buttons',()=>{
  const api=loadSite(),ui=mounted(api,{}, {builtKeys:['cardCode'],plannedKeys:['cardCode'],view:'programs'});
  ui.click({action:'choose',program:'code'});
  assert.equal(ui.controller.getView(),'signup');
  ui.click({action:'return'});
  assert.equal(ui.controller.getView(),'home');
});

test('lower-bound repair prevents zero dogs and preserves other form state',()=>{
  const api=loadSite(),builtKeys=['formRule','counterRule','countDownRule'];
  const ui=mounted(api,{countDownRule:'unbounded'},{builtKeys,view:'signup'});
  ui.click({action:'slot',slot:'1'});
  ui.inputName('Buksi');
  ui.click({action:'minus'});
  assert.equal(ui.events.at(-1).result,0);
  assert.match(ui.parts['.ks-stage'].innerHTML,/aria-label="Kutyák száma">0</);
  ui.controller.update({countDownRule:'floor'},{builtKeys});
  assert.match(ui.parts['.ks-stage'].innerHTML,/aria-label="Kutyák száma">1</);
  assert.match(ui.parts['.ks-stage'].innerHTML,/aria-label="Eggyel kevesebb kutya" disabled/);
  assert.match(ui.parts['.ks-stage'].innerHTML,/value="Buksi"/);
  ui.click({action:'plus'});
  ui.click({action:'minus'});
  assert.equal(ui.events.at(-1).result,1);
  assert.equal(ui.events.at(-1).detail.delta,-1);
});

test('additional visual choices remain unpublished until their task is applied',()=>{
  const api=loadSite(),config={fontPair:'sans',heroPlacement:'left',buttonShape:'square'};
  const before=api.html(config,{builtKeys:['title','hero','buttonLabel']});
  assert.doesNotMatch(before,/ks-font-sans|ks-photo-left|ks-button-square/);
  const after=api.html(config,{builtKeys:['title','hero','buttonLabel','fontPair','heroPlacement','buttonShape']});
  assert.match(after,/ks-font-sans/);
  assert.match(after,/ks-photo-left/);
  assert.match(after,/ks-button-square/);
});
