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
    host.style.left = preference.side === 'left' ? '0px' : 'auto';
    host.style.right = preference.side === 'right' ? '0px' : 'auto';
    host.style.top = Math.round(clamp(preference.ratio, 0, 1) *
      Math.max(0, window.innerHeight - 42)) + 'px';
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
    if (moved) void savePlacement();
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
      ':host { color-scheme:light dark; font:12px system-ui,-apple-system,"Segoe UI",sans-serif; color:#20312a; }',
      '*,*::before,*::after { box-sizing:border-box; }',
      '.edge { position:relative;display:block;width:24px;height:42px; }',
      '.handle { width:24px;height:42px;flex:none;border:1px solid #b9c7c1;background:#e8f0ec;',
      ' color:#176851;box-shadow:0 2px 10px #0002;cursor:grab;touch-action:none;',
      ' font:18px system-ui;line-height:1;padding:0;border-radius:0 8px 8px 0; }',
      ':host([data-side="right"]) .handle { border-radius:8px 0 0 8px; }',
      '.handle:active { cursor:grabbing; }',
      '.rail { position:absolute;top:-37px;right:100%;display:none;flex-direction:column;gap:3px;padding:6px 5px;',
      ' border:1px solid #b9c7c1;border-radius:11px;background:#f8faf9;',
      ' box-shadow:0 4px 16px #0003; }',
      ':host([data-side="left"]) .rail { left:100%;right:auto; }',
      ':host(:hover) .rail,:host(:focus-within) .rail { display:flex; }',
      '.stop { position:relative;display:grid;place-items:center;width:30px;height:32px;',
      ' border:0;border-radius:7px;background:transparent;cursor:pointer;color:#778980; }',
      '.stop.selected { background:#d9ebe1;color:#176851; }',
      '.stop:hover { background:#e4eee9; }',
      '.stop:focus-visible,.handle:focus-visible { outline:2px solid #176851;outline-offset:2px; }',
      '.tick { width:13px;height:3px;background:currentColor;border-radius:2px; }',
      '.stop.selected .tick { width:20px;height:4px; }',
      '.hint { pointer-events:none;position:absolute;right:calc(100% + 12px);top:50%;',
      ' transform:translateY(-50%);white-space:nowrap;visibility:hidden;',
      ' color:#fff;background:#25332e;padding:6px 9px;border-radius:6px;',
      ' box-shadow:0 2px 8px #0003;font-size:11px; }',
      ':host([data-side="left"]) .hint { left:calc(100% + 12px);right:auto; }',
      '.stop:hover .hint,.stop:focus-visible .hint { visibility:visible; }',
      '.feedback { max-width:145px;padding:6px;color:#9e3535;font-size:11px;',
      ' overflow-wrap:anywhere; }',
      '[hidden] { display:none!important; }',
      '@media(prefers-color-scheme:dark) {',
      ' .handle { background:#253a31;color:#91d5b0;border-color:#46574f; }',
      ' .rail { background:#27332f;border-color:#46574f; }',
      ' .stop { color:#9db3a8; }',
      ' .stop.selected { background:#345a47;color:#a7efc6; }',
      ' .stop:hover { background:#384b42; }',
      '}'
    ].join('');
    const edge = document.createElement('div');
    edge.className = 'edge';
    handle = document.createElement('button');
    handle.className = 'handle';
    handle.type = 'button';
    handle.textContent = '◈';
    handle.setAttribute('aria-label', '拖曳調整乾淨模式工具位置；滑鼠移入展開等級');
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
    edge.append(handle, rail);
    root.append(style, edge);

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
