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
  for(const name of ['combat-core','character-core'])vm.runInNewContext(read('js/'+name+'.js'),ctx);
  const controls={getAp:()=>ap,spendAp:n=>{ap-=n},refresh(){},execute(command){
    const result=ctx.window.WBCharacter.apply(state,command);
    if(result.ok)Object.assign(state,result.patch);
    return result;
  }};
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


test('optional linked portraits follow form switches without changing other portraits', () => {
  const {api,state}=harness();
  state.portraits=[{id:'p-warrior',src:'data:image/png;base64,a',name:'Warrior'},
                   {id:'p-mage',src:'data:image/png;base64,b',name:'Mage'}];
  state.formId='p-warrior';
  const warrior=api.createLoadout(state,'Warrior'), mage=api.createLoadout(state,'Mage');
  assert.equal(api.configureLoadout(state,warrior.id,'portraitId','p-warrior'),true);
  assert.equal(api.configureLoadout(state,mage.id,'portraitId','p-mage'),true);
  assert.equal(state.formId,'p-mage','Linking portrait on active form previews it immediately');
  assert.equal(api.selectLoadout(state,warrior.id),true);
  assert.equal(state.formId,'p-warrior');
  assert.equal(api.selectLoadout(state,mage.id),true);
  assert.equal(state.formId,'p-mage');
  assert.equal(api.selectLoadout(state,''),true);
  assert.equal(state.formId,'p-mage','Base form leaves current portrait unchanged');
  const other=api.createLoadout(state,'Other');
  assert.equal(api.configureLoadout(state,other.id,'portraitId','invalid'),true);
  assert.equal(other.portraitId,'');
  state.formId='p-warrior';
  assert.equal(api.selectLoadout(state,other.id),true);
  assert.equal(state.formId,'p-warrior','Unlinked form leaves portrait unchanged');
});

test('form stat adjustments apply only to the selected form and do not rewrite base stats', () => {
  const {api,state,controls}=harness();
  state.fields={baseSTR:14};
  const a=api.createLoadout(state,'Warrior');
  const b=api.createLoadout(state,'Mage');
  assert.equal(api.configureLoadout(state,a.id,'STR',4),true);
  assert.equal(api.configureLoadout(state,a.id,'AGL',-2),true);
  assert.equal(api.configureLoadout(state,b.id,'INT',5),true);
  assert.equal(api.configureLoadout(state,b.id,'STR','bad'),true);
  assert.equal(api.formStatBonus(state,'STR'),0);
  assert.equal(api.formStatBonus(state,'INT'),5);
  assert.equal(api.selectLoadout(state,a.id),true);
  assert.equal(api.formStatBonus(state,'STR'),4);
  assert.equal(api.formStatBonus(state,'AGL'),-2);
  assert.equal(api.formStatBonus(state,'INT'),0);
  assert.equal(api.formStatBonus(state,'NOT_A_STAT'),0);
  assert.equal(api.selectLoadout(state,''),true);
  assert.equal(api.formStatBonus(state,'STR'),0);
  assert.equal(state.fields.baseSTR,14);
  assert.equal(api.configureLoadout(state,a.id,'STR',999),true);
  assert.equal(api.selectLoadout(state,a.id),true);
  assert.equal(api.formStatBonus(state,'STR'),28,'Out-of-range modifiers are bounded');
  assert.equal(api.configureLoadout(state,a.id,'badProperty',3),false);
});

test('mechanical form configuration survives import and old loadouts get defaults', () => {
  const {api,state}=harness();
  state.portraits=[{id:'portrait1',name:'Form one',src:'data:image/png;base64,a'}];
  const original=api.createLoadout(state,'Fae');
  api.configureLoadout(state,original.id,'portraitId','portrait1');
  api.configureLoadout(state,original.id,'DEX',3);
  const imported=JSON.parse(JSON.stringify(state));
  api.normalizeState(imported);
  assert.equal(imported.abilityLoadouts[0].portraitId,'portrait1');
  assert.equal(imported.abilityLoadouts[0].statBonuses.DEX,3);
  assert.equal(api.formStatBonus(imported,'DEX'),3);
  imported.abilityLoadouts=[{id:'loadabcdefg',name:'Legacy'}];
  imported.activeAbilityLoadoutId='loadabcdefg';
  api.normalizeState(imported);
  assert.equal(imported.abilityLoadouts[0].portraitId,'');
  assert.equal(api.formStatBonus(imported,'STR'),0);
  assert.deepEqual(Object.keys(imported.abilityLoadouts[0].statBonuses),[]);
});

test('mechanical form UI and core derived score use the same form bonus', () => {
  const h=read('index.html'),app=read('js/app.js'),abilities=read('js/abilities.js'),css=read('css/sheet.css');
  assert.match(h,/id="abilityLoadoutConfig"/);
  assert.match(abilities,/data-loadout-portrait/);
  assert.match(abilities,/data-loadout-stat=/);
  assert.match(app,/WBAbilities\.formStatBonus\(state, k\)/);
  assert.match(app,/const formBonus = window\.WBAbilities\.formStatBonus\(state, s\.k\)/);
  assert.match(app,/showPortrait\(\)/);
  assert.match(css,/\.loadout-stat-grid/);
});


test('selecting a linked portrait on Overview switches abilities and temporary form stats', () => {
  const {api,state,controls}=harness();
  state.portraits=[
    {id:'humanpic',name:'Human',src:'data:image/png;base64,a'},
    {id:'monsterpic',name:'Monstrous',src:'data:image/png;base64,b'}
  ];
  const human=api.createLoadout(state,'Human');
  const monster=api.createLoadout(state,'Monstrous');
  api.configureLoadout(state,human.id,'portraitId','humanpic');
  api.configureLoadout(state,monster.id,'portraitId','monsterpic');
  api.configureLoadout(state,human.id,'CHA',3);
  api.configureLoadout(state,monster.id,'STR',6);
  state.abilities=[
    ability('abilabcdefg','Human-only',[human.id]),
    ability('abilhijklmn','Monstrous-only',[monster.id]),
    ability('abilmnopqrst','Shared',[])
  ];
  state.abilities[0].cooldownLeft=2;
  state.abilities[1].usesLeft=1;
  state.abilities[1].durationLeft=2;
  state.abilities[1].capacityCurrent=3;
  const oldEnergy=state.resources[0].current;

  assert.equal(api.selectPortrait(state,'humanpic'),true);
  assert.equal(state.formId,'humanpic');
  assert.equal(state.activeAbilityLoadoutId,human.id);
  assert.equal(api.formStatBonus(state,'CHA'),3);
  assert.equal(api.formStatBonus(state,'STR'),0);
  assert.deepEqual(Array.from(api.filterAbilities(state,{sort:'name'},controls),a=>a.name),
    ['Human-only','Shared']);

  assert.equal(api.selectPortrait(state,'monsterpic'),true);
  assert.equal(state.activeAbilityLoadoutId,monster.id);
  assert.equal(api.formStatBonus(state,'STR'),6);
  assert.equal(api.formStatBonus(state,'CHA'),0);
  assert.deepEqual(Array.from(api.filterAbilities(state,{sort:'name'},controls),a=>a.name),
    ['Monstrous-only','Shared']);
  assert.equal(state.abilities[0].cooldownLeft,2);
  assert.equal(state.abilities[1].usesLeft,1);
  assert.equal(state.abilities[1].durationLeft,2);
  assert.equal(state.abilities[1].capacityCurrent,3);
  assert.equal(state.resources[0].current,oldEnergy);
});

test('an unlinked portrait switches to Base/shared abilities, with no lingering form stats', () => {
  const {api,state,controls}=harness();
  state.portraits=[
    {id:'baseportrait',name:'Base',src:'data:image/png;base64,a'},
    {id:'formportrait',name:'Form',src:'data:image/png;base64,b'}
  ];
  const form=api.createLoadout(state,'Monster');
  api.configureLoadout(state,form.id,'portraitId','formportrait');
  api.configureLoadout(state,form.id,'VIT',5);
  state.abilities=[ability('abilabcdefg','Form-only',[form.id]),ability('abilhijklmn','Shared',[])];
  assert.equal(api.selectPortrait(state,'formportrait'),true);
  assert.equal(api.formStatBonus(state,'VIT'),5);
  assert.equal(api.selectPortrait(state,'baseportrait'),true);
  assert.equal(state.activeAbilityLoadoutId,'');
  assert.equal(state.formId,'baseportrait');
  assert.equal(api.formStatBonus(state,'VIT'),0);
  assert.deepEqual(Array.from(api.filterAbilities(state,{},controls),a=>a.name),['Shared']);

  const before=JSON.stringify(state);
  assert.equal(api.selectPortrait(state,'missingportrait'),false);
  assert.equal(JSON.stringify(state),before,'An invalid portrait ID should be a no-op');
});

test('when two ability forms share one portrait, clicking it preserves current matched form', () => {
  const {api,state}=harness();
  state.portraits=[{id:'sharedportrait',name:'Shared',src:'data:image/png;base64,a'}];
  const a=api.createLoadout(state,'Knight');
  const b=api.createLoadout(state,'Paladin');
  api.configureLoadout(state,a.id,'portraitId','sharedportrait');
  api.configureLoadout(state,b.id,'portraitId','sharedportrait');
  state.activeAbilityLoadoutId=b.id;
  assert.equal(api.selectPortrait(state,'sharedportrait'),true);
  assert.equal(state.activeAbilityLoadoutId,b.id);
  state.activeAbilityLoadoutId='';
  assert.equal(api.selectPortrait(state,'sharedportrait'),true);
  assert.equal(state.activeAbilityLoadoutId,a.id,'First matching form is fallback only');
});

test('portrait form resolution is read-only and prefers the active form when links are shared',()=>{
  const {api,state}=harness();
  state.portraits=[{id:'shared',name:'Shared'},{id:'base',name:'Base'}];
  state.abilityLoadouts=[{id:'loadfirst',portraitId:'shared'},{id:'loadsecond',portraitId:'shared'}];
  state.activeAbilityLoadoutId='loadsecond';
  const before=JSON.stringify(state);
  assert.equal(api.portraitForm(state,'shared'),'loadsecond');
  assert.equal(api.portraitForm(state,'base'),'');
  assert.equal(api.portraitForm(state,'missing'),null);
  assert.equal(JSON.stringify(state),before);
});

test('form-specific resource costs block ability activation without spending AP', () => {
  const {api,state,controls,getAp}=harness();
  const human=api.createLoadout(state,'Human');
  const monster=api.createLoadout(state,'Monster');
  state.resources=[{id:'resabcdefg',name:'Energy',max:100,current:60,loadoutIds:[monster.id]}];
  const a=ability('abilabcdefg','Overdrive',[]); // shared ability with form-specific cost
  state.abilities=[a];
  state.activeAbilityLoadoutId=human.id;
  const beforeAp=getAp();
  assert.equal(api.resourceAvailable(state,state.resources[0]),false);
  assert.equal(api.checkActivation(state,a.id,controls).ok,false);
  assert.match(api.activate(state,a.id,controls).message,/unavailable in this form/i);
  assert.equal(getAp(),beforeAp);
  assert.equal(state.resources[0].current,60);
  assert.equal(a.cooldownLeft,0);
  assert.equal(a.usesLeft,2);
  state.activeAbilityLoadoutId=monster.id;
  assert.equal(api.resourceAvailable(state,state.resources[0]),true);
  assert.equal(api.activate(state,a.id,controls).ok,true);
  assert.equal(getAp(),beforeAp-5);
  assert.equal(state.resources[0].current,50);
  state.activeAbilityLoadoutId=human.id;
  assert.equal(state.resources[0].current,50,'Returning to Human does not refill Energy');
});

test('Mana policies per form block and enable ability costs without changing built-in Mana', () => {
  const {api,state}=harness();
  const human=api.createLoadout(state,'Human');
  const monster=api.createLoadout(state,'Monster');
  state.abilities=[{id:'abilabcdefg',name:'Magic Missile',type:'active',apCost:5,
    resourceId:'base-mana',resourceCost:20,uses:''}];
  api.normalizeState(state);
  let ap=15,mana=50;
  const controls={getAp:()=>ap,spendAp:n=>{ap-=n},getMana:()=>mana,spendMana:n=>{mana-=n}};
  api.configureLoadout(state,monster.id,'manaMode','hide');
  assert.equal(api.formManaAvailable(state),false);
  assert.equal(api.activate(state,'abilabcdefg',controls).ok,false);
  assert.equal(ap,15);assert.equal(mana,50);
  api.configureLoadout(state,monster.id,'manaMode','show');
  state.showMana=false;
  assert.equal(api.formManaAvailable(state),true);
  assert.equal(api.activate(state,'abilabcdefg',controls).ok,true);
  assert.equal(ap,10);assert.equal(mana,30);
  api.selectLoadout(state,human.id);
  assert.equal(api.formManaAvailable(state),false,'Human inherits the global toggle');
  assert.equal(mana,30);
  api.configureLoadout(state,human.id,'manaMode','invalid');
  assert.equal(state.abilityLoadouts[0].manaMode,'inherit');
});

test('deleting a form removes resource memberships but preserves amounts', () => {
  const {api,state}=harness();
  const a=api.createLoadout(state,'First');
  const b=api.createLoadout(state,'Second');
  state.resources=[
    {id:'resabcdefg',name:'Energy',max:100,current:27,loadoutIds:[a.id]},
    {id:'reshijklmn',name:'Shield',max:50,current:13,loadoutIds:[a.id,b.id]}
  ];
  assert.equal(api.removeLoadout(state,a.id),true);
  assert.deepEqual(Array.from(state.resources[0].loadoutIds),[]);
  assert.deepEqual(Array.from(state.resources[1].loadoutIds),[b.id]);
  assert.equal(state.resources[0].current,27);
  assert.equal(state.resources[1].current,13);
});

test('form mana settings persist; resource assignments filter invalid form ids on import', () => {
  const {api,state}=harness();
  const monster=api.createLoadout(state,'Monster');
  api.configureLoadout(state,monster.id,'manaMode','hide');
  state.resources=[{id:'resabcdefg',name:'Energy',max:100,current:44,
    loadoutIds:[monster.id,'invalid']}];
  const saved=JSON.parse(JSON.stringify(state));
  api.normalizeState(saved);
  assert.equal(saved.abilityLoadouts[0].manaMode,'hide');
  assert.equal(saved.resources[0].current,44);
  assert.deepEqual(Array.from(saved.resources[0].loadoutIds),[monster.id]);
  saved.abilityLoadouts=[{id:'loadabcdefg',name:'Legacy'}];
  api.normalizeState(saved);
  assert.equal(saved.abilityLoadouts[0].manaMode,'inherit');
});

test('new form-resource controls use the saved character rather than game state', () => {
  const html=read('index.html'),css=read('css/sheet.css'),abilities=read('js/abilities.js');
  for (const id of ['resourceShowAll','resourceSummary'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(abilities,/data-loadout-mana-mode/);
  assert.match(css,/\.resource-memberships/);
  assert.match(html,/css\/sheet\.css\?v=[a-z0-9-]+/); // Release token changes when assets change.
});

test('legacy and new forms have free entry by default; configuration normalizes and saves',()=>{
  const {api,state}=harness();
  const f=api.createLoadout(state,'Free Fighter');
  assert.equal(f.entryApCost,'');
  assert.equal(f.entryResourceId,'');
  assert.equal(f.entryResourceCost,'');
  api.configureLoadout(state,f.id,'entryApCost','4');
  api.configureLoadout(state,f.id,'entryResourceId','resabcdefg');
  api.configureLoadout(state,f.id,'entryResourceCost','6');
  const copy=JSON.parse(JSON.stringify(state));
  api.normalizeState(copy);
  const saved=copy.abilityLoadouts[0];
  assert.equal(saved.entryApCost,4);
  assert.equal(saved.entryResourceId,'resabcdefg');
  assert.equal(saved.entryResourceCost,6);
  const old={abilities:[],abilityLoadouts:[{id:'loadabcdefgh',name:'Legacy'}],resources:[]};
  api.normalizeState(old);
  assert.equal(old.abilityLoadouts[0].entryApCost,'');
  assert.equal(old.abilityLoadouts[0].entryResourceCost,'');
});
test('entering a named form charges both AP and a custom resource exactly once, Base remains free',()=>{
  const {api,state,controls,getAp}=harness();
  const a=api.createLoadout(state,'Overdrive');
  api.configureLoadout(state,a.id,'entryApCost',6);
  api.configureLoadout(state,a.id,'entryResourceId','resabcdefg');
  api.configureLoadout(state,a.id,'entryResourceCost',25);
  const beforeAp=getAp(),beforeResource=state.resources[0].current;
  assert.equal(api.selectLoadout(state,''),true,'base exit is free');
  assert.equal(api.selectLoadout(state,a.id,controls),true);
  assert.equal(getAp(),beforeAp-6);
  assert.equal(state.resources[0].current,beforeResource-25);
  assert.equal(api.selectLoadout(state,a.id,controls),true,'already active form costs nothing');
  assert.equal(getAp(),beforeAp-6);
  assert.equal(state.resources[0].current,beforeResource-25);
  assert.equal(api.selectLoadout(state,''),true);
  assert.equal(state.activeAbilityLoadoutId,'');
  assert.equal(getAp(),beforeAp-6);
  assert.equal(api.selectLoadout(state,a.id,controls),true);
  assert.equal(getAp(),beforeAp-12);
  assert.equal(state.resources[0].current,beforeResource-50);
});
test('combined cost is atomic: AP, resources, gear, and portrait remain unchanged when unaffordable',()=>{
  const {api,state,controls,getAp}=harness();
  const changes=[];
  state.portraits=[{id:'human',src:'data:image/png;base64,a'},{id:'beast',src:'data:image/png;base64,b'}];
  state.formId='human';
  state.equip={head:'original'};
  const dest=api.createLoadout(state,'Beast');
  api.configureLoadout(state,dest.id,'portraitId','beast');
  api.configureLoadout(state,dest.id,'entryApCost',7);
  api.configureLoadout(state,dest.id,'entryResourceId','resabcdefg');
  api.configureLoadout(state,dest.id,'entryResourceCost',199);
  api.selectLoadout(state,'');
  const ref=JSON.stringify(state),apBefore=getAp();
  const withGear={...controls};
  // No payment can go through if the second cost is too high.
  assert.match(api.entryCost(state,dest.id,withGear).message,/Not enough Energy/);
  assert.equal(api.selectLoadout(state,dest.id,withGear),false);
  assert.equal(api.selectPortrait(state,'beast',withGear),false);
  assert.equal(getAp(),apBefore);
  assert.equal(JSON.stringify(state),ref);
  assert.equal(changes.length,0);
  api.configureLoadout(state,dest.id,'entryResourceCost',10);
  api.configureLoadout(state,dest.id,'entryApCost',999);
  const noAp=JSON.stringify(state);
  assert.match(api.entryCost(state,dest.id,withGear).message,/Not enough AP/);
  assert.equal(api.selectPortrait(state,'beast',withGear),false);
  assert.equal(JSON.stringify(state),noAp);
  assert.equal(getAp(),apBefore);
});
test('entering a linked portrait spends Mana once and rejecting low Mana leaves portrait and form intact',()=>{
  const {api,state,controls,getAp}=harness();
  state.portraits=[{id:'basepic',src:'data:image/png;base64,a'},{id:'godpic',src:'data:image/png;base64,b'}];
  state.formId='basepic';
  const f=api.createLoadout(state,'Divine');
  api.configureLoadout(state,f.id,'portraitId','godpic');
  api.configureLoadout(state,f.id,'entryApCost',2);
  api.configureLoadout(state,f.id,'entryResourceId','base-mana');
  api.configureLoadout(state,f.id,'entryResourceCost',8);
  api.selectLoadout(state,'');
  let mana=7;
  const paid={...controls,getMana:()=>mana,spendMana:n=>{mana-=n;}};
  const baseline=JSON.stringify(state),before=getAp();
  assert.equal(api.selectPortrait(state,'godpic',paid),false);
  assert.equal(JSON.stringify(state),baseline);
  assert.equal(getAp(),before);
  assert.equal(mana,7);
  mana=20;
  assert.equal(api.selectPortrait(state,'godpic',paid),true);
  assert.equal(state.formId,'godpic');
  assert.equal(state.activeAbilityLoadoutId,f.id);
  assert.equal(mana,12);
  assert.equal(getAp(),before-2);
  assert.equal(api.selectPortrait(state,'godpic',paid),true);
  assert.equal(mana,12);
  assert.equal(api.selectPortrait(state,'basepic',paid),true);
  assert.equal(state.activeAbilityLoadoutId,'');
  assert.equal(mana,12);
});
test('Base always restores its equipment profile and unavailable entry costs do not touch gear',()=>{
  const {api,state,controls}=harness();
  const original={main:'sword'};
  state.equip={...original};
  const changes=[];
  const {window:wb}=harness();
  // Existing equipment adapter stays the sole owner of per-form gear profiles.
  assert.match(read('js/abilities.js'),/WBEquipment\.switchForm\(state,identifier\)/);
  const a=api.createLoadout(state,'Armored');
  api.configureLoadout(state,a.id,'entryApCost',100);
  api.selectLoadout(state,'');
  const oldEquip=JSON.stringify(state.equip);
  assert.equal(api.selectLoadout(state,a.id,controls),false);
  assert.equal(JSON.stringify(state.equip),oldEquip);
});
test('cost editor exposes independent AP and resource entry fields',()=>{
 const js=read('js/abilities.js');
 assert.match(js,/data-loadout-entry-cost="entryApCost"/);
 assert.match(js,/data-loadout-entry-cost="entryResourceCost"/);
 assert.match(js,/data-loadout-entry-resource/);
});
