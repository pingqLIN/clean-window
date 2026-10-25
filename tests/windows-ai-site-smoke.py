import os, subprocess, time, shutil, json, socket, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from pywinauto import Desktop
from pywinauto.keyboard import send_keys
ROOT=Path(__file__).resolve().parents[1]
EXTENSION=(ROOT/'dist/runtime').resolve()
chrome_candidates=[Path(os.environ.get('LOCALAPPDATA',''))/'Google/Chrome/Application/chrome.exe',Path(os.environ.get('PROGRAMFILES','C:\\Program Files'))/'Google/Chrome/Application/chrome.exe',Path(os.environ.get('PROGRAMFILES(X86)','C:\\Program Files (x86)'))/'Google/Chrome/Application/chrome.exe']
chrome=next((p for p in chrome_candidates if p.is_file()),None)
if chrome is None: raise RuntimeError('Chrome Stable executable was not found in standard Windows install paths')
if not (EXTENSION/'manifest.json').is_file(): raise RuntimeError(f'Missing runtime manifest: {EXTENSION}')
with socket.socket() as listener:
  listener.bind(('127.0.0.1',0)); port=listener.getsockname()[1]
profile=Path(tempfile.mkdtemp(prefix='clean-window-ai-site-',dir=str(ROOT/'local')))
proc=None
def until(fn,predicate,timeout=8):
  end=time.monotonic()+timeout
  value=None
  while time.monotonic()<end:
    value=fn()
    if predicate(value): return value
    time.sleep(.1)
  raise AssertionError(f'Condition not met; last value={value!r}')
try:
  proc=subprocess.Popen([str(chrome),f'--user-data-dir={profile}',f'--remote-debugging-port={port}','--remote-debugging-address=127.0.0.1','--no-first-run','--no-default-browser-check'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  with sync_playwright() as p:
    browser=None
    for _ in range(50):
      try: browser=p.chromium.connect_over_cdp(f'http://127.0.0.1:{port}',timeout=1000); break
      except Exception: time.sleep(.2)
    if browser is None: raise RuntimeError('Chrome Stable CDP endpoint did not become ready')
    context=browser.contexts[0]
    manager_page=context.pages[0]
    manager_page.goto('chrome://extensions/',wait_until='domcontentloaded',timeout=10000)
    manager_page.wait_for_timeout(500)
    manager_page.evaluate("document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#devMode').click()")
    manager_page.wait_for_timeout(200)
    assert manager_page.evaluate("document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#devMode').getAttribute('aria-checked')")=='true'
    manager_page.evaluate("document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#loadUnpacked').click()")
    desktop=Desktop(backend='uia')
    manager_window=desktop.window(process=proc.pid,class_name='Chrome_WidgetWin_1')
    manager_window.wait('visible',timeout=12)
    dialog=None
    for title in ['選取擴充功能目錄。','Select the extension directory.','Select the extension directory']:
      candidate=manager_window.child_window(title=title,control_type='Window')
      try:
        if candidate.exists(timeout=0): dialog=candidate; break
      except Exception: pass
    if dialog is None: raise RuntimeError('Could not find the Chrome Load unpacked folder picker. Supported UI titles: Traditional Chinese and English.')
    dialog.wait('visible',timeout=12)
    dialog.set_focus(); dialog.type_keys('%d'); time.sleep(.2)
    dialog.type_keys(str(EXTENSION),with_spaces=True); dialog.type_keys('{ENTER}'); time.sleep(1)
    try:
      print('FOLDER_NAVIGATION',dialog.child_window(auto_id='1001',control_type='ToolBar').element_info.name,dialog.child_window(auto_id='1152',control_type='Edit').get_value(),flush=True)
    except Exception as e: print('FOLDER_NAVIGATION_INFO',str(e)[:200],flush=True)
    dialog.child_window(auto_id='1',control_type='Button').click_input()
    info=[]; extension_id=None
    for _ in range(75):
      info=manager_page.evaluate("(()=>{const m=document.querySelector('extensions-manager');const l=m?.shadowRoot?.querySelector('#itemsList');const items=l?.shadowRoot?[...l.shadowRoot.querySelectorAll('extensions-item')]:[];return items.map(i=>({id:i.id,name:i.data?.name,version:i.data?.version,enabled:i.data?.state}))})()")
      extension_id=next((x['id'] for x in info if x.get('name')=='Clean Window｜乾淨視窗'),None)
      if extension_id: break
      time.sleep(.2)
    if not extension_id: raise RuntimeError(f'Runtime extension was not loaded by Chrome Stable; cards={json.dumps(info,ensure_ascii=False)}')
    print('PASS: Chrome Stable loaded dist/runtime',json.dumps(next(x for x in info if x['id']==extension_id),ensure_ascii=False),flush=True)
    controller=context.new_page()
    controller.goto(f'chrome-extension://{extension_id}/popup.html',wait_until='domcontentloaded',timeout=10000)
    controller.wait_for_selector('button:not([disabled])',timeout=10000)
    shortcuts=controller.evaluate('chrome.commands.getAll()')
    shortcut_map={x['name']:x.get('shortcut','') for x in shortcuts}
    expected={'toggle-clean':'Alt+Shift+Y','toggle-fullscreen':'Alt+Shift+F','restore':'Alt+Shift+U','edit-title':'Alt+Shift+J'}
    assert all(shortcut_map.get(k)==v for k,v in expected.items()),shortcut_map
    print('PASS: all four shortcut defaults registered in Chrome Stable',json.dumps(shortcut_map,ensure_ascii=False),flush=True)
    chrome_window=desktop.window(process=proc.pid,class_name='Chrome_WidgetWin_1')
    chrome_window.wait('visible',timeout=8)
    def layout_metrics(page):
      return page.evaluate("""() => {
        const html=document.documentElement;
        const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
        const bar=document.getElementById('clean-window-address-ui');
        const r=bar?.getBoundingClientRect();
        const regions=[...document.querySelectorAll('nav,aside,[role=navigation]')].filter(visible).slice(0,10).map(e=>{const b=e.getBoundingClientRect();return {tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),width:Math.round(b.width),height:Math.round(b.height),left:Math.round(b.left),top:Math.round(b.top)}});
        return {host:location.hostname,path:location.pathname,readyState:document.readyState,timeOrigin:performance.timeOrigin,title:document.title.slice(0,100),rootInlinePadding:html.style.getPropertyValue('padding-top'),rootComputedPadding:getComputedStyle(html).paddingTop,rootClientHeight:html.clientHeight,rootScrollHeight:html.scrollHeight,loginPromptVisible:/sign in|log in|登入|登录/i.test(document.body?.innerText||''),navigationRegions:regions,bar:bar?{height:Math.round(r.height),top:Math.round(r.top),dock:bar.dataset.cwDock,hidden:bar.dataset.cwHidden,workspace:bar.dataset.cwWorkspace}:null};
      }""")
    def nav_signature(metrics):
      return [(r['tag'],r['role'],r['label'],r['width'],r['left'],r['top']) for r in metrics['navigationRegions']]
    sites=[('Gemini','https://gemini.google.com/','gemini.google.com'),('Claude','https://claude.ai/','claude.ai'),('ChatGPT','https://chatgpt.com/','chatgpt.com')]
    results=[]
    for name,url,expected_host in sites:
      # This profile persists the last selected level across tabs; reset explicitly so every site's first pass starts at L1.
      controller.evaluate("() => chrome.storage.local.set({cleanLevel:1})")
      target=context.new_page()
      print('SITE_START',name,url,flush=True)
      try:
        target.goto(url,wait_until='domcontentloaded',timeout=35000)
        target.wait_for_timeout(3500)
        initial=layout_metrics(target)
        print('SITE_INITIAL',json.dumps({'name':name,**initial},ensure_ascii=False),flush=True)
        if initial['host']!=expected_host and not (name=='Claude' and initial['host']=='www.claude.ai'):
          print('SITE_SKIP_REDIRECT',json.dumps({'name':name,'expectedHost':expected_host,'actualHost':initial['host'],'path':initial['path']},ensure_ascii=False),flush=True)
          results.append({'name':name,'status':'SKIP_REDIRECT','host':initial['host']})
          target.close(); continue
        target.evaluate("""() => { window.__cwBarTrace=[]; const collect=n=>{if(n.nodeType!==1)return [];const out=[];if((n.id||'').startsWith('clean-window-address-ui'))out.push({id:n.id,tag:n.tagName});for(const e of n.querySelectorAll?.('[id]')||[])if((e.id||'').startsWith('clean-window-address-ui'))out.push({id:e.id,tag:e.tagName});return out;};const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'){if((r.target.id||'').startsWith('clean-window-address-ui'))window.__cwBarTrace.push({t:Math.round(performance.now()),kind:'id-change',id:r.target.id});continue;}for(const n of r.addedNodes)for(const e of collect(n))window.__cwBarTrace.push({t:Math.round(performance.now()),kind:'add',...e});for(const n of r.removedNodes)for(const e of collect(n))window.__cwBarTrace.push({t:Math.round(performance.now()),kind:'remove',...e});}});observer.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['id']});window.__cwBarTraceObserver=observer; }""")
        target.bring_to_front(); time.sleep(.3)
        source=controller.evaluate("(async()=>{const t=(await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0];return {tabId:t.id,windowId:t.windowId}})()")
        chrome_window.set_focus(); send_keys('%+y',pause=0.05)
        moved=until(lambda:controller.evaluate('id=>chrome.tabs.get(id)',source['tabId']),lambda t:t['windowId']!=source['windowId'])
        popup_id=moved['windowId']
        target.wait_for_timeout(700)
        level1=layout_metrics(target)
        print('SITE_L1_TRACE',json.dumps({'name':name,'trace':target.evaluate('window.__cwBarTrace||[]')},ensure_ascii=False),flush=True)
        assert level1['bar'] and level1['bar']['dock']=='true' and level1['bar']['workspace']=='true',f'{name}: L1 workspace bar not detected: {level1}'
        assert level1['timeOrigin']==initial['timeOrigin'],f'{name}: L1 caused a document navigation: {initial} -> {level1}'
        assert nav_signature(level1)==nav_signature(initial),f'{name}: L1 changed visible navigation regions: {initial} -> {level1}'
        assert level1['rootInlinePadding']==initial['rootInlinePadding'],f'{name}: L1 changed inline root padding: {initial} -> {level1}'
        print('SITE_L1_PASS',json.dumps({'name':name,**level1},ensure_ascii=False),flush=True)
        level2result=controller.evaluate('arg=>chrome.runtime.sendMessage({type:"clean-window:hub",...arg})',{'action':'set-level','level':2,'target':{'windowId':popup_id,'tabId':source['tabId']}})
        assert level2result.get('ok'),f'{name}: L2 failed: {level2result}'
        target.wait_for_timeout(500)
        level2=layout_metrics(target)
        assert level2['bar'] and level2['bar']['dock']=='false' and level2['bar']['hidden']=='true' and level2['bar']['workspace']=='true',f'{name}: L2 workspace bar not detected: {level2}'
        assert level2['rootInlinePadding']==initial['rootInlinePadding'],f'{name}: L2 changed inline root padding: {initial} -> {level2}'
        assert level2['timeOrigin']==initial['timeOrigin'],f'{name}: L2 caused a document navigation: {initial} -> {level2}'
        assert nav_signature(level2)==nav_signature(initial),f'{name}: L2 changed visible navigation regions: {initial} -> {level2}'
        print('SITE_L2_PASS',json.dumps({'name':name,**level2},ensure_ascii=False),flush=True)
        level3result=controller.evaluate('arg=>chrome.runtime.sendMessage({type:"clean-window:hub",...arg})',{'action':'set-level','level':3,'target':{'windowId':popup_id,'tabId':source['tabId']}})
        assert level3result.get('ok'),f'{name}: L3 failed: {level3result}'
        target.wait_for_timeout(300)
        level3=layout_metrics(target)
        assert level3['bar'] is None,f'{name}: L3 left top bar behind: {level3}'
        assert level3['rootInlinePadding']==initial['rootInlinePadding'],f'{name}: L3 changed inline root padding: {initial} -> {level3}'
        assert level3['timeOrigin']==initial['timeOrigin'],f'{name}: L3 caused a document navigation: {initial} -> {level3}'
        assert nav_signature(level3)==nav_signature(initial),f'{name}: L3 changed visible navigation regions: {initial} -> {level3}'
        print('SITE_L3_PASS',json.dumps({'name':name,**level3},ensure_ascii=False),flush=True)
        popup_native=desktop.window(title=target.title(),process=proc.pid)
        popup_native.wait('visible',timeout=8); popup_native.set_focus(); send_keys('%+u',pause=0.05)
        restored=until(lambda:controller.evaluate('id=>chrome.tabs.get(id)',source['tabId']),lambda t:t['windowId']==source['windowId'])
        assert restored['id']==source['tabId']
        target.wait_for_timeout(400)
        final=layout_metrics(target)
        assert final['bar'] is None,f'{name}: toolbar remained after restore: {final}'
        assert final['rootInlinePadding']==initial['rootInlinePadding'],f'{name}: root padding was not restored: {initial} -> {final}'
        assert final['timeOrigin']==initial['timeOrigin'],f'{name}: Restore caused a document navigation: {initial} -> {final}'
        assert nav_signature(final)==nav_signature(initial),f'{name}: Restore changed visible navigation regions: {initial} -> {final}'
        print('SITE_RESTORE_PASS',json.dumps({'name':name,'final':final},ensure_ascii=False),flush=True)
        results.append({'name':name,'status':'PASS','host':final['host'],'signedOutLikely':final['loginPromptVisible'],'visibleNavigationRegions':len(final['navigationRegions'])})
      except Exception as e:
        print('SITE_FAIL',json.dumps({'name':name,'error':str(e)[:800]},ensure_ascii=False),flush=True)
        results.append({'name':name,'status':'FAIL','error':str(e)[:500]})
        try:
          active=controller.evaluate("(async()=>{const t=(await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0];return {tabId:t.id,windowId:t.windowId}})()")
          if active.get('tabId'):
            try: native=desktop.window(title=target.title(),process=proc.pid)
            except Exception: native=desktop.window(process=proc.pid,class_name='Chrome_WidgetWin_1')
            native.set_focus(); send_keys('%+u',pause=0.05); time.sleep(.5)
        except Exception: pass
      finally:
        try: target.close()
        except Exception: pass
    print('AI_SITE_SUMMARY',json.dumps(results,ensure_ascii=False),flush=True)
    if not any(x['status']=='PASS' for x in results): raise AssertionError('No AI website produced a usable smoke-test result')
    if any(x['status']=='FAIL' for x in results): raise AssertionError('One or more AI website smoke checks failed')
finally:
  if proc is not None:
    try: proc.terminate(); proc.wait(timeout=4)
    except Exception:
      try: proc.kill()
      except Exception: pass
    time.sleep(.4)
  if profile.exists(): shutil.rmtree(profile,ignore_errors=True)
