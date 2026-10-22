import { createController } from './controller.js';
const controller = createController(chrome);
const actionIds = ['toggle-clean', 'toggle-fullscreen', 'restore', 'edit-title'];

async function feedback(tabId, message = '') {
  if (!Number.isInteger(tabId)) return;
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId, text: message ? '!' : '' }),
    chrome.action.setTitle({ tabId, title: message || 'Clean Window｜乾淨視窗' }),
    chrome.storage.session.set({ [`feedback:${tabId}`]: message })
  ]);
}

async function perform(action, target, options = {}) {
  try {
    const result = await controller.run(action, target, options);
    await feedback(target.tabId, result.warning);
    return { ok: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await feedback(target?.tabId, message);
    return { ok: false, error: message };
  }
}

// Management and bookmark actions are exposed only to the extension popup or
// an authenticated top-frame content script in one of OUR managed popups.
const webURL = value => { try {const u=new URL(value);return ['https:','http:'].includes(u.protocol) ? u.href : null;}catch{return null;} };
const pendingNavigationKey = token => `pending-navigation:${token}`;
const safeNavigationTarget = value => {
  if (typeof value !== 'string' || value.length > 8192) throw new Error('網址無效。');
  let url;
  try { url = new URL(value); } catch { throw new Error('請輸入完整的 HTTP(S) 網址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('只支援不含帳號密碼的 HTTP(S) 網址。');
  }
  return url;
};
// Chrome host patterns do not scope access by port or path. Request only the
// destination hostname. An explicit HTTP destination also requests HTTPS for the
// same hostname because many sites automatically upgrade HTTP to HTTPS.
const hostPatterns = url => url.protocol === 'http:'
  ? [`http://${url.hostname}/*`, `https://${url.hostname}/*`]
  : [`https://${url.hostname}/*`];
async function managedWebSender(sender) {
  if (sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) ||
      !Number.isInteger(sender.tab?.windowId) || !webURL(sender.url)) {
    throw new Error('只允許由乾淨視窗的主頁面發起導覽。');
  }
  const item = (await controller.listManaged()).find(row =>
    row.tabId === sender.tab.id && row.windowId === sender.tab.windowId);
  if (!item || ![1, 2, 3].includes(item.level)) throw new Error('此頁不是可導覽的乾淨視窗。');
  return item;
}
function siteAccessToken(sender) {
  try {
    const actual = new URL(sender.url);
    const expected = new URL(chrome.runtime.getURL('site-access.html'));
    return actual.origin === expected.origin && actual.pathname === expected.pathname
      ? actual.searchParams.get('token') : null;
  } catch { return null; }
}
async function readPendingNavigation(token) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) throw new Error('網站授權請求無效。');
  const key = pendingNavigationKey(token);
  const pending = (await chrome.storage.session.get(key))[key];
  if (!pending) throw new Error('網站授權請求已取消或逾時。');
  if (!Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt > 10 * 60 * 1000) {
    await chrome.storage.session.remove(key).catch(() => {});
    throw new Error('網站授權請求已逾時，請重新提交網址。');
  }
  return { key, pending };
}
async function prepareNavigation(message, sender) {
  await managedWebSender(sender);
  const target = safeNavigationTarget(message.url);
  const source = new URL(sender.url);
  if (target.origin === source.origin) return { ok: true, action: 'navigate' };
  const patterns = hostPatterns(target);
  if (await chrome.permissions.contains({ origins: patterns })) return { ok: true, action: 'navigate' };

  const token = crypto.randomUUID();
  const key = pendingNavigationKey(token);
  const pending = {
    tabId: sender.tab.id, windowId: sender.tab.windowId,
    incognito: sender.tab.incognito === true,
    url: target.href, originPatterns: patterns, createdAt: Date.now()
  };
  await chrome.storage.session.set({ [key]: pending });
  try {
    const prompt = await chrome.windows.create({
      url: chrome.runtime.getURL(`site-access.html?token=${encodeURIComponent(token)}`),
      type: 'popup', width: 430, height: 330, focused: true, incognito: pending.incognito
    });
    await chrome.storage.session.set({ [key]: { ...pending, promptWindowId: prompt.id } });
    return { ok: true, action: 'prompt', host: target.host };
  } catch (error) {
    await chrome.storage.session.remove(key).catch(() => {});
    throw error;
  }
}
async function resolvePendingNavigation(message, sender, action) {
  const token = siteAccessToken(sender);
  if (!token || token !== message.token) throw new Error('未授權的網站授權視窗。');
  const { key, pending } = await readPendingNavigation(token);
  const managed = (await controller.listManaged()).some(item =>
    item.tabId === pending.tabId && item.windowId === pending.windowId);
  if (!managed) {
    await chrome.storage.session.remove(key).catch(() => {});
    throw new Error('原本的乾淨視窗已不存在；請重新開啟目標頁面。');
  }
  if (action === 'complete') {
    const granted = await chrome.permissions.contains({ origins: pending.originPatterns });
    if (!granted) throw new Error('尚未取得此網站的存取權；可以重新授權或不授權直接前往。');
  }
  await chrome.tabs.update(pending.tabId, { url: pending.url, active: true });
  await chrome.storage.session.remove(key);
  return { ok: true };
}
async function hub(message,sender) {
  const operation = message.action;
  if (operation === 'list') return {ok:true,items:await controller.listManaged()};
  if (operation === 'focus') return {ok:true,...await controller.focusManaged(message.target?.tabId,message.target?.windowId)};
  if (operation === 'restore' || operation === 'set-level' || operation === 'edit-title') {
    return perform(operation,message.target,operation === 'set-level' ? {level:message.level}
      : operation === 'edit-title' ? {anchor:message.anchor} : {});
  }
  if (operation === 'bookmarks-status') {
    return {ok:true,granted:await chrome.permissions.contains({permissions:['bookmarks']})};
  }
  if (operation === 'bookmarks-grant') {
    const win=await chrome.windows.create({
      url:chrome.runtime.getURL('bookmarks.html'),type:'popup',width:390,height:260,focused:true
    });
    return {ok:true,windowId:win.id};
  }
  if (operation === 'bookmarks-recent') {
    if (!await chrome.permissions.contains({permissions:['bookmarks']})) return {ok:true,granted:false,items:[]};
    const nodes=await chrome.bookmarks.getRecent(10);
    return {ok:true,granted:true,items:nodes.filter(item=>webURL(item.url))
      .slice(0,8).map(item=>({title:String(item.title||item.url).slice(0,100),url:item.url}))};
  }
  if (operation === 'bookmarks-state') {
    if (!await chrome.permissions.contains({permissions:['bookmarks']})) return {ok:true,granted:false,bookmarked:false};
    if (sender.frameId!==0 || !sender.tab?.id || !webURL(sender.url)) {
      return {ok:true,granted:true,bookmarked:false};
    }
    const found=await chrome.bookmarks.search({url:webURL(sender.url)});
    return {ok:true,granted:true,bookmarked:found.length>0};
  }
  if (operation === 'bookmarks-toggle') {
    // No popup-supplied URL: use the browser-authenticated frame URL.
    if (sender.frameId!==0 || !sender.tab?.id || !webURL(sender.url) ||
        !await chrome.permissions.contains({permissions:['bookmarks']})) {
      throw new Error('此頁無書籤授權；請先在授權視窗啟用書籤。');
    }
    const url=webURL(sender.url);
    const found=await chrome.bookmarks.search({url});
    if (found.length) {
      await chrome.bookmarks.remove(found[0].id);
      return {ok:true,bookmarked:false};
    }
    await chrome.bookmarks.create({title:String(message.title||'未命名網頁').slice(0,160),url});
    return {ok:true,bookmarked:true};
  }
  if (operation === 'history' || operation === 'downloads') {
    const url=operation === 'history' ? 'chrome://history/' : 'chrome://downloads/';
    const win=await chrome.windows.create({url,type:'normal',focused:true});
    return {ok:true,windowId:win.id};
  }
  throw new Error('不支援的管理操作。');
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === 'clean-window:navigate') {
    if (!sender.tab || sender.frameId !== 0) return false;
    prepareNavigation(message, sender).then(respond, error =>
      respond({ ok: false, error: error?.message || String(error) }));
    return true;
  }
  if (['clean-window:site-access-info','clean-window:site-access-complete',
       'clean-window:site-access-continue','clean-window:site-access-cancel'].includes(message?.type)) {
    if (!siteAccessToken(sender) || siteAccessToken(sender) !== message.token) return false;
    const run = async () => {
      if (message.type === 'clean-window:site-access-info') {
        const { pending } = await readPendingNavigation(message.token);
        const managed = (await controller.listManaged()).some(item =>
          item.tabId === pending.tabId && item.windowId === pending.windowId);
        if (!managed) throw new Error('原本的乾淨視窗已不存在。');
        return { ok: true, host: new URL(pending.url).host, originPatterns: pending.originPatterns };
      }
      if (message.type === 'clean-window:site-access-cancel') {
        const { key } = await readPendingNavigation(message.token);
        await chrome.storage.session.remove(key);
        return { ok: true };
      }
      return resolvePendingNavigation(message, sender,
        message.type === 'clean-window:site-access-complete' ? 'complete' : 'continue');
    };
    run().then(respond, error => respond({ ok: false, error: error?.message || String(error) }));
    return true;
  }
  // Only the page's own top-frame content script can use the tiny extension dock.
  // A web page and another extension cannot invoke these internal actions.
  if (message?.type === 'clean-window:dock') {
    if (!Number.isInteger(sender.tab?.id) || !Number.isInteger(sender.tab?.windowId)
        || sender.frameId !== 0 || !['restore', 'manage'].includes(message.action)) return false;
    const task = message.action === 'restore'
      ? perform('restore', { tabId: sender.tab.id, windowId: sender.tab.windowId })
      : chrome.windows.create({ url: 'chrome://extensions/', type: 'normal', focused: true })
          .then(win => ({ok: true, windowId: win?.id}));
    task.then(respond, error => respond({ok: false, error: String(error)}));
    return true;
  }
  if (['clean-window:edge-level','clean-window:edge-restore'].includes(message?.type)) {
    if (!Number.isInteger(sender.tab?.id) || !Number.isInteger(sender.tab?.windowId) ||
        sender.frameId !== 0) return false;
    const target = {tabId:sender.tab.id,windowId:sender.tab.windowId};
    const run = async () => {
      if (message.type === 'clean-window:edge-restore') {
        const matches = await controller.listManaged();
        if (!matches.some(item => item.tabId === target.tabId && item.windowId === target.windowId))
          throw new Error('這個分頁不是受管理的乾淨視窗。');
      }
      const action = message.type === 'clean-window:edge-restore' ? 'restore' : 'set-level';
      return perform(action,target,action === 'set-level' ? {level:message.level} : {});
    };
    run().then(respond,error=>respond({ok:false,error:error?.message||String(error)}));
    return true;
  }
  if (message?.type === 'clean-window:hub') {
    const popup = sender.url === chrome.runtime.getURL('popup.html');
    const run = async () => {
      if (!popup) {
        if (message.action === 'edit-title') throw new Error('標題編輯只能從擴充 Popup 管理清單開啟。');
        if (!Number.isInteger(sender.tab?.id) || sender.frameId !== 0 ||
            !webURL(sender.url)) throw new Error('非授權的乾淨模式頁面。');
        const matches=await controller.listManaged();
        if (!matches.some(item=>item.tabId===sender.tab.id &&
            item.windowId===sender.tab.windowId && item.level===1)) {
          throw new Error('此頁沒有啟用第一級乾淨模式。');
        }
      }
      return hub(message,sender);
    };
    if (!popup && (!sender.tab || sender.frameId!==0)) return false;
    run().then(respond,error=>respond({ok:false,error:error?.message||String(error)}));
    return true;
  }
  if (message?.type === 'clean-window:title-updated') {
    if (sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)) return false;
    controller.renameManaged(sender.tab.id,sender.tab.windowId,message.title)
      .then(saved=>respond({ok:saved}),()=>respond({ok:false}));
    return true;
  }
  if (sender.url !== chrome.runtime.getURL('popup.html')) return false;
  if (message?.type !== 'clean-window:run' || !actionIds.includes(message.action)) return false;
  perform(message.action, message.target).then(respond, error => respond({ ok: false, error: String(error) }));
  return true;
});

// Capture the event's tab before any asynchronous work; never query a different
// "current window" halfway through an operation.
chrome.commands.onCommand.addListener((command, eventTab) => {
  if (!actionIds.includes(command)) return;
  const capture = eventTab?.id !== undefined
    ? Promise.resolve(eventTab)
    : chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => tabs[0]);
  void capture.then(tab => {
    if (!tab) return;
    return perform(command, { tabId: tab.id, windowId: tab.windowId });
  }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) return;
    const entries = [
      ['toggle-clean', '套用簡化等級／還原'],
      ['toggle-fullscreen', '整個視窗：切換全螢幕'],
      ['restore', '還原目前視窗'],
      ['reapply-clean', '重新啟用目前網站的精簡介面'],
      ['edit-title', '編輯乾淨模式標題（Symbol＋文字）']
    ];
    for (const [id, title] of entries) {
      chrome.contextMenus.create({ id, title: `Clean Window · ${title}`, contexts: ['page', 'action'] }, () => {
        if (chrome.runtime.lastError) console.warn('Context menu unavailable:', chrome.runtime.lastError.message);
      });
    }
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id === undefined) return;
  if (info.menuItemId === 'reapply-clean') {
    void controller.refresh(tab.id, tab.windowId).then(active => {
      if (!active) throw new Error('目前分頁不是受管理的乾淨視窗。');
      return feedback(tab.id, '');
    }).catch(error => feedback(tab.id, error?.message || String(error)));
    return;
  }
  if (actionIds.includes(info.menuItemId)) {
    void perform(info.menuItemId, { tabId: tab.id, windowId: tab.windowId });
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  void (async () => {
    const saved = await chrome.storage.session.get(null);
    const pendingKeys = Object.entries(saved)
      .filter(([key, value]) => key.startsWith('pending-navigation:') && value?.tabId === tabId)
      .map(([key]) => key);
    await chrome.storage.session.remove([`clean:${tabId}`, `feedback:${tabId}`, ...pendingKeys]);
  })().catch(() => {});
});
chrome.windows.onRemoved.addListener(windowId => {
  // Do NOT delete tab restoration records when the origin window closes.
  void (async () => {
    const saved = await chrome.storage.session.get(null);
    const pendingKeys = Object.entries(saved)
      .filter(([key, value]) => key.startsWith('pending-navigation:') &&
        (value?.windowId === windowId || value?.promptWindowId === windowId))
      .map(([key]) => key);
    await chrome.storage.session.remove([`full:${windowId}`, ...pendingKeys]);
  })().catch(() => {});
});
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  void (async () => {
    const oldKey = `clean:${removedTabId}`;
    const record = (await chrome.storage.session.get(oldKey))[oldKey];
    if (record) await chrome.storage.session.set({ [`clean:${addedTabId}`]: record });
    await chrome.storage.session.remove([oldKey, `feedback:${removedTabId}`]);
  })().catch(() => {});
});

/* Re-attach after same-origin navigation or when this destination's optional host
   permission was previously granted. Otherwise a user-invoked context-menu action can
   reapply the UI using activeTab, without granting persistent access. */
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== 'complete' || !Number.isInteger(tab?.windowId)) return;
  void controller.refresh(tabId, tab.windowId).catch(() => {});
});
