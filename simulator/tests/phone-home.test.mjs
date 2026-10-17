import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHomeLayout,moveHomeApp,homePageSize} from '../phone-home.js';
test('home customization migrates safely when apps are installed or removed',()=>{
  const ids=['appstore','a','b','new'],raw={order:['b','a','b','removed'],hidden:['appstore','a','removed'],dock:['b','removed','a'],labels:{a:'  Mon application  ',removed:'Old'},widgets:['clock','invalid','weather']};
  const layout=normalizeHomeLayout(raw,ids);
  assert.deepEqual(layout.order,['b','a','appstore','new']);assert.deepEqual(layout.hidden,['a']);assert.deepEqual(layout.dock,['b','a']);assert.equal(layout.labels.a,'Mon application');assert.equal(layout.labels.removed,undefined);assert.deepEqual(layout.widgets,['clock','weather']);
  const next=normalizeHomeLayout(layout,ids.filter(id=>id!=='b'));assert.equal(next.order.includes('b'),false);assert.equal(next.dock.includes('b'),false);
});
test('page capacity and movement stay bounded and preserve every app exactly once',()=>{
  assert.equal(homePageSize({widgets:[],widgetSize:'compact'}),16);assert.equal(homePageSize({widgets:[],widgetSize:'compact'},true),12);assert.equal(homePageSize({widgets:['clock'],widgetSize:'large'}),8);
  const order=Array.from({length:25},(_,i)=>String(i));const moved=moveHomeApp(order,'1',12);assert.equal(moved.indexOf('1'),13);assert.equal(new Set(moved).size,25);assert.equal(order[1],'1');assert.equal(moveHomeApp(order,'1',-30)[0],'1');assert.equal(moveHomeApp(order,'1',99).at(-1),'1');
});
