import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeChrome} from './fake-chrome.mjs';
let createController;
try { ({createController}=await import('../extension/controller.js')); } catch {}
const setup=()=>{ assert.equal(typeof createController,'function','controller has not been implemented');const f=fakeChrome();f.preferences.cleanLevel=2;return {...f,ctl:createController(f.api)}; };
const target={windowId:1,tabId:11};

test('clean mode moves the existing tab, without URL/reload and without touching window 2',async()=>{
 const f=setup(), before=structuredClone(f.wins.get(2));
 const result=await f.ctl.run('toggle-clean',target);
 assert.equal(f.tabs.get(11).windowId,result.windowId);
 assert.equal(f.wins.get(result.windowId).type,'popup');
 assert.deepEqual(f.wins.get(2),before);assert.equal(f.tabs.get(21).windowId,2);
 assert.equal(f.calls[0][0],'create'); assert.equal(f.calls[0][1].tabId,11);
 assert.equal('url' in f.calls[0][1],false);
});
test('restoration returns to original window through a normal window',async()=>{
 const f=setup();await f.ctl.run('toggle-clean',target);
 const id=f.tabs.get(11).windowId;await f.ctl.run('restore',{tabId:11,windowId:id});
 assert.equal(f.tabs.get(11).windowId,1);assert.equal(f.tabs.get(11).index,0);
 assert.equal(f.wins.size,2);
});
test('only-tab source closes naturally; restore creates a new normal window, never uses another',async()=>{
 const f=setup();f.tabs.delete(12);await f.ctl.run('toggle-clean',target);
 assert.equal(f.wins.has(1),false);
 await f.ctl.run('restore',{tabId:11,windowId:f.tabs.get(11).windowId});
 assert.equal(f.wins.get(f.tabs.get(11).windowId).type,'normal');assert.notEqual(f.tabs.get(11).windowId,2);
});
test('fullscreen and restore preserve original bounds, affect only window 1',async()=>{
 const f=setup();const before=structuredClone(f.wins.get(1));await f.ctl.run('toggle-fullscreen',target);
 assert.equal(f.wins.get(1).state,'fullscreen');assert.equal(f.wins.get(2).state,'normal');
 await f.ctl.run('toggle-fullscreen',target);
 for(const k of ['state','left','top','width','height'])assert.equal(f.wins.get(1)[k],before[k]);
 assert.ok(f.calls.every(c=>c[0]!=='updateWindow'||c[1]===1));
});
test('maximized state restores without conflicting bounds',async()=>{
 const f=setup();f.wins.get(1).state='maximized';await f.ctl.run('toggle-fullscreen',target);await f.ctl.run('restore',target);
 assert.equal(f.wins.get(1).state,'maximized');
 assert.ok(f.calls.every(c=>c[0]!=='updateWindow'||c[2].state!=='maximized'||!('width'in c[2])));
});
test('stale tab/window target rejected; no fallback to focused window',async()=>{
 const f=setup();await assert.rejects(f.ctl.run('toggle-clean',{windowId:2,tabId:11}),/目標|分頁/);assert.equal(f.calls.length,0);
});
test('grouped tab is rejected with fullscreen alternative and no mutation',async()=>{
 const f=setup();f.tabs.get(11).groupId=7;await assert.rejects(f.ctl.run('toggle-clean',target),/群組/);assert.equal(f.calls.length,0);
});
test('split-view tab is rejected without breaking the split',async()=>{
 const f=setup();f.tabs.get(11).splitViewId=9;await assert.rejects(f.ctl.run('toggle-clean',target),/分割|Split/);assert.equal(f.calls.length,0);
});
test('storage failure before create leaves all windows intact',async()=>{
 const f=setup();f.api.failStorage=true;await assert.rejects(f.ctl.run('toggle-clean',target));assert.equal(f.calls.length,0);
});
test('failed creation retains source tab; next invocation can succeed',async()=>{
 const f=setup();f.api.failCreate=true;await assert.rejects(f.ctl.run('toggle-clean',target));assert.equal(f.tabs.get(11).windowId,1);
 f.api.failCreate=false;await f.ctl.run('toggle-clean',target);assert.equal(f.wins.get(f.tabs.get(11).windowId).type,'popup');
});
test('failed merge leaves the tab in an accessible normal window and returns warning',async()=>{
 const f=setup();await f.ctl.run('toggle-clean',target);f.api.failMove=true;
 const result=await f.ctl.run('restore',{tabId:11,windowId:f.tabs.get(11).windowId});
 assert.ok(result.warning);assert.equal(f.wins.get(f.tabs.get(11).windowId).type,'normal');assert.equal(f.tabs.get(21).windowId,2);
});
test('restore does not use a closed original window nor any replacement window',async()=>{
 const f=setup();await f.ctl.run('toggle-clean',target);f.tabs.delete(12);f.wins.delete(1);
 await f.ctl.run('restore',{tabId:11,windowId:f.tabs.get(11).windowId});
 assert.equal(f.calls.filter(c=>c[0]==='moveTab').length,0);
});
test('recordless popup can be explicitly restored after extension reload',async()=>{
 const f=setup();f.wins.get(1).type='popup';f.tabs.delete(12);
 await f.ctl.run('restore',target);assert.equal(f.wins.get(f.tabs.get(11).windowId).type,'normal');
});
test('normal restore is no-op, does not relocate a tab',async()=>{
 const f=setup();await f.ctl.run('restore',target);assert.equal(f.calls.length,0);
});
test('manual F11 exit is not undone by stale fullscreen metadata',async()=>{
 const f=setup();await f.ctl.run('toggle-fullscreen',target);f.wins.get(1).state='normal';f.wins.get(1).width=550;
 const count=f.calls.length;await f.ctl.run('restore',target);assert.equal(f.calls.length,count);assert.equal(f.wins.get(1).width,550);
});
test('rapid repeated target commands do not create two windows',async()=>{
 const f=setup();const results=await Promise.allSettled([f.ctl.run('toggle-clean',target),f.ctl.run('toggle-clean',target)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.calls.filter(c=>c[0]==='create').length,1);
});
test('invalid action and IDs fail without side effects',async()=>{
 const f=setup();await assert.rejects(f.ctl.run('bogus',target));await assert.rejects(f.ctl.run('restore',{windowId:-1,tabId:11}));assert.equal(f.calls.length,0);
});
test('pinned flag is restored',async()=>{
 const f=setup();f.tabs.get(11).pinned=true;await f.ctl.run('toggle-clean',target);f.tabs.get(11).pinned=false;
 await f.ctl.run('restore',{tabId:11,windowId:f.tabs.get(11).windowId});assert.equal(f.tabs.get(11).pinned,true);
});

test('worker recreation retains session restoration metadata',async()=>{
 const f=setup();await f.ctl.run('toggle-clean',target);
 f.ctl=createController(f.api);await f.ctl.run('restore',{windowId:f.tabs.get(11).windowId,tabId:11});
 assert.equal(f.tabs.get(11).windowId,1);
});
test('pending journal recovers after post-create storage failure',async()=>{
 const f=setup(),set=f.api.storage.session.set;let count=0;
 f.api.storage.session.set=async data=>{if(++count===2)throw new Error('Post-create write failed');return set(data);};
 await assert.rejects(f.ctl.run('toggle-clean',target));assert.equal(f.wins.get(f.tabs.get(11).windowId).type,'popup');
 await f.ctl.run('restore',{windowId:f.tabs.get(11).windowId,tabId:11});assert.equal(f.tabs.get(11).windowId,1);
});
test('fullscreen supports grouped tabs without moving them',async()=>{
 const f=setup();f.tabs.get(11).groupId=99;await f.ctl.run('toggle-fullscreen',target);
 assert.equal(f.tabs.get(11).groupId,99);assert.equal(f.tabs.get(11).windowId,1);
});
test('incognito target stays incognito; no cross-profile merge',async()=>{
 const f=setup();f.wins.get(1).incognito=true;await f.ctl.run('toggle-clean',target);
 const id=f.tabs.get(11).windowId;assert.equal(f.wins.get(id).incognito,true);
 f.wins.get(1).incognito=false;await f.ctl.run('restore',{windowId:id,tabId:11});
 assert.notEqual(f.tabs.get(11).windowId,1);assert.equal(f.wins.get(f.tabs.get(11).windowId).incognito,true);
});
test('target moving during journal write is caught before popup creation',async()=>{
 const f=setup(),set=f.api.storage.session.set;
 f.api.storage.session.set=async data=>{await set(data);f.tabs.get(11).windowId=2;};
 await assert.rejects(f.ctl.run('toggle-clean',target),/目標|分頁/);
 assert.equal(f.calls.filter(c=>c[0]==='create').length,0);
});
test('toggle clean on fullscreen popup exits fullscreen before restoring',async()=>{
 const f=setup();await f.ctl.run('toggle-clean',target);
 const id=f.tabs.get(11).windowId,popupTarget={windowId:id,tabId:11};
 await f.ctl.run('toggle-fullscreen',popupTarget);const start=f.calls.length;
 await f.ctl.run('toggle-clean',popupTarget);
 assert.equal(f.calls[start][0],'updateWindow');assert.equal(f.calls[start][1],id);assert.equal(f.calls[start][2].state,'normal');
 assert.equal(f.tabs.get(11).windowId,1);
});


test('level 1 shows the URL and Clean Window extension dock',async()=>{
 const f=setup();f.preferences.cleanLevel=1;
 const result=await f.ctl.run('toggle-clean',target);
 assert.equal(result.level,1);
 assert.equal(result.mode,'clean');
 assert.equal(f.wins.get(result.windowId).type,'popup');
 assert.equal(f.tabs.get(11).windowId,result.windowId);
 assert.equal(f.pageModes.get(11),'address-dock');
 assert.equal(f.db['clean:11'].cleanLevel,1);
 await f.ctl.run('restore',{tabId:11,windowId:result.windowId});
 assert.equal(f.tabs.get(11).windowId,1);
 assert.equal(f.pageModes.get(11),'off');
});
test('level 2 shows the URL bar without extension dock',async()=>{
 const f=setup();f.preferences.cleanLevel=2;
 const result=await f.ctl.run('toggle-clean',target);
 assert.equal(result.level,2);
 assert.equal(f.wins.get(result.windowId).type,'popup');
 assert.equal(f.pageModes.get(11),'address');
});
test('level 3 opens a plain popup without injected toolbar',async()=>{
 const f=setup();f.preferences.cleanLevel=3;
 const other=structuredClone(f.wins.get(2));
 const result=await f.ctl.run('toggle-clean',target);
 assert.equal(result.level,3);
 assert.equal(result.mode,'clean');
 assert.equal(f.wins.get(result.windowId).type,'popup');
 assert.notEqual(f.pageModes.get(11),'address');
 assert.notEqual(f.pageModes.get(11),'address-dock');
 assert.deepEqual(f.wins.get(2),other);
});
test('injection denial is fail closed for level 1 and 2, level 3 still works',async()=>{
 for(const level of [1,2]){
  const f=setup();f.preferences.cleanLevel=level;f.api.failInject=true;
  await assert.rejects(f.ctl.run('toggle-clean',target),/Injection blocked/);
  assert.equal(f.tabs.get(11).windowId,1);
  assert.equal(f.calls.filter(c=>c[0]==='create').length,0);
 }
 const f=setup();f.preferences.cleanLevel=3;f.api.failInject=true;
 const result=await f.ctl.run('toggle-clean',target);
 assert.equal(f.wins.get(result.windowId).type,'popup');
});
test('legacy detached normal window journal remains restorable',async()=>{
 const f=setup();
 f.wins.set(4,{id:4,type:'normal',state:'normal',left:20,top:30,width:900,height:650,incognito:false});
 f.tabs.get(11).windowId=4;
 f.db['clean:11']={originWindowId:1,originIndex:0,pinned:false,detachedType:'normal',detachedWindowId:4,phase:'open'};
 const result=await f.ctl.run('restore',{tabId:11,windowId:4});
 assert.equal(result.windowId,1);assert.equal(f.tabs.get(11).windowId,1);
});
test('saved levels outside 1..3 default safely to level 1',async()=>{
 for (const value of [4,5,6,88,'3',-1]){
  const f=setup();f.preferences.cleanLevel=value;
  const result=await f.ctl.run('toggle-clean',target);
  assert.equal(result.level,1);
  assert.equal(f.pageModes.get(11),'address-dock');
 }
});
test('fullscreen shortcut retains grouped and split-view compatibility',async()=>{
 const f=setup();f.tabs.get(11).groupId=77;f.tabs.get(11).splitViewId=33;
 await f.ctl.run('toggle-fullscreen',target);
 assert.equal(f.tabs.get(11).windowId,1);
 assert.equal(f.wins.get(1).state,'fullscreen');
});
