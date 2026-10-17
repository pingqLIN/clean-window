import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function panel(initialPrefs = {}, overrides = {}) {
  const nodes = new Map();
  const make = () => ({
    disabled: true, value: '4', checked: false, textContent: '', hidden: false,
    listeners: {},
    addEventListener(event, handler) { this.listeners[event] = handler; },
    querySelector() { return { textContent: '' }; }
  });
  for (const id of ['#target-status','#feedback','#clean-level','#level-number',
    '#level-title','#level-detail','#level-limit','#clean-label','#clean-description']) nodes.set(id, make());
  const buttons = ['toggle-clean','restore'].map(action => ({
    ...make(), dataset: { action }, disabled: true
  }));
  const prefs = { ...initialPrefs };
  const messages = [];
  const chrome = {
    tabs: { async query(query) { return query.windowId ? [{id:11}] : [{id:11,windowId:1}]; } },
    windows: { async get() { return overrides.win ?? {id:1,type:'normal',state:'normal'}; } },
    commands: { async getAll() { return []; } },
    storage: {
      session: { async get() { return overrides.journal ?? {}; } },
      local: {
        async get() { return { ...prefs }; },
        async set(value) {
          if (overrides.failStore) throw new Error('storage failed');
          Object.assign(prefs, value);
        }
      }
    },
    runtime: { async sendMessage(message) { messages.push(message); return { ok: true }; } }
  };
  const document = {
    querySelectorAll() { return buttons; },
    querySelector(selector) { return nodes.get(selector); }
  };
  let closed = 0;
  const window = { close() { closed++; } };
  runInNewContext(script, { chrome, document, window });
  return { nodes, buttons, prefs, messages, get closed() { return closed; } };
}


test('new popup initializes at level 1 of 3',async()=>{
 const p=panel();await flush();
 assert.equal(p.nodes.get('#clean-level').value,'1');
 assert.equal(p.nodes.get('#level-number').textContent,'1 / 3');
 assert.match(p.nodes.get('#level-title').textContent,/擴充欄/);
 assert.equal(p.nodes.get('#clean-level').disabled,false);
});
test('setting level 2 persists and advertises URL only',async()=>{
 const p=panel();await flush();
 const slider=p.nodes.get('#clean-level');slider.value='2';
 slider.listeners.input();
 assert.match(p.nodes.get('#level-detail').textContent,/網址欄/);
 assert.match(p.nodes.get('#level-detail').textContent,/不顯示擴充工具列/);
 await slider.listeners.change();
 assert.equal(p.prefs.cleanLevel,2);
 await p.buttons[0].listeners.click();
 assert.equal(p.messages[0].action,'toggle-clean');
 assert.equal(p.closed,1);
});
test('level 3 has no additional toolbar and no limitation',async()=>{
 const p=panel({cleanLevel:3});await flush();
 assert.equal(p.nodes.get('#clean-level').value,'3');
 assert.match(p.nodes.get('#level-title').textContent,/純精簡/);
 assert.equal(p.nodes.get('#level-limit').hidden,true);
});
test('invalid saved level falls back to level one of three',async()=>{
 const p=panel({cleanLevel:6});await flush();
 assert.equal(p.nodes.get('#clean-level').value,'1');
});
test('storage errors restore previous valid level',async()=>{
 const p=panel({cleanLevel:2},{failStore:true});await flush();
 const slider=p.nodes.get('#clean-level');slider.value='3';
 slider.listeners.input();await slider.listeners.change();
 assert.equal(slider.value,'2');
 assert.equal(p.prefs.cleanLevel,2);
 assert.match(p.nodes.get('#feedback').textContent,/storage failed/);
 assert.ok(p.buttons.every(button=>!button.disabled));
});
test('existing detached popup keeps its restore action',async()=>{
 const p=panel({cleanLevel:1},{win:{id:1,type:'popup',state:'normal'}});await flush();
 assert.equal(p.nodes.get('#clean-label').textContent,'從目前模式還原');
 assert.equal(p.nodes.get('#clean-level').value,'1');
});
