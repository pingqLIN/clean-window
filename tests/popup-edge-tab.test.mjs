import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture({ popup = false, savedLevel = 3, preferenceLevel = 1 } = {}) {
  const messages = [];
  const prefs = { cleanLevel: preferenceLevel };
  let closed = 0;
  let sync = () => {};
  let clock = 0, nextTimer = 0;
  const timers = new Map();
  const fakeSetTimeout = (callback, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { callback, due: clock + Number(delay) });
    return id;
  };
  const fakeClearTimeout = id => timers.delete(id);
  const advanceTimers = ms => {
    clock += ms;
    while (true) {
      const due = [...timers.entries()].filter(([, timer]) => timer.due <= clock)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!due) break;
      timers.delete(due[0]);
      due[1].callback();
    }
  };
  const make = (dataset = {}) => ({
    dataset, listeners: {}, attrs: {}, disabled: true, hidden: false,
    textContent: '', value: '1', style: { setProperty() {}, transform: '' }, classList: {
      items: new Set(),
      toggle(name, on) { if (on) this.items.add(name); else this.items.delete(name); },
      contains(name) { return this.items.has(name); }
    },
    addEventListener(name, callback) {
      const previous = this.listeners[name];
      this.listeners[name] = previous
        ? (...args) => { previous(...args); return callback(...args); }
        : callback;
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    querySelector() { return null; },
    getBoundingClientRect() { return { left: 0, width: 100 }; },
    click() { return this.listeners.click?.({ stopPropagation() {} }); }
  });
  const stops = [1, 2, 3].map(level => make({ level: String(level) }));
  const zones = [1, 2, 3].map(level => make({ level: String(level) }));
  const pips = [1, 2, 3].map(level => make({ level: String(level) }));
  const pipsBox = make();
  pipsBox.querySelectorAll = selector => selector === '.pip' ? pips : [];
  pipsBox.matches = () => false;
  const wrap = make();
  const pill = make();
  const handle = make({});
  const stage = make({ selectedLevel: '1', previewLevel: '1' });
  stage.querySelectorAll = selector => selector === '.morph-zone' ? zones : selector === '.pip' ? pips : [];
  stage.querySelector = selector => {
    if (selector === '.level-pips') return pipsBox;
    if (selector === '.morph-wrap') return wrap;
    if (selector === '.morph-zones') return pill;
    const match = selector.match(/^\.morph-zone\[data-level="([123])"\]$/);
    return match ? zones[Number(match[1]) - 1] : null;
  };
  const edgeTab = make();
  edgeTab.querySelectorAll = selector => selector === '.et-stop' ? stops : [];
  edgeTab.querySelector = selector => selector === '.et-handle' ? handle : null;
  const apply = make({ action: 'toggle-clean' });
  const restore = make({ action: 'restore' });
  const nodes = new Map();
  for (const selector of ['#target-status', '#feedback', '#scope', '#clean-level',
    '#level-number', '#level-title', '#level-detail', '#level-limit',
    '#clean-label', '#clean-description', 'main']) nodes.set(selector, make());
  nodes.set('#morph-stage', stage);
  nodes.set('#edge-tab', edgeTab);
  nodes.set('#edge-tab .et-handle', handle);
  nodes.set('.choice.primary', apply);
  const document = {
    querySelectorAll(selector) { return selector === 'button[data-action]' ? [apply, restore] : []; },
    querySelector(selector) { return nodes.get(selector) || null; }
  };
  const record = { phase: 'open', popupWindowId: 1, cleanLevel: savedLevel };
  const chrome = {
    tabs: { async query() { return [{ id: 11, windowId: 1 }]; } },
    windows: { async get() { return { id: 1, type: popup ? 'popup' : 'normal', state: 'normal' }; } },
    commands: { async getAll() { return []; } },
    storage: {
      session: { async get() { return popup ? { 'clean:11': record } : {}; } },
      local: {
        async get() { return { ...prefs }; },
        async set(value) { Object.assign(prefs, value); }
      }
    },
    runtime: { async sendMessage(message) { messages.push(message); return { ok: true }; } }
  };
  class MutationObserver {
    constructor(callback) { sync = callback; }
    observe() {}
  }
  runInNewContext(script, {
    chrome, document, MutationObserver,
    window: { close() { closed++; }, matchMedia() { return { matches: true }; } },
    setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {}
  });
  return {
    nodes, stops, zones, pips, handle, stage, wrap, pipsBox, prefs, messages, timers,
    advanceTimers,
    sync: () => sync(), get closed() { return closed; }
  };
}

test('popup edge tab replaces decorative hint with three accessible controls', async () => {
  const html = await readFile(new URL('../extension/popup.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../extension/popup.css', import.meta.url), 'utf8');
  assert.match(html, /id="edge-tab"/);
  assert.doesNotMatch(html, /class="edge-hint"/);
  assert.equal((html.match(/class="et-stop"/g) || []).length, 3);
  assert.match(css, /\.edge-tab:hover \.et-rail/);
  assert.match(css, /\.edge-tab:focus-within \.et-rail/);
  assert.match(css, /\.morph-stage\[data-pips="on"\] \.morph-wrap \{ opacity: 0; pointer-events: none; \}/);
  assert.match(css, /\.morph-stage\[data-pips="on"\] \.morph-caption \{ opacity: 1; \}/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(html, /id="edge-tooltip"[^>]*>側邊標籤：切換模式或關閉乾淨視窗/);
  assert.match(css, /\.edge-tab:hover \.et-tooltip/);
  assert.match(css, /\.et-handle\s*\{[^}]*z-index:\s*2/s);
  assert.match(css, /\.et-rail\s*\{[^}]*z-index:\s*1/s);
});

test('bottom dots select a mode without applying; black button keeps instant apply', async () => {
  const p = fixture();
  await flush();
  p.pips[1].click();
  p.sync();
  assert.equal(p.stage.dataset.selectedLevel, '2');
  assert.equal(p.pips[1].attrs['aria-checked'], 'true');
  assert.equal(p.zones[1].attrs['aria-checked'], 'true');
  assert.equal(p.prefs.cleanLevel, 1);
  assert.equal(p.messages.filter(m => m.action === 'toggle-clean').length, 0);
  assert.equal(p.closed, 0);
  await p.zones[1].click();
  await flush();
  assert.equal(p.prefs.cleanLevel, 2);
  assert.equal(p.messages.at(-1).action, 'toggle-clean');
  assert.deepEqual({ ...p.messages.at(-1).target }, { tabId: 11, windowId: 1 });
  assert.equal(p.closed, 1);
});

test('hovering the central mode button for 1.5 seconds fades to the same caption state as the pips', async () => {
  const p = fixture();
  await flush();
  p.wrap.listeners.pointerenter();
  assert.equal(p.stage.dataset.pips, undefined, 'caption does not appear immediately');
  assert.equal([...p.timers.values()][0]?.due, 1500, 'hover delay is exactly 1.5 seconds');
  p.advanceTimers(1499);
  assert.equal(p.stage.dataset.pips, undefined, 'caption remains hidden before the delay expires');
  p.advanceTimers(1);
  assert.equal(p.stage.dataset.pips, 'on');
  assert.equal(p.stage.dataset.captionSource, 'button');
  p.wrap.listeners.pointerleave();
  p.pipsBox.listeners.pointerenter();
  assert.equal(p.stage.dataset.pips, 'on', 'moving to the pips keeps the caption available');
  assert.equal(p.stage.dataset.captionSource, 'pips');
  p.pipsBox.listeners.pointerleave();
  assert.equal(p.stage.dataset.pips, undefined);
});

test('leaving the central mode button before 1.5 seconds cancels the caption', async () => {
  const p = fixture();
  await flush();
  p.wrap.listeners.pointerenter();
  p.advanceTimers(1499);
  p.wrap.listeners.pointerleave();
  p.advanceTimers(1);
  assert.equal(p.stage.dataset.pips, undefined);
  assert.equal(p.stage.dataset.captionSource, undefined);
});

test('re-entering a black button zone selects under-pointer mode without applying', async () => {
  const p = fixture();
  await flush();
  p.pips[0].click();
  assert.equal(p.stage.dataset.selectedLevel, '1');
  p.zones[2].listeners.mouseenter();
  p.sync();
  assert.equal(p.stage.dataset.selectedLevel, '3');
  assert.equal(p.stage.dataset.previewLevel, '3');
  assert.equal(p.zones[2].attrs['aria-checked'], 'true');
  assert.equal(p.pips[2].attrs['aria-checked'], 'true');
  assert.equal(p.prefs.cleanLevel, 1);
  assert.equal(p.messages.filter(m => m.action === 'toggle-clean').length, 0);
  assert.equal(p.closed, 0);
});

test('popup demonstration tab never launches title editing', async () => {
  const p = fixture();
  await flush();
  await p.handle.click();
  assert.equal(p.messages.length, 0);
  assert.equal(p.nodes.get('#feedback').textContent, '');
});

test('managed popup dots only preview; the original black button switches level', async () => {
  const p = fixture({ popup: true, savedLevel: 3, preferenceLevel: 1 });
  await flush();
  p.sync();
  assert.equal(p.stage.dataset.selectedLevel, '3');
  assert.equal(p.stops[2].classList.contains('selected'), true);
  p.pips[1].click();
  p.sync();
  assert.equal(p.stage.dataset.selectedLevel, '2');
  assert.equal(p.messages.some(m => m.action === 'set-level'), false);
  assert.equal(p.closed, 0);
  await p.zones[1].click();
  await flush();
  assert.equal(p.messages.at(-1).action, 'set-level');
  assert.equal(p.messages.at(-1).type, 'clean-window:hub');
  assert.equal(p.messages.at(-1).level, 2);
  assert.equal(p.closed, 1);
});

test('managed-list EDIT uses an explicit target and clipped titles scroll only on hover', async () => {
  const p = fixture({ popup: true });
  await flush();
  await p.handle.click();
  assert.equal(p.messages.length, 0, 'the decorative tab cannot edit titles');
  assert.match(script, /requestHub\('edit-title', \{ target: targetOf, anchor \}\)/);
  assert.match(script, /screenX: Math\.round\(window\.screenX \+ rect\.left\)/);
  assert.match(script, /title\.textContent = item\.title/);
  assert.match(script, /viewport\.dataset\.overflow = String\(overflow\)/);
  const css = await readFile(new URL('../extension/popup.css', import.meta.url), 'utf8');
  assert.match(css, /@keyframes cw-title-marquee/);
  assert.match(css, /\.managed-name:hover \.managed-name-viewport\[data-overflow="true"\]/);
});
