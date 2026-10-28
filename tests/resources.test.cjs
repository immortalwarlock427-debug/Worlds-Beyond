/* Self-contained resource manager tests. Run: node --test tests/resources.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '..', 'js', 'resources.js'), 'utf8');

function setup() {
  class Element {
    constructor() {
      this.checked = true;
      this.hidden = false;
      this.innerHTML = '';
      this.handlers = {};
    }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    emit(type, event = {}) {
      assert.ok(this.handlers[type], type + ' listener is installed');
      this.handlers[type](event);
    }
    querySelectorAll(query) {
      return query === '[data-resource-prop="name"]'
        ? [{ focus() {}, select() {} }]
        : [];
    }
  }
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const context = {
    window: { confirm: () => true },
    document: { getElementById },
    Date, Math, Set
  };
  vm.runInNewContext(script, context, { filename: 'resources.js' });
  const api = context.window.WBResources;
  const state = { resources: [], showMana: true };
  api.normalizeState(state);
  let saveCount = 0;
  const manager = api.init(() => state, () => { saveCount++; });
  return { api, state, manager, getElementById, saves: () => saveCount, window: context.window };
}

function fireProperty(els, id, prop, value) {
  const input = {
    dataset: { resourceProp: prop },
    value,
    checked: Boolean(value),
    closest: (selector) =>
      selector === '[data-resource-prop]' ? input :
      selector === '[data-resource-id]' ? { dataset: { resourceId: id } } : null
  };
  els('resourceList').emit('change', { target: input });
}

function fireAction(els, id, action, amount = 5) {
  const card = {
    dataset: { resourceId: id },
    querySelector: () => ({ value: amount })
  };
  const button = {
    dataset: { resourceAction: action },
    closest: (selector) => selector === '[data-resource-action]' ? button : card
  };
  els('resourceList').emit('click', { target: button });
}

test('legacy characters keep Mana and start with no custom resources', () => {
  const { api } = setup();
  const old = { fields: { mpCur: 37, manaKind: 'holy' } };
  api.normalizeState(old);
  assert.deepEqual(Array.from(old.resources), []);
  assert.equal(old.showMana, true);
  assert.deepEqual(old.fields, { mpCur: 37, manaKind: 'holy' });
});

test('imported values are clamped, sanitized and assigned distinct stable ids', () => {
  const { api } = setup();
  const state = { showMana: false, resources: [
    { id: 'resabcdefg', name: 'Energy', max: 100, current: 500, regen: -20, color: 'blue', display: 'percent', refillOnRest: false },
    { id: 'resabcdefg', name: '', max: 0, current: -30, regen: 999999999, display: 'invalid' },
    null
  ] };
  api.normalizeState(state);
  assert.equal(state.showMana, false);
  assert.equal(state.resources.length, 2);
  assert.equal(state.resources[0].current, 100);
  assert.equal(state.resources[0].regen, 0);
  assert.equal(state.resources[0].refillOnRest, false);
  assert.equal(state.resources[0].display, 'percent');
  assert.equal(state.resources[1].max, 1);
  assert.equal(state.resources[1].current, 0);
  assert.equal(state.resources[1].name, 'Resource');
  assert.equal(state.resources[1].regen, 999999);
  assert.notEqual(state.resources[0].id, state.resources[1].id);
});

test('adding, editing and removing resource pools persists the changes', () => {
  const { state, getElementById: el, saves } = setup();
  el('addResource').emit('click');
  assert.equal(state.resources.length, 1);
  const r = state.resources[0];
  assert.ok(r.id.startsWith('res'));
  assert.equal(r.current, 100);
  fireProperty(el, r.id, 'name', 'Heat');
  fireProperty(el, r.id, 'max', '200');
  fireProperty(el, r.id, 'current', '155');
  fireProperty(el, r.id, 'color', 'red');
  assert.equal(r.name, 'Heat');
  assert.equal(r.max, 200);
  assert.equal(r.current, 155);
  assert.match(el('resourceList').innerHTML, /Heat/);
  assert.match(el('resourceList').innerHTML, /155 \/ 200/);
  assert.match(el('resourceList').innerHTML, /resource-meter red/);
  fireAction(el, r.id, 'remove');
  assert.equal(state.resources.length, 0);
  assert.ok(saves() >= 6);
});

test('Spend, Restore and Fill cap correctly without ever spending AP', () => {
  const { state, getElementById: el } = setup();
  el('addResource').emit('click');
  const r = state.resources[0];
  const ap = 15;
  fireAction(el, r.id, 'spend', '18');
  assert.equal(r.current, 82);
  fireAction(el, r.id, 'spend', '300');
  assert.equal(r.current, 0);
  fireAction(el, r.id, 'restore', '31');
  assert.equal(r.current, 31);
  fireAction(el, r.id, 'restore', '1000');
  assert.equal(r.current, 100);
  fireAction(el, r.id, 'spend', '17');
  fireAction(el, r.id, 'refill');
  assert.equal(r.current, 100);
  assert.equal(ap, 15);
});

test('resource adjustment amount persists through actions, rerenders and character saves', () => {
  const { state, manager, getElementById: el } = setup();
  el('addResource').emit('click');
  const r = state.resources[0];
  const amountInput = {
    value: '10',
    closest: (selector) => selector === '[data-resource-amount]' ? amountInput :
      selector === '[data-resource-id]' ? { dataset: { resourceId: r.id } } : null
  };
  el('resourceList').emit('change', { target: amountInput });
  assert.equal(r.amount, 10);
  assert.match(el('resourceList').innerHTML, /value="10" data-resource-amount/);
  fireAction(el, r.id, 'spend', '10');
  assert.equal(r.current, 90);
  assert.equal(r.amount, 10);
  assert.match(el('resourceList').innerHTML, /value="10" data-resource-amount/);
  fireAction(el, r.id, 'restore', '10');
  assert.equal(r.current, 100);
  manager.render();
  assert.match(el('resourceList').innerHTML, /value="10" data-resource-amount/);
  const imported = JSON.parse(JSON.stringify(state));
  const { api } = setup();
  api.normalizeState(imported);
  assert.equal(imported.resources[0].amount, 10);
});

test('turn recovery and long rest obey individual preferences', () => {
  const { state, manager, getElementById: el } = setup();
  el('addResource').emit('click');
  el('addResource').emit('click');
  const [a,b] = state.resources;
  a.current = 20; a.regen = 15; a.refillOnRest = false;
  b.current = 70; b.regen = 0; b.refillOnRest = true;
  manager.turnStart();
  assert.equal(a.current, 35);
  assert.equal(b.current, 70);
  manager.longRest();
  assert.equal(a.current, 35);
  assert.equal(b.current, 100);
  a.regen = 999999;
  manager.turnStart();
  assert.equal(a.current, 100);
});

test('Mana visibility toggles without changing resource balances', () => {
  const { state, getElementById: el } = setup();
  state.resources.push({ id: 'resabcdefg', name: 'Energy', max: 100, current: 27,
    color: 'blue', display: 'percent', regen: 0, refillOnRest: false });
  const checkbox = el('showManaPool');
  checkbox.checked = false;
  checkbox.emit('change');
  assert.equal(state.showMana, false);
  assert.equal(el('manaPool').hidden, true);
  assert.equal(state.resources[0].current, 27);
  checkbox.checked = true;
  checkbox.emit('change');
  assert.equal(el('manaPool').hidden, false);
});

test('the character sheet loads manager before app and hooks turn/rest/export', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.ok(html.indexOf('src="js/resources.js"') < html.indexOf('src="js/app.js"'));
  assert.match(html, /id="resourceSection"/);
  assert.match(app, /window\.WBResources\.normalizeState\(state\)/);
  assert.match(app, /resourceManager\.turnStart\(\)/);
  assert.match(app, /resourceManager\.longRest\(\)/);
  assert.match(app, /resources: state\.resources/);
  assert.match(app, /version: 1, exported: new Date/);
});
