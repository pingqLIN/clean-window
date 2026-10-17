import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeChrome} from './fake-chrome.mjs';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);}});
async function setup(){
 const f=fakeChrome();f.preferences.cleanLevel=2;
 const runtime={id:'abcdefghijklmnopabcdefghijklmnop',getURL:p=>`chrome-extension://abcdefghijklmnopabcdefghijklmnop/${p}`,onMessage:event(),onInstalled:event()};
 f.api.runtime=runtime;
 f.api.action={async setBadgeText(){},async setTitle(){}};
 f.api.commands={onCommand:event()};
 f.api.contextMenus={onClicked:event(),removeAll(fn){fn();},create(data,fn){fn();}};
 f.api.tabs.onRemoved=event();f.api.tabs.onReplaced=event();f.api.tabs.onUpdated=event();f.api.windows.onRemoved=event();
 globalThis.chrome=f.api;
 await import(`../extension/background.js?case=${Math.random()}`);
 return {...f,sender:{id:runtime.id,url:runtime.getURL('popup.html')},listener:runtime.onMessage.listeners[0]};
}
test('internal action panel can issue an explicit-target command',async()=>{
 const f=await setup();
 const response=await new Promise(resolve=>f.listener({type:'clean-window:run',action:'toggle-clean',target:{windowId:1,tabId:11}},f.sender,resolve));
 assert.equal(response.ok,true);assert.equal(f.wins.get(response.windowId).type,'popup');assert.equal(f.tabs.get(21).windowId,2);
});
test('web-page sender and other-extension sender are ignored',async()=>{
 const f=await setup(),msg={type:'clean-window:run',action:'toggle-clean',target:{windowId:1,tabId:11}};
 let responses=0;
 assert.equal(f.listener(msg,{...f.sender,url:'https://untrusted.example/'},()=>responses++),false);
 assert.equal(f.listener(msg,{...f.sender,id:'some-other-extension'},()=>responses++),false);
 assert.equal(responses,0);assert.equal(f.calls.length,0);
});
test('stale target error returns through runtime response rather than mutating another window',async()=>{
 const f=await setup();const response=await new Promise(resolve=>f.listener({type:'clean-window:run',action:'toggle-clean',target:{windowId:2,tabId:11}},f.sender,resolve));
 assert.equal(response.ok,false);assert.match(response.error,/目標|分頁/);assert.equal(f.calls.length,0);
});
test('origin-window removed event does not discard the moved tab journal',async()=>{
 const f=await setup();await f.api.storage.session.set({'clean:11':{originWindowId:1},'full:1':{state:'normal'}});
 f.api.windows.onRemoved.listeners[0](1);await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(f.db['clean:11'],{originWindowId:1});assert.equal(f.db['full:1'],undefined);
});
test('tab removal only clears this tabs own journal and feedback',async()=>{
 const f=await setup();await f.api.storage.session.set({'clean:11':{},'feedback:11':'error','clean:21':{keep:true}});
 f.api.tabs.onRemoved.listeners[0](11);await new Promise(r=>setTimeout(r,0));
 assert.equal(f.db['clean:11'],undefined);assert.deepEqual(f.db['clean:21'],{keep:true});
});
test('installation only sets own context menus, never opens new pages',async()=>{
 const f=await setup();f.api.runtime.onInstalled.listeners[0]({reason:'install'});assert.equal(f.calls.length,0);
});

test('self-drawn extension dock restores only its actual top-frame tab',async()=>{
 const f=await setup();
 const detached=await new Promise(resolve=>f.listener(
  {type:'clean-window:run',action:'toggle-clean',target:{tabId:11,windowId:1}},
  f.sender,resolve
 ));
 assert.equal(detached.ok,true);
 const sender={id:f.sender.id,url:'https://example.test/',frameId:0,
  tab:{id:11,windowId:detached.windowId}};
 const restored=await new Promise(resolve=>f.listener(
  {type:'clean-window:dock',action:'restore'},sender,resolve
 ));
 assert.equal(restored.ok,true);
 assert.equal(f.tabs.get(11).windowId,1);
});

test('extension dock rejects non-extension senders, subframes, and unknown actions',async()=>{
 const f=await setup();
 const valid={id:f.sender.id,url:'https://example.test/',frameId:0,
  tab:{id:11,windowId:1}};
 const message={type:'clean-window:dock',action:'manage'};
 let calls=0;
 for(const fake of [{...valid,id:'another-extension'},
   {...valid,frameId:1}, {...valid,tab:undefined}]){
  assert.equal(f.listener(message,fake,()=>calls++),false);
 }
 assert.equal(f.listener({...message,action:'remove-other-extension'},valid,()=>calls++),false);
 assert.equal(f.calls.length,0);
 assert.equal(calls,0);
});

test('extension dock management button opens native extension management window',async()=>{
 const f=await setup();
 let created;
 f.api.windows.create=async options=>{created=options;return {id:91,type:'normal'};};
 const sender={id:f.sender.id,url:'https://example.test/',frameId:0,
  tab:{id:11,windowId:1}};
 const result=await new Promise(resolve=>f.listener(
  {type:'clean-window:dock',action:'manage'},sender,resolve
 ));
 assert.equal(result.ok,true);
 assert.equal(result.windowId,91);
 assert.deepEqual(created,{url:'chrome://extensions/',type:'normal',focused:true});
});

test('title shortcut targets only the captured clean popup tab',async()=>{
 const f=await setup();
 const opened=await new Promise(resolve=>f.listener(
  {type:'clean-window:run',action:'toggle-clean',target:{tabId:11,windowId:1}},
  f.sender,resolve));
 assert.equal(opened.ok,true);
 f.api.commands.onCommand.listeners[0]('edit-title',{id:11,windowId:opened.windowId});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(f.titleModes.get(11),'editing');
 assert.equal(f.tabs.get(21).windowId,2);
});
test('edit-title context menu respects original explicit target',async()=>{
 const f=await setup();
 const opened=await new Promise(resolve=>f.listener(
  {type:'clean-window:run',action:'toggle-clean',target:{tabId:11,windowId:1}},
  f.sender,resolve));
 f.api.contextMenus.onClicked.listeners[0]({menuItemId:'edit-title'},{id:11,windowId:opened.windowId});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(f.titleModes.get(11),'editing');
});

test('edge-level command changes only the managed popup originating from its top frame',async()=>{
 const f=await setup();f.preferences.cleanLevel=1;
 const opened=await new Promise(resolve=>f.listener(
  {type:'clean-window:run',action:'toggle-clean',target:{tabId:11,windowId:1}},
  f.sender,resolve));
 assert.equal(opened.ok,true);
 const sender={id:f.sender.id,url:'https://example.test/',frameId:0,
   tab:{id:11,windowId:opened.windowId}};
 const reply=await new Promise(resolve=>f.listener(
  {type:'clean-window:edge-level',level:3},sender,resolve));
 assert.equal(reply.ok,true);
 assert.equal(reply.level,3);
 assert.equal(f.db['clean:11'].cleanLevel,3);
 assert.equal(f.edgeModes.get(11),3);
 assert.equal(f.tabs.get(21).windowId,2);
});
test('edge-level message ignores other extensions, missing sender tab and subframes',async()=>{
 const f=await setup();
 const good={id:f.sender.id,url:'https://example.test/',frameId:0,
   tab:{id:11,windowId:1}};
 const msg={type:'clean-window:edge-level',level:2};
 let count=0;
 for (const fake of [{...good,id:'other-extension'}, {...good,frameId:1}, {...good,tab:undefined}]) {
   assert.equal(f.listener(msg,fake,()=>count++),false);
 }
 assert.equal(count,0);
 assert.equal(f.calls.length,0);
});


test('single-tap edge title action opens editor for its own popup without moving tabs',async()=>{
 const f=await setup();f.api.failInjectInPopup=true;
 const opened=await new Promise(resolve=>f.listener(
  {type:'clean-window:run',action:'toggle-clean',target:{tabId:11,windowId:1}},
  f.sender,resolve));
 assert.equal(opened.ok,true);
 const sender={id:f.sender.id,url:'https://example.test/',frameId:0,
   tab:{id:11,windowId:opened.windowId}};
 const result=await new Promise(resolve=>f.listener(
   {type:'clean-window:edge-title'},sender,resolve));
 assert.equal(result.ok,true);
 assert.equal(result.mode,'title-editor');
 assert.equal(f.titleModes.get(11),'editing');
 assert.equal(f.tabs.get(21).windowId,2);
});
test('edge title command rejects untrusted frames and unrelated popup windows',async()=>{
 const f=await setup();
 const good={id:f.sender.id,url:'https://example.test/',frameId:0,
   tab:{id:11,windowId:1}};
 for(const bad of [{...good,id:'other-extension'}, {...good,frameId:1}, {...good,tab:undefined}]) {
   assert.equal(f.listener({type:'clean-window:edge-title'},bad,()=>{}),false);
 }
 const result=await new Promise(resolve=>f.listener(
  {type:'clean-window:edge-title'},good,resolve));
 assert.equal(result.ok,false);
 assert.match(result.error,/先進入/);
});
