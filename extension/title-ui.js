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
    editor.remove();
    editor = null;
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
  function openEditor() {
    if (!state) throw new Error('請先啟用乾淨模式，才可編輯標題。');
    if (editor) { editor.shadowRoot?.querySelector('#cw-title-text')?.focus(); return; }
    returnFocus = document.activeElement;
    const host = document.createElement('div');
    host.id = 'clean-window-title-editor';
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;';
    const root = host.attachShadow({mode:'open'});
    const styles = document.createElement('style');
    styles.textContent = `
      :host { color-scheme:light dark; }
      *,*::before,*::after { box-sizing:border-box; }
      .panel { pointer-events:auto; position:absolute; top:18px; left:50%; transform:translateX(-50%);
        width:min(440px,calc(100vw - 24px)); padding:16px;
        border:1px solid #ccd5dd; border-radius:14px;
        box-shadow:0 14px 50px #0005; background:#f9fafb; color:#27313c;
        font:13px/1.5 system-ui,'Segoe UI',sans-serif; }
      h2 { font-size:15px; margin:0 0 12px; font-weight:650; }
      .fields { display:flex; gap:10px; }
      label { display:flex; flex-direction:column; gap:5px; min-width:0; }
      .symbol-field { width:90px; flex:none; }
      .text-field { flex:1; }
      input,select { width:100%; height:36px; border:1px solid #c8d0d9; border-radius:8px;
        background:#fff; color:#202932; padding:0 9px; font:13px system-ui,'Segoe UI',sans-serif; }
      #cw-title-symbol { font-size:21px; text-align:center; }
      .presets { display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 0; }
      .preset { min-width:30px;height:29px;padding:2px 5px!important;font-size:17px!important; }
      .preview { margin:11px 0; padding:8px 10px; border:1px solid #e1e5ea; border-radius:8px;
        background:#f0f2f5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .buttons { display:flex; align-items:center; gap:7px; }
      button { border:1px solid #cbd3dd; border-radius:8px; padding:7px 10px;
        font:12px system-ui,'Segoe UI',sans-serif; cursor:pointer; background:#fff; color:inherit; }
      button.primary { background:#176851; color:#fff; border-color:#176851; }
      button.reset { margin-right:auto; }
      button:focus-visible,input:focus-visible { outline:2px solid #477fe5; outline-offset:2px; }
      .hint { font-size:11px; color:#64717c; margin:9px 0 0; }
      @media (prefers-color-scheme:dark) {
        .panel { background:#282c32; color:#f1f3f5; border-color:#444c54; }
        input,select,button { background:#363d46; color:#f1f3f5; border-color:#57616c; }
        .preview { background:#343b43; border-color:#434b56; }
        .hint { color:#b3bcc6; }
      }
    `;
    const panel = document.createElement('div');
    panel.className='panel'; panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','false');
    panel.setAttribute('aria-label','編輯乾淨模式標題');
    const heading = document.createElement('h2');
    heading.textContent = '編輯乾淨模式標題';
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
    titleLabel.className='text-field'; titleLabel.textContent='頁面標題';
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
    const button = (label, kind) => {
      const el = document.createElement('button');
      el.type='button'; el.className=kind; el.textContent=label; return el;
    };
    const reset=button('原始標題','reset');
    const cancel=button('取消','');
    const save=button('套用','primary'); save.type='submit';
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
    const hint=document.createElement('p'); hint.className='hint';
    hint.textContent='支援貼上單一 Emoji（包含組合表情、國旗）或 Unicode 符號；只修改目前分頁標題。';
    panel.append(heading,form,hint);
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
      else if (message.action==='edit') openEditor();
      else throw new Error('不支援的標題操作。');
      respond({ok:true,active:!!state});
    } catch(error) { respond({ok:false,error:error?.message||String(error)}); }
    return false;
  });
  globalThis.__cleanWindowTitleUI = true;
})();
