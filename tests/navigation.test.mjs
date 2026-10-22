import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fake-chrome.mjs';

const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); } });
async function setup() {
  const f = fakeChrome();
  f.preferences.cleanLevel = 2;
  const runtime = {
    id: 'abcdefghijklmnopabcdefghijklmnop',
    getURL: path => `chrome-extension://abcdefghijklmnopabcdefghijklmnop/${path}`,
    onMessage: event(), onInstalled: event()
  };
  f.api.runtime = runtime;
  f.api.action = { async setBadgeText() {}, async setTitle() {} };
  f.api.commands = { onCommand: event() };
  f.api.contextMenus = {
    entries: [], onClicked: event(),
    removeAll(callback) { callback(); },
    create(data, callback) { this.entries.push(data); callback(); }
  };
  f.api.tabs.onRemoved = event();
  f.api.tabs.onReplaced = event();
  f.api.tabs.onUpdated = event();
  f.api.windows.onRemoved = event();
  globalThis.chrome = f.api;
  await import(`../extension/background.js?navigation-test=${Math.random()}`);
  return {
    ...f, runtime,
    sender: { id: runtime.id, url: runtime.getURL('popup.html') },
    listener: runtime.onMessage.listeners[0]
  };
}
const send = (f, message, sender) => new Promise(resolve => {
  const handled = f.listener(message, sender, resolve);
  if (handled === false) resolve({ ignored: true });
});
async function openClean(f) {
  const result = await send(f, {
    type: 'clean-window:run', action: 'toggle-clean',
    target: { tabId: 11, windowId: 1 }
  }, f.sender);
  assert.equal(result.ok, true);
  return result;
}
const webSender = (f, windowId, url = 'https://source.example/start') => ({
  id: f.runtime.id, url, frameId: 0, tab: { id: 11, windowId }
});
const pendingRows = f => Object.entries(f.db).filter(([key]) => key.startsWith('pending-navigation:'));
const tokenFromPrompt = f => {
  const pending = pendingRows(f)[0]?.[1];
  return new URL(f.wins.get(pending.promptWindowId).url).searchParams.get('token');
};
const accessSender = (f, token) => ({
  id: f.runtime.id, url: f.runtime.getURL(`site-access.html?token=${token}`), frameId: 0
});

test('same-origin navigation stays immediate and never requests a host permission', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://source.example/next?view=clean'
  }, webSender(f, clean.windowId));
  assert.deepEqual(result, { ok: true, action: 'navigate' });
  assert.equal(pendingRows(f).length, 0);
  assert.equal(f.originPermissions.size, 0);
});

test('cross-origin address navigation opens a per-host prompt without granting access', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/path?q=1'
  }, webSender(f, clean.windowId));
  assert.equal(result.ok, true);
  assert.equal(result.action, 'prompt');
  assert.equal(result.host, 'destination.example');
  const [key, pending] = pendingRows(f)[0];
  assert.match(key, /^pending-navigation:/);
  assert.equal(pending.url, 'https://destination.example/path?q=1');
  assert.deepEqual(pending.originPatterns, ['https://destination.example/*']);
  assert.equal(pending.tabId, 11);
  assert.equal(pending.windowId, clean.windowId);
  assert.ok(Number.isInteger(pending.promptWindowId));
  assert.equal(f.originPermissions.size, 0, 'opening the prompt must not grant a permission');
});

test('level 2 hidden URL bar can request per-host access for cross-origin navigation', async () => {
  const f = await setup();
  f.preferences.cleanLevel = 2;
  const clean = await openClean(f);
  assert.equal(f.db['clean:11'].cleanLevel, 2);
  const target = 'https://level-two-destination.example/work';
  const result = await send(f, {
    type: 'clean-window:navigate', url: target
  }, webSender(f, clean.windowId));
  assert.equal(result.ok, true);
  assert.equal(result.action, 'prompt');
  assert.equal(result.host, 'level-two-destination.example');
  const [, pending] = pendingRows(f)[0];
  assert.equal(pending.url, target);
  assert.equal(pending.windowId, clean.windowId);
  assert.deepEqual(pending.originPatterns, ['https://level-two-destination.example/*']);
});

test('HTTP destinations request both schemes for the same hostname to survive common HTTPS upgrades', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const target = 'http://destination.example/start';
  const result = await send(f, {
    type: 'clean-window:navigate', url: target
  }, webSender(f, clean.windowId));
  assert.equal(result.action, 'prompt');
  const [key, pending] = pendingRows(f)[0];
  const expectedPatterns = ['http://destination.example/*', 'https://destination.example/*'];
  assert.deepEqual(pending.originPatterns, expectedPatterns);
  const token = tokenFromPrompt(f, result.windowId);
  const info = await send(f, { type: 'clean-window:site-access-info', token }, accessSender(f, token));
  assert.deepEqual(info.originPatterns, expectedPatterns);
  f.originPermissions.add(expectedPatterns[0]);
  f.originPermissions.add(expectedPatterns[1]);
  assert.deepEqual(await send(f, { type: 'clean-window:site-access-complete', token }, accessSender(f, token)), { ok: true });
  assert.equal(f.tabs.get(11).url, target);
  // Model a normal HTTP -> HTTPS redirect on the same hostname.
  f.tabs.get(11).url = 'https://destination.example/secure';
  f.pageModes.delete(11); f.edgeModes.delete(11); f.titleModes.delete(11);
  f.api.tabs.onUpdated.listeners[0](11, { status: 'complete' }, { id: 11, windowId: clean.windowId });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.pageModes.get(11), 'address-hidden');
  assert.equal(f.edgeModes.get(11), 2);
  assert.equal(f.originPermissions.size, 2, 'only the exact hostname is granted across the two schemes');
  assert.equal(f.db[key], undefined);
});

test('incognito cross-origin access prompts stay in the same incognito context', async () => {
  const f = await setup();
  f.wins.get(1).incognito = true;
  f.tabs.get(11).incognito = true;
  const clean = await openClean(f);
  assert.equal(f.wins.get(clean.windowId).incognito, true);
  const sender = { ...webSender(f, clean.windowId), tab: { id: 11, windowId: clean.windowId, incognito: true } };
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/incognito'
  }, sender);
  assert.equal(result.action, 'prompt');
  const [, pending] = pendingRows(f)[0];
  assert.equal(pending.incognito, true);
  assert.equal(f.wins.get(pending.promptWindowId).incognito, true);
});

test('a previously granted destination host keeps cross-origin navigation immediate', async () => {
  const f = await setup();
  const clean = await openClean(f);
  f.originPermissions.add('https://destination.example/*');
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/another-page'
  }, webSender(f, clean.windowId));
  assert.deepEqual(result, { ok: true, action: 'navigate' });
  assert.equal(pendingRows(f).length, 0);
});

test('site-access page receives only the destination host and pattern, not the full URL', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/private/path?secret=not-shared'
  }, webSender(f, clean.windowId));
  const token = tokenFromPrompt(f, result.windowId);
  const info = await send(f, { type: 'clean-window:site-access-info', token }, accessSender(f, token));
  assert.equal(info.ok, true);
  assert.equal(info.host, 'destination.example');
  assert.deepEqual(info.originPatterns, ['https://destination.example/*']);
  assert.equal(Object.hasOwn(info, 'url'), false);
});

test('granting the exact optional host permission navigates only the recorded managed tab', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const target = 'https://destination.example/work';
  const result = await send(f, {
    type: 'clean-window:navigate', url: target
  }, webSender(f, clean.windowId));
  const token = tokenFromPrompt(f, result.windowId);
  f.originPermissions.add('https://destination.example/*');
  const completed = await send(f, {
    type: 'clean-window:site-access-complete', token
  }, accessSender(f, token));
  assert.deepEqual(completed, { ok: true });
  assert.equal(f.tabs.get(11).url, target);
  assert.equal(f.tabs.get(11).windowId, clean.windowId);
  assert.equal(f.tabs.get(21).url, undefined, 'unrelated tab must not be navigated');
  assert.equal(pendingRows(f).length, 0);
  assert.equal(f.preferences.url, undefined, 'destination URL must not enter persistent local storage');
});

test('a granted destination host automatically reattaches controls after navigation completes', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const target = 'https://destination.example/next';
  const result = await send(f, {
    type: 'clean-window:navigate', url: target
  }, webSender(f, clean.windowId));
  const token = tokenFromPrompt(f, result.windowId);
  f.originPermissions.add('https://destination.example/*');
  await send(f, { type: 'clean-window:site-access-complete', token }, accessSender(f, token));
  // A cross-document navigation destroys content-script state in the real browser.
  f.pageModes.delete(11); f.edgeModes.delete(11); f.titleModes.delete(11);
  f.api.tabs.onUpdated.listeners[0](11, { status: 'complete' }, { id: 11, windowId: clean.windowId });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.pageModes.get(11), 'address-hidden');
  assert.equal(f.edgeModes.get(11), 2);
  assert.equal(f.titleModes.get(11), 'active');
});

test('completion cannot navigate unless the requested host permission is actually granted', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/not-yet-granted'
  }, webSender(f, clean.windowId));
  const token = tokenFromPrompt(f, result.windowId);
  const completed = await send(f, {
    type: 'clean-window:site-access-complete', token
  }, accessSender(f, token));
  assert.equal(completed.ok, false);
  assert.match(completed.error, /尚未取得此網站的存取權/);
  assert.equal(f.tabs.get(11).url, undefined);
  assert.equal(pendingRows(f).length, 1, 'user must still be able to continue without permission or cancel');
});

test('expired access prompts are removed on the next attempted action', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/expired'
  }, webSender(f, clean.windowId));
  const token = tokenFromPrompt(f, result.windowId);
  const [key, pending] = pendingRows(f)[0];
  f.db[key] = { ...pending, createdAt: Date.now() - 11 * 60 * 1000 };
  const info = await send(f, { type: 'clean-window:site-access-info', token }, accessSender(f, token));
  assert.equal(info.ok, false);
  assert.match(info.error, /已逾時/);
  assert.equal(pendingRows(f).length, 0);
  assert.equal(f.tabs.get(11).url, undefined);
});

test('closing either the access prompt or its target tab cleans pending URL state', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/closed-prompt'
  }, webSender(f, clean.windowId));
  const [key, pending] = pendingRows(f)[0];
  f.api.windows.onRemoved.listeners[0](pending.promptWindowId);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(f.db[key], undefined, 'closing the access window removes the pending URL');

  const second = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/closed-tab'
  }, webSender(f, clean.windowId));
  assert.equal(second.action, 'prompt');
  const [secondKey] = pendingRows(f)[0];
  f.api.tabs.onRemoved.listeners[0](11);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(f.db[secondKey], undefined, 'closing the target tab removes the pending URL');
});

test('continuing without permission navigates only after an explicit second choice', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const target = 'https://destination.example/no-toolbar';
  const result = await send(f, {
    type: 'clean-window:navigate', url: target
  }, webSender(f, clean.windowId));
  const token = tokenFromPrompt(f, result.windowId);
  const continued = await send(f, {
    type: 'clean-window:site-access-continue', token
  }, accessSender(f, token));
  assert.deepEqual(continued, { ok: true });
  assert.equal(f.tabs.get(11).url, target);
  assert.equal(f.originPermissions.size, 0);
  assert.equal(pendingRows(f).length, 0);
});

test('cancel leaves the current page in place and removes the pending destination', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const result = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/cancelled'
  }, webSender(f, clean.windowId));
  const token = tokenFromPrompt(f, result.windowId);
  const cancelled = await send(f, {
    type: 'clean-window:site-access-cancel', token
  }, accessSender(f, token));
  assert.deepEqual(cancelled, { ok: true });
  assert.equal(f.tabs.get(11).url, undefined);
  assert.equal(pendingRows(f).length, 0);
});

test('unmanaged pages, subframes and unsafe destinations cannot open permission prompts', async () => {
  const f = await setup();
  const clean = await openClean(f);
  const badSender = { ...webSender(f, 2), tab: { id: 21, windowId: 2 } };
  const rejected = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/'
  }, badSender);
  assert.equal(rejected.ok, false);
  const subframe = await send(f, {
    type: 'clean-window:navigate', url: 'https://destination.example/'
  }, { ...webSender(f, clean.windowId), frameId: 2 });
  assert.equal(subframe.ignored, true);
  const unsafe = await send(f, {
    type: 'clean-window:navigate', url: 'javascript:alert(1)'
  }, webSender(f, clean.windowId));
  assert.equal(unsafe.ok, false);
  assert.equal(pendingRows(f).length, 0);
});

test('reapply context-menu action restores page controls after an ungranted cross-origin navigation', async () => {
  const f = await setup();
  const clean = await openClean(f);
  f.pageModes.delete(11);
  f.edgeModes.delete(11);
  f.titleModes.delete(11);
  f.api.contextMenus.onClicked.listeners[0]({ menuItemId: 'reapply-clean' }, {
    id: 11, windowId: clean.windowId
  });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.pageModes.get(11), 'address-hidden');
  assert.equal(f.edgeModes.get(11), 2);
  assert.equal(f.titleModes.get(11), 'active');
  assert.equal(f.tabs.get(21).windowId, 2);
});
