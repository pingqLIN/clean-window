import { createController } from './controller.js';
const controller = createController(chrome);
const actionIds = ['toggle-clean', 'toggle-fullscreen', 'restore'];

async function feedback(tabId, message = '') {
  if (!Number.isInteger(tabId)) return;
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId, text: message ? '!' : '' }),
    chrome.action.setTitle({ tabId, title: message || 'Clean Window｜乾淨視窗' }),
    chrome.storage.session.set({ [`feedback:${tabId}`]: message })
  ]);
}

async function perform(action, target) {
  try {
    const result = await controller.run(action, target);
    await feedback(target.tabId, result.warning);
    return { ok: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await feedback(target?.tabId, message);
    return { ok: false, error: message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
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
      ['toggle-clean', '目前分頁：精簡視窗／還原'],
      ['toggle-fullscreen', '整個視窗：切換全螢幕'],
      ['restore', '還原目前視窗']
    ];
    for (const [id, title] of entries) {
      chrome.contextMenus.create({ id, title: `Clean Window · ${title}`, contexts: ['page', 'action'] }, () => {
        if (chrome.runtime.lastError) console.warn('Context menu unavailable:', chrome.runtime.lastError.message);
      });
    }
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (actionIds.includes(info.menuItemId) && tab?.id !== undefined) {
    void perform(info.menuItemId, { tabId: tab.id, windowId: tab.windowId });
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  void chrome.storage.session.remove([`clean:${tabId}`, `feedback:${tabId}`]).catch(() => {});
});
chrome.windows.onRemoved.addListener(windowId => {
  // Do NOT delete tab restoration records when the origin window closes.
  void chrome.storage.session.remove(`full:${windowId}`).catch(() => {});
});
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  void (async () => {
    const oldKey = `clean:${removedTabId}`;
    const record = (await chrome.storage.session.get(oldKey))[oldKey];
    if (record) await chrome.storage.session.set({ [`clean:${addedTabId}`]: record });
    await chrome.storage.session.remove([oldKey, `feedback:${removedTabId}`]);
  })().catch(() => {});
});
