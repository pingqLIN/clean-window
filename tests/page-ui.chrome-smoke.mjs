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
const youtubeSource = await readFile(new URL('../extension/youtube-ui.js', import.meta.url),'utf8');
const siteAccessHTML = await readFile(new URL('../extension/site-access.html', import.meta.url),'utf8');
const siteAccessSource = await readFile(new URL('../extension/site-access.js', import.meta.url),'utf8');
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
 await run('globalThis.__navigationRequests=[];globalThis.__cwNavigationMode="prompt";globalThis.chrome={storage:{local:{async get(key){return {[key]:globalThis.__cwTheme};},async set(value){globalThis.__cwTheme=value.cleanWindowUiTheme;}}},runtime:{onMessage:{addListener(fn){globalThis.__cwListener=fn;}},async sendMessage(message){if(message.type==="clean-window:navigate"){globalThis.__navigationRequests.push(message);return {ok:true,action:globalThis.__cwNavigationMode};}globalThis.__hubCalls=(globalThis.__hubCalls||[]).concat(message);if(message.action==="list")return {ok:true,items:[{tabId:11,windowId:5,title:"🎨 研究視窗",level:1}]};if(message.action==="bookmarks-recent")return{ok:true,granted:false,items:[]};if(message.action==="bookmarks-status")return {ok:true,granted:false};return{ok:true,level:message.level};}}};'+source);
 const invoke=(mode)=>run('new Promise(resolve=>globalThis.__cwListener({type:"clean-window:page-ui",mode:"'+mode+'"}, {},resolve))');

 const full=await invoke('address-dock');
 assert.equal(full.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'true');
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwHeight'),'86');
 assert.equal(await run('document.documentElement.style.paddingTop'), '', 'level 1 should not reserve a permanent blank gap');
 assert.notEqual(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).transform'),'none','level 1 starts collapsed');
 assert.notEqual(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).clipPath'),'none','only the center handle is exposed while collapsed');
 const dockHandle=await run('(() => {const r=document.getElementById("clean-window-address-ui").getBoundingClientRect();return{x:r.left+r.width/2,y:r.bottom-3};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:dockHandle.x,y:dockHandle.y});
 await sleep(240);
 assert.equal(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).transform'),'none','hovering the top handle expands level 1');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:12,y:140});
 await sleep(250);
 assert.notEqual(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).transform'),'none','level 1 collapses again after pointer leaves');
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelectorAll(".ribbon button").length'),7);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".brand")===null'),true);
 const initialTheme=await run('document.getElementById("clean-window-address-ui").dataset.theme');
 await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".theme-toggle").click();true');
 await sleep(30);
 const toggledTheme=await run('document.getElementById("clean-window-address-ui").dataset.theme');
 assert.notEqual(toggledTheme,initialTheme);
 assert.equal(await run('globalThis.__cwTheme'),toggledTheme);
 await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".ribbon button[title=\'管理乾淨視窗\']").click();true');
 await sleep(240);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwMenuOpen'),'true','opening the extension menu keeps level 1 expanded');
 assert.ok(await run('Math.abs(document.getElementById("clean-window-address-ui").getBoundingClientRect().top)')<1,'the menu remains reachable after the pointer leaves the toolbar');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:12,y:140});
 await sleep(40);
 assert.ok(await run('Math.abs(document.getElementById("clean-window-address-ui").getBoundingClientRect().top)')<1,'open menu prevents accidental collapse');
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
 await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".menu-header button").click();true');
 await sleep(240);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwMenuOpen'),undefined,'closing the menu releases the expanded state');
 assert.notEqual(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).transform'),'none','level 1 collapses again when its menu closes and the pointer is outside');
 console.log('PASS: level 1 draws two-row toolbar, manager list and optional bookmark permission entry');
 const switched=await invoke('address');
 assert.equal(switched.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'false');
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwHeight'),'48');
 await sleep(220);
 assert.equal(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).transform'),'none','level 2 stays visible rather than inheriting level 1 collapse');
 assert.equal(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).clipPath'),'none','level 2 is not clipped to a small handle');
 assert.equal(await run('getComputedStyle(document.documentElement).paddingTop'),'48px','level 2 reserves its visible address-bar height on ordinary pages');
 await sleep(30);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.theme'),toggledTheme,'theme persists to level 2');
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".theme-toggle")!==null'),true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".ribbon")===null'),true);
 const returned=await invoke('address-dock');
 assert.equal(returned.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'true');
 assert.notEqual(await run('getComputedStyle(document.getElementById("clean-window-address-ui")).transform'),'none','switching back to level 1 restores the collapsed state');
 assert.equal(await run('document.documentElement.style.paddingTop'),'','switching to level 1 removes the address-bar layout gap');
 await invoke('off');
 assert.equal(await run('!document.getElementById("clean-window-address-ui")'),true);
 const address=await invoke('address');
 assert.equal(address.ok,true);
 assert.equal(await run('document.getElementById("clean-window-address-ui").dataset.cwDock'),'false');
 console.log('PASS: URL-only mode without extension dock');
 await run(`(() => {const root=document.getElementById('clean-window-address-ui').shadowRoot;const input=root.querySelector('input');input.value=location.origin+'/#cw-same-origin';root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true;})()`);
 await sleep(25);
 assert.equal(await run('location.hash'),'#cw-same-origin','same-origin URL-bar navigation proceeds without a permission prompt');
 assert.equal(await run('globalThis.__navigationRequests.length'),0,'same-origin navigation must not request host access');
 const crossOriginTarget='https://cross-origin.example/path?case=activeTab';
 await run(`(() => {const root=document.getElementById('clean-window-address-ui').shadowRoot;const input=root.querySelector('input');input.value=${JSON.stringify(crossOriginTarget)};root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true;})()`);
 await sleep(45);
 assert.deepEqual(await run('globalThis.__navigationRequests[0]'),{type:'clean-window:navigate',url:crossOriginTarget});
 assert.equal(await run('location.hostname'),'127.0.0.1','cross-origin target must not navigate before the access choice');
 assert.match(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".feedback").textContent'),/存取選擇視窗/);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".feedback").hidden'),false);
 await run('globalThis.__cwNavigationMode="error";true');
 await run(`(() => {const root=document.getElementById('clean-window-address-ui').shadowRoot;const input=root.querySelector('input');input.value='https://fallback.example/';root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true;})()`);
 await sleep(35);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelectorAll(".feedback-actions button").length'),2);
 assert.equal(await run('location.hostname'),'127.0.0.1','fallback must not navigate without a second explicit choice');
 await run(`document.getElementById('clean-window-address-ui').shadowRoot.querySelector('.feedback-actions button:last-child').click();true`);
 assert.equal(await run('document.getElementById("clean-window-address-ui").shadowRoot.querySelector(".feedback").hidden'),true);
 await run('globalThis.__cwNavigationMode="prompt";true');
 console.log('PASS: same-origin navigation stays immediate; cross-origin prompts and permission-flow failures offer explicit safe choices');
 await invoke('off');
 assert.equal(await run('!document.getElementById("clean-window-address-ui")'),true);
 assert.equal(await run('document.documentElement.style.paddingTop'), '');
 console.log('PASS: bare popup mode removes content toolbar and restores padding');
 console.log('SMOKE PASS: 4/4 drawn-bar Chrome Headless DOM checks');

 // The edge control has no text on the handle, but exposes an accessible
 // three-stop rail, hover-only explanations, instant switching, and edge drag.
 await run('globalThis.chrome.storage={local:{async get(){return{};},async set(value){globalThis.__edgeSaved=value;}}};globalThis.chrome.runtime.sendMessage=async message=>{if(message.type==="clean-window:edge-title"){globalThis.__edgeTitleRequests=(globalThis.__edgeTitleRequests||0)+1;return{ok:true};}if(message.type==="clean-window:edge-restore"){globalThis.__edgeRestoreRequests=(globalThis.__edgeRestoreRequests||0)+1;return{ok:true};}if(message.type==="clean-window:edge-level"){globalThis.__edgeLevelRequests=(globalThis.__edgeLevelRequests||0)+1;return{ok:true,level:message.level};}return{ok:true,level:message.level};};globalThis.chrome.runtime.onMessage.addListener=fn=>{globalThis.__cwEdgeListener=fn;};'+edgeSource);
 const edgeCommand=level=>run('new Promise(resolve=>globalThis.__cwEdgeListener({type:"clean-window:edge-ui",level:'+JSON.stringify(level)+'}, {},resolve))');
 const edgeCloseAlignment=()=>run('(() => {const root=document.querySelector("#clean-window-edge-control").shadowRoot;const a=root.querySelector(".handle").getBoundingClientRect();const b=root.querySelector(".close").getBoundingClientRect();return {dx:Math.abs(a.left+a.width/2-b.left-b.width/2),dy:(b.top+b.height/2)-(a.top+a.height/2),inside:root.querySelector(".handle-anchor")?.contains(root.querySelector(".close"))};})()');
 const edgeLayout=()=>run('(() => {const root=document.querySelector("#clean-window-edge-control").shadowRoot;const a=root.querySelector(".handle-anchor").getBoundingClientRect();const b=root.querySelector(".rail").getBoundingClientRect();return {width:a.width,height:a.height,gap:root.host.dataset.side==="right"?a.left-b.right:b.left-a.right};})()');
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
 const grip=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+34};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:grip.x,y:grip.y});
 const stop=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop[data-level=\'2\']").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:stop.x,y:stop.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:stop.x,y:stop.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:stop.x,y:stop.y,button:'left',clickCount:1});
 await sleep(40);
 assert.equal(await run('document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".stop.selected").dataset.level'),'2');
 assert.equal(await run('globalThis.__edgeLevelRequests'),1,'a real level change requests controller reconciliation');
 const sameStop=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelectorAll(".stop")[1].getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:sameStop.x,y:sameStop.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:sameStop.x,y:sameStop.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:sameStop.x,y:sameStop.y,button:'left',clickCount:1});
 await sleep(40);
 assert.equal(await run('globalThis.__edgeLevelRequests'),2,'clicking the selected level still requests reconciliation');
 console.log('PASS: real pointer click switches edge level and reselecting a level can repair stale UI; simulated page clicks are ignored');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:grip.x,y:grip.y});
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".rail")).display'),'flex');
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle"),"::after").visibility'),'visible');
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".hint")).visibility'),'hidden');
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".close")).visibility'),'visible');
 const rightClose=await edgeCloseAlignment();
 assert.ok(rightClose.inside && rightClose.dx <= 1 && Math.abs(rightClose.dy + 7) <= 1,'right-side X must sit 7px above handle center');
 const rightSpacing=await edgeLayout();
 assert.equal(rightSpacing.width,30);
 assert.equal(rightSpacing.height,50);
 assert.ok(Math.abs(rightSpacing.gap-8)<1,'right rail must stand 8px clear of enlarged tab');
 console.log('PASS: hover reveals vertical rail with an X centered on the right tab');
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
 const leftClose=await edgeCloseAlignment();
 assert.ok(leftClose.inside && leftClose.dx <= 1 && Math.abs(leftClose.dy + 7) <= 1,'left-side X must sit 7px above handle center');
 const leftSpacing=await edgeLayout();
 assert.ok(Math.abs(leftSpacing.gap-8)<1,'left rail must stand 8px clear of enlarged tab');
 console.log('PASS: dragging persists opposite edge placement; X stays centered on either side');
 assert.equal(await run('globalThis.__edgeRestoreRequests||0'),0,'drag must not restore the window');
 const movedGrip=await run('(() => {const r=document.querySelector("#clean-window-edge-control").shadowRoot.querySelector(".handle").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+34};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:movedGrip.x,y:movedGrip.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:movedGrip.x,y:movedGrip.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:movedGrip.x,y:movedGrip.y,button:'left',clickCount:1});
 await sleep(30);
 assert.equal(await run('globalThis.__edgeRestoreRequests||0'),0,'the tab handle cannot restore or edit on click');
 console.log('PASS: edge handle drag remains functional; tapping it does not edit title');
 // The red X overlays the handle center and must reject synthetic clicks.
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
 const titleCommand=(action,anchor)=>run('new Promise(resolve=>globalThis.__cwTitleListener('+JSON.stringify({type:'clean-window:title',action,...(anchor?{anchor}:{})})+', {},resolve))');
 const started=await titleCommand('start');
 assert.equal(started.ok,true);
 assert.equal(await run('document.title'),'◈ Clean Window Test');
 console.log('PASS: symbol + original page title without favicon spoofing');

 const opened=await titleCommand('edit',{screenX:900,screenY:350});
 assert.equal(opened.ok,true);
 const editorVisual=await run('(() => {const r=document.querySelector("#clean-window-title-editor").shadowRoot;return {corner:getComputedStyle(r.querySelector(".panel")).borderTopLeftRadius,applyCorner:getComputedStyle(r.querySelector("button.primary")).borderTopLeftRadius}})()');
 assert.equal(editorVisual.corner,'16px');
 assert.equal(editorVisual.applyCorner,'999px');
 assert.equal(await run('document.querySelector("#clean-window-title-editor").dataset.sidecar'),'true');
 assert.equal(await run('getComputedStyle(document.querySelector("#clean-window-title-editor").shadowRoot.querySelector(".panel")).animationName'),'cw-title-sidecar-enter');
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

 // Real CSS/layout checks with a synthetic YouTube DOM, never a logged-in profile.
 await run(`document.body.innerHTML = '<div id="masthead-container" style="height:56px">YouTube header</div><ytd-watch-flexy theater><div id="player-full-bleed-container" style="height:300px"><div id="player-container"><ytd-player><div id="container"><div id="movie_player"><div class="html5-video-container"><video class="html5-main-video" style="width:640px;height:360px"></video></div></div></div></ytd-player></div></div><div id="columns"><div id="primary"><div id="player-container-outer"></div><article id="comments" style="background:rgb(220,230,240);height:500px">Comments</article></div><aside id="secondary">Recommendations</aside></div></ytd-watch-flexy>';globalThis.__youtubeLocation={hostname:'www.youtube.com',pathname:'/watch'};true`);
 await run(`(() => {
   const watch=document.querySelector('ytd-watch-flexy');watch.style.display='block';
   const manager=document.createElement('ytd-page-manager');manager.style.cssText='display:block;margin-top:56px';
   const app=document.createElement('ytd-app');app.style.cssText='display:block;position:absolute;top:0;width:100%';
   watch.before(app);app.append(manager);manager.append(watch);
   const stage=document.querySelector('#player-full-bleed-container');
   const outer=document.createElement('div');outer.id='full-bleed-container';
   outer.style.cssText='display:flex;position:relative;height:300px;max-height:300px';
   stage.before(outer);outer.append(stage);
 })()`);
 await run('(function(location){'+youtubeSource+'})(globalThis.__youtubeLocation);true');
 const youtubeLevel=async level=>{
   assert.equal((await edgeCommand(level)).ok,true);
   await sleep(45);
 };
 const youtubeLayout=()=>run(`(() => {
   const player=document.querySelector('#movie_player').getBoundingClientRect();
   const video=document.querySelector('video').getBoundingClientRect();
   return {mode:document.documentElement.getAttribute('data-clean-window-youtube'),
     inner:[innerWidth,innerHeight],player:{x:player.x,y:player.y,w:player.width,h:player.height},
     video:{w:video.width,h:video.height},overflow:getComputedStyle(document.documentElement).overflowY,
     comments:getComputedStyle(document.querySelector('#comments')).backgroundColor,
     scrollHeight:document.documentElement.scrollHeight,
     columnsTop:document.querySelector('#columns').getBoundingClientRect().top,
     columnsVisibility:getComputedStyle(document.querySelector('#columns')).visibility,
     videoVisibility:getComputedStyle(document.querySelector('video')).visibility,
     header:getComputedStyle(document.querySelector('#masthead-container')).display};
 })()`);
 await youtubeLevel(3);
 let yt=await youtubeLayout();
 assert.equal(yt.mode,'3');
 assert.deepEqual(yt.player,{x:0,y:0,w:yt.inner[0],h:yt.inner[1]});
 assert.equal(yt.video.w,yt.inner[0]);assert.equal(yt.video.h,yt.inner[1]);
 assert.equal(yt.overflow,'hidden');
 assert.equal(yt.columnsVisibility,'hidden','level 3 must hide page content that can paint above the player');
 assert.equal(yt.videoVisibility,'visible');
 await send('Emulation.setDeviceMetricsOverride',{width:900,height:500,deviceScaleFactor:1,mobile:false});
 await sleep(45);yt=await youtubeLayout();
 assert.deepEqual(yt.player,{x:0,y:0,w:900,h:500});
 console.log('PASS: YouTube level 3 fills the viewport and follows resize without the theater height cap');
 await invoke('address');
 await youtubeLevel(2);yt=await youtubeLayout();
 assert.equal(yt.mode,'2');assert.equal(yt.player.h,452);
 assert.ok(yt.columnsTop>=yt.player.y+yt.player.h,'metadata and recommendations must start below the resized theater player');
 assert.equal(yt.player.y,48,'site header spacing must not remain below the drawn bar');
 assert.equal(yt.comments,'rgb(220, 230, 240)');assert.notEqual(yt.overflow,'hidden');
 assert.ok(yt.scrollHeight>yt.inner[1]);
 // Layout uses CSS coordinates, not physical pixels or a captured monitor's DPI.
 await run(`document.querySelector('#clean-window-address-ui').style.setProperty('height','72px','important');true`);
 await sleep(80);yt=await youtubeLayout();
 assert.equal(yt.player.y,72,'measure the rendered toolbar instead of assuming 48px');
 assert.equal(yt.player.h,428);
 for (const display of [
   {width:640,height:720,deviceScaleFactor:1},
   {width:1440,height:900,deviceScaleFactor:1.5},
   {width:1920,height:1080,deviceScaleFactor:2}
 ]) {
   await send('Emulation.setDeviceMetricsOverride',{...display,mobile:false});
   await sleep(80);yt=await youtubeLayout();
   assert.equal(yt.player.y,72);
   const expectedHeight=Math.min(display.height-72,yt.player.w*9/16);
   assert.ok(Math.abs(yt.player.h-expectedHeight)<1,'level 2 uses the video ratio with a viewport height cap');
   assert.equal(yt.columnsVisibility,'visible');
   assert.ok(yt.columnsTop>=yt.player.y+yt.player.h);
 }
 await run(`document.querySelector('#clean-window-address-ui').style.setProperty('display','none','important');true`);
 await sleep(80);yt=await youtubeLayout();
 assert.equal(yt.player.y,0,'a hidden toolbar must not reserve phantom space');
 assert.ok(Math.abs(yt.player.h-Math.min(1080,yt.player.w*9/16))<1);
 await run(`document.querySelector('#clean-window-address-ui').style.removeProperty('display');true`);
 await run(`document.querySelector('#clean-window-address-ui').style.setProperty('height','48px','important');true`);
 await send('Emulation.setDeviceMetricsOverride',{width:900,height:500,deviceScaleFactor:1,mobile:false});
 await sleep(80);
 console.log('PASS: player follows measured toolbar height and multiple viewport sizes/device pixel ratios');
 await run(`document.querySelector('ytd-watch-flexy').removeAttribute('theater');document.querySelector('#full-bleed-container').style.display='none';document.querySelector('#player-container-outer').append(document.querySelector('#player-container'));true`);
 await sleep(45);yt=await youtubeLayout();
 assert.equal(yt.player.h,452,'normal player also fills content below the URL bar');
 await youtubeLevel(3);yt=await youtubeLayout();
 assert.equal(yt.columnsVisibility,'hidden');
 assert.equal(yt.videoVisibility,'visible','normal-mode player remains visible inside the hidden columns');
 await youtubeLevel(2);
 console.log('PASS: YouTube level 2 reserves the rendered toolbar and preserves scrollable comments and page colors');
 // Trusted pointer events exercise preview separately from persisted mode commands.
 await invoke('address');
 await run(`globalThis.__previewCommands=[];globalThis.__previewWrites=[];globalThis.__previewFail=false;
   globalThis.__previewVideo=document.querySelector('video');
   chrome.storage.local.set=async value=>{globalThis.__previewWrites.push(value);};
   chrome.runtime.sendMessage=async message=>{globalThis.__previewCommands.push(message);
     return globalThis.__previewFail?{ok:false,error:'Preview commit failed'}:{ok:true,level:message.level};};
   window.scrollTo(0,100);true`);
 const previewState=()=>run(`(() => {const host=document.querySelector('#clean-window-edge-control');return {
   preview:host.dataset.previewLevel||null,selected:host.shadowRoot.querySelector('.stop.selected').dataset.level,
   mode:document.documentElement.getAttribute('data-clean-window-youtube'),scrollY,
   sameVideo:globalThis.__previewVideo===document.querySelector('video'),
   commands:globalThis.__previewCommands.length,writes:globalThis.__previewWrites.length,
   playerScale:(()=>{const m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#player-container')).transform);return [m.a,m.d];})(),
   animations:document.querySelector('#player-container').getAnimations().length};})()`);
 const hoverMode=async level=>{
   const handle=await run(`(() => {const r=document.querySelector('#clean-window-edge-control').shadowRoot.querySelector('.handle').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+35};})()`);
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',...handle});
   await sleep(30);
   const point=await run(`(() => {const r=document.querySelector('#clean-window-edge-control').shadowRoot.querySelector('.stop[data-level="${level}"]').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
   return point;
 };
 const leaveModes=()=>send('Input.dispatchMouseEvent',{type:'mouseMoved',x:300,y:25});
 const clickPoint=async point=>{
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
   await sleep(50);
 };
 const originalScroll=(await previewState()).scrollY;
 await hoverMode(3);await sleep(190);
 let preview=await previewState();
 assert.equal(preview.preview,'3');assert.equal(preview.selected,'2');assert.equal(preview.mode,'3');
 assert.equal(preview.commands,0);assert.equal(preview.writes,0);assert.ok(preview.animations>0);
 assert.ok(Math.abs(preview.playerScale[0]-preview.playerScale[1])<0.001,'transition must not stretch the video on one axis');
 assert.equal(preview.sameVideo,true);
 await leaveModes();await sleep(80);preview=await previewState();
 assert.equal(preview.preview,null);assert.equal(preview.mode,'2');assert.equal(preview.scrollY,originalScroll);
 console.log('PASS: hover previews with live-player animation, no mode writes, and leave restores mode/scroll');
 await hoverMode(1);await sleep(190);
 assert.equal((await previewState()).mode,null);
 assert.equal(await run('document.querySelector("#clean-window-address-ui").dataset.cwDock'),'true');
 await leaveModes();await sleep(60);
 await hoverMode(1);await sleep(40);await hoverMode(3);await sleep(190);
 assert.equal((await previewState()).mode,'3');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 assert.equal((await previewState()).mode,'2');
 const commitPoint=await hoverMode(3);await sleep(190);
 assert.equal(await run(`document.querySelector('#clean-window-edge-control').shadowRoot.elementFromPoint(${commitPoint.x},${commitPoint.y})?.closest('button')?.dataset.level`),'3','preview feedback must not move the mode button away from the pointer');
 await clickPoint(commitPoint);
 await leaveModes();await sleep(60);preview=await previewState();
 assert.equal(preview.selected,'3');assert.equal(preview.mode,'3');assert.equal(preview.preview,null);
 assert.equal(preview.commands,1,'only the actual click commits a mode');
 await invoke('address');await youtubeLevel(2);
 await run('globalThis.__previewFail=true;true');
 const failPoint=await hoverMode(3);await sleep(190);await clickPoint(failPoint);
 preview=await previewState();assert.equal(preview.mode,'2');assert.equal(preview.selected,'2');
 await leaveModes();await run('globalThis.__previewFail=false;true');
 console.log('PASS: latest hover wins, Escape restores, click commits once, failed commit restores');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await hoverMode(3);await sleep(190);
 assert.equal((await previewState()).animations,0);
 await leaveModes();await sleep(40);
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await hoverMode(3);await sleep(190);
 await send('Emulation.setPageScaleFactor',{pageScaleFactor:1.2});
 await sleep(60);assert.equal((await previewState()).preview,null,'pinch scaling cancels a preview');
 await send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
 await leaveModes();await sleep(40);
 await hoverMode(3);await sleep(190);
 await run(`document.dispatchEvent(new Event('yt-navigate-start'));true`);
 assert.equal((await previewState()).preview,null);
 await leaveModes();
 await hoverMode(3);await sleep(190);
 await send('Emulation.setDeviceMetricsOverride',{width:880,height:510,deviceScaleFactor:1,mobile:false});
 await sleep(70);assert.equal((await previewState()).preview,null);
 await leaveModes();
 await hoverMode(3);await sleep(190);
 await invoke('off');await edgeCommand('off');
 assert.equal(await run('!!document.querySelector("#clean-window-address-ui")'),false,'Restore must not resurrect a preview toolbar');
 await invoke('address');await youtubeLevel(2);await leaveModes();
 console.log('PASS: reduced motion, resize cancellation and Restore during preview leave no stale UI');
 await youtubeLevel(1);yt=await youtubeLayout();
 assert.equal(yt.mode,null);assert.notEqual(yt.header,'none');
 assert.equal(await run('!!document.getElementById("clean-window-youtube-style")'),false);
 await youtubeLevel(3);
 await run(`globalThis.__youtubeLocation.pathname='/results';document.dispatchEvent(new Event('yt-navigate-finish'));true`);
 await sleep(45);assert.equal((await youtubeLayout()).mode,null);
 await run(`globalThis.__youtubeLocation.pathname='/watch';document.dispatchEvent(new Event('yt-navigate-finish'));true`);
 await sleep(45);assert.equal((await youtubeLayout()).mode,'3');
 await run(`Object.defineProperty(document,'fullscreenElement',{configurable:true,value:document.querySelector('#movie_player')});document.dispatchEvent(new Event('fullscreenchange'));true`);
 await sleep(45);assert.equal((await youtubeLayout()).mode,null);
 await run(`delete document.fullscreenElement;document.dispatchEvent(new Event('fullscreenchange'));true`);
 await sleep(45);assert.equal((await youtubeLayout()).mode,'3');
 await edgeCommand('off');
 assert.equal((await youtubeLayout()).mode,null);
 await run(`globalThis.__youtubeLocation.hostname='youtube.com.example.test';true`);
 await youtubeLevel(3);assert.equal((await youtubeLayout()).mode,null);
 await edgeCommand('off');await invoke('off');
 await send('Emulation.clearDeviceMetricsOverride');
 console.log('PASS: YouTube level 1/restore clean up, SPA route and fullscreen transitions recover, lookalike hosts stay unchanged');

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
 const headerLayout=await run('(() => {const h=document.querySelector("header");return {height:getComputedStyle(h).height,headerGap:document.querySelector("main").getBoundingClientRect().top-h.getBoundingClientRect().bottom,decorative:document.querySelectorAll(".mark,.lock,.scope-win,.scope-pips").length,restore:!!h.querySelector("#restore"),theme:!!h.querySelector("#theme-toggle"),status:!!h.querySelector("#target-status"),feedback:!!h.querySelector("#feedback-icon")}})()');
 assert.equal(headerLayout.height,'68px');
 assert.ok(headerLayout.headerGap >= 8 && headerLayout.headerGap <= 18,'allow one small intentional breathing gap below the taller header');
 assert.equal(headerLayout.decorative,0,'nonfunctional top decoration must be removed');
 assert.ok(headerLayout.restore && headerLayout.theme && headerLayout.status && headerLayout.feedback);
 console.log('PASS: balanced one-row popup header retains actions with restored breathing room');
 const demoHandle=await run('(() => {const r=document.querySelector(".edge-tab .et-handle").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:demoHandle.x,y:demoHandle.y});
 let tooltipVisible=false;
 for(let i=0;i<12 && !tooltipVisible;i++) {
   await sleep(25);
   tooltipVisible=await run('getComputedStyle(document.querySelector(".et-tooltip")).visibility==="visible"');
 }
 assert.ok(tooltipVisible,'preview-tab hover must reveal its help text');
 const popupSpacing=await run(`(() => {
   const box=s=>document.querySelector(s).getBoundingClientRect();
   const tip=box(".et-tooltip"),shots=box(".shots"),rail=box(".et-rail");
   const pill=box(".morph-wrap"),tools=box(".hdr-tools");
   const hint=getComputedStyle(document.querySelector(".et-tooltip"));
   return {
     tip:{top:tip.top,right:tip.right,bottom:tip.bottom},
     shots:{top:shots.top},
     rail:{left:rail.left,top:rail.top,bottom:rail.bottom},
     pill:{top:pill.top,right:pill.right},
     tools:{left:tools.left},
     hintVisible:hint.visibility,
     tipPosition:hint.position,
     tipAboveIllustration:shots.top-tip.bottom,
     railAbovePill:pill.top-rail.bottom
   };
 })()`);
 assert.equal(popupSpacing.hintVisible,'visible','preview-tab hover should reveal help');
 assert.equal(popupSpacing.tipPosition,'fixed');
 assert.ok(popupSpacing.tipAboveIllustration>=4,'help text must stay in its own upper lane');
 assert.ok(popupSpacing.tip.right+8 < popupSpacing.tools.left,'help text must not cover header controls');
 assert.ok(popupSpacing.railAbovePill>=5,'preview mode rail must maintain a visible gap above the black mode button');
 console.log('PASS: hover tooltip stays clear of toolbar and illustration; mode rail avoids the black button');
 await run('document.documentElement.dataset.theme="dark";true');
 assert.equal(await run('getComputedStyle(document.body).backgroundColor'),'rgb(32, 33, 36)');
 await run('document.querySelector("#theme-toggle").click();true');
 assert.equal(await run('getComputedStyle(document.body).backgroundColor'),'rgb(246, 245, 241)');
 console.log('PASS: dark popup uses elevated deep-grey background while theme switch stays active');
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
 assert.deepEqual(sequence,['edit-title','focus']);
 assert.equal(await run('globalThis.__cwPopupMsgs.find(m=>m.action==="edit-title")?.anchor?.screenY>0'),true);
 console.log('PASS: popup EDIT opens anchored sidecar before focusing its managed window');
 console.log('SMOKE PASS: popup managed-list title, marquee and edit actions; real MV3 reload remains unverified');
 // Synthetic viewport-locked AI layouts: sidebar bottom controls must survive.
 const fixtureHTML='<!doctype html><html><head><style>html,body{margin:0;padding:0}#app{display:flex;height:100vh}#side{width:200px;height:100%;display:flex;flex-direction:column}#main{flex:1;height:100%;display:flex;flex-direction:column}.bottom{height:48px;margin-top:auto}</style></head><body><div id="app"><nav id="side"><button>menu</button><button class="bottom">settings</button></nav><main id="main"><button>new chat</button><button class="bottom">send</button></main></div></body></html>';
 const workspaceFixture=async (hostname,height=650)=>{
   const expr=`(() => {
     const frame=document.createElement('iframe');
     frame.style.cssText='position:absolute;top:0;left:0;width:900px;height:650px;border:0';
     frame.style.height=${height}+'px';
     document.body.append(frame);
     const d=frame.contentDocument;d.open();d.write(${JSON.stringify(fixtureHTML)});d.close();
     const w=frame.contentWindow;
     w.chrome={storage:{local:{async get(){return{}},async set(){}}},runtime:{onMessage:{addListener(){}}}};
     w.__cwLocation={protocol:'https:',hostname:${JSON.stringify(hostname)},href:'https://'+${JSON.stringify(hostname)}+'/',origin:'https://'+${JSON.stringify(hostname)}};
     w.eval(${JSON.stringify('((location)=>{'+source+'})(globalThis.__cwLocation)')});
     const before=d.documentElement.style.paddingTop;
     w.__cleanWindowPageUI.apply('address-dock');
     const bar=d.getElementById('clean-window-address-ui');
     const result={
       workspace:bar.dataset.cwWorkspace,
       before,after:d.documentElement.style.paddingTop,
       height:w.innerHeight,scroll:d.documentElement.scrollHeight,
       side:d.querySelector('#side .bottom').getBoundingClientRect().bottom,
       send:d.querySelector('#main .bottom').getBoundingClientRect().bottom,
       leftClear:d.elementFromPoint(12,2)!==bar,
       peek:d.elementFromPoint(450,2)===bar
     };
     bar.focus();result.focused=bar.matches(':focus-within');bar.blur();
     w.__cleanWindowPageUI.apply('address');
     result.addressHeight=d.getElementById('clean-window-address-ui').dataset.cwHeight;
     result.addressPadding=d.documentElement.style.paddingTop;
     result.addressClip=w.getComputedStyle(d.getElementById('clean-window-address-ui')).clipPath;
     w.__cleanWindowPageUI.apply('off');
     result.restored=d.documentElement.style.paddingTop;
     frame.remove();
     return result;
   })()`;
   return run(expr);
 };
 for(const host of ['gemini.google.com','claude.ai','www.claude.ai',
                    'chatgpt.com','www.chatgpt.com','chat.openai.com']){
   const r=await workspaceFixture(host);
   assert.equal(r.workspace,'true',host);
   assert.equal(r.after,r.before,host+' must not shift document root');
   assert.equal(r.addressPadding,r.before,host+' level 2 must not shift root');
   assert.equal(r.restored,r.before,host+' restore must preserve original padding');
   assert.equal(r.addressHeight,'48');
   assert.equal(r.addressClip,'none',host+' level 2 remains visible instead of collapsing to the level-1 handle');
   assert.ok(r.side<=r.height+1 && r.send<=r.height+1,host+' bottom controls visible');
   assert.ok(r.scroll<=r.height+1,host+' no unwanted root scroll');
   assert.equal(r.leftClear,true,host+' native left controls accessible');
   assert.equal(r.peek,true,host+' toolbar handle accessible');
   assert.equal(r.focused,true,host+' keyboard toolbar expansion');
 }
 for(const height of [360,500,780]) {
   for(const host of ['gemini.google.com','claude.ai','chatgpt.com']) {
     const r=await workspaceFixture(host,height);
     assert.equal(r.after,r.before,host+' '+height+'px root unchanged');
     assert.ok(r.side<=r.height+1 && r.send<=r.height+1,host+' '+height+'px bottom actions');
     assert.ok(r.scroll<=r.height+1,host+' '+height+'px no overflow');
   }
 }
 const lookalike=await workspaceFixture('gemini.google.com.example.com');
 assert.equal(lookalike.workspace,'false');
 assert.equal(lookalike.after,lookalike.before,'level 1 overlay should not reserve an empty page gap on ordinary pages');
 assert.notEqual(lookalike.addressPadding,lookalike.before,'level 2 should reserve its visible address bar on ordinary pages');
 assert.equal(lookalike.restored,lookalike.before);
 console.log('PASS: Gemini/Claude/ChatGPT preserve viewport-locked navigation, bottom actions and accessible toolbar handle');

 // Exercise the real site-access page script in Chrome's DOM with a bounded API stub.
 const siteAccessBody=siteAccessHTML.split('<body>')[1]?.split('</body>')[0];
 assert.ok(siteAccessBody,'site-access page body fixture missing');
 const initSiteAccess=(grant,patterns=['https://destination.example/*'])=>`document.body.innerHTML=${JSON.stringify(siteAccessBody)};globalThis.__cwSiteAccessMessages=[];globalThis.__cwSiteAccessClosed=false;globalThis.__cwPermissionGrant=${grant};globalThis.__cwRequestedOrigins=[];globalThis.__cwAccessPatterns=${JSON.stringify(patterns)};window.close=()=>{globalThis.__cwSiteAccessClosed=true;};globalThis.chrome={runtime:{async sendMessage(message){globalThis.__cwSiteAccessMessages.push(message);if(message.type==='clean-window:site-access-info')return {ok:true,host:'destination.example',originPatterns:globalThis.__cwAccessPatterns};return {ok:true};}},permissions:{async request(query){globalThis.__cwRequestedOrigins=query.origins;return globalThis.__cwPermissionGrant;}}};true`;
 const runSiteAccess=()=>run('(function(location){'+siteAccessSource+'})({href:'+JSON.stringify('chrome-extension://abcdefghijklmnopabcdefghijklmnop/site-access.html?token=12345678-1234-4234-8234-123456789abc')+'});true');
 await run(initSiteAccess(true));await runSiteAccess();await sleep(25);
 assert.equal(await run('document.querySelector("#target-host").textContent'),'destination.example');
 await run('document.querySelector("#allow").click();true');await sleep(35);
 assert.deepEqual(await run('globalThis.__cwRequestedOrigins'),['https://destination.example/*']);
 assert.equal(await run('globalThis.__cwSiteAccessMessages.some(m=>m.type==="clean-window:site-access-complete")'),true);
 assert.equal(await run('globalThis.__cwSiteAccessClosed'),true);
 console.log('PASS: site-access UI requests only the displayed hostname and continues after explicit approval');
 const httpUpgradePatterns=['http://destination.example/*','https://destination.example/*'];
 await run(initSiteAccess(true,httpUpgradePatterns));await runSiteAccess();await sleep(25);
 assert.match(await run('document.querySelector("#scope-note").textContent'),/HTTP 與 HTTPS/);
 await run('document.querySelector("#allow").click();true');await sleep(35);
 assert.deepEqual(await run('globalThis.__cwRequestedOrigins'),httpUpgradePatterns);
 assert.equal(await run('globalThis.__cwSiteAccessMessages.some(m=>m.type==="clean-window:site-access-complete")'),true);
 assert.equal(await run('globalThis.__cwSiteAccessClosed'),true);
 console.log('PASS: HTTP targets explicitly request the same host over HTTP and HTTPS for common scheme-upgrade redirects');
 await run(initSiteAccess(false));await runSiteAccess();await sleep(25);
 await run('document.querySelector("#allow").click();true');await sleep(25);
 assert.match(await run('document.querySelector("#status").textContent'),/尚未授權/);
 assert.equal(await run('document.querySelector("#continue").disabled'),false);
 await run('document.querySelector("#continue").click();true');await sleep(25);
 assert.equal(await run('globalThis.__cwSiteAccessMessages.some(m=>m.type==="clean-window:site-access-continue")'),true);
 assert.equal(await run('globalThis.__cwSiteAccessClosed'),true);
 console.log('PASS: denied site access does not navigate automatically; explicit no-permission continuation works');
 await run(initSiteAccess(true));await runSiteAccess();await sleep(25);
 await run('document.querySelector("#cancel").click();true');await sleep(25);
 assert.equal(await run('globalThis.__cwSiteAccessMessages.some(m=>m.type==="clean-window:site-access-cancel")'),true);
 assert.equal(await run('globalThis.__cwSiteAccessClosed'),true);
 console.log('PASS: cancel closes the access prompt without issuing a navigation');

} finally {
 try{ws?.close();}catch{}
 try{processHandle?.kill();}catch{}
 await new Promise(resolve=>server.close(resolve));
 await sleep(450);
 await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:150}).catch(()=>{});
}
