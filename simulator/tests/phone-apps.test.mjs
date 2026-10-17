import {test} from 'node:test';
import assert from 'node:assert/strict';
import {APP_CATALOG,APP_CATEGORIES,APP_BY_ID,STARTER_APPS,createAppLibrary,calculate,convert,makeQuestion,DECKS} from '../phone-apps.js';

test('catalogue contains 160 distinct launchable apps in ten categories',()=>{
  assert.equal(APP_CATALOG.length,160);assert.equal(APP_BY_ID.size,160);assert.equal(new Set(APP_CATALOG.map(a=>a.name)).size,160);
  assert.equal(APP_CATEGORIES.length,10);
  for(const c of APP_CATEGORIES)assert.equal(APP_CATALOG.filter(a=>a.category===c.id).length,16);
  for(const a of APP_CATALOG){assert.ok(a.name&&a.kind&&a.description&&a.icon&&a.color);if(a.kind==='flashcards')assert.ok(DECKS[a.deck]?.length);}
});
test('install, save, reload and uninstall preserve identity and isolate app data',()=>{
  let persisted;const lib=createAppLibrary({},s=>{persisted=JSON.parse(JSON.stringify(s));});
  assert.equal(lib.list().length,STARTER_APPS.length);assert.equal(lib.install('setelan'),false);
  for(const a of APP_CATALOG)assert.equal(lib.install(a.id),true);
  assert.equal(lib.list().length,160);lib.install(APP_CATALOG[0].id);assert.equal(lib.list().length,160);
  const a=APP_CATALOG[0].id,b=APP_CATALOG[1].id;
  assert.ok(lib.write(a,{text:'A <script>never executed</script>'}));lib.write(b,{text:'B'});
  let restored=createAppLibrary(persisted);assert.equal(restored.read(a).text,'A <script>never executed</script>');
  restored.uninstall(a);assert.equal(restored.has(a),false);assert.deepEqual(restored.read(a),{});assert.equal(restored.read(b).text,'B');
  assert.equal(restored.write(a,{text:'blocked'}),false);restored.install(a);assert.deepEqual(restored.read(a),{});
  assert.equal(restored.write(a,{text:'x'.repeat(16001)}),false);
  assert.equal(createAppLibrary({installed:[]}).list().length,0);
});
test('search combines names, category filters and installation state',()=>{
  const lib=createAppLibrary({installed:[]});assert.equal(lib.search().length,160);assert.equal(lib.search('zznotanapp').length,0);
  assert.equal(lib.search('','game').length,16);assert.equal(lib.search('CATATAN').some(a=>a.name==='Catatan'),true);
  lib.install('store-game-1');assert.deepEqual(lib.search('','game',true).map(a=>a.name),['Tebak Angka']);
});
test('converters and calculators handle unit offsets, zero and invalid arithmetic',()=>{
  assert.equal(convert(1,'length',1,0),1000);assert.equal(convert(100,'temperature',0,1),212);assert.equal(convert(273.15,'temperature',2,0),0);
  assert.equal(convert(36,'speed',0,1),10);assert.equal(calculate('discount2',[100000,20,10]),72000);
  assert.equal(calculate('remaining',[0,0]),0);assert.equal(calculate('area',[7,8]),56);
  assert.throws(()=>calculate('split',[5,0]));assert.throws(()=>calculate('discount',[100,110]));assert.throws(()=>convert(NaN,'length',0,1));
  for(const a of APP_CATALOG.filter(a=>a.kind==='quiz')){const q=makeQuestion(a.topic,()=>0.5);assert.ok(q.text&&q.explanation);assert.ok(Number.isFinite(q.answer));}
});
