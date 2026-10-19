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
  const make = (dataset = {}) => ({
    dataset, listeners: {}, attrs: {}, disabled: true, hidden: false,
    textContent: '', value: '1', classList: {
      items: new Set(),
      toggle(name, on) { if (on) this.items.add(name); else this.items.delete(name); },
      contains(name) { return this.items.has(name); }
    },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    querySelector() { return null; },
    click() { return this.listeners.click?.({ stopPropagation() {} }); }
  });
  const stops = [1, 2, 3].map(level => make({ level: String(level) }));
  const zones = [1, 2, 3].map(level => make({ level: String(level) }));
  const pips = [1, 2, 3].map(level => make({ level: String(level) }));
  const pipsBox = make();
  pipsBox.querySelectorAll = selector => selector === '.pip' ? pips : [];
  pipsBox.matches = () => false;
  const handle = make({});
  const stage = make({ selectedLevel: '1', previewLevel: '1' });
  stage.querySelectorAll = selector => selector === '.morph-zone' ? zones : selector === '.pip' ? pips : [];
  stage.querySelector = selector => {
    if (selector === '.level-pips') return pipsBox;
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
    chrome, document, MutationObserver, window: { close() { closed++; } }
  });
  return {
    nodes, stops, zones, pips, handle, stage, prefs, messages,
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
  assert.match(css, /prefers-reduced-motion: reduce/);
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

test('edge title control refuses to rename normal window', async () => {
  const p = fixture();
  await flush();
  await p.handle.click();
  assert.equal(p.messages.length, 0);
  assert.match(p.nodes.get('#feedback').textContent, /請先開啟乾淨模式/);
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

test('managed edge title action carries explicit window and tab IDs', async () => {
  const p = fixture({ popup: true });
  await flush();
  await p.handle.click();
  assert.equal(p.messages[0].type, 'clean-window:run');
  assert.equal(p.messages[0].action, 'edit-title');
  assert.deepEqual({ ...p.messages[0].target }, { tabId: 11, windowId: 1 });
  assert.equal(p.closed, 1);
});
