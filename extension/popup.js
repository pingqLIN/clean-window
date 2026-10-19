const buttons = [...document.querySelectorAll('button[data-action]')];
const status = document.querySelector('#target-status');
const feedback = document.querySelector('#feedback');
const feedbackIcon = document.querySelector('#feedback-icon');
const scope = document.querySelector('#scope');
const scopePips = document.querySelector('#scope-pips');
const root = document.querySelector('main');
const levelInput = document.querySelector('#clean-level');
const levelNumber = document.querySelector('#level-number');
const levelTitle = document.querySelector('#level-title');
const levelDetail = document.querySelector('#level-detail');
const levelLimit = document.querySelector('#level-limit');
const cleanLabel = document.querySelector('#clean-label');
const cleanDescription = document.querySelector('#clean-description');
const managed = document.querySelector('#managed-windows');
const managedList = document.querySelector('#managed-list');
const managedCount = document.querySelector('#managed-count');

// Words below only reach assistive tech (aria-*, sr-only nodes) and hover tooltips.
const levels = {
  1: {
    name: '輕量瀏覽器工具列',
    detail: '雙列工具列包含網址導覽、書籤、乾淨視窗清單、歷史紀錄、下載與還原入口。',
    limit: '這些是 Clean Window 自繪快捷功能，非 Chrome 原生網址欄或第三方擴充按鈕；書籤需另外授權。'
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

const RESTORE_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10"/><path d="M9 2h5v5M14 2L7.5 8.5"/></svg>';
const EMPTY_SVG = '<svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="2"/></svg>';
const icon = html => {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild;
};

// One pip per item; past `max` a short dash says "and more".
const renderPips = (container, count, max) => {
  if (!container) return;
  container.replaceChildren();
  for (let index = 0; index < Math.min(count, max); index++) container.append(document.createElement('i'));
  if (count > max) {
    const more = document.createElement('i');
    more.className = 'more';
    container.append(more);
  }
};

let target;
let isRestoring = false;
let managedPopup = false;
let storedLevel = 1;

// kind: 'error' | 'warn' | 'info'. The visible part is a glyph; the sentence goes to
// the live region (screen readers) and the glyph's tooltip.
const show = (message, kind = 'error') => {
  feedback.textContent = message;
  feedback.hidden = !message;
  if (!feedbackIcon) return;
  feedbackIcon.hidden = true;
  if (message) {
    void feedbackIcon.offsetWidth;
    feedbackIcon.dataset.kind = kind;
    feedbackIcon.title = message;
    feedbackIcon.hidden = false;
  } else {
    feedbackIcon.title = '';
  }
};
const setScopeState = state => { if (scope) scope.dataset.state = state; };

const requestHub = async (action, extra = {}) => {
  const result = await chrome.runtime.sendMessage({ type: 'clean-window:hub', action, ...extra });
  if (!result?.ok) throw new Error(result?.error || '管理操作失敗');
  return result;
};
const managedButton = fn => {
  const el = document.createElement('button');
  el.type = 'button';
  el.addEventListener('click', async () => {
    el.disabled = true;
    try { await fn(); } catch (error) { show(error.message); }
    finally { el.disabled = false; }
  });
  return el;
};

// Identity glyph for a managed window: the title's own leading icon/emoji when it has
// one, otherwise a stable shape + tone derived from the title.
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const leadGrapheme = title => {
  const text = String(title || '').trim();
  if (!text) return '';
  return segmenter ? ([...segmenter.segment(text)][0]?.segment || '') : ([...text][0] || '');
};
const isIconGrapheme = value => /[\p{S}\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u.test(value);
const hashOf = text => {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
};
const identityOf = title => {
  const el = document.createElement('span');
  el.className = 'ident';
  el.setAttribute('aria-hidden', 'true');
  const lead = leadGrapheme(title);
  if (isIconGrapheme(lead)) {
    el.textContent = lead;
  } else {
    const h = hashOf(String(title || ''));
    el.dataset.shape = ['circle', 'square', 'diamond', 'triangle'][h % 4];
    el.dataset.tone = String((h >>> 3) % 6);
  }
  return el;
};

const levelSegOf = item => {
  const targetOf = { tabId: item.tabId, windowId: item.windowId };
  const group = document.createElement('div');
  group.className = 'level-seg';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', '調整 ' + item.title + ' 的簡化等級');
  for (const level of [1, 2, 3]) {
    const seg = document.createElement('button');
    seg.type = 'button';
    seg.className = 'seg';
    seg.setAttribute('role', 'radio');
    seg.setAttribute('aria-checked', String(item.level === level));
    seg.setAttribute('aria-label', '第 ' + level + ' 級：' + levels[level].name);
    seg.title = levels[level].name;
    seg.addEventListener('click', async () => {
      if (level === item.level) return;
      const all = [...group.querySelectorAll('button')];
      all.forEach(button => { button.disabled = true; });
      try {
        await requestHub('set-level', { target: targetOf, level });
        await loadManaged();
      } catch (error) {
        show(error.message);
        all.forEach(button => { button.disabled = false; });
      }
    });
    group.append(seg);
  }
  return group;
};

async function loadManaged() {
  if (!managedList) return;
  try {
    const { items } = await requestHub('list');
    renderPips(managedCount, items.length, 4);
    managed.querySelector('summary')?.setAttribute('aria-label', '已啟用乾淨視窗 · ' + items.length);
    managedList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'managed-empty';
      empty.setAttribute('role', 'status');
      empty.setAttribute('aria-label', '目前沒有已啟用的乾淨視窗。');
      empty.title = '目前沒有已啟用的乾淨視窗。';
      empty.append(icon(EMPTY_SVG));
      managedList.append(empty);
      return;
    }
    for (const item of items) {
      const targetOf = { tabId: item.tabId, windowId: item.windowId };
      const line = document.createElement('div');
      line.className = 'managed-row';
      const name = managedButton(async () => {
        await requestHub('focus', { target: targetOf });
        window.close();
      });
      name.className = 'managed-name';
      name.title = item.title;
      name.setAttribute('aria-label', item.title);
      name.append(identityOf(item.title));
      const restore = managedButton(async () => {
        await requestHub('restore', { target: targetOf });
        await loadManaged();
      });
      restore.className = 'managed-restore';
      restore.title = '還原至普通視窗';
      restore.setAttribute('aria-label', '還原 ' + item.title);
      restore.append(icon(RESTORE_SVG));
      line.append(name, levelSegOf(item), restore);
      managedList.append(line);
    }
  } catch (error) { show(error.message); }
}
if (managed) managed.addEventListener('toggle', () => { if (managed.open) void loadManaged(); });

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
      ? '精簡 Popup，搭配輕量瀏覽器雙列工具列。'
      : level === 2 ? '精簡 Popup，搭配自繪網址欄。'
        : '將目前分頁移至純精簡 Popup。';
  }
  const stage = document.querySelector?.('#morph-stage');
  if (stage) {
    stage.dataset.selectedLevel = String(level);
    stage.dataset.previewLevel = String(level);
    stage.querySelectorAll?.('.pip').forEach(pip => {
      pip.setAttribute('aria-checked', String(pip.dataset.level === String(level)));
    });
  }
  const diagramTarget = document.querySelector?.('#diagram-target');
  if (diagramTarget) diagramTarget.dataset.level = String(level);
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
    renderPips(scopePips, tabs.length, 5);
    setScopeState('ok');
    const record = saved[`clean:${tab.id}`];
    managedPopup = win.type === 'popup' && record?.phase === 'open'
      && record.popupWindowId === win.id;
    isRestoring = win.state === 'fullscreen' || win.type === 'popup'
      || (win.type === 'normal' && record?.detachedType === 'normal'
        && record.originWindowId !== win.id
        && (record.detachedWindowId === win.id || record.phase === 'opening'));
    if (isRestoring) cleanLabel.textContent = '從目前模式還原';
    if (root) root.dataset.restoring = String(isRestoring);
    // A managed popup's active mode takes precedence over the global default.
    storedLevel = managedPopup && validLevel(record.cleanLevel)
      ? record.cleanLevel
      : validLevel(preference.cleanLevel) ? preference.cleanLevel : 1;
    const edgeHandle = document.querySelector?.('#edge-tab .et-handle');
    if (edgeHandle) {
      edgeHandle.setAttribute('aria-label', managedPopup ? '編輯乾淨模式標題' : '開啟乾淨模式後可編輯標題');
      edgeHandle.dataset.tip = managedPopup
        ? '點選：編輯標題\n短線僅顯示模式'
        : '先啟用乾淨模式，才能編輯標題\n短線僅供預覽';
    }
    levelInput.value = String(storedLevel);
    levelInput.disabled = false;
    describeLevel();
    for (const button of buttons) {
      const shortcut = commands.find(command => command.name === button.dataset.action)?.shortcut;
      const kbd = button.querySelector('kbd');
      if (kbd) kbd.textContent = shortcut || '未指定快捷鍵';
      if (shortcut) {
        button.title = `${button.title || ''} · ${shortcut}`.replace(/^ · /, '');
        button.setAttribute?.('aria-keyshortcuts', shortcut.replace(/\s+/g, ''));
      }
      button.disabled = false;
    }
    show(saved[`feedback:${tab.id}`] || '', 'warn');
    if (managedList) void loadManaged();
  } catch (error) {
    status.textContent = '無法確認目標';
    setScopeState('error');
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
      if (result.warning) show(result.warning, 'warn');
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

// Dots select a local preview; only the black button applies a mode.
const stage = document.querySelector?.('#morph-stage');
if (stage) {
  const selected = () => stage.dataset.selectedLevel || '1';
  let applying = false;
  stage.querySelector?.('.morph-action')?.addEventListener('click', async event => {
    event.stopPropagation();
    const level = Number(selected());
    if (!validLevel(level) || levelInput.disabled || !target || applying) return;
    applying = true;
    const previous = storedLevel;
    try {
      await chrome.storage.local.set({ cleanLevel: level });
      storedLevel = level;
      show('');
      let result;
      if (managedPopup) result = await requestHub('set-level', { target, level });
      else {
        result = await chrome.runtime.sendMessage({ type: 'clean-window:run', action: 'toggle-clean', target });
        if (!result?.ok) throw new Error(result?.error || '套用簡化模式失敗');
      }
      if (result.warning) show(result.warning, 'warn');
      else window.close();
    } catch (error) {
      storedLevel = previous;
      levelInput.value = String(previous);
      describeLevel();
      show('無法套用簡化等級：' + (error?.message || String(error)));
    } finally { applying = false; }
  });
  stage.addEventListener('mouseleave', () => { stage.dataset.previewLevel = selected(); });

  // Mode caption (shown while hovering the pips) and the edge-tab hint follow the previewed level.
  const MODES = {
    1: ['Standard Mode', 'Two-row toolbar with URL bar and quick actions.'],
    2: ['Compact Mode', 'Slim URL bar only.'],
    3: ['Focus Mode', 'Title bar only. Pure content.']
  };
  const caption = stage.querySelector?.('.morph-caption');
  const edgeTab = document.querySelector?.('#edge-tab');
  const syncEdge = () => {
    const level = stage.dataset.selectedLevel || '1';
    edgeTab?.querySelectorAll?.('.et-stop').forEach(item => {
      const on = item.dataset.level === level;
      item.classList.toggle('selected', on);
    });
  };
  const syncPreview = () => {
    const level = stage.dataset.previewLevel || '1';
    const [name, text] = MODES[level] || MODES[1];
    if (caption?.children?.[1]) { caption.children[0].textContent = name; caption.children[1].textContent = text; }
    syncEdge();
  };
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(syncPreview).observe(stage, { attributes: true, attributeFilter: ['data-preview-level', 'data-selected-level'] });
  }
  syncPreview();

  // Popup edge bars are decorative; only its handle can edit the title.
  if (edgeTab) {
    edgeTab.querySelector?.('.et-handle')?.addEventListener('click', async () => {
      if (!target) return;
      if (!managedPopup) {
        show('請先開啟乾淨模式，再編輯視窗標題。', 'info');
        return;
      }
      try {
        const result = await chrome.runtime.sendMessage({ type: 'clean-window:run', action: 'edit-title', target });
        if (!result?.ok) throw new Error(result?.error || '無法開啟標題編輯器。');
        window.close();
      } catch (error) { show(error.message); }
    });
  }

  // Pips: hovering previews temporarily, clicking selects until the black button applies.
  const pipsBox = stage.querySelector?.('.level-pips');
  if (pipsBox) {
    const enter = level => { stage.dataset.pips = 'on'; if (level) stage.dataset.previewLevel = level; };
    const leave = () => { delete stage.dataset.pips; stage.dataset.previewLevel = selected(); };
    pipsBox.addEventListener('pointerenter', () => enter());
    pipsBox.addEventListener('pointerleave', leave);
    pipsBox.querySelectorAll?.('.pip').forEach(pip => {
      pip.addEventListener('click', () => {
        const level = Number(pip.dataset.level);
        if (!validLevel(level) || levelInput.disabled || !target) return;
        levelInput.value = String(level);
        describeLevel();
        enter(String(level));
      });
      pip.addEventListener('focus', () => enter(pip.dataset.level));
      pip.addEventListener('blur', () => { if (!pipsBox.matches(':hover')) leave(); });
    });
  }

  // Tilt: pointer on the left third leans the button left, centre third stays level, right leans right.
  const wrap = stage.querySelector('.morph-wrap');
  const pill = stage.querySelector('.morph-zones');
  if (wrap && pill) {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    let tgt = 0, cur = 0, raf = 0;
    const tick = () => {
      cur += (tgt - cur) * 0.18;
      pill.style.setProperty('--cw-hover-y', (cur * 4).toFixed(2) + 'deg');
      pill.style.setProperty('--cw-hover-z', (cur * 0.8).toFixed(2) + 'deg');
      raf = Math.abs(tgt - cur) > 0.002 ? requestAnimationFrame(tick) : 0;
    };
    const aim = value => { tgt = value; if (!still && !raf) raf = requestAnimationFrame(tick); };
    wrap.addEventListener('pointermove', event => {
      const rect = wrap.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const d = (x - 0.5) * 2;
      aim(Math.sign(d) * Math.max(0, (Math.abs(d) - 0.33) / 0.67));
      pill.style.setProperty('--mx', (x * 100).toFixed(0) + '%');
    });
    wrap.addEventListener('pointerleave', () => { aim(0); stage.dataset.previewLevel = selected(); });
  }
}

const themeToggle = document.querySelector?.('#theme-toggle');
if (themeToggle && typeof window !== 'undefined' && document?.documentElement) {
  const applyTheme = theme => {
    document.documentElement.dataset.theme = theme;
    try { chrome.storage?.local?.set({ cwTheme: theme }); } catch {}
  };
  chrome.storage?.local?.get('cwTheme').then(data => {
    if (data?.cwTheme) applyTheme(data.cwTheme);
  }).catch(() => {});
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
    applyTheme(isDark ? 'light' : 'dark');
  });
}
