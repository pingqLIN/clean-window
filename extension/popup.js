const buttons = [...document.querySelectorAll('button[data-action]')];
const status = document.querySelector('#target-status');
const feedback = document.querySelector('#feedback');
const levelInput = document.querySelector('#clean-level');
const levelNumber = document.querySelector('#level-number');
const levelTitle = document.querySelector('#level-title');
const levelDetail = document.querySelector('#level-detail');
const levelLimit = document.querySelector('#level-limit');
const cleanLabel = document.querySelector('#clean-label');
const cleanDescription = document.querySelector('#clean-description');

const levels = {
  1: {
    name: '自繪網址欄＋擴充欄',
    detail: '精簡 Popup 顯示自繪網址欄，右側包含 Clean Window 自身操作與擴充管理入口。',
    limit: '非 Chrome 原生網址列；擴充欄不能直接啟動其他擴充的按鈕。僅支援可注入的 HTTP(S) 頁面。'
  },
  2: {
    name: '自繪網址欄',
    detail: '精簡 Popup 顯示可輸入的自繪網址欄，不顯示擴充工具列。',
    limit: '非 Chrome 原生網址列；跨頁導覽可能使欄位消失。'
  },
  3: {
    name: '純精簡 Popup',
    detail: '只保留可拖曳縮放的 Popup 視窗與標題列，不顯示額外工具列。',
    limit: ''
  }
};

let target;
let isRestoring = false;
let storedLevel = 1;
const show = message => { feedback.textContent = message; feedback.hidden = !message; };
const validLevel = value => Number.isInteger(value) && value >= 1 && value <= 3;
const describeLevel = () => {
  const level = Number(levelInput.value);
  const preset = levels[level];
  levelNumber.textContent = `${level} / 3`;
  levelTitle.textContent = `${level} · ${preset.name}`;
  levelDetail.textContent = preset.detail;
  levelLimit.textContent = preset.limit;
  levelLimit.hidden = !preset.limit;
  if (!isRestoring) {
    cleanLabel.textContent = '套用此簡化等級';
    cleanDescription.textContent = level === 1
      ? '精簡 Popup，搭配自繪網址欄與擴充工具列。'
      : level === 2 ? '精簡 Popup，搭配自繪網址欄。'
        : '將目前分頁移至純精簡 Popup。';
  }
};

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('找不到目前分頁。請從目標視窗開啟本面板。');
    target = { tabId: tab.id, windowId: tab.windowId };
    const [win, tabs, saved, commands, preference] = await Promise.all([
      chrome.windows.get(target.windowId),
      chrome.tabs.query({ windowId: target.windowId }),
      chrome.storage.session.get([`feedback:${tab.id}`, `clean:${tab.id}`]),
      chrome.commands.getAll(),
      chrome.storage.local.get('cleanLevel')
    ]);
    status.textContent = `只處理此視窗 · ${tabs.length} 個分頁`;
    const record = saved[`clean:${tab.id}`];
    isRestoring = win.state === 'fullscreen' || win.type === 'popup'
      || (win.type === 'normal' && record?.detachedType === 'normal'
        && record.originWindowId !== win.id
        && (record.detachedWindowId === win.id || record.phase === 'opening'));
    if (isRestoring) cleanLabel.textContent = '從目前模式還原';
    storedLevel = validLevel(preference.cleanLevel)
      ? preference.cleanLevel : 1;
    levelInput.value = String(storedLevel);
    levelInput.disabled = false;
    describeLevel();
    for (const button of buttons) {
      const shortcut = commands.find(command => command.name === button.dataset.action)?.shortcut;
      button.querySelector('kbd').textContent = shortcut || '未指定快捷鍵';
      button.disabled = false;
    }
    show(saved[`feedback:${tab.id}`] || '');
  } catch (error) {
    status.textContent = '無法確認目標';
    show(error.message);
  }
}

levelInput.addEventListener('input', describeLevel);
levelInput.addEventListener('change', async () => {
  const requested = Number(levelInput.value);
  if (!validLevel(requested)) return;
  levelInput.disabled = true;
  buttons.forEach(button => { button.disabled = true; });
  try {
    await chrome.storage.local.set({ cleanLevel: requested });
    storedLevel = requested;
    describeLevel();
    show('');
  } catch (error) {
    levelInput.value = String(storedLevel);
    describeLevel();
    show(`無法儲存簡化等級：${error.message}`);
  } finally {
    levelInput.disabled = false;
    buttons.forEach(button => { button.disabled = false; });
  }
});

for (const button of buttons) {
  button.addEventListener('click', async () => {
    if (!target) return;
    buttons.forEach(item => { item.disabled = true; });
    levelInput.disabled = true;
    show('');
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'clean-window:run', action: button.dataset.action, target
      });
      if (!result?.ok) throw new Error(result?.error || '操作未完成。請重新開啟面板。');
      if (result.warning) show(result.warning);
      else window.close();
    } catch (error) {
      show(error.message);
    } finally {
      buttons.forEach(item => { item.disabled = false; });
      levelInput.disabled = false;
    }
  });
}
void init();
