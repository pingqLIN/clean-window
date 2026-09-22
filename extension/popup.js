const buttons = [...document.querySelectorAll('button[data-action]')];
const status = document.querySelector('#target-status');
const feedback = document.querySelector('#feedback');
let target;
const show = message => { feedback.textContent = message; feedback.hidden = !message; };

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('找不到目前分頁。請從目標視窗開啟本面板。');
    target = { tabId: tab.id, windowId: tab.windowId };
    const [win, tabs, stored, commands] = await Promise.all([
      chrome.windows.get(target.windowId),
      chrome.tabs.query({ windowId: target.windowId }),
      chrome.storage.session.get(`feedback:${tab.id}`),
      chrome.commands.getAll()
    ]);
    status.textContent = `只處理此視窗 · ${tabs.length} 個分頁`;
    if (win.type === 'popup') document.querySelector('#clean-label').textContent = '精簡視窗 → 還原普通視窗';
    if (win.state === 'fullscreen') document.querySelector('#full-label').textContent = '退出此視窗的全螢幕';
    for (const button of buttons) {
      const shortcut = commands.find(command => command.name === button.dataset.action)?.shortcut;
      button.querySelector('kbd').textContent = shortcut || '未指定快捷鍵';
      button.disabled = false;
    }
    show(stored[`feedback:${tab.id}`] || '');
  } catch (error) {
    status.textContent = '無法確認目標';
    show(error.message);
  }
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    if (!target) return;
    buttons.forEach(item => { item.disabled = true; });
    show('');
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'clean-window:run', action: button.dataset.action, target
      });
      if (!result?.ok) throw new Error(result?.error || '操作未完成。請重新開啟面板。');
      if (result.warning) {
        // If the panel remains open, let the user read the recovery warning.
        show(result.warning);
      } else {
        window.close();
      }
    } catch (error) {
      show(error.message);
    } finally {
      buttons.forEach(item => { item.disabled = false; });
    }
  });
}
void init();
