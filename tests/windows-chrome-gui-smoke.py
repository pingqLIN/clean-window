import os, subprocess, time, shutil, json, threading
import win32gui, win32process
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from pywinauto import Desktop
from pywinauto.keyboard import send_keys
ROOT=Path(__file__).resolve().parents[1]
EXTENSION=(ROOT/'dist/runtime').resolve()
chrome=Path(os.environ['LOCALAPPDATA'])/'Google/Chrome/Application/chrome.exe'
profile=ROOT/'local/chrome-stable-window-profile'
EVIDENCE=ROOT/'evidence'; EVIDENCE.mkdir(exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
  def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT/'tests')))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/fixture.html'
port=9232
if not (EXTENSION/'manifest.json').is_file(): raise RuntimeError(f'Missing runtime manifest: {EXTENSION}')
if profile.exists(): shutil.rmtree(profile)
proc=subprocess.Popen([str(chrome),f'--user-data-dir={profile}',f'--remote-debugging-port={port}','--no-first-run','--no-default-browser-check'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def until(fn,predicate,timeout=8):
  end=time.monotonic()+timeout
  value=None
  while time.monotonic()<end:
    value=fn()
    if predicate(value): return value
    time.sleep(.1)
  raise AssertionError(f'Condition not met; last value={value!r}')
try:
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
    target=context.new_page(); target.goto(base,wait_until='domcontentloaded',timeout=10000)
    target.evaluate("window.sessionToken='stable-window-smoke-token';document.querySelector('textarea').value='未儲存草稿：Chrome Stable 實機驗收 24680';true")
    token=target.evaluate('window.sessionToken')
    unsaved=target.locator('textarea').input_value()
    target.bring_to_front(); time.sleep(.3)
    source=controller.evaluate("(async()=>{const t=(await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0];const spare=await chrome.tabs.create({windowId:t.windowId,url:'about:blank',active:false});return {tabId:t.id,windowId:t.windowId,spareTabId:spare.id}})()")
    print('SOURCE',json.dumps(source),flush=True)
    assert target.evaluate('window.sessionToken')==token
    chrome_window=desktop.window(process=proc.pid,class_name='Chrome_WidgetWin_1')
    chrome_window.wait('visible',timeout=8)
    chrome_window.set_focus(); send_keys('%+y',pause=0.05)
    print('OS_KEYBOARD_SENT=Alt+Shift+Y',flush=True)
    moved=until(lambda:controller.evaluate('id=>chrome.tabs.get(id)',source['tabId']),lambda t:t['windowId']!=source['windowId'])
    popup_id=moved['windowId']
    print('PASS: OS-level keyboard input triggered toggle-clean',json.dumps({'tabId':moved['id'],'windowId':popup_id,'sourceWindowId':source['windowId']},ensure_ascii=False),flush=True)
    win=controller.evaluate('id=>chrome.windows.get(id)',popup_id)
    assert win['type']=='popup',win
    assert moved['id']==source['tabId'] and moved['url']==base
    assert controller.evaluate('id=>chrome.tabs.query({windowId:id})',source['windowId'])
    source_after=controller.evaluate('id=>chrome.windows.get(id)',source['windowId'])
    source_tabs=controller.evaluate('id=>chrome.tabs.query({windowId:id})',source['windowId'])
    assert source_after['type']=='normal' and any(t['id']==source['spareTabId'] for t in source_tabs)
    assert target.evaluate('window.sessionToken')==token
    assert target.locator('textarea').input_value()==unsaved
    ui_present=target.evaluate("!!document.getElementById('clean-window-address-ui')")
    print('PASS: Chrome Stable created a native popup window',json.dumps({'window':{k:win.get(k) for k in ['id','type','state','left','top','width','height']},'toolbarInjected':ui_present,'pageStatePreserved':True,'otherTabPreserved':True},ensure_ascii=False),flush=True)
    native_windows=[]
    def collect_window(hwnd,_):
      try:
        if not win32gui.IsWindowVisible(hwnd): return
        title=win32gui.GetWindowText(hwnd)
        _,pid=win32process.GetWindowThreadProcessId(hwnd)
        if title and (pid==proc.pid or 'Clean Window' in title or 'Google Chrome' in title):
          rect=win32gui.GetWindowRect(hwnd)
          native_windows.append({'hwnd':hwnd,'pid':pid,'title':title,'rect':rect})
      except Exception: pass
    win32gui.EnumWindows(collect_window,None)
    print('WIN32_WINDOWS',json.dumps(native_windows,ensure_ascii=False),flush=True)
    native_popup=next((w for w in native_windows if 'Clean Window test page' in w['title']),None)
    if native_popup:
      native=desktop.window(handle=native_popup['hwnd'])
      controls=[x.element_info.name for x in native.descendants() if x.element_info.control_type=='Button' and x.element_info.name in ['最小化','放到最大','關閉']]
      print('NATIVE_POPUP_TITLEBAR',json.dumps({'title':native_popup['title'],'rect':native_popup['rect'],'titlebarButtons':controls},ensure_ascii=False),flush=True)
      try: native.wrapper_object().capture_as_image().save(str(EVIDENCE/'chrome-stable-clean-popup.png')); print('NATIVE_POPUP_CAPTURE=PASS',flush=True)
      except Exception as e: print('WINDOW_CAPTURE_SKIPPED',str(e)[:200],flush=True)
    popup_native=desktop.window(title_re='.*Clean Window test page.*',process=proc.pid)
    popup_native.wait('visible',timeout=8); popup_native.set_focus(); send_keys('%+j',pause=0.05)
    editor=until(lambda:target.evaluate("!!document.getElementById('clean-window-title-editor')"),lambda x:x is True)
    print('PASS: OS-level Alt+Shift+J opened title editor in the managed clean Popup',editor,flush=True)
    popup_native.set_focus(); send_keys('%+u',pause=0.05)
    print('OS_KEYBOARD_SENT=Alt+Shift+U',flush=True)
    restored_tab=until(lambda:controller.evaluate('id=>chrome.tabs.get(id)',source['tabId']),lambda t:t['windowId']==source['windowId'])
    assert restored_tab['id']==source['tabId']
    assert target.evaluate('window.sessionToken')==token
    assert target.locator('textarea').input_value()==unsaved
    assert not target.evaluate("!!document.getElementById('clean-window-title-editor')")
    print('PASS: OS-level Alt+Shift+U restored the same tab, closed the title editor and preserved unsaved page state',flush=True)
    chrome_window.set_focus(); send_keys('%+f',pause=0.05)
    fullscreen=until(lambda:controller.evaluate('id=>chrome.windows.get(id)',source['windowId']),lambda w:w.get('state')=='fullscreen')
    print('PASS: OS-level Alt+Shift+F entered fullscreen',json.dumps({k:fullscreen.get(k) for k in ['id','state','type']},ensure_ascii=False),flush=True)
    send_keys('%+f',pause=0.05)
    normal=until(lambda:controller.evaluate('id=>chrome.windows.get(id)',source['windowId']),lambda w:w.get('state')!='fullscreen')
    print('PASS: second Alt+Shift+F exited fullscreen',json.dumps({k:normal.get(k) for k in ['id','state','type']},ensure_ascii=False),flush=True)
    assert target.evaluate('window.sessionToken')==token and target.locator('textarea').input_value()==unsaved
finally:
  try: proc.terminate(); proc.wait(timeout=4)
  except Exception: proc.kill()
  time.sleep(.4)
  if profile.exists(): shutil.rmtree(profile,ignore_errors=True)
  server.shutdown()
