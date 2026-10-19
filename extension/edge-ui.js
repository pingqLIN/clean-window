/* Compact, opt-in controls for a managed Clean Window. Isolated content-script world. */
(() => {
  'use strict';
  if (globalThis.__cleanWindowEdgeUI) return;
  const HOST_ID = 'clean-window-edge-control';
  const NAMES = [
    '自繪網址欄＋擴充欄',
    '自繪網址欄',
    '純精簡 Popup'
  ];
  let host, root, handle, buttons = [], currentLevel = 1;
  let preference = { side: 'right', ratio: 0.48 };
  let drag = null;

  const validLevel = value => Number.isInteger(value) && value >= 1 && value <= 3;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function position() {
    if (!host) return;
    host.dataset.side = preference.side;
    host.style.setProperty('left', preference.side === 'left' ? '0px' : 'auto', 'important');
    host.style.setProperty('right', preference.side === 'right' ? '0px' : 'auto', 'important');
    const top = Math.round(clamp(preference.ratio, 0, 1) *
      Math.max(0, window.innerHeight - 42));
    host.style.setProperty('top', top + 'px', 'important');
    host.dataset.tipPlacement = top < 62 ? 'below' : 'above';
  }
  function updateLevel(level) {
    if (!validLevel(level)) return;
    currentLevel = level;
    for (const button of buttons) {
      const selected = Number(button.dataset.level) === level;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }
  function status(message) {
    if (!root) return;
    const el = root.querySelector('.feedback');
    el.textContent = message || '';
    el.hidden = !message;
  }
  async function savePlacement() {
    try { await chrome.storage.local.set({ edgeControl: { ...preference } }); }
    catch { /* Movement stays usable even when persistence is denied. */ }
  }
  function placeFromPointer(event) {
    if (!drag) return;
    if (Math.abs(event.clientX - drag.startX) > 4 ||
        Math.abs(event.clientY - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    preference.side = event.clientX < window.innerWidth / 2 ? 'left' : 'right';
    preference.ratio = clamp((event.clientY - drag.offsetY) /
      Math.max(1, window.innerHeight - 42), 0, 1);
    position();
  }
  function finishDrag(event) {
    if (drag?.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      void savePlacement();
    }
  }
  function start() {
    if (host?.isConnected) return;
    if (!/^https?:$/.test(location.protocol) || !document.documentElement) {
      throw new Error('邊緣工具只支援可注入的一般網頁。');
    }
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'all:initial!important;position:fixed!important;top:0;right:0;z-index:2147483646!important;pointer-events:auto!important;';
    root = host.attachShadow({mode:'open'});
    const style = document.createElement('style');
    style.textContent = [
      ':host { color-scheme:light dark; font:12px system-ui,-apple-system,"Segoe UI",sans-serif; color:#393b3e; }',
      '*,*::before,*::after { box-sizing:border-box; }',
      '.edge { position:relative;display:flex;align-items:center;gap:2px;width:24px;height:42px; }',
      '.handle-anchor {position:relative;flex:none;width:24px;height:42px;}',
      '.close {position:absolute;top:6px;left:3px;width:18px;height:16px;z-index:3;border:0;border-radius:5px;',
      ' display:grid;place-items:center;padding:0;background:#c73030;color:white;font:700 19px/1 system-ui;',
      ' opacity:0;visibility:hidden;pointer-events:none;cursor:pointer;',
      ' transition:opacity .17s ease,visibility 0s linear .17s,background-color .17s ease;}',
      /* X is anchored to the handle rather than the expanding flex rail. */
      ':host(:hover) .close,:host(:focus-within) .close {opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s;}',
      '.close:hover {background:#aa1818;}',
      '.close:focus-visible {outline:2px solid white;outline-offset:1px;}',
      ':host([data-side="right"]) .edge { flex-direction:row-reverse; }',
      ':host(:hover) .edge,:host(:focus-within) .edge { width:70px; }',
      '.handle { position:relative;width:100%;height:100%;border:1px solid #999da2;background:#b8bbbf;',
      ' color:#333;box-shadow:0 2px 10px #0002;cursor:grab;touch-action:none;',
      ' padding:0;border-radius:0 8px 8px 0; }',
      '.handle::after { content:attr(data-tip);position:absolute;right:0;bottom:calc(100% + 12px);',
      ' transform:translateY(5px);opacity:0;visibility:hidden;pointer-events:none;',
      ' white-space:nowrap;background:#3e4044;color:#fff;border-radius:6px;padding:6px 9px;',
      ' box-shadow:0 2px 8px #0003;font:11px/1.3 system-ui;',
      ' transition:opacity .12s ease,transform .16s ease,visibility 0s linear .16s; }',
      '.handle:hover::after,.handle:focus-visible::after {opacity:1;visibility:visible;transform:translateY(0);transition-delay:0s;}',
      ':host([data-side="right"]) .handle { border-radius:8px 0 0 8px; }',
      ':host([data-side="left"]) .handle::after {left:0;right:auto;}',
      ':host([data-tip-placement="below"]) .handle::after {bottom:auto;top:calc(100% + 12px);transform:translateY(-5px);}',
      ':host([data-tip-placement="below"]) .handle:hover::after,',
      ':host([data-tip-placement="below"]) .handle:focus-visible::after {transform:translateY(0);}',
      '.handle:active { cursor:grabbing; }',
      '.rail { position:static;flex:none;display:flex;opacity:0;visibility:hidden;pointer-events:none;flex-direction:column;gap:3px;padding:6px 5px;',
      ' border:1px solid #b6b9bf;border-radius:11px;background:#f5f5f6;',
      ' box-shadow:0 4px 16px #0003;',
      ' transition:opacity .17s ease,visibility 0s linear .17s; }',

      ':host(:hover) .rail,:host(:focus-within) .rail { opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s; }',
      '.stop { position:relative;display:grid;place-items:center;width:30px;height:32px;',
      ' border:0;border-radius:7px;background:transparent;cursor:pointer;color:#696d73; }',
      '.stop.selected { background:#dadddf;color:#34383d; }',
      '.stop:hover { background:#e4e6e8; }',
      '.handle,.stop { transition:background-color .14s ease,border-color .14s ease,color .14s ease,box-shadow .14s ease; }',
      '.stop:active { opacity:.68; }',
      '.stop:focus-visible,.handle:focus-visible { outline:2px solid #5e6876;outline-offset:2px; }',
      '.tick { width:13px;height:3px;background:currentColor;border-radius:2px; }',
      '.stop.selected .tick { width:20px;height:4px; }',
      '.hint { pointer-events:none;position:absolute;right:calc(100% + 12px);top:50%;',
      ' transform:translateY(-50%);white-space:nowrap;visibility:hidden;',
      ' color:#fff;background:#3e4044;padding:6px 9px;border-radius:6px;',
      ' box-shadow:0 2px 8px #0003;font-size:11px; }',
      ':host([data-side="left"]) .hint { left:calc(100% + 12px);right:auto; }',
      '.stop:hover .hint,.stop:focus-visible .hint { visibility:visible; }',
      '.feedback { max-width:145px;padding:6px;color:#9e3535;font-size:11px;',
      ' overflow-wrap:anywhere; }',
      '.feedback:not([hidden]) {animation:cw-edge-feedback .17s ease both;}',
      '@keyframes cw-edge-feedback {from {opacity:0} to {opacity:1}}',
      '@media(prefers-reduced-motion:reduce) {',
      ' .handle,.handle::after,.stop,.rail,.close {transition:none!important;animation:none!important;}',
      ' .handle:hover::after,.handle:focus-visible::after {transform:none!important;}',
      '}',
      '[hidden] { display:none!important; }',
      '@media(prefers-color-scheme:dark) {',
      ' .handle { background:#686c72;color:#f5f6f8;border-color:#555960; }',
      ' .rail { background:#2d3035;border-color:#4d5259; }',
      ' .stop { color:#aab0b8; }',
      ' .stop.selected { background:#52565d;color:#f4f5f7; }',
      ' .stop:hover { background:#3e4248; }',
      '}'
    ].join('');
    const edge = document.createElement('div');
    edge.className = 'edge';
    handle = document.createElement('button');
    handle.className = 'handle';
    handle.type = 'button';
    handle.textContent = '';
    handle.dataset.tip = '滑鼠移入：關閉乾淨模式或切換等級 · 拖曳移動';
    handle.setAttribute('aria-label', '拖曳乾淨模式標籤；移入顯示關閉與模式選單');
    const rail = document.createElement('div');
    rail.className = 'rail';
    rail.setAttribute('role', 'group');
    rail.setAttribute('aria-label', '乾淨模式等級');
    buttons = NAMES.map((name, index) => {
      const button = document.createElement('button');
      button.className = 'stop';
      button.type = 'button';
      button.dataset.level = String(index + 1);
      button.setAttribute('aria-label', '第 ' + (index + 1) + ' 級：' + name);
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.setAttribute('aria-hidden', 'true');
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = (index + 1) + ' · ' + name;
      hint.setAttribute('aria-hidden', 'true');
      button.append(tick, hint);
      button.addEventListener('click', async event => {
        if (!event.isTrusted) return;
        event.preventDefault();
        event.stopPropagation();
        const level = index + 1;
        if (currentLevel === level) return;
        status('');
        buttons.forEach(item => { item.disabled = true; });
        try {
          const result = await chrome.runtime.sendMessage({
            type: 'clean-window:edge-level', level
          });
          if (!result?.ok) throw new Error(result?.error || '等級切換失敗');
          updateLevel(result.level);
          if (result.warning) status(result.warning);
        } catch (error) {
          status(error?.message || '等級切換失敗');
        } finally {
          buttons.forEach(item => { item.disabled = false; });
        }
      });
      rail.append(button);
      return button;
    });
    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.hidden = true;
    feedback.setAttribute('role', 'status');
    rail.append(feedback);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.textContent = '×';
    close.title = '離開乾淨模式並還原原本視窗';
    close.setAttribute('aria-label', '關閉乾淨模式並還原原本視窗');
    close.addEventListener('click', async event => {
      if (!event.isTrusted) return;
      event.preventDefault();
      event.stopPropagation();
      close.disabled = true;
      status('');
      try {
        const result = await chrome.runtime.sendMessage({type:'clean-window:edge-restore'});
        if (!result?.ok) throw new Error(result?.error || '無法還原視窗');
        if (result.warning) status(result.warning);
      } catch (error) {
        status(error?.message || '無法還原視窗');
      } finally { close.disabled = false; }
    });
    // Dedicated 24×42 anchor keeps the X positioned relative to the grey tab,
    // never relative to the expanding 70px flex rail. Top inset is optically
    // raised so the icon matches the selected rail line in the real UI.
    const anchor = document.createElement('div');
    anchor.className = 'handle-anchor';
    anchor.append(handle, close);
    edge.append(anchor, rail);
    root.append(style, edge);

    handle.title = '拖曳調整位置；滑鼠移入顯示關閉 X 與模式選擇';
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      drag = {
        pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        offsetY: event.clientY - host.getBoundingClientRect().top, moved: false
      };
      try { handle.setPointerCapture(event.pointerId); }
      catch { /* Window listeners still allow dragging on hosts without pointer capture. */ }
      event.stopPropagation();
    });
    // Listen at the window's capture phase so crossing out of a narrow edge tab
    // does not interrupt a drag even when pointer capture is unavailable.
    document.documentElement.append(host);
    position();
    void chrome.storage.local.get('edgeControl').then(saved => {
      if (!host?.isConnected || drag) return;
      const value = saved.edgeControl;
      if (value && ['left','right'].includes(value.side) &&
          Number.isFinite(value.ratio) && value.ratio >= 0 && value.ratio <= 1) {
        preference = { side: value.side, ratio: value.ratio };
        position();
      }
    }).catch(() => {});
  }
  function apply(level) {
    if (level === 'off') {
      host?.remove();
      host = root = handle = null;
      buttons = [];
      return {ok:true,active:false};
    }
    if (!validLevel(level)) throw new Error('不支援的簡化等級。');
    start();
    updateLevel(level);
    return {ok:true,active:true,level};
  }
  window.addEventListener('pointermove', event => {
    if (drag?.pointerId === event.pointerId) placeFromPointer(event);
  }, true);
  window.addEventListener('pointerup', finishDrag, true);
  window.addEventListener('pointercancel', finishDrag, true);
  window.addEventListener('resize', position);
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'clean-window:edge-ui') return false;
    try { respond(apply(message.level)); }
    catch (error) { respond({ok:false,error:error?.message || String(error)}); }
    return false;
  });
  globalThis.__cleanWindowEdgeUI = true;
})();
