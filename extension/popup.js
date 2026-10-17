const buttons = [...document.querySelectorAll('button[data-action]')];
const status = document.querySelector('#target-status');
const feedback = document.querySelector('#feedback');
const levelInput = document.querySelector('#clean-level');
const levelNumber = document.querySelector('#level-number');
const levelTitle = document.querySelector('#level-title');
const levelDetail = document.querySelector('#level-detail');
const levelLimit = document.querySelector('#level-limit');
const levelPreview = document.querySelector('.level-preview');
const cleanLabel = document.querySelector('#clean-label');
const cleanDescription = document.querySelector('#clean-description');
const managed = document.querySelector('#managed-windows');
const managedList = document.querySelector('#managed-list');
const managedCount = document.querySelector('#managed-count');

const requestHub = async (action,extra={})=>{
  const result=await chrome.runtime.sendMessage({type:'clean-window:hub',action,...extra});
  if (!result?.ok) throw new Error(result?.error||'管理操作失敗');
  return result;
};
const managedButton=(title,fn)=>{
  const el=document.createElement('button');
  el.type='button';el.textContent=title;
  el.addEventListener('click',async()=>{
    el.disabled=true;
    try{await fn();}catch(error){show(error.message);}
    finally{el.disabled=false;}
  });
  return el;
};
async function loadManaged(){
  if (!managedList) return;
  try {
    const {items}=await requestHub('list');
    managedCount.textContent=items.length ? String(items.length) : '';
    managedList.replaceChildren();
    if (!items.length){
      const empty=document.createElement('p');empty.className='managed-empty';
      empty.textContent='目前沒有已啟用的乾淨視窗。';managedList.append(empty);return;
    }
    for(const item of items){
      const line=document.createElement('div');line.className='managed-row';
      const text=managedButton(item.title,async()=>{
        await requestHub('focus',{target:{tabId:item.tabId,windowId:item.windowId}});
        window.close();
      });
      text.className='managed-name';text.title=item.title;
      const selector=document.createElement('select');
      selector.setAttribute('aria-label','調整 '+item.title+' 的簡化等級');
      for(const level of [1,2,3]){
        const opt=document.createElement('option');opt.value=String(level);
        opt.textContent='L'+level;selector.append(opt);
      }
      selector.value=String(item.level);
      selector.addEventListener('change',async()=>{
        selector.disabled=true;
        try{
          await requestHub('set-level',{target:{tabId:item.tabId,windowId:item.windowId},level:Number(selector.value)});
          await loadManaged();
        }catch(error){selector.value=String(item.level);show(error.message);}
        finally{selector.disabled=false;}
      });
      const restore=managedButton('↗',async()=>{
        await requestHub('restore',{target:{tabId:item.tabId,windowId:item.windowId}});
        await loadManaged();
      });
      restore.title='還原至普通視窗';
      restore.setAttribute('aria-label','還原 '+item.title);
      line.append(text,selector,restore);managedList.append(line);
    }
  } catch(error){show(error.message);}
}
if(managed) managed.addEventListener('toggle',()=>{if(managed.open) void loadManaged();});


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
  if (levelPreview && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    levelPreview.classList.remove('changing');
    void levelPreview.offsetWidth;
    levelPreview.classList.add('changing');
  }
  if (!isRestoring) {
    cleanLabel.textContent = '套用此簡化等級';
    cleanDescription.textContent = level === 1
      ? '精簡 Popup，搭配輕量瀏覽器雙列工具列。'
      : level === 2 ? '精簡 Popup，搭配自繪網址欄。'
        : '將目前分頁移至純精簡 Popup。';
  }
  if (levelPreview) {
    const stage = document.querySelector?.('#morph-stage');
    if (stage) {
      stage.dataset.selectedLevel = String(level);
      stage.dataset.previewLevel = String(level);
      const badge = document.querySelector?.('#morph-badge-num');
      if (badge) badge.textContent = `0${level}`;
    }
    const diagramTarget = document.querySelector?.('#diagram-target');
    if (diagramTarget) diagramTarget.dataset.level = String(level);
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
    if (managedList) void loadManaged();
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

if (levelPreview) {
  const stage = document.querySelector?.('#morph-stage');
  if (stage) {
    const zones = stage.querySelectorAll?.('.morph-zone');
    const badge = stage.querySelector?.('#morph-badge-num');

    zones?.forEach(zone => {
      zone.addEventListener('mouseenter', () => {
        const lvl = zone.dataset.level;
        if (lvl) {
          stage.dataset.previewLevel = lvl;
          if (badge) badge.textContent = `0${lvl}`;
        }
      });

      zone.addEventListener('click', (e) => {
        e.stopPropagation();
        const lvl = zone.dataset.level;
        if (lvl && levelInput && !levelInput.disabled) {
          stage.dataset.selectedLevel = lvl;
          stage.dataset.previewLevel = lvl;
          if (badge) badge.textContent = `0${lvl}`;
          levelInput.value = lvl;
          describeLevel();
          levelInput.dispatchEvent(new Event('change'));
        }
      });
    });

    stage.addEventListener('mouseleave', () => {
      const current = stage.dataset.selectedLevel || '1';
      stage.dataset.previewLevel = current;
      if (badge) badge.textContent = `0${current}`;
    });
  }
}

const themeToggle = document.querySelector?.('#theme-toggle');
if (themeToggle && typeof window !== 'undefined' && document?.documentElement) {
  const applyTheme = (theme) => {
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

