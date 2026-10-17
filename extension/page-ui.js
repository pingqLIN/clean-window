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
  function stopBar() {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = null;
    bar?.remove();
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
    if (bar?.isConnected) return;
    const html = document.documentElement;
    originalPadding = { value: html.style.getPropertyValue('padding-top') };
    originalPriority = html.style.getPropertyPriority('padding-top');
    const currentPadding = getComputedStyle(html).paddingTop || '0px';
    html.style.setProperty('padding-top', `calc(${currentPadding} + ${BAR_HEIGHT}px)`, 'important');
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.dataset.cwDock = withDock ? 'true' : 'false';
    bar.style.cssText = 'all:initial!important;position:fixed!important;inset:0 0 auto 0!important;height:48px!important;z-index:2147483647!important;';
    const shadow = bar.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = `
      :host { color-scheme:light dark; }
      *,*::before,*::after { box-sizing:border-box; }
      .strip { display:flex; align-items:center; gap:8px; height:48px; padding:0 12px;
        background:#f5f6f8; color:#253042; border-bottom:1px solid #d8dce2;
        font:13px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif; }
      button { border:0; border-radius:50%; width:32px; height:32px; flex:none;
        background:transparent; color:inherit; font:18px system-ui; cursor:pointer; }
      button:hover { background:#e2e6ec; }
      button:focus-visible,input:focus-visible { outline:2px solid #477fe5; outline-offset:1px; }
      .brand { flex:none; font-size:10px; letter-spacing:.02em; color:#566578;
        padding:0 6px; white-space:nowrap; }
      .dock { display:flex; align-items:center; gap:3px; flex:none; padding-left:7px;
        border-left:1px solid #cfd5dd; }
      .dock button { font-size:13px; border-radius:8px; width:31px; height:30px; }
      .dock .mark { font-size:11px; font-weight:750; color:#176851; }
      .feedback { position:absolute;top:49px;right:10px;max-width:85%;
        padding:7px 11px;border-radius:8px;color:#fff;background:#8d3434;
        font:12px system-ui;box-shadow:0 2px 8px #0005; }
      .feedback[hidden] { display:none; }
      form { margin:0; flex:1; min-width:0; }
      input { width:100%; height:34px; padding:0 14px; border:1px solid #d8dee7;
        border-radius:18px; background:#fff; color:#202124;
        font:13px system-ui,-apple-system,'Segoe UI',sans-serif; }
      input:focus { border-color:#8aa9ec; }
      @media(prefers-color-scheme:dark) {
        .strip { background:#292b30; color:#e7e9ee; border-color:#45474d; }
        button:hover { background:#3b3e44; }
        .brand { color:#aab2bf; }
        input { background:#3b3f46; color:#f0f2f5; border-color:#525761; }
        .dock { border-color:#555c66; }
        .dock .mark { color:#85c9a9; }
      }
      @media(max-width:480px) { .strip { gap:3px; padding:0 6px; } .brand {font-size:9px;padding:0 2px;} }
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
    const brand=document.createElement('span');
    brand.className='brand'; brand.textContent='Clean Window · 自繪';
    const form=document.createElement('form');
    address=document.createElement('input');
    address.type='text'; address.inputMode='url';address.autocomplete='off';
    address.spellcheck=false;address.setAttribute('aria-label','自繪網址欄，非 Chrome 原生網址列');
    address.title='僅供網址導覽；Chrome 網站身分與安全狀態請在普通視窗檢查';
    address.value=location.href;
    form.append(address);
    form.addEventListener('submit',event=>{
      event.preventDefault();event.stopPropagation();
      try {location.assign(addressURL(address.value));}
      catch(error) {address.setCustomValidity(error.message); address.reportValidity();address.setCustomValidity('');}
    });
    strip.addEventListener('pointerdown',event=>event.stopPropagation());
    strip.addEventListener('click',event=>event.stopPropagation());
    strip.append(back,forward,reload,brand,form);
    const feedback=document.createElement('div');
    feedback.className='feedback';feedback.hidden=true;feedback.setAttribute('role','status');
    if (withDock) {
      const dock=document.createElement('div');
      dock.className='dock';dock.setAttribute('aria-label','Clean Window 擴充工具列');
      const action=(label,glyph,actionName)=>{
        const button=makeButton(glyph,label,async()=>{
          feedback.hidden=true;
          button.disabled=true;
          try {
            const result=await chrome.runtime.sendMessage({type:'clean-window:dock',action:actionName});
            if (!result?.ok) throw new Error(result?.error || '操作失敗');
          } catch(error) {
            feedback.textContent=error?.message || '操作失敗';
            feedback.hidden=false;
          } finally {button.disabled=false;}
        });
        return button;
      };
      const own=action('Clean Window：還原目前視窗','CW','restore');
      own.classList.add('mark');
      const manage=action('管理已安裝的擴充功能（不是啟動其他擴充）','⚙','manage');
      dock.append(own,manage);
      strip.append(dock);
    }
    shadow.append(style,strip,feedback);
    html.appendChild(bar);
    updateTimer=setInterval(()=>{
      if (!bar?.isConnected) {stopBar(); return;}
      if (address && shadow.activeElement !== address && address.value !== location.href) address.value=location.href;
    },750);
  }
  function apply(mode) {
    if (mode === 'off') {stopBar();return {ok:true,active:false};}
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
  globalThis.__cleanWindowPageUI = true;
})();
