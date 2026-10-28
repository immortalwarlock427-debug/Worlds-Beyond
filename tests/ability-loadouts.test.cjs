/* Ability loadouts regression checks: node --test tests/ability-loadouts.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
function harness() {
  class El {
    constructor() {
      this.value = ''; this.checked = false; this.innerHTML = ''; this.textContent = '';
      this.handlers = {}; this.disabled = false; this.classList = { toggle() {} };
    }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    emit(type, event={}) { assert.ok(this.handlers[type], 'Missing event: '+type); this.handlers[type]({ target:this, ...event }); }
    querySelectorAll() { return []; }
  }
  const ids = new Map();
  const el = id => { if (!ids.has(id)) ids.set(id,new El()); return ids.get(id); };
  const ctx = {window:{confirm:()=>true},document:{getElementById:el},Date,Math,Set};
  vm.runInNewContext(read('js/abilities.js'),ctx);
  const api=ctx.window.WBAbilities;
  const state={abilities:[],abilityLoadouts:[],activeAbilityLoadoutId:'',resources:[{id:'resabcdefg',name:'Energy',max:100,current:100}],showMana:true};
  api.normalizeState(state);
  let ap=30,saves=0;
  const controls={getAp:()=>ap,spendAp:n=>{ap-=n},refresh(){}};
  const view=api.init(()=>state,()=>saves++,controls);
  return {api,state,el,view,controls,getAp:()=>ap,saves:()=>saves};
}
function ability(id,name,ids=[]) {
  return {id,name,type:'active',apCost:5,resourceId:'resabcdefg',resourceCost:10,
    uses:2,usesLeft:2,cooldown:2,cooldownLeft:0,duration:3,durationLeft:0,
    capacityMax:'',capacityCurrent:0,loadoutIds:ids,effects:[],favorite:false,
    category:'Combat',description:'',notes:''};
}
test('legacy character save uses empty ability forms; abilities remain accessible', () => {
  const {api}=harness();
  const old={abilities:[{name:'Old skill',apCost:3}],portraits:[{name:'Base'}],formId:'portrait-7'};
  api.normalizeState(old);
  assert.equal(old.abilityLoadouts.length,0);
  assert.equal(old.activeAbilityLoadoutId,'');
  assert.equal(old.abilities[0].loadoutIds.length,0);
  assert.equal(api.loadoutVisible(old,old.abilities[0]),true);
  assert.equal(old.formId,'portrait-7');
  assert.equal(old.portraits[0].name,'Base');
});
test('forms select which skills are available while shared skills always work', () => {
  const {api,state,controls,getAp}=harness();
  const warrior=api.createLoadout(state,'Warrior');
  const mage=api.createLoadout(state,'Mage');
  state.abilities=[ability('abilabcdefg','Sword Strike',[warrior.id]),
    ability('abilhijklmn','Fireball',[mage.id]),ability('abilmnopqrst','Dodge',[])];
  state.activeAbilityLoadoutId=warrior.id;
  assert.deepEqual(Array.from(api.filterAbilities(state,{sort:'name'},controls),a=>a.name),['Dodge','Sword Strike']);
  let fail=api.activate(state,'abilhijklmn',controls);
  assert.equal(fail.ok,false);
  assert.match(fail.message,/unavailable/i);
  assert.equal(state.resources[0].current,100);
  assert.equal(getAp(),30);
  assert.equal(api.activate(state,'abilabcdefg',controls).ok,true);
  assert.equal(getAp(),25);
  assert.equal(state.resources[0].current,90);
  state.activeAbilityLoadoutId=mage.id;
  assert.equal(api.loadoutVisible(state,state.abilities[0]),false);
  assert.equal(api.activate(state,'abilhijklmn',controls).ok,true);
  assert.equal(state.abilities[0].cooldownLeft,2);
  assert.equal(state.abilities[0].usesLeft,1);
  assert.equal(state.abilities[0].durationLeft,3);
  assert.equal(state.abilities[1].usesLeft,1);
  api.advanceTurn(state);
  assert.equal(state.abilities[0].cooldownLeft,1,'cooldown continues in another form');
  assert.equal(state.abilities[0].durationLeft,2,'timed effects continue in another form');
  assert.equal(api.filterAbilities(state,{showAll:true},controls).length,3);
  assert.equal(api.filterAbilities(state,{status:'usable',showAll:true},controls).length,1);
});
test('one ability can belong to multiple forms; base permits only shared abilities', () => {
  const {api,state,controls}=harness();
  const a=api.createLoadout(state,'One'),b=api.createLoadout(state,'Two');
  state.abilities=[ability('abilabcdefg','Dual',[a.id,b.id]),ability('abilhijklmn','Shared',[])];
  state.activeAbilityLoadoutId=a.id;
  assert.equal(api.loadoutVisible(state,state.abilities[0]),true);
  state.activeAbilityLoadoutId=b.id;
  assert.equal(api.loadoutVisible(state,state.abilities[0]),true);
  state.activeAbilityLoadoutId='';
  assert.equal(api.loadoutVisible(state,state.abilities[0]),false);
  assert.deepEqual(Array.from(api.filterAbilities(state,{},controls),x=>x.name),['Shared']);
});
test('deleting a form does not delete abilities or reset remaining resources/tracking', () => {
  const {api,state}=harness();
  const a=api.createLoadout(state,'Warrior'),b=api.createLoadout(state,'Mage');
  state.abilities=[ability('abilabcdefg','Warrior-only',[a.id]),ability('abilhijklmn','Dual',[a.id,b.id])];
  state.abilities[0].cooldownLeft=2;state.abilities[0].usesLeft=1;state.abilities[0].durationLeft=2;
  state.activeAbilityLoadoutId=a.id;
  assert.equal(api.removeLoadout(state,a.id),true);
  assert.equal(state.abilities.length,2);
  assert.deepEqual(Array.from(state.abilities[0].loadoutIds),[]);
  assert.deepEqual(Array.from(state.abilities[1].loadoutIds),[b.id]);
  assert.equal(state.abilities[0].cooldownLeft,2);
  assert.equal(state.abilities[0].usesLeft,1);
  assert.equal(state.abilities[0].durationLeft,2);
  assert.equal(state.activeAbilityLoadoutId,'');
});
test('loadouts survive character JSON export/import and malformed references are removed', () => {
  const {api,state}=harness();
  const f=api.createLoadout(state,'Arcane');
  state.abilities=[ability('abilabcdefg','Rune',[f.id,'invalid','invalid'])];
  const copy=JSON.parse(JSON.stringify(state));
  api.normalizeState(copy);
  assert.equal(copy.abilityLoadouts[0].name,'Arcane');
  assert.equal(copy.activeAbilityLoadoutId,f.id);
  assert.deepEqual(Array.from(copy.abilities[0].loadoutIds),[f.id]);
  assert.equal(copy.resources[0].current,100);
  assert.equal(api.loadoutVisible(copy,copy.abilities[0]),true);
});
test('loadout controls create and select forms without erasing saved abilities', () => {
  const {api,state,el,view,saves}=harness();
  state.abilities=[ability('abilabcdefg','Common Skill')];
  el('abilityLoadoutName').value='Seven Classes - Warrior';
  el('abilityLoadoutAdd').emit('click');
  assert.equal(state.abilityLoadouts.length,1);
  const a=state.abilityLoadouts[0];
  assert.equal(a.name,'Seven Classes - Warrior');
  assert.equal(state.activeAbilityLoadoutId,a.id);
  assert.equal(state.abilities[0].loadoutIds.length,0);
  assert.match(el('abilityLoadoutSelect').innerHTML,/Seven Classes - Warrior/);
  assert.ok(saves()>0);
  el('abilityShowAll').checked=true;el('abilityShowAll').emit('change');
  assert.match(el('abilityList').innerHTML,/Common Skill/);
  el('abilityLoadoutSelect').value='';
  el('abilityLoadoutSelect').emit('change');
  assert.equal(state.activeAbilityLoadoutId,'');
  assert.equal(state.abilities[0].cooldownLeft,0);
});
test('UI and character state store ability loadouts separately from portrait forms',()=>{
  const h=read('index.html'),app=read('js/app.js'),css=read('css/sheet.css');
  for(const id of ['abilityLoadoutSelect','abilityLoadoutAdd','abilityLoadoutDelete',
    'abilityLoadoutName','abilityShowAll','abilityLoadoutFeedback']) {
    assert.equal((h.match(new RegExp('id="'+id+'"','g')) || []).length,1,id);
  }
  assert.match(app,/abilityLoadouts: \[\], activeAbilityLoadoutId: ''/);
  assert.match(css,/\.ability-loadouts/);
  assert.match(h, /css\/sheet\.css\?v=[a-z0-9-]+/); // Asset version can change between releases.
});


test('clicking a form while Shared is selected makes it exclusive without an extra uncheck', () => {
  const {api,state}=harness();
  const warrior=api.createLoadout(state,'Warrior');
  const mage=api.createLoadout(state,'Mage');
  const a=ability('abilabcdefg','Aegis');
  state.abilities.push(a);
  assert.deepEqual(Array.from(a.loadoutIds),[]);
  assert.equal(api.loadoutVisible(state,a),true);
  assert.equal(api.setLoadoutMembership(state,a,'member',warrior.id,true),true);
  assert.deepEqual(Array.from(a.loadoutIds),[warrior.id]);
  state.activeAbilityLoadoutId=mage.id;
  assert.equal(api.loadoutVisible(state,a),false);
  assert.equal(api.setLoadoutMembership(state,a,'member',mage.id,true),true);
  assert.deepEqual(Array.from(a.loadoutIds),[warrior.id,mage.id]);
  assert.equal(api.setLoadoutMembership(state,a,'member',warrior.id,false),true);
  assert.deepEqual(Array.from(a.loadoutIds),[mage.id]);
  assert.equal(api.setLoadoutMembership(state,a,'member',mage.id,false),true);
  assert.deepEqual(Array.from(a.loadoutIds),[],'Unchecking last selected form restores Shared');
  assert.equal(api.loadoutVisible(state,a),true);
});

test('selecting Shared clears all specific forms without resetting ability trackers', () => {
  const {api,state}=harness();
  const warrior=api.createLoadout(state,'Warrior');
  const mage=api.createLoadout(state,'Mage');
  const a=ability('abilabcdefg','Aegis',[warrior.id,mage.id]);
  a.cooldownLeft=2;a.usesLeft=1;a.durationLeft=1;a.capacityCurrent=2;
  state.abilities.push(a);
  assert.equal(api.setLoadoutMembership(state,a,'shared','',true),true);
  assert.deepEqual(Array.from(a.loadoutIds),[]);
  assert.equal(a.cooldownLeft,2);
  assert.equal(a.usesLeft,1);
  assert.equal(a.durationLeft,1);
  assert.equal(a.capacityCurrent,2);
  assert.equal(api.setLoadoutMembership(state,a,'shared','',false),true);
  assert.deepEqual(Array.from(a.loadoutIds),[mage.id],'Unchecking Shared chooses the current form');
  assert.equal(api.setLoadoutMembership(state,a,'member','nonexistent',true),false);
  assert.deepEqual(Array.from(a.loadoutIds),[mage.id]);
});

test('form membership checkboxes are interactive even when Shared is selected', () => {
  const js=read('js/abilities.js');
  const start=js.indexOf('function memberships(ability)');
  const end=js.indexOf('function renderLoadouts()',start);
  assert.ok(start>0 && end>start);
  const markup=js.slice(start,end);
  assert.match(markup,/data-loadout-member/);
  assert.doesNotMatch(markup,/disabled/);
  assert.match(markup,/!shared && ability\.loadoutIds\.includes\(form\.id\)/);
});
