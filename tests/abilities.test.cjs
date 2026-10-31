/* Ability Library unit and integration checks. Run: node --test tests/abilities.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
function harness() {
  class Element {
    constructor() { this.value = ''; this.checked = false; this.innerHTML = ''; this.textContent = ''; this.handlers = {}; this.open = false; this.classList = { toggle() {} }; }
    addEventListener(type, fn) { this.handlers[type] = fn; }
    emit(type, target) { assert.ok(this.handlers[type], 'missing ' + type); this.handlers[type]({ target: target || this }); }
    querySelectorAll() { return []; }
  }
  const elements = new Map();
  const el = (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const ctx = { window: { confirm: () => true }, document: { getElementById: el }, Date, Math, Set };
  vm.runInNewContext(read('js/abilities.js'), ctx);
  const state = { fields: { manaKind: 'mana' }, resources: [{ id: 'resabcdefg', name: 'Energy' }], abilities: [] };
  const api = ctx.window.WBAbilities;
  api.normalizeState(state);
  let saves = 0;
  const manager = api.init(() => state, () => { saves++; });
  return { api, state, manager, el, saves: () => saves };
}
test('old characters get an empty ability list without losing existing data', () => {
  const { api } = harness();
  const old = { fields: { charName: 'Aldrich' } };
  api.normalizeState(old);
  assert.equal(old.abilities.length, 0);
  assert.equal(old.fields.charName, 'Aldrich');
});
test('normalization sanitizes malformed ability records and duplicates', () => {
  const { api } = harness();
  const state = { abilities: [
    { id: 'abilabcdefg', name: '<script>', type: 'invalid', apCost: -3, resourceCost: '10', favorite: true },
    { id: 'abilabcdefg', name: 'Blink', category: 'Movement', cooldown: '2', notes: 'Saved' },
    null
  ] };
  api.normalizeState(state);
  assert.equal(state.abilities.length, 2);
  assert.equal(state.abilities[0].apCost, 0);
  assert.equal(state.abilities[0].type, 'active');
  assert.equal(state.abilities[0].resourceCost, 10);
  assert.equal(state.abilities[1].cooldown, 2);
  assert.notEqual(state.abilities[0].id, state.abilities[1].id);
});
test('add ability creates persistent character data and escaped display text', () => {
  const { state, el, saves } = harness();
  el('abilityAdd').emit('click');
  assert.equal(state.abilities.length, 1);
  assert.match(el('abilityList').innerHTML, /New ability/);
  assert.ok(saves() > 0);
  state.abilities[0].name = '<img src=x onerror=alert(1)>';
  state.abilities[0].description = 'Very powerful';
  state.abilities[0].apCost = 5;
  state.abilities[0].resourceId = 'resabcdefg';
  state.abilities[0].resourceCost = 25;
  const serialized = JSON.parse(JSON.stringify(state));
  assert.equal(serialized.abilities[0].name, '<img src=x onerror=alert(1)>');
  const { api } = harness();
  api.normalizeState(serialized);
  assert.equal(serialized.abilities[0].resourceCost, 25);
});
test('search and favorite filtering are independent of saved data', () => {
  const { state, manager, el } = harness();
  state.abilities.push(
    { id: 'abilabcdefg', name: 'Overdrive', category: 'Mechanical', type: 'active', description: 'Move faster', notes: '', apCost: 5, resourceId: 'resabcdefg', resourceCost: 25, cooldown: 3, duration: 2, uses: '', favorite: true },
    { id: 'abilhijklmn', name: 'Shadowstep', category: 'Movement', type: 'active', description: '', notes: '', apCost: 4, resourceId: '', resourceCost: '', cooldown: '', duration: '', uses: '', favorite: false }
  );
  manager.render();
  assert.match(el('abilityList').innerHTML, /Overdrive/);
  assert.match(el('abilityList').innerHTML, /Shadowstep/);
  const input = el('abilitySearch');
  input.value = 'Shadow';
  input.emit('input');
  assert.doesNotMatch(el('abilityList').innerHTML, /Overdrive/);
  assert.match(el('abilityList').innerHTML, /Shadowstep/);
  input.value = '';
  el('abilityFavorites').checked = true;
  el('abilityFavorites').emit('change');
  assert.match(el('abilityList').innerHTML, /Overdrive/);
  assert.doesNotMatch(el('abilityList').innerHTML, /Shadowstep/);
  assert.equal(state.abilities.length, 2);
});
test('HTML loads abilities before app, saved in character rather than game', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  assert.ok(html.indexOf('src="js/abilities.js') < html.indexOf('src="js/app.js'));
  assert.match(html, /id="abilitySection"/);
  assert.match(app, /abilities: \[\]/);
  assert.match(app, /WBAbilities\.normalizeState\(state\)/);
  assert.match(app, /WBAbilities\.init\(\(\) => state, save,/);
  const persistence = read('js/persistence.js');
  assert.match(app, /WBPersistence\.exportCharacter\(state\)/);
  assert.match(persistence, /format: CHARACTER_FORMAT/);
  assert.match(persistence, /version: CHARACTER_VERSION/);
});


test('optional uses remain blank for unlimited abilities, while zero remains an explicit limit', () => {
  const { api } = harness();
  const state = { abilities: [
    { name: 'Mana powered', apCost: 5, resourceCost: 25, uses: '' },
    { name: 'Exhausted ability', uses: 0 }
  ] };
  api.normalizeState(state);
  assert.equal(state.abilities[0].uses, '');
  assert.equal(state.abilities[1].uses, 0);
  const exported = JSON.parse(JSON.stringify(state));
  api.normalizeState(exported);
  assert.equal(exported.abilities[0].uses, '');
  assert.equal(exported.abilities[1].uses, 0);
  const html = read('js/abilities.js');
  assert.match(html, /Uses \/ charges \(blank = unlimited\)/);
});

test('character file controls retain unique IDs and replacement confirmations', () => {
  const html = read('index.html');
  for (const id of ['exportBtn', 'importBtn', 'clearBtn', 'clearConfirm', 'importConfirm', 'footBtns', 'importFile', 'saveStatus']) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id + ' should be unique');
  }
});


test('activation spends AP and Energy, tracks cooldown, and never spends on failure', () => {
  const { api } = harness();
  const state = { abilities: [{
    id: 'abilabcdefg', name: 'Overdrive', type: 'active', apCost: 5,
    resourceId: 'resabcdefg', resourceCost: 25, cooldown: 3, duration: 2, uses: ''
  }], resources: [{ id: 'resabcdefg', name: 'Energy', max: 100, current: 100 }], showMana: false };
  api.normalizeState(state);
  let ap = 15;
  const controls = { getAp: () => ap, spendAp: (n) => { ap -= n; } };
  assert.equal(api.activate(state, state.abilities[0].id, controls).ok, true);
  assert.equal(ap, 10);
  assert.equal(state.resources[0].current, 75);
  assert.equal(state.abilities[0].usesLeft, null);
  assert.equal(state.abilities[0].cooldownLeft, 3);
  assert.equal(state.abilities[0].durationLeft, 2);
  assert.equal(api.activate(state, state.abilities[0].id, controls).ok, false);
  assert.equal(ap, 10);
  assert.equal(state.resources[0].current, 75);
  api.advanceTurn(state);
  assert.equal(state.abilities[0].cooldownLeft, 2);
  assert.equal(state.abilities[0].durationLeft, 1);
  api.advanceTurn(state);
  api.advanceTurn(state);
  assert.equal(state.abilities[0].cooldownLeft, 0);
  assert.equal(state.abilities[0].durationLeft, 0);
  assert.equal(api.activate(state, state.abilities[0].id, controls).ok, true);
  assert.equal(state.resources[0].current, 50);
});

test('activation requires sufficient AP, resource, charges, and valid resource', () => {
  const { api } = harness();
  const state = { abilities: [{
    id: 'abilabcdefg', name: 'Pulse', type: 'reaction', apCost: 6,
    resourceId: 'resabcdefg', resourceCost: 10, uses: 1
  }], resources: [{ id: 'resabcdefg', name: 'Energy', max: 100, current: 5 }] };
  api.normalizeState(state);
  let ap = 4;
  const controls = { getAp: () => ap, spendAp: (n) => { ap -= n; } };
  assert.equal(api.activate(state, 'abilabcdefg', controls).ok, false);
  assert.equal(ap, 4);
  ap = 12;
  assert.equal(api.activate(state, 'abilabcdefg', controls).ok, false);
  assert.equal(ap, 12);
  state.resources[0].current = 30;
  assert.equal(api.activate(state, 'abilabcdefg', controls).ok, true);
  assert.equal(ap, 6);
  assert.equal(state.abilities[0].usesLeft, 0);
  assert.equal(api.activate(state, 'abilabcdefg', controls).ok, false);
  api.resetForRest(state);
  assert.equal(state.abilities[0].usesLeft, 1);
});

test('passives cannot be activated; Mana costs require configured visible Mana', () => {
  const { api } = harness();
  const state = { abilities: [
    { id: 'abilabcdefg', name: 'Passive', type: 'passive', apCost: 0 },
    { id: 'abilhijklmn', name: 'Burst', type: 'active', resourceId: 'base-mana', resourceCost: 20 }
  ], resources: [], showMana: false };
  api.normalizeState(state);
  let mana = 30;
  let spent = 0;
  const controls = {
    getAp: () => 15, spendAp: () => {},
    getMana: () => mana, spendMana: (n) => { spent += n; mana -= n; }
  };
  assert.equal(api.activate(state, 'abilabcdefg', controls).ok, false);
  assert.equal(api.activate(state, 'abilhijklmn', controls).ok, false);
  assert.equal(mana, 30);
  state.showMana = true;
  assert.equal(api.activate(state, 'abilhijklmn', controls).ok, true);
  assert.equal(mana, 10);
  assert.equal(spent, 20);
});

test('activation integration uses the same sheet AP, turn, and long-rest controls', () => {
  const app = read('js/app.js');
  const html = read('index.html');
  assert.match(app, /execute\(\{type:'StartTurn'\}\)/);
  assert.match(app, /execute\(\{type:'LongRest'\}\)/);
  assert.match(app, /getAp: \(\) => apHave\(\)/);
  assert.match(app, /spendAp: \(cost\) => spendAp\(cost\)/);
  assert.match(read('js/character-core.js'), /run\(\{type:'RestAbilities'\}/);
  assert.match(html, /id="abilityFeedback"/);
});


test('Foundry holds at most six creations without consuming limited charges', () => {
  const { api } = harness();
  const state = { abilities: [{ id: 'abilabcdefg', name: 'Foundry', type: 'active', uses: '', capacityMax: 6 }],
    resources: [] };
  api.normalizeState(state);
  const controls = { getAp: () => 15, spendAp: () => {} };
  for (let i = 0; i < 6; i++) assert.equal(api.activate(state, 'abilabcdefg', controls).ok, true);
  assert.equal(state.abilities[0].capacityCurrent, 6);
  assert.equal(state.abilities[0].usesLeft, null);
  assert.equal(api.activate(state, 'abilabcdefg', controls).ok, false);
  api.resetForRest(state);
  assert.equal(state.abilities[0].capacityCurrent, 6);
  state.abilities[0].capacityCurrent = 5; // one held item was released
  assert.equal(api.activate(state, 'abilabcdefg', controls).ok, true);
});

test('capacity is optional, bounded, and saved with the character', () => {
  const { api } = harness();
  const state = { abilities: [
    { name: 'No limit', capacityMax: '', capacityCurrent: 17 },
    { name: 'Limited', capacityMax: 6, capacityCurrent: 99 }
  ] };
  api.normalizeState(state);
  assert.equal(state.abilities[0].capacityMax, '');
  assert.equal(state.abilities[0].capacityCurrent, 0);
  assert.equal(state.abilities[1].capacityCurrent, 6);
  const saved = JSON.parse(JSON.stringify(state));
  api.normalizeState(saved);
  assert.equal(saved.abilities[1].capacityMax, 6);
  assert.equal(saved.abilities[1].capacityCurrent, 6);
});

test('quick Use stays outside details and remains available when collapsed', () => {
  const js = read('js/abilities.js');
  assert.match(js, /ability-quick-use/);
  assert.match(js, /data-ability-action="use"/);
  assert.match(js, /data-ability-action="release"/);
  assert.match(js, /'<\/div><\/details>' \+/);
});

test('temporary movement effects stack while active and expire without changing base fields', () => {
  const { api } = harness();
  const state = { fields: { speed: '15' }, resources: [], abilities: [
    { id: 'abilabcdefg', name: 'Haste', type: 'active', duration: 3, effectTarget: 'movement', effectValue: 15 },
    { id: 'abilhijklmn', name: 'Slow', type: 'active', duration: 2, effectTarget: 'movement', effectValue: -5 }
  ] };
  api.normalizeState(state);
  const c = { getAp: () => 15, spendAp: () => {} };
  assert.equal(api.activate(state, state.abilities[0].id, c).ok, true);
  assert.equal(api.activate(state, state.abilities[1].id, c).ok, true);
  assert.equal(api.movementBonus(state), 10);
  api.advanceTurn(state);
  assert.equal(api.movementBonus(state), 10);
  api.advanceTurn(state);
  assert.equal(api.movementBonus(state), 15);
  api.advanceTurn(state);
  assert.equal(api.movementBonus(state), 0);
  assert.equal(state.fields.speed, '15');
});
test('automatic movement bonuses require a duration before any costs are spent', () => {
  const { api } = harness();
  const state = { abilities: [{ id: 'abilabcdefg', name: 'Speed Up', type: 'active',
    apCost: 5, duration: '', effectTarget: 'movement', effectValue: 15 }], resources: [] };
  api.normalizeState(state);
  let ap = 15;
  assert.equal(api.activate(state, 'abilabcdefg', { getAp: () => ap, spendAp: n => { ap -= n; } }).ok, false);
  assert.equal(ap, 15);
});
test('effect values and targets persist safely through character import', () => {
  const { api } = harness();
  const state = { abilities: [{ name: 'Speed', effectTarget: 'movement', effectValue: 15, durationLeft: 3 },
    { name: 'Bad target', effectTarget: 'eval', effectValue: 999999 }] };
  api.normalizeState(state);
  assert.equal(state.abilities[0].effects[0].value, 15);
  assert.equal(state.abilities[1].effects[0].target, 'none');
  assert.equal(state.abilities[1].effects[0].value, 99999);
  const recovered = JSON.parse(JSON.stringify(state));
  api.normalizeState(recovered);
  assert.equal(api.movementBonus(recovered), 15);
});
test('movement panel uses derived movement bonus', () => {
  const app = read('js/app.js');
  assert.match(app, /WBAbilities\.movementBonus\(state\)/);
  assert.match(app, /execute\(\{type:'StartTurn'\}\)[\s\S]*?fillInputs\(\);refreshAll\(\);save\(\)/);
});

test('movement display and derived speed do not double-count an active bonus', () => {
  const { api } = harness();
  const state = { abilities: [{ name: 'Enhanced Movement', effectTarget: 'movement', effectValue: 15, durationLeft: 3 }] };
  api.normalizeState(state);
  assert.equal(api.effectiveMovement(state, 15), 30);
  assert.equal(api.effectiveMovement(state, 15), 30);
  assert.equal(api.effectiveMovement(state, 10), 25);
  api.advanceTurn(state);
  api.advanceTurn(state);
  api.advanceTurn(state);
  assert.equal(api.effectiveMovement(state, 15), 15);
  const app = read('js/app.js');
  const css = read('css/sheet.css');
  assert.match(app, /const speedNow = \(\) => window\.WBAbilities\.effectiveMovement\(state, speedBase\(\)\)/);
  // Check the behavior hooks rather than matching the entire implementation expression.
  // The style now also covers Movement derived from temporary AGL score effects.
  assert.match(app, /el\.classList\.toggle\('ability-adjusted', !manual/);
  assert.match(app, /!!gear\('move'\)/);
  assert.match(app, /effectBonus\(state, 'stat', 'AGL'\)/);
  assert.match(app, /dataset\.editingBase/);
  assert.match(css, /input\[data-auto\]\.ability-adjusted:not\(\.manual\)/);
  assert.match(css, /var\(--verdigris\)/);
});

test('multiple effects stack on Armor, Evasion, stats and custom max', () => {
  const { api } = harness();
  const state = { resources: [{id:'resabcdefg',max:100,current:60}], abilities: [
    { name:'Overdrive', durationLeft:3, effects:[
      { target:'movement',value:15 }, { target:'armor',value:2 },
      { target:'evasion',value:3 }, { target:'stat',stat:'STR',value:4 },
      { target:'resource-max',resourceId:'resabcdefg',value:20 }
    ] },
    { name:'Barrier', durationLeft:2, effects:[{target:'armor',value:5}] }
  ]};
  api.normalizeState(state);
  assert.equal(api.effectBonus(state,'armor'),7);
  assert.equal(api.effectBonus(state,'evasion'),3);
  assert.equal(api.effectBonus(state,'stat','STR'),4);
  assert.equal(api.effectBonus(state,'stat','DEX'),0);
  assert.equal(api.effectiveMovement(state,15),30);
  assert.equal(api.resourceMax(state,state.resources[0]),120);
  assert.equal(state.resources[0].max,100);
  assert.equal(state.resources[0].current,60);
  api.advanceTurn(state);api.advanceTurn(state);
  assert.equal(api.effectBonus(state,'armor'),2);
  api.advanceTurn(state);
  assert.equal(api.effectBonus(state,'armor'),0);
  assert.equal(api.resourceMax(state,state.resources[0]),100);
});
test('old single movement effects are migrated without double-counting', () => {
  const { api } = harness();
  const state = { abilities:[{name:'Old Haste',effectTarget:'movement',effectValue:15,durationLeft:2}]};
  api.normalizeState(state);
  assert.equal(state.abilities[0].effects.length,1);
  assert.equal(api.movementBonus(state),15);
  api.normalizeState(state);
  assert.equal(state.abilities[0].effects.length,1);
  assert.equal(api.movementBonus(state),15);
});
test('effectful activations require duration and valid resources before any AP spending', () => {
  const { api } = harness();
  const state = { resources:[], abilities:[{id:'abilabcdefg',name:'Shield',duration:'',apCost:5,
    effects:[{target:'armor',value:2},{target:'resource-max',resourceId:'missing',value:20}]}]};
  api.normalizeState(state);
  let ap=15;
  const c={getAp:()=>ap,spendAp:n=>{ap-=n}};
  assert.equal(api.activate(state,'abilabcdefg',c).ok,false);
  assert.equal(ap,15);
  state.abilities[0].duration=3;
  assert.equal(api.activate(state,'abilabcdefg',c).ok,false);
  assert.equal(ap,15);
});
