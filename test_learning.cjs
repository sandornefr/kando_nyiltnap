'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function load() {
  const context={window:{},document:{getElementById:()=>true}};
  for(const file of ['site.js','learning.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
  return context.window;
}
test('learning preview shows the actual selected button source without executing it',()=>{
  const {KandoSite:site,KandoLearning:lesson}=load();
  const config={buttonLabel:'discover',theme:'mint',title:'build'};
  const html=lesson.render(0,config);
  const actual=site.source(config,'html').code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  assert.ok(html.includes(actual));
  assert.match(html,/Ápolt bunda, jó közérzet/);
  assert.match(html,/#42634b/);
  assert.match(html,/Kérek egy időpontot/);
  assert.doesNotMatch(html,/<button type="button"\s+class="ks-primary"/);
});
test('projector lessons are read only and navigation is bounded at both ends',()=>{
  const {KandoLearning:lesson}=load();
  for(let page=0;page<lesson.count;page++){
    const readonly=lesson.render(page,{},false);
    assert.doesNotMatch(readonly,/data-learning-page=/);
    assert.match(readonly,new RegExp('data-learning-index="'+page+'"'));
  }
  for(const invalid of [-8,'bad',Infinity])assert.match(lesson.render(invalid),/data-learning-index="0"/);
  assert.match(lesson.render(99),/data-learning-index="4"/);
  assert.doesNotMatch(lesson.render(0),/data-learning-page="-1"/);
  assert.doesNotMatch(lesson.render(4),/data-learning-page="5"/);
});
