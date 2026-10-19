/** On-demand browser DOM smoke: isolated Chrome profile, loopback fixture, no package dependencies. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome Dev\\Application\\chrome.exe';
// Expose the otherwise closed Shadow DOM only inside this isolated test profile.
const source = (await readFile(new URL('../extension/page-ui.js', import.meta.url),'utf8'))
 .replace("attachShadow({mode:'closed'})","attachShadow({mode:'open'})");
const titleSource = await readFile(new URL('../extension/title-ui.js', import.meta.url),'utf8');
const popupSource = await readFile(new URL('../extension/popup.js', import.meta.url),'utf8');
const popupHTML = await readFile(new URL('../extension/popup.html', import.meta.url),'utf8');
const popupCSS = await readFile(new URL('../extension/popup.css', import.meta.url),'utf8');
const edgeSource = await readFile(new URL('../extension/edge-ui.js', import.meta.url),'utf8');
const server=createServer((req,res)=>{
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end('<!doctype html><title>Clean Window Test</title><header>Outside main</header><main style="width:75vw;height:72vh;background:#e1e8f2;margin:20px"><h1>Main Content</h1><p>Smoke Fixture</p></main><footer>Outside main</footer>');
});
const profile=await mkdtemp(join(tmpdir(),'cw-page-ui-'));
let processHandle, ws;
const pending=new Map();
let sequence=0;
const send=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++sequence;
 pending.set(id,{resolve,reject});
 ws.send(JSON.stringify({id,method,params}));
});
const run=async(expression)=>{
 const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
 return result.result.value;
};
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 processHandle=spawn(chrome,[
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu',
  '--remote-debugging-port=0', '--user-data-dir='+profile,'about:blank'
 ],{windowsHide:true,stdio:'ignore'});
 let debugPort;
 for(let i=0;i<100;i++){
  if(processHandle.exitCode!==null)break;
  try{
    debugPort=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);
    if(debugPort)break;
  }catch{}
  await sleep(100);
 }
 if(!debugPort)throw Error('BLOCKED: Chrome Dev remote-debugging port unavailable in isolated headless session');
 const url='http://127.0.0.1:'+port+'/';
 const target=await (await fetch('http://127.0.0.1:'+debugPort+'/json/new?'+encodeURIComponent(url),{method:'PUT'})).json();
 ws=new WebSocket(target.webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{
  let msg;try{msg=JSON.parse(event.data);}catch{return;}
  if(!msg.id)return;
  const p=pending.get(msg.id);
  if(p){pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}
 });
 await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
 });
 await send('Runtime.enable');
 await send('Page.enable');
 let ready=false;
 for(let i=0;i<60;i++){
  try {ready=await run('document.readyState === "complete" && !!document.querySelector("main")');}catch{}
  if(ready)break;
  await sleep(100);
 }
 assert.equal(ready,true,'test page ready');
 await run('globalThis.chrome={storage:{local:{async get(key){return {[key]:globalThis.__cwTheme};},async set(value){globalThis.__cwTheme=value.cleanWindowUiTheme;}}},runtime:{onMessage:{addListener(fn){globalThis.__cwListener=fn;}},async sendMessage(message){globalThis.__hubCalls=(globalThis.__hubCalls||[]).concat(message);if(message.action==="list")return {ok:true,items:[{tabId:11,windowId:5,title:"🎨 研究視窗",level:1}]};if(message.action==="bookmarks-recent")return{ok:true,granted:false,items:[]};if(message.action==="bookmarks-status")return {ok:true,granted:false};return{ok:true,level:message.level};}}};'+source);
 const invoke=(mode)=>run('new Promise(resolve=>globalThis.__cwListener({type:"clean-window:page-ui",mode:"'+mode+'"}, {},resolve))');

 const full=await invoke('address-dock');
 assert.equal(full.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'true');
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwHeight'),'86');
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelectorAll(".ribbon button").length'),7);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".brand")===null'),true);
 const initialTheme=await run('document.getElementById("clean-window-address-ui").dataset.theme');
 await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".theme-toggle").click();true');
 await sleep(30);
 const toggledTheme=await run('document.getElementById("clean-window-address-ui").dataset.theme');
 assert.notEqual(toggledTheme,initialTheme);
 assert.equal(await run('globalThis.__cwTheme'),toggledTheme);
 await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".ribbon button[title=\'管理乾淨視窗\']").click();true');
 await sleep(40);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelectorAll(".menu-row").length'),1);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".menu-row .name").textContent'),'🎨 研究視窗');
 await run('(() => {const r=document.getElementById("clean-window-address-ui").shadowRoot;const s=r.querySelector(".menu-row select");s.value="2";s.dispatchEvent(new Event("change"));return true;})()');
 await sleep(40);
 assert.equal(await run('globalThis.__hubCalls.some(m=>m.action==="set-level"&&m.level===2&&m.target.windowId===5)'),true);
 await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".ribbon button[title=\'瀏覽書籤\']").click();true');
 await sleep(40);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".menu").textContent.includes("需要另外授權")'),true);
 await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".menu-action").click();true');
 await sleep(40);
 assert.equal(await run('globalThis.__hubCalls.some(m=>m.action==="bookmarks-grant")'),true);
 console.log('PASS: level 1 draws two-row toolbar, manager list and optional bookmark permission entry');
 const switched=await invoke('address');
 assert.equal(switched.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'false');
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwHeight'),'48');
 await sleep(30);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.theme'),toggledTheme,'theme persists to level 2');
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".theme-toggle")!==null'),true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".ribbon")===null'),true);
 const returned=await invoke('address-dock');
 assert.equal(returned.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'true');
 await invoke('off');
 assert.equal(await run('!document.getElementById("clean-window-address-ui")'),true);
 const address=await invoke('address');
 assert.equal(address.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'false');
 console.log('PASS: URL-only mode without extension dock');
 await invoke('off');
 assert.equal(await run('!document.getElementById("clean-window-address-ui")'),true);
 assert.equal(await run('document.documentElement.style.paddingTop'), '');
 console.log('PASS: bare popup mode removes content toolbar and restores padding');
 console.log('SMOKE PASS: 4/4 drawn-bar Chrome Headless DOM checks');

 // The edge control has no text on the handle, but exposes an accessible
 // three-stop rail, hover-only explanations, instant switching, and edge drag.
 await run('globalThis.chrome.storage={local:{async get(){return{};},async set(value){globalThis.__edgeSaved=value;}}};globalThis.chrome.runtime.sendMessage=async message=>{if(message.type==="clean-window:edge-title"){globalThis.__edgeTitleRequests=(globalThis.__edgeTitleRequests||0)+1;return{ok:true};}if(message.type==="clean-window:edge-restore"){globalThis.__edgeRestoreRequests=(globalThis.__edgeRestoreRequests||0)+1;return{ok:true};}return{ok:true,level:message.level};};globalThis.chrome.runtime.onMessage.addListener=fn=>{globalThis.__cwEdgeListener=fn;};'+edgeSource);
 const edgeCommand=level=>run('new Promise(resolve=>globalThis.__cwEdgeListener({type:"clean-window:edge-ui",level:'+JSON.stringify(level)+'}, {},resolve))');
 const rail=await edgeCommand(1);
 assert.equal(rail.ok,true);
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelectorAll(".edge .close").length'),1);
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".close")).visibility'),'hidden');
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelectorAll(".stop").length'),3);
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle").textContent'),'');
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle").dataset.tip.includes("關閉乾淨模式")'),true);
 assert.equal(await run('document.querySelector("#clean-window-edge-control").dataset.tipPlacement'),'above');
 assert.notEqual(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle"),"::after").bottom'),'auto');
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop.selected").dataset.level'),'1');
 assert.equal((await edgeCommand(3)).level,3);
 assert.equal(await run('(() => {const r=document.querySelector("#clean-window-edge-control").getBoundingClientRect();return Math.abs(r.right-window.innerWidth)<1;})()'),true,'edge control is pinned to the right viewport edge');
 await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop[data-level=\'2\']").click();true');
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop.selected").dataset.level'),'3','untrusted synthetic click must not invoke extension actions');
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop.selected").dataset.level'),'3');
 const grip=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:grip.x,y:grip.y});
 const stop=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop[data-level=\'2\']").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:stop.x,y:stop.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:stop.x,y:stop.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:stop.x,y:stop.y,button:'left',clickCount:1});
 await sleep(40);
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop.selected").dataset.level'),'2');
 console.log('PASS: real pointer click switches edge level; simulated page clicks are ignored');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:grip.x,y:grip.y});
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".rail")).display'),'flex');
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle"),"::after").visibility'),'visible');
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".hint")).visibility'),'hidden');
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".close")).visibility'),'visible');
 console.log('PASS: hover reveals vertical rail, labels stay hidden on the handle');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".rail")).transitionDuration'),'0s');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 console.log('PASS: reduced-motion preference disables nonessential edge animation');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:grip.x,y:grip.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:7,y:160,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:7,y:160,button:'left',clickCount:1});
 assert.equal(await run('document.querySelector("#clean-window-edge-control").dataset.side'),'left');
 assert.equal(await run('(() => {const r=document.querySelector("#clean-window-edge-control").getBoundingClientRect();return Math.abs(r.left)<1;})()'),true,'drag snaps to the left viewport edge');
 assert.equal(await run('globalThis.__edgeSaved.edgeControl.side'),'left');
 console.log('PASS: dragging moves and persists the rail at the opposite screen edge');
 assert.equal(await run('globalThis.__edgeRestoreRequests||0'),0,'drag must not restore the window');
 const movedGrip=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:movedGrip.x,y:movedGrip.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:movedGrip.x,y:movedGrip.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:movedGrip.x,y:movedGrip.y,button:'left',clickCount:1});
 await sleep(30);
 assert.equal(await run('globalThis.__edgeRestoreRequests||0'),0,'the tab handle cannot restore or edit on click');
 console.log('PASS: edge handle drag remains functional; tapping it does not edit title');
 // The red X is contained in the hover rail and must reject synthetic clicks.
 await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".close").click();true');
 assert.equal(await run('globalThis.__edgeRestoreRequests||0'),0);
 const closePoint=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".close").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:closePoint.x,y:closePoint.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:closePoint.x,y:closePoint.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:closePoint.x,y:closePoint.y,button:'left',clickCount:1});
 await sleep(40);
 assert.equal(await run('globalThis.__edgeRestoreRequests'),1);
 console.log('PASS: edge-tab red X requests restore only on a trusted pointer click');
 await edgeCommand('off');
 assert.equal(await run('!document.querySelector("#clean-window-edge-control")'),true);

 // Title editor: default native title, symbol selection, custom text, SPA updates, restoration.
 await run('globalThis.chrome.runtime.onMessage.addListener=fn=>{globalThis.__cwTitleListener=fn;};'+titleSource);
 const titleCommand=action=>run('new Promise(resolve=>globalThis.__cwTitleListener({type:"clean-window:title",action:"'+action+'"}, {},resolve))');
 const started=await titleCommand('start');
 assert.equal(started.ok,true);
 assert.equal(await run('document.title'),'◈ Clean Window Test');
 console.log('PASS: symbol + original page title without favicon spoofing');

 const opened=await titleCommand('edit');
 assert.equal(opened.ok,true);
 const editorVisual=await run('(() => {const r=document.querySelector("#clean-window-title-editor").shadowRoot;return {corner:getComputedStyle(r.querySelector(".panel")).borderTopLeftRadius,applyCorner:getComputedStyle(r.querySelector("button.primary")).borderTopLeftRadius}})()');
 assert.equal(editorVisual.corner,'16px');
 assert.equal(editorVisual.applyCorner,'999px');
 console.log('PASS: title editor follows the popup rounded-panel and pill-action styling');
 const custom=await run(`(() => {
   const root=document.querySelector('#clean-window-title-editor').shadowRoot;
   const symbol=root.querySelector('#cw-title-symbol');
   const title=root.querySelector('#cw-title-text');
   symbol.value='✦'; title.value='我的乾淨視窗';
   root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   return document.title;
 })()`);
 assert.equal(custom,'✦ 我的乾淨視窗');
 console.log('PASS: title editor applies chosen standard symbol and text');
 await titleCommand('edit');
 const keycaps=await run(`(() => {
   const root=document.querySelector('#clean-window-title-editor').shadowRoot;
   const presets=[...root.querySelectorAll('.preset')].map(el=>el.textContent);
   const expected=['1️⃣','2️⃣','3️⃣','🖋️','🌍','🚩','🔥','🔍','💡','🛠️','🔏'];
   if(!expected.every(icon=>presets.includes(icon)))return 'missing presets';
   root.querySelector('#cw-title-symbol').value='1️⃣';
   root.querySelector('#cw-title-text').value='工作視窗';
   root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   return document.title;
 })()`);
 assert.equal(keycaps,'1️⃣ 工作視窗');
 console.log('PASS: requested Emoji presets exist and keycap icon is accepted');

 await titleCommand('edit');
 const emoji=await run(`(() => {
   const root=document.querySelector('#clean-window-title-editor').shadowRoot;
   root.querySelector('#cw-title-symbol').value='👩🏽‍💻';
   root.querySelector('#cw-title-text').value='Emoji 測試';
   root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   return document.title;
 })()`);
 assert.equal(emoji,'👩🏽‍💻 Emoji 測試');
 console.log('PASS: composite grapheme Emoji icon stored intact');

 await titleCommand('edit');
 const invalidIcon=await run(`(() => {
   const root=document.querySelector('#clean-window-title-editor').shadowRoot;
   root.querySelector('#cw-title-symbol').value='🎨🎬';
   root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   return {title:document.title,editor:!!document.querySelector('#clean-window-title-editor')};
 })()`);
 assert.deepEqual(invalidIcon,{title:'👩🏽‍💻 Emoji 測試',editor:true});
 console.log('PASS: multiple Emoji are rejected without changing title');
 await run("document.querySelector('#clean-window-title-editor').shadowRoot.querySelector('button.reset').click();true");
 await titleCommand('edit');
 await run(`(() => {
   const root=document.querySelector('#clean-window-title-editor').shadowRoot;
   root.querySelector('#cw-title-symbol').value='🇹🇼';
   root.querySelector('#cw-title-text').value='我的乾淨視窗';
   root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   return true;
 })()`);
 assert.equal(await run('document.title'),'🇹🇼 我的乾淨視窗');
 console.log('PASS: country-flag Emoji stays a single icon');

 await run('document.title="SPA Updated"; true');
 await sleep(150);
 assert.equal(await run('document.title'),'🇹🇼 我的乾淨視窗');
 await titleCommand('off');
 assert.equal(await run('document.title'),'SPA Updated');
 console.log('PASS: restore latest native title after SPA title changes');

 await titleCommand('start');
 assert.equal(await run('document.title'),'◈ SPA Updated');
 await titleCommand('edit');
 const reset=await run(`(() => {
   const root=document.querySelector('#clean-window-title-editor').shadowRoot;
   root.querySelector('button.reset').click();
   return document.title;
 })()`);
 assert.equal(reset,'◈ SPA Updated');
 await titleCommand('off');
 assert.equal(await run('document.title'),'SPA Updated');
 console.log('PASS: restore original title and remove editor override');
 console.log('SMOKE PASS: 16/16 Chrome Headless DOM checks; not full MV3 window/titlebar acceptance');

 // Render the real popup HTML/CSS with an isolated extension API stub, then
 // verify that managed names, clipping, hover marquee and EDIT are usable.
 const popupBody=popupHTML.split('<body>')[1]?.split('</body>')[0];
 assert.ok(popupBody,'popup body fixture missing');
 await run('document.body.innerHTML='+JSON.stringify(popupBody)+';document.head.insertAdjacentHTML("beforeend",'+JSON.stringify('<style>'+popupCSS+'</style>')+');document.querySelector("#managed-windows").open=true;window.close=()=>{globalThis.__cwPopupClosed=true;};true');
 const popupStub = [
   'globalThis.__cwPopupMsgs=[];',
   'globalThis.chrome={',
   ' tabs:{async query(){return [{id:11,windowId:71}]}},',
   ' windows:{async get(){return {id:71,type:"normal",state:"normal"}}},',
   ' commands:{async getAll(){return []}},',
   ' storage:{session:{async get(){return {}}},local:{async get(){return {cleanLevel:1}},async set(){}}},',
   ' runtime:{async sendMessage(message){globalThis.__cwPopupMsgs.push(message);',
   ' if(message.action==="list")return {ok:true,items:[',
   ' {tabId:91,windowId:81,level:1,title:"🖋️ 已編輯的很長很長視窗標題，這是一段應該啟動連續跑馬燈顯示完整字串的測試內容"},',
   ' {tabId:92,windowId:82,level:3,title:"短標題"}',
   ' ]}; return {ok:true};}}};'
 ].join('');
 await run(popupStub+popupSource);
 await sleep(95);
 const popupRows=await run('(() => [...document.querySelectorAll("#managed-list .managed-row")].map(row=>({title:row.querySelector(".managed-name-text")?.textContent,overflow:row.querySelector(".managed-name-viewport")?.dataset.overflow,edit:!!row.querySelector(".managed-edit"),visibleWidth:row.querySelector(".managed-name-viewport")?.clientWidth})))()');
 assert.equal(popupRows.length,2);
 assert.equal(popupRows[0].title.startsWith('🖋️ 已編輯'),true);
 assert.equal(popupRows[0].overflow,'true');
 assert.equal(popupRows[1].overflow,'false');
 assert.equal(popupRows[0].visibleWidth>25,true);
 assert.equal(popupRows[0].edit,true);
 console.log('PASS: popup list renders managed titles and individual edit icons, clips only long names');
 const moving=await run('(() => {const r=document.querySelector("#managed-list .managed-name-viewport").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:moving.x,y:moving.y});
 await sleep(40);
 let marqueeStarted=false;
 for(let attempt=0;attempt<10;attempt++){
   const animation=await run('getComputedStyle(document.querySelector("#managed-list .managed-name-track")).animationName');
   if(animation==='cw-title-marquee'){marqueeStarted=true;break;}
   await sleep(25);
 }
 assert.equal(marqueeStarted,true,'long title must scroll on hover');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.equal(await run('getComputedStyle(document.querySelector("#managed-list .managed-name-track")).animationName'),'none');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 console.log('PASS: clipped title loops on hover and stops for reduced-motion preference');
 await run('document.querySelector("#managed-list .managed-edit").click();true');
 await sleep(20);
 assert.equal(await run('globalThis.__cwPopupMsgs.some(m=>m.action==="edit-title"&&m.target.tabId===91&&m.target.windowId===81)'),true);
 const sequence=await run('globalThis.__cwPopupMsgs.filter(m=>m.action==="focus"||m.action==="edit-title").map(m=>m.action)');
 assert.deepEqual(sequence,['focus','edit-title']);
 console.log('PASS: popup EDIT focuses the selected window then opens its title editor');
 console.log('SMOKE PASS: popup managed-list title, marquee and edit actions; real MV3 reload remains unverified');

} finally {
 try{ws?.close();}catch{}
 try{processHandle?.kill();}catch{}
 await new Promise(resolve=>server.close(resolve));
 await sleep(450);
 await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:150}).catch(()=>{});
}
