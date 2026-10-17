"""Development-only headed Chromium test in an isolated temporary profile.
Run on Linux: xvfb-run -a -s '-screen 0 1920x1080x24' sh -c 'openbox >/tmp/clean-window-wm.log 2>&1 & python tests/browser-smoke.py'
Requires Python playwright, Pillow, Chromium and Openbox. No package runtime dependency.
"""
import json
import os
import shutil
import tempfile
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import ImageGrab
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'evidence'
EVIDENCE.mkdir(exist_ok=True)
# Read-only preflight. Respect managed-browser restrictions; do not try to
# disable policies or reroute around a blocked extension/fullscreen policy.
policy_path = Path('/etc/chromium/policies/managed')
policy = {}
if policy_path.is_dir():
    for item in sorted(policy_path.glob('*.json')):
        try: policy.update(json.loads(item.read_text()))
        except (OSError, ValueError): pass
blockers = []
if '*' in policy.get('ExtensionInstallBlocklist', []):
    blockers.append('Managed policy blocks extension installation.')
if policy.get('FullscreenAllowed') is False:
    blockers.append('Managed policy disables fullscreen.')
if blockers:
    report = {'status': 'BLOCKED', 'checks_passed': 0, 'reason': blockers,
              'policy_modified': False, 'user_browser_touched': False}
    (EVIDENCE/'browser-smoke.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('BLOCKED:', ' '.join(blockers), flush=True)
    raise SystemExit(2)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'tests')))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}/fixture.html'
results = []
def passed(name, details=None):
    results.append({'test': name, 'status': 'PASS', 'details': details})
    print('PASS:', name, flush=True)

def until(fn, predicate, timeout=6):
    deadline = time.monotonic()+timeout
    while time.monotonic()<deadline:
        value=fn()
        if predicate(value): return value
        time.sleep(.1)
    raise AssertionError(f'Condition not met; last value: {value}')

try:
  with tempfile.TemporaryDirectory(prefix='clean-window-test-') as profile, sync_playwright() as p:
    print('CHECK: launching isolated headed Chromium', flush=True)
    ctx = p.chromium.launch_persistent_context(
      profile, executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
      headless=False, viewport=None, timeout=12000,
      ignore_default_args=['--disable-extensions', '--enable-automation'],
      args=[f'--disable-extensions-except={ROOT / "extension"}', f'--load-extension={ROOT / "extension"}',
            '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--window-position=300,160'])
    print('CHECK: Chromium launched', flush=True)
    ctx.set_default_timeout(8000)
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
    extension_id = sw.url.split('/')[2]
    control=ctx.pages[0]
    control.goto(f'chrome-extension://{extension_id}/popup.html')
    control.wait_for_selector('button:not([disabled])')
    # Exercise legacy popup geometry without relying on synthetic activeTab user grants.
    control.evaluate('chrome.storage.local.set({cleanLevel:3})')
    control.locator('body').screenshot(path=str(EVIDENCE/'extension-panel.png'))
    passed('MV3 service worker and action panel loaded', {'browser': sw.evaluate('navigator.userAgent'), 'extensionId': extension_id})
    shortcuts=control.evaluate('chrome.commands.getAll()')
    assert all(c.get('shortcut') for c in shortcuts if c['name'] in ['toggle-clean','toggle-fullscreen','restore'])
    passed('All three keyboard shortcuts registered',shortcuts)

    def api(expression, argument=None): return control.evaluate(expression, argument)
    def window_data(id): return api('(id)=>chrome.windows.get(id)',id)
    def tab_data(id): return api('(id)=>chrome.tabs.get(id)',id)
    def run(action, target):
      result=api('arg=>chrome.runtime.sendMessage({type:"clean-window:run",...arg})',{'action':action,'target':target})
      assert result.get('ok'), result
      return result
    def stable(id):
      return api('''async id=>{
        const w=await chrome.windows.get(id); const tabs=await chrome.tabs.query({windowId:id});
        return {id:w.id,type:w.type,state:w.state,left:w.left,top:w.top,width:w.width,height:w.height,
          tabs:tabs.map(t=>({id:t.id,index:t.index,active:t.active,pinned:t.pinned,groupId:t.groupId}))};
      }''',id)

    with ctx.expect_page() as event:
      target_win=api('(url)=>chrome.windows.create({url,type:"normal",left:50,top:130,width:880,height:700})',base+'?role=target')
    target_page=event.value;target_page.wait_for_load_state()
    target_tab=target_win['tabs'][0]['id'];target={'windowId':target_win['id'],'tabId':target_tab}
    with ctx.expect_page():
      api('(x)=>chrome.tabs.create({windowId:x.id,url:x.url,active:false})',{'id':target_win['id'],'url':base+'?role=keeper'})
    with ctx.expect_page() as event:
      spectator=api('(url)=>chrome.windows.create({url,type:"normal",left:990,top:130,width:880,height:700})',base+'?role=spectator')
    event.value.wait_for_load_state()
    time.sleep(.4)
    spectator_before=stable(spectator['id'])
    target_page.locator('textarea').fill('未儲存草稿：切換視窗後仍然保留 12345')
    token=target_page.evaluate('window.sessionToken')
    api('(id)=>chrome.windows.update(id,{focused:true})',target_win['id']);time.sleep(.3)
    ImageGrab.grab().save(EVIDENCE/'desktop-before.png')
    result=run('toggle-clean',target)
    popup_id=result['windowId']
    until(lambda:window_data(popup_id),lambda w:w['type']=='popup')
    time.sleep(.4)
    assert tab_data(target_tab)['windowId']==popup_id
    assert target_page.evaluate('window.sessionToken')==token
    assert target_page.locator('textarea').input_value()=='未儲存草稿：切換視窗後仍然保留 12345'
    passed('Popup preserves the same tab ID, page token and unsaved textarea')
    assert stable(spectator['id'])==spectator_before
    passed('Other window geometry, mode and tab list stay unchanged after popup')
    desktop=ImageGrab.grab();desktop.save(EVIDENCE/'desktop-clean.png')
    w=window_data(popup_id)
    desktop.crop((w['left'],w['top'],w['left']+w['width'],w['top']+w['height'])).save(EVIDENCE/'native-clean-window.png')
    popup_target={'windowId':popup_id,'tabId':target_tab}
    result=run('restore',popup_target)
    assert result['windowId']==target['windowId']
    assert tab_data(target_tab)['windowId']==target['windowId']
    assert target_page.evaluate('window.sessionToken')==token
    assert target_page.locator('textarea').input_value()=='未儲存草稿：切換視窗後仍然保留 12345'
    assert stable(spectator['id'])==spectator_before
    passed('Restore to original window keeps page state and other window unchanged')

    api('(id)=>chrome.windows.update(id,{focused:true})',target['windowId']);target_page.bring_to_front()
    target_page.keyboard.press('Alt+Shift+w')
    until(lambda:tab_data(target_tab),lambda t:t['windowId']!=target['windowId'])
    assert window_data(tab_data(target_tab)['windowId'])['type']=='popup'
    target_page.keyboard.press('Alt+Shift+r')
    until(lambda:tab_data(target_tab),lambda t:t['windowId']==target['windowId'])
    passed('Actual keyboard command opens popup and restores without a toolbar')

    time.sleep(.3);normal_before=window_data(target['windowId'])
    run('toggle-fullscreen',target)
    until(lambda:window_data(target['windowId']),lambda w:w['state']=='fullscreen')
    assert stable(spectator['id'])==spectator_before
    run('toggle-fullscreen',target)
    restored=until(lambda:window_data(target['windowId']),lambda w:w['state']=='normal')
    time.sleep(.3);restored=window_data(target['windowId'])
    for field in ('left','top','width','height'): assert restored[field]==normal_before[field],(field,normal_before,restored)
    assert stable(spectator['id'])==spectator_before
    passed('Fullscreen toggles only the target, and restores original normal bounds')

    api('(id)=>chrome.windows.update(id,{state:"maximized"})',target['windowId'])
    until(lambda:window_data(target['windowId']),lambda w:w['state']=='maximized')
    run('toggle-fullscreen',target);until(lambda:window_data(target['windowId']),lambda w:w['state']=='fullscreen')
    run('restore',target);until(lambda:window_data(target['windowId']),lambda w:w['state']=='maximized')
    passed('Original maximized state survives fullscreen round trip')
    api('(id)=>chrome.windows.update(id,{state:"normal"})',target['windowId'])

    with ctx.expect_page() as event:
      solo=api('(url)=>chrome.windows.create({url,type:"normal",width:700,height:550})',base+'?role=solo')
    solo_page=event.value;solo_page.wait_for_load_state()
    solo_tab=solo['tabs'][0]['id']
    out=run('toggle-clean',{'windowId':solo['id'],'tabId':solo_tab})
    all_ids=api('async()=> (await chrome.windows.getAll()).map(w=>w.id)')
    assert solo['id'] not in all_ids
    # Simulate extension reload metadata loss, then restore explicitly.
    api('(key)=>chrome.storage.session.remove(key)',f'clean:{solo_tab}')
    back=run('restore',{'windowId':out['windowId'],'tabId':solo_tab})
    assert window_data(back['windowId'])['type']=='normal'
    assert back['windowId']!=spectator['id']
    assert stable(spectator['id'])==spectator_before
    passed('Last source tab closes its empty window; metadata-free restore creates a new normal window')

    stale=api('arg=>chrome.runtime.sendMessage({type:"clean-window:run",action:"toggle-clean",target:arg})',{'windowId':spectator['id'],'tabId':target_tab})
    assert stale.get('ok') is False
    assert stable(spectator['id'])==spectator_before
    passed('Stale target rejected by actual service-worker message handler')
    ctx.close()
finally:
  server.shutdown()
  (EVIDENCE/'browser-smoke.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'PASS: {len(results)} headed-browser checks',flush=True)
