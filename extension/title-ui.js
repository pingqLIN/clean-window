/* On-demand, tab-local title customization. Symbol is text, never a Chrome/favicon security icon. */
(() => {
  'use strict';
  if (globalThis.__cleanWindowTitleUI) return;
  const DEFAULT_SYMBOL = '◈';
  const ICON_PRESETS = ['◈', '◆', '✦', '★', '🎨', '🎬', '🪟', '✨', '🌈', '📌', '💻', '🧭',
    '1️⃣', '2️⃣', '3️⃣', '🖋️', '🌍', '🚩', '🔥', '🔍', '💡', '🛠️', '🔏'];
  const MAX_TITLE = 160;
  let state = null;
  let observer = null;
  let editor = null;
  let returnFocus = null;

  function supported() {
    return /^https?:$/.test(location.protocol) && !!document.documentElement;
  }
  function cleanText(value) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE);
  }
  // Emoji (including ZWJ families, skin tones and flags) are one grapheme,
  // not necessarily one JavaScript code point.
  function cleanIcon(value) {
    const icon = String(value ?? '').trim().normalize('NFC');
    if (!icon || icon.length > 32 || /[\u0000-\u001f\u007f-\u009f]/u.test(icon)) return null;
    const segments = [...new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }).segment(icon)];
    const isKeycap = /^[0-9#*]\uFE0F?\u20E3$/u.test(icon);
    if (segments.length !== 1 || (!isKeycap && !/[\p{Extended_Pictographic}\p{S}\p{Regional_Indicator}]/u.test(icon))) return null;
    return icon;
  }
  function titleText() {
    return state?.custom ?? state?.original ?? '';
  }
  function updateDocumentTitle() {
    if (!state) return;
    const text = titleText() || '未命名頁面';
    state.display = state.symbol + ' ' + text;
    if (document.title !== state.display) document.title = state.display;
  }
  function onTitleChanged() {
    if (!state || document.title === state.display) return;
    // Capture genuine title changes in SPAs, without confusing our own writes for page changes.
    state.original = document.title;
    updateDocumentTitle();
  }
  function start() {
    if (!supported()) throw new Error('頁面標題僅支援一般 HTTP(S) 網頁。');
    if (state) { updateDocumentTitle(); return; }
    state = { original: document.title, custom: null, symbol: DEFAULT_SYMBOL, display: '' };
    observer = new MutationObserver(onTitleChanged);
    observer.observe(document.head || document.documentElement,
      {subtree: true, childList: true, characterData: true});
    updateDocumentTitle();
  }
  function notifyManager() {
    void chrome.runtime.sendMessage({type:'clean-window:title-updated',title:document.title})
      .catch(() => {});
  }
  function dismissEditor() {
    if (!editor) return;
    const previous = editor;
    editor = null;
    const panel = previous.shadowRoot?.querySelector('.panel');
    const sidecar = previous.dataset.sidecar === 'true';
    if (panel && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        && typeof panel.animate === 'function') {
      previous.id = 'clean-window-title-editor-exiting';
      previous.style.pointerEvents = 'none';
      panel.style.pointerEvents = 'none';
      const exit = panel.animate(
        [{ opacity: 1, transform: sidecar ? 'translateX(0)' : 'translateX(-50%)' },
         { opacity: 0, transform: sidecar ? 'translateX(-10px)' : 'translate(-50%, -5px)' }],
        { duration: 95, easing: 'ease-in', fill: 'forwards' });
      void exit.finished.then(() => previous.remove(), () => previous.remove());
    } else previous.remove();
    try { returnFocus?.focus(); } catch {}
    returnFocus = null;
  }
  function stop() {
    dismissEditor();
    if (!state) return;
    observer?.disconnect();
    observer = null;
    const original = state.original;
    state = null;
    if (document.title !== original) document.title = original;
  }
  function openEditor(anchor) {
    if (!state) throw new Error('請先啟用乾淨模式，才可編輯標題。');
    if (editor) { editor.shadowRoot?.querySelector('#cw-title-text')?.focus(); return; }
    returnFocus = document.activeElement;
    const host = document.createElement('div');
    host.id = 'clean-window-title-editor';
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;';
    const sx = anchor?.screenX, sy = anchor?.screenY;
    if (Number.isFinite(sx) && Number.isFinite(sy) && Math.abs(sx) < 100000 && Math.abs(sy) < 100000) {
      const width = Math.min(396, Math.max(0, window.innerWidth - 24));
      const chromeTop = Math.max(0, window.outerHeight - window.innerHeight);
      const viewportLeft = window.screenX + Math.max(0, window.outerWidth - window.innerWidth) / 2;
      const desiredLeft = sx - viewportLeft - width - 12;
      const maxLeft = Math.max(12, window.innerWidth - width - 12);
      const desiredTop = sy - (window.screenY + chromeTop) - 40;
      const maxTop = Math.max(12, window.innerHeight - 160);
      const x = Math.max(12, Math.min(maxLeft, desiredLeft));
      const y = Math.max(12, Math.min(maxTop, desiredTop));
      host.dataset.sidecar = 'true';
      host.style.setProperty('--cw-editor-left', Math.round(x) + 'px');
      host.style.setProperty('--cw-editor-top', Math.round(y) + 'px');
    }
    const root = host.attachShadow({mode:'open'});
    // Follow the same explicit theme preference as the extension popup.
    void chrome.storage?.local?.get('cwTheme').then(prefs => {
      if (host.isConnected && ['light', 'dark'].includes(prefs?.cwTheme)) {
        host.dataset.theme = prefs.cwTheme;
      }
    }).catch(() => {});
    const styles = document.createElement('style');
    styles.textContent = `
      :host {
        color-scheme:light;
        --cw-bg:#f6f5f1; --cw-surface:#fff; --cw-soft:#efeeea;
        --cw-ink:#17181a; --cw-muted:#6d6f73; --cw-line:rgba(23,24,26,.14);
        --cw-pill:#17181a; --cw-pill-ink:#fff; --cw-signal:#1f7a5c;
        font:13px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;
      }
      :host([data-theme="dark"]) {
        color-scheme:dark;
        --cw-bg:#0f1011; --cw-surface:#171819; --cw-soft:#242526;
        --cw-ink:#ecebe7; --cw-muted:#9b9da0; --cw-line:rgba(236,235,231,.16);
        --cw-pill:#ecebe7; --cw-pill-ink:#17181a; --cw-signal:#4fc79d;
      }
      @media(prefers-color-scheme:dark) {
        :host(:not([data-theme="light"])) {
          color-scheme:dark;
          --cw-bg:#0f1011; --cw-surface:#171819; --cw-soft:#242526;
          --cw-ink:#ecebe7; --cw-muted:#9b9da0; --cw-line:rgba(236,235,231,.16);
          --cw-pill:#ecebe7; --cw-pill-ink:#17181a; --cw-signal:#4fc79d;
        }
      }
      *,*::before,*::after {box-sizing:border-box;}
      .panel { pointer-events:auto; position:absolute; top:18px; left:50%;
        transform:translateX(-50%); animation:cw-title-enter .19s cubic-bezier(.16,1,.3,1) both;
        width:min(396px,calc(100vw - 24px)); max-height:calc(100vh - 36px); overflow-y:auto;
        padding:18px; border:1px solid var(--cw-line); border-radius:16px;
        box-shadow:0 14px 45px #0004,0 1px 2px #0001;
        background:var(--cw-bg); color:var(--cw-ink); font:inherit; }
      @keyframes cw-title-enter {from{opacity:0;transform:translate(-50%,-7px)}to{opacity:1;transform:translateX(-50%)}}
      :host([data-sidecar="true"]) .panel {
        top:var(--cw-editor-top,18px);left:var(--cw-editor-left,12px);right:auto;
        transform:none;animation:cw-title-sidecar-enter .22s cubic-bezier(.16,1,.3,1) both;
      }
      @keyframes cw-title-sidecar-enter {from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
      h2 {font-size:14px;letter-spacing:.01em;margin:0 0 16px;font-weight:650;}
      .fields {display:flex;gap:8px;}
      label {display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--cw-muted);font-size:11px;}
      .symbol-field {width:76px;flex:none;}
      .text-field {flex:1;}
      input {width:100%;height:38px;border:1px solid var(--cw-line);border-radius:10px;
        background:var(--cw-surface);color:var(--cw-ink);padding:0 10px;
        font:13px system-ui,-apple-system,'Segoe UI',sans-serif;}
      #cw-title-symbol {font-size:20px;text-align:center;}
      .presets {display:flex;flex-wrap:wrap;gap:5px;margin:12px 0 0;}
      button {border:1px solid var(--cw-line);border-radius:10px;padding:8px 11px;
        font:12px system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;
        background:var(--cw-surface);color:var(--cw-ink);}
      .preset {min-width:31px;height:31px;padding:2px 5px!important;font-size:17px!important;}
      .preview {margin:15px 0 14px;padding:10px 12px;border:1px solid var(--cw-line);
        border-radius:10px;background:var(--cw-soft);white-space:nowrap;overflow:hidden;
        text-overflow:ellipsis;font-size:12px;color:var(--cw-ink);}
      .buttons {display:flex;align-items:center;gap:7px;}
      .buttons button {width:36px;height:36px;padding:0;display:grid;place-items:center;font-size:20px;line-height:1;}
      button.primary {background:var(--cw-pill);color:var(--cw-pill-ink);border-color:var(--cw-pill);
        border-radius:50%;min-width:36px;width:36px;font-size:20px;font-weight:500;}
      button.reset {margin-right:auto;color:#d94747;}
      button.reset svg {width:20px;height:20px;display:block;stroke:currentColor;}
      button:hover:not(.primary) {background:var(--cw-soft);}
      button.primary:hover {filter:brightness(.88);}
      button:active {opacity:.72;}
      button,input {transition:background-color .15s ease,border-color .15s ease,opacity .15s ease;}
      button:focus-visible,input:focus-visible {outline:2px solid var(--cw-signal);outline-offset:2px;}
      @media(prefers-reduced-motion:reduce) {.panel{animation:none!important;}button,input{transition:none!important;}}
    `;
    const panel = document.createElement('div');
    panel.className='panel'; panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','false');
    panel.setAttribute('aria-label','編輯乾淨模式標題');
    const form = document.createElement('form');
    const fields = document.createElement('div'); fields.className='fields';
    const symbolLabel = document.createElement('label');
    symbolLabel.className='symbol-field'; symbolLabel.textContent='Icon / Emoji';
    const symbol = document.createElement('input');
    symbol.type='text'; symbol.id='cw-title-symbol'; symbol.maxLength=32;
    symbol.setAttribute('aria-label','輸入單一 Emoji 或 Symbol 圖示');
    symbol.autocomplete='off'; symbol.spellcheck=false;
    symbol.value=state.symbol;
    symbolLabel.append(symbol);
    const titleLabel = document.createElement('label');
    titleLabel.className='text-field'; titleLabel.textContent='Title';
    const text = document.createElement('input');
    text.type='text'; text.id='cw-title-text'; text.maxLength=MAX_TITLE;
    text.autocomplete='off'; text.spellcheck=false; text.value=titleText();
    titleLabel.append(text);
    fields.append(symbolLabel,titleLabel);
    const presets = document.createElement('div');
    presets.className='presets';
    presets.setAttribute('aria-label', '常用 Emoji 與符號');
    for (const glyph of ICON_PRESETS) {
      const pick = document.createElement('button');
      pick.type='button'; pick.className='preset'; pick.textContent=glyph;
      pick.setAttribute('aria-label', '選用圖示 ' + glyph);
      pick.addEventListener('click', () => {
        symbol.value=glyph;
        updatePreview();
        symbol.focus();
      });
      presets.append(pick);
    }
    const preview = document.createElement('div');
    preview.className='preview'; preview.setAttribute('aria-live','polite');
    const updatePreview = () => {
      preview.textContent=(cleanIcon(symbol.value) || '□') + ' ' +
        (cleanText(text.value) || '未命名頁面');
    };
    symbol.addEventListener('input',updatePreview);
    symbol.addEventListener('change',updatePreview);
    text.addEventListener('input',updatePreview);
    updatePreview();
    const controls = document.createElement('div'); controls.className='buttons';
    const button = (label, kind, accessibleLabel) => {
      const el = document.createElement('button');
      el.type='button'; el.className=kind; el.textContent=label;
      el.setAttribute('aria-label', accessibleLabel);
      el.title=accessibleLabel;
      return el;
    };
    const reset=button('', 'reset', '重設為原始標題');
    const resetIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');
    resetIcon.setAttribute('viewBox','0 0 24 24');
    resetIcon.setAttribute('fill','none');
    resetIcon.setAttribute('stroke-width','2');
    resetIcon.setAttribute('stroke-linecap','round');
    resetIcon.setAttribute('stroke-linejoin','round');
    resetIcon.setAttribute('aria-hidden','true');
    const resetArrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    resetArrow.setAttribute('d','M3 7v6h6');
    const resetArc=document.createElementNS('http://www.w3.org/2000/svg','path');
    resetArc.setAttribute('d','M3.05 13A9 9 0 1 0 5.64 5.64L3 8');
    resetIcon.append(resetArrow,resetArc);
    reset.append(resetIcon);
    const cancel=button('❌', '', '取消編輯');
    const save=button('⭕', 'primary', '套用標題'); save.type='submit';
    reset.addEventListener('click',()=>{
      state.custom=null;state.symbol=DEFAULT_SYMBOL;
      updateDocumentTitle(); notifyManager(); dismissEditor();
    });
    cancel.addEventListener('click',dismissEditor);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const newTitle=cleanText(text.value);
      if (!newTitle) { text.setCustomValidity('標題不可空白。'); text.reportValidity(); text.setCustomValidity(''); return; }
      const icon=cleanIcon(symbol.value);
      if (!icon) {
        symbol.setCustomValidity('請輸入單一 Emoji 或符號（可含組合字元）。');
        symbol.reportValidity(); symbol.setCustomValidity('');
        symbol.focus(); return;
      }
      state.custom=newTitle;
      state.symbol=icon;
      updateDocumentTitle();notifyManager();dismissEditor();
    });
    panel.addEventListener('keydown',event=>{
      if (event.key==='Escape') { event.preventDefault();dismissEditor(); }
    });
    form.append(fields,presets,preview,controls);
    controls.append(reset,cancel,save);
    // Keep the visible editor deliberately quiet: field labels carry the only
    // explanatory text; reset/apply/cancel are compact icon-only controls.
    panel.append(form);
    root.append(styles,panel);
    document.documentElement.append(host);
    editor=host;
    text.focus(); text.select();
  }
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if (message?.type!=='clean-window:title') return false;
    try {
      if (message.action==='start') start();
      else if (message.action==='off') stop();
      else if (message.action==='edit') openEditor(message.anchor);
      else throw new Error('不支援的標題操作。');
      respond({ok:true,active:!!state});
    } catch(error) { respond({ok:false,error:error?.message||String(error)}); }
    return false;
  });
  globalThis.__cleanWindowTitleUI = true;
})();
