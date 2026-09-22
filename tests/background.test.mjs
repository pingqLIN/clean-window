import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeChrome} from './fake-chrome.mjs';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);}});
async function setup(){
 const f=fakeChrome();
 const runtime={id:'abcdefghijklmnopabcdefghijklmnop',getURL:p=>`chrome-extension://abcdefghijklmnopabcdefghijklmnop/${p}`,onMessage:event(),onInstalled:event()};
 f.api.runtime=runtime;
 f.api.action={async setBadgeText(){},async setTitle(){}};
 f.api.commands={onCommand:event()};
 f.api.contextMenus={onClicked:event(),removeAll(fn){fn();},create(data,fn){fn();}};
 f.api.tabs.onRemoved=event();f.api.tabs.onReplaced=event();f.api.windows.onRemoved=event();
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
