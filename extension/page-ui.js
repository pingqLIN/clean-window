/* Site-side UI lives in an isolated content-script world. It never impersonates Chrome security UI. */
(() => {
  'use strict';
  if (globalThis.__cleanWindowPageUI) return;
  const BAR_ID = 'clean-window-address-ui';
  const BAR_HEIGHT = 48;
  let bar, address, originalPadding, originalPriority, updateTimer;

  function isWebPage() {
    return /^https?:$/.test(location.protocol) && !!document.documentElement;
  }
  function addressURL(value) {
    if (typeof value !== 'string') throw new Error('請輸入網址。');
    const raw = value.trim();
    if (!raw || raw.length > 8192 || /[\x00-\x20\x7f]/.test(raw)) throw new Error('網址不可包含空白或控制字元。');
    if (/^(javascript|data|blob|file|chrome|about|view-source|ftp):/i.test(raw)) throw new Error('僅支援 HTTP(S) 網址。');
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)
        && !/^localhost(?::\d+)?(?:[/?#]|$)/i.test(raw)) throw new Error('僅支援 HTTP(S) 網址。');
    const scheme = /^https?:\/\//i.test(raw) ? '' :
      /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(raw) ? 'http://' : 'https://';
    const url = new URL(scheme + raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) {
      throw new Error('網址無效，或包含不支援的帳號密碼。');
    }
    if (!url.hostname.includes('.') && url.hostname !== 'localhost' && !url.hostname.includes(':')) {
      throw new Error('請輸入完整網站網域。');
    }
    return url.href;
  }
  function stopBar(withFade = false) {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = null;
    const oldBar = bar;
    if (oldBar?.isConnected) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (withFade && !reduced && typeof oldBar.animate === 'function') {
        oldBar.id = BAR_ID + '-exiting';
        oldBar.style.pointerEvents = 'none';
        const exit = oldBar.animate([{ opacity: 1 }, { opacity: 0 }],
          { duration: 120, easing: 'ease-in', fill: 'forwards' });
        void exit.finished.then(() => oldBar.remove(), () => oldBar.remove());
      } else oldBar.remove();
    }
    bar = address = null;
    if (originalPadding) {
      const html = document.documentElement;
      if (originalPadding.value) html.style.setProperty('padding-top', originalPadding.value, originalPriority);
      else html.style.removeProperty('padding-top');
    }
    originalPadding = null;
  }
  function startBar(withDock = false) {
    if (!isWebPage()) throw new Error('自繪網址欄僅支援一般 HTTP(S) 網頁。');
    if (bar?.isConnected && bar.dataset.cwDock === String(withDock)) return;
    if (bar?.isConnected) stopBar();
    const html = document.documentElement;
    originalPadding = { value: html.style.getPropertyValue('padding-top') };
    originalPriority = html.style.getPropertyPriority('padding-top');
    const height = withDock ? 86 : BAR_HEIGHT;
    const currentPadding = getComputedStyle(html).paddingTop || '0px';
    html.style.setProperty('padding-top', `calc(${currentPadding} + ${height}px)`, 'important');
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.dataset.cwDock = withDock ? 'true' : 'false';
    bar.dataset.cwHeight = String(height);
    bar.style.cssText = 'all:initial!important;position:fixed!important;inset:0 0 auto 0!important;height:'+height+'px!important;z-index:2147483647!important;';
    const shadow = bar.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = `
      :host { color-scheme:light; animation:cw-bar-enter .18s cubic-bezier(.16,1,.3,1) both; }
      @keyframes cw-bar-enter {from {opacity:0;transform:translateY(-4px);} to {opacity:1;transform:none;}}
      :host([data-theme="dark"]) { color-scheme:dark; }
      *,*::before,*::after { box-sizing:border-box; }
      .strip { display:flex; align-items:center; gap:8px; height:48px; padding:0 12px;
        transition:background-color .17s ease,color .17s ease,border-color .17s ease;
        background:#f5f6f8; color:#253042; border-bottom:1px solid #d8dce2;
        font:13px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif; }
      button { border:0; border-radius:50%; width:32px; height:32px; flex:none;
        background:transparent; color:inherit; font:18px system-ui; cursor:pointer; }
      button:hover { background:#e2e6ec; }
      button,select { transition:background-color .14s ease,color .14s ease,border-color .14s ease,opacity .14s ease; }
      button:active { opacity:.62; }
      button:focus-visible,input:focus-visible { outline:2px solid #477fe5; outline-offset:1px; }
      .theme-toggle { border-radius:9px;font-size:18px; }
      .ribbon { height:38px;display:flex;align-items:center;gap:4px;padding:2px 10px;
        transition:background-color .17s ease,color .17s ease,border-color .17s ease;
        border-bottom:1px solid #d8dce2;background:#eff3f5;color:#35434a; }
      .ribbon .identity { font-size:10px;letter-spacing:.02em;color:#537566;
        font-weight:700;margin-right:auto;white-space:nowrap; }
      .ribbon button { width:29px;height:29px;font-size:15px;border-radius:7px; }
      .ribbon button[aria-pressed="true"] { color:#176851;background:#dde9e1; }
      .menu { position:absolute;top:86px;right:7px;width:min(340px,calc(100vw - 14px));
        max-height:min(360px,calc(100vh - 100px));overflow-y:auto;
        background:#fff;color:#27313c;border:1px solid #bfcbd2;border-radius:12px;
        padding:10px;box-shadow:0 12px 35px #0004;font:12px/1.4 system-ui; }
      .menu {opacity:1;transform:none;transition:opacity .15s ease,transform .17s ease,display .17s allow-discrete;}
      .menu[hidden] {display:none;opacity:0;transform:translateY(-5px);}
      @starting-style { .menu:not([hidden]) {opacity:0;transform:translateY(-5px);} }
      .menu-header { display:flex;align-items:center;justify-content:space-between;
        font-weight:650;margin-bottom:8px; }
      .menu-row { display:flex;align-items:center;gap:5px;border-top:1px solid #e3e7e9;padding:6px 0; }
      .menu-row {animation:cw-list-enter .17s ease both;}
      @keyframes cw-list-enter {from {opacity:0;transform:translateY(-3px)} to {opacity:1;transform:none}}
      .menu-row .name { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        font-size:12px;text-align:left;width:auto; }
      .menu-row button,.menu-row select,.menu-action {border:1px solid #d8dee7;
        border-radius:7px;background:transparent;color:inherit;font:12px system-ui;
        height:30px;padding:0 6px; }
      .menu-row select {width:52px;}
      .menu-row .icon-button {width:29px;flex:none;}
      .menu-note {line-height:1.6;color:#657581;margin:5px 0; }
      .feedback { position:absolute;top:87px;right:10px;max-width:85%;
        padding:7px 11px;border-radius:8px;color:#fff;background:#8d3434;
        font:12px system-ui;box-shadow:0 2px 8px #0005; }
      .feedback[data-kind="info"] { background:#315c4c; }
      .feedback[data-kind="warning"] { background:#705326; }
      .feedback .feedback-actions { display:flex;gap:6px;margin-top:7px; }
      .feedback .feedback-actions button { width:auto;height:auto;padding:5px 8px;border-radius:6px;
        background:#fff;color:#28332d;font:12px system-ui; }
      .feedback {transition:opacity .14s ease,display .14s allow-discrete;}
      .feedback[hidden] { display:none;opacity:0; }
      @starting-style {.feedback:not([hidden]) {opacity:0;}}
      form { margin:0; flex:1; min-width:0; }
      input { width:100%; height:34px; padding:0 14px; border:1px solid #d8dee7;
        border-radius:18px; background:#fff; color:#202124;
        font:13px system-ui,-apple-system,'Segoe UI',sans-serif;
        transition:background-color .17s ease,color .17s ease,border-color .17s ease; }
      input:focus { border-color:#8aa9ec; }
      :host([data-theme="dark"]) .strip { background:#292b30; color:#e7e9ee; border-color:#45474d; }
      :host([data-theme="dark"]) button:hover { background:#3b3e44; }
      :host([data-theme="dark"]) .theme-toggle { color:#f0f2f5; }
      :host([data-theme="dark"]) input { background:#3b3f46; color:#f0f2f5; border-color:#525761; }
      :host([data-theme="dark"]) .ribbon { background:#262e32;color:#e4ebee;border-color:#45474d; }
      :host([data-theme="dark"]) .ribbon .identity { color:#9cd4b7; }
      :host([data-theme="dark"]) .ribbon button[aria-pressed="true"] { color:#9cd4b7;background:#385347; }
      :host([data-theme="dark"]) .menu { background:#27333a;color:#f0f3f3;border-color:#53626a; }
      :host([data-theme="dark"]) .menu-row { border-color:#44515a; }
      :host([data-theme="dark"]) .menu-row button,
      :host([data-theme="dark"]) .menu-row select,
      :host([data-theme="dark"]) .menu-action { border-color:#62717a; }
      :host([data-theme="dark"]) .menu-note {color:#b6c9ce; }
      @media(max-width:480px) { .strip { gap:3px; padding:0 6px; } }
      @media(prefers-reduced-motion:reduce) {
        :host {animation:none!important;}
        button,select,input,.strip,.ribbon,.menu,.feedback,.menu-row {transition:none!important;animation:none!important;}
      }
    `;
    const strip = document.createElement('div');
    strip.className = 'strip';
    const makeButton = (glyph, title, onClick) => {
      const button = document.createElement('button');
      button.type='button'; button.textContent=glyph; button.title=title;
      button.setAttribute('aria-label',title);
      button.addEventListener('click',e=>{e.stopPropagation();onClick();});
      return button;
    };
    const back=makeButton('‹','上一頁',()=>history.back());
    const forward=makeButton('›','下一頁',()=>history.forward());
    const reload=makeButton('↻','重新整理',()=>location.reload());
    const themeButton=makeButton('☾','切換為深色工具列',()=>{});
    themeButton.className='theme-toggle';
    let manualTheme=false;
    const applyTheme=theme=>{
      if (!bar) return;
      bar.dataset.theme=theme;
      themeButton.textContent=theme==='dark'?'☀':'☾';
      const label=theme==='dark'?'切換為淺色工具列':'切換為深色工具列';
      themeButton.title=label;
      themeButton.setAttribute('aria-label',label);
      themeButton.setAttribute('aria-pressed',String(theme==='dark'));
    };
    applyTheme(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light');
    themeButton.addEventListener('click',async()=>{
      manualTheme=true;
      const next=bar?.dataset.theme==='dark'?'light':'dark';
      applyTheme(next);
      try {await chrome.storage.local.set({cleanWindowUiTheme:next});}
      catch(error){feedback.textContent='無法儲存工具列主題：'+(error?.message||String(error));feedback.hidden=false;}
    });
    const form=document.createElement('form');
    address=document.createElement('input');
    address.type='text'; address.inputMode='url';address.autocomplete='off';
    address.spellcheck=false;address.setAttribute('aria-label','自繪網址欄，非 Chrome 原生網址列');
    address.title='僅供網址導覽；Chrome 網站身分與安全狀態請在普通視窗檢查';
    address.value=location.href;
    form.append(address);
    let navigationBusy = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();event.stopPropagation();
      let target;
      try { target = addressURL(address.value); }
      catch(error) {address.setCustomValidity(error.message); address.reportValidity();address.setCustomValidity('');return;}
      // Same-origin navigation keeps activeTab access and needs no extra prompt.
      if (new URL(target).origin === location.origin) { location.assign(target); return; }
      if (navigationBusy) return;
      navigationBusy = true;
      address.disabled = true;
      feedback.hidden = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'clean-window:navigate', url: target });
        if (!result?.ok) throw new Error(result?.error || '無法準備跨網站導覽。');
        if (result.action === 'navigate') { location.assign(target); return; }
        if (result.action === 'prompt') {
          feedback.dataset.kind = 'info';
          feedback.textContent = `已開啟「${new URL(target).host}」的存取選擇視窗。允許後可保留工具列；不授權也可直接前往。`;
          feedback.hidden = false;
          return;
        }
        throw new Error('無法辨識導覽狀態。');
      } catch(error) {
        showNavigationFallback(target, error?.message || String(error));
      } finally {
        navigationBusy = false;
        address.disabled = false;
      }
    });
    strip.addEventListener('pointerdown',event=>event.stopPropagation());
    strip.addEventListener('click',event=>event.stopPropagation());
    strip.append(back,forward,reload,form,themeButton);
    const feedback=document.createElement('div');
    feedback.className='feedback';feedback.hidden=true;feedback.setAttribute('role','status');
    const showNavigationFallback = (target, reason) => {
      feedback.replaceChildren();
      const message = document.createElement('div');
      message.textContent = `無法開啟網站授權選擇（${String(reason).slice(0,180)}）。可留在此頁，或不授權直接前往；跨來源後工具列可能消失。`;
      const actions = document.createElement('div');
      actions.className = 'feedback-actions';
      const proceed = document.createElement('button');
      proceed.type = 'button'; proceed.textContent = '不授權，仍然前往';
      proceed.addEventListener('click', event => { event.stopPropagation(); location.assign(target); });
      const stay = document.createElement('button');
      stay.type = 'button'; stay.textContent = '留在此頁';
      stay.addEventListener('click', event => {
        event.stopPropagation(); feedback.hidden = true; feedback.replaceChildren(); address.value = location.href;
      });
      actions.append(proceed, stay);
      feedback.append(message, actions);
      feedback.dataset.kind = 'warning'; feedback.hidden = false;
    };
    let ribbon=null, menu=null;
    if (withDock) {
      ribbon=document.createElement('div');ribbon.className='ribbon';
      ribbon.setAttribute('aria-label','第一級 · 輕量瀏覽器工具列');
      const identity=document.createElement('span');
      identity.className='identity';identity.textContent='CW · LITE';
      ribbon.append(identity);
      menu=document.createElement('div');menu.className='menu';
      menu.hidden=true;menu.setAttribute('role','region');
      menu.setAttribute('aria-label','乾淨視窗工具選單');
      const hub=async(action,extras={})=>{
        const result=await chrome.runtime.sendMessage({type:'clean-window:hub',action,...extras});
        if (!result?.ok) throw new Error(result?.error || '操作失敗');
        return result;
      };
      const report=error=>{
        feedback.textContent=error?.message || String(error);
        feedback.hidden=false;
      };
      const clearMenu=()=>{menu.replaceChildren();menu.hidden=true;};
      const openMenu=title=>{
        const heading=document.createElement('div');heading.className='menu-header';
        heading.textContent=title;
        const close=makeButton('×','關閉工具選單',clearMenu);
        heading.append(close);menu.replaceChildren(heading);
        menu.hidden=false;
      };
      const note=message=>{
        const n=document.createElement('p');n.className='menu-note';
        n.textContent=message;menu.append(n);
      };
      const itemButton=(label,title,click)=>{
        const el=document.createElement('button');el.type='button';
        el.textContent=label;el.title=title;el.setAttribute('aria-label',title);
        el.addEventListener('click',()=>{void Promise.resolve().then(click).catch(report);});
        return el;
      };
      const row=()=>{
        const el=document.createElement('div');el.className='menu-row';
        menu.append(el);return el;
      };
      const windowsList=async()=>{
        openMenu('已啟用乾淨模式');
        const result=await hub('list');
        if (!result.items.length) {note('目前沒有可管理的乾淨 Popup。');return;}
        for (const item of result.items) {
          const line=row();
          const focus=itemButton(item.title,'切換至 '+item.title,async()=>{
            await hub('focus',{target:{tabId:item.tabId,windowId:item.windowId}});
            clearMenu();
          });focus.className='name';line.append(focus);
          const level=document.createElement('select');level.setAttribute('aria-label','簡化等級 · '+item.title);
          for (const n of [1,2,3]) {
            const option=document.createElement('option');
            option.value=String(n);option.textContent='L'+n;level.append(option);
          }
          level.value=String(item.level);
          level.addEventListener('change',()=>{void hub('set-level',{
            target:{tabId:item.tabId,windowId:item.windowId},level:Number(level.value)
          }).then(windowsList).catch(error=>{level.value=String(item.level);report(error);});});
          line.append(level);
          const restore=itemButton('↗','還原 '+item.title,async()=>{
            await hub('restore',{target:{tabId:item.tabId,windowId:item.windowId}});
            await windowsList();
          });restore.className='icon-button';line.append(restore);
        }
      };
      const bookmarksList=async()=>{
        openMenu('常用書籤');
        const result=await hub('bookmarks-recent');
        if (!result.granted) {
          note('書籤功能需要另外授權；不會自動讀取你的書籤。');
          const grant=itemButton('啟用書籤功能','開啟書籤授權視窗',()=>{
            return hub('bookmarks-grant');
          });grant.className='menu-action';menu.append(grant);return;
        }
        if (!result.items.length){note('沒有可顯示的 HTTP(S) 書籤。');return;}
        for (const item of result.items){
          const line=row();const btn=itemButton(item.title,'前往書籤 '+item.title,()=>{
            const url=new URL(item.url);
            if (!['http:','https:'].includes(url.protocol)) throw new Error('不支援的書籤網址');
            location.assign(url.href);
          });btn.className='name';line.append(btn);
        }
      };
      const command=(glyph,title,fn)=>{
        const button=makeButton(glyph,title,()=>{feedback.hidden=true;
          void Promise.resolve().then(fn).catch(report);});
        ribbon.append(button);return button;
      };
      command('☆','加入或移除目前網頁書籤',async()=>{
        const permission=await hub('bookmarks-status');
        if (!permission.granted) {await hub('bookmarks-grant');return;}
        const result=await hub('bookmarks-toggle',{title:document.title});
        bookmark.textContent=result.bookmarked?'★':'☆';
        bookmark.setAttribute('aria-pressed',String(result.bookmarked));
      });
      const bookmark=ribbon.lastElementChild;
      bookmark.setAttribute('aria-pressed','false');
      bookmark.addEventListener('pointerenter',()=>{
        void hub('bookmarks-state').then(state=>{
          if (state.granted) {
            bookmark.textContent=state.bookmarked?'★':'☆';
            bookmark.setAttribute('aria-pressed',String(state.bookmarked));
          }
        }).catch(()=>{});
      });
      command('▤','瀏覽書籤',bookmarksList);
      command('☷','管理乾淨視窗',windowsList);
      command('◷','在 Chrome 開啟瀏覽紀錄',()=>hub('history'));
      command('↓','在 Chrome 開啟下載內容',()=>hub('downloads'));
      command('⚙','管理 Chrome 擴充功能',async()=>{
        const response=await chrome.runtime.sendMessage({type:'clean-window:dock',action:'manage'});
        if (!response?.ok) throw new Error(response?.error||'無法開啟擴充管理');
      });
      command('↗','將目前頁面還原至完整 Chrome',async()=>{
        const response=await chrome.runtime.sendMessage({type:'clean-window:dock',action:'restore'});
        if (!response?.ok) throw new Error(response?.error||'無法還原視窗');
      });
    }
    if (ribbon) shadow.append(style,strip,ribbon,menu,feedback);
    else shadow.append(style,strip,feedback);

    html.appendChild(bar);
    const currentBar=bar;
    void chrome.storage.local.get('cleanWindowUiTheme').then(saved=>{
      if (bar!==currentBar || manualTheme) return;
      if (saved.cleanWindowUiTheme==='light' || saved.cleanWindowUiTheme==='dark') {
        applyTheme(saved.cleanWindowUiTheme);
      }
    }).catch(()=>{});
    updateTimer=setInterval(()=>{
      if (!bar?.isConnected) {stopBar(); return;}
      if (address && shadow.activeElement !== address && address.value !== location.href) address.value=location.href;
    },750);
  }
  function apply(mode) {
    if (mode === 'off') {stopBar(true);return {ok:true,active:false};}
    if (mode === 'address') {startBar(false);return {ok:true,active:true};}
    if (mode === 'address-dock') {startBar(true);return {ok:true,active:true};}
    throw new Error('不支援的頁面顯示模式。');
  }
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if (message?.type !== 'clean-window:page-ui') return false;
    try {respond(apply(message.mode));}
    catch(error) {respond({ok:false,error:error?.message || String(error)});}
    return false;
  });
  // Shared only inside this extension's isolated world; preview never calls the background worker.
  globalThis.__cleanWindowPageUI = { apply };
})();
