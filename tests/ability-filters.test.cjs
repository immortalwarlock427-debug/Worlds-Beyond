/* Rich Ability Library filters and readiness: node --test tests/ability-filters.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function setup() {
  class Element {
    constructor() {
      this.value = ''; this.checked = false; this.innerHTML = ''; this.textContent = '';
      this.handlers = {}; this.open = false;
      this.classList = { last: '', toggle: (key, yes) => { this.classList.last = yes ? key : ''; } };
    }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    emit(name, target) { assert.ok(this.handlers[name]); this.handlers[name]({target:target || this}); }
    querySelectorAll() { return []; }
  }
  const els = new Map();
  const byId = id => { if (!els.has(id)) els.set(id,new Element()); return els.get(id); };
  const ctx = { window: {confirm:()=>true}, document:{getElementById:byId}, Date,Math,Set };
  vm.runInNewContext(read('js/abilities.js'),ctx);
  const api = ctx.window.WBAbilities;
  const state = {fields:{manaKind:'mana'},showMana:true,resources:[
    {id:'resabcdefg',name:'Energy',max:100,current:60},
    {id:'reszzzzzzzz',name:'Stamina',max:20,current:20}
  ],abilities:[
    {id:'abilabcdefg',name:'Overdrive',category:'Mechanical',type:'active',apCost:5,
      resourceId:'resabcdefg',resourceCost:25,uses:'',cooldown:3,cooldownLeft:0,favorite:true},
    {id:'abilhijklmn',name:'Cooling',category:'Mechanical',type:'active',apCost:3,
      resourceId:'resabcdefg',resourceCost:5,cooldown:2,cooldownLeft:2,favorite:false},
    {id:'abilmnopqrs',name:'No charges',category:'Mechanical',type:'reaction',uses:2,usesLeft:0,apCost:2},
    {id:'abiltuvwxyz',name:'Blessing',category:'Faith',type:'passive'},
    {id:'abilmmmmmmm',name:'Full Foundry',category:'Mechanical',type:'active',capacityMax:6,capacityCurrent:6,apCost:2},
    {id:'abilnnnnnnn',name:'Expensive',category:'Energy',type:'active',apCost:11,
      resourceId:'reszzzzzzzz',resourceCost:21},
    {id:'abilooooooo',name:'Holy Strike',category:'Faith',type:'active',apCost:8,
      resourceId:'base-mana',resourceCost:20},
    {id:'abilppppppp',name:'Stance',category:'Combat',type:'active',apCost:0,duration:3,durationLeft:2}
  ]};
  api.normalizeState(state);
  let ap=15, mana=50, spent=0;
  const controls={getAp:()=>ap,spendAp:n=>{ap-=n;spent+=n;},getMana:()=>mana,spendMana:n=>{mana-=n;}};
  return {api,state,controls,byId,setAp:n=>{ap=n;},setMana:n=>{mana=n;},spent:()=>spent};
}
const names = items => Array.from(items, item=>item.name);
test('filters by type, category, resource, favorites and AP bands without touching character data',()=>{
  const {api,state,controls}=setup();
  const find=options=>names(api.filterAbilities(state,{sort:'name',...options},controls));
  const old=JSON.stringify(state);
  assert.deepEqual(find({type:'passive'}),['Blessing']);
  assert.deepEqual(find({type:'reaction'}),['No charges']);
  assert.deepEqual(find({category:'Faith'}),['Blessing','Holy Strike']);
  assert.deepEqual(find({resource:'resabcdefg'}),['Cooling','Overdrive']);
  assert.deepEqual(find({resource:'base-mana'}),['Holy Strike']);
  assert.deepEqual(find({resource:'none'}),['Blessing','Full Foundry','No charges','Stance']);
  assert.deepEqual(find({ap:'free'}),['Blessing','Stance']);
  assert.deepEqual(find({ap:'11+'}),['Expensive']);
  assert.deepEqual(find({ap:'6-10'}),['Holy Strike']);
  assert.deepEqual(find({favorites:true}),['Overdrive']);
  assert.deepEqual(find({search:'holy'}),['Holy Strike']);
  assert.equal(JSON.stringify(state),old,'Filters must not alter character records');
});
test('Usable now is cost-aware without consuming AP, mana or custom resources',()=>{
  const {api,state,controls,setAp,setMana,spent}=setup();
  const f=()=>names(api.filterAbilities(state,{status:'usable',sort:'name'},controls));
  assert.deepEqual(f(),['Holy Strike','Overdrive','Stance']);
  assert.equal(state.resources[0].current,60);
  assert.equal(spent(),0);
  setAp(4);
  assert.deepEqual(f(),['Stance']);
  setAp(15);setMana(10);
  assert.deepEqual(f(),['Overdrive','Stance']);
  state.resources[0].current=4;
  assert.deepEqual(f(),['Stance']);
  assert.equal(spent(),0);
});
test('Cooldown, exhausted, active and passive filters distinguish distinct tracker states',()=>{
  const {api,state,controls}=setup();
  const f=options=>names(api.filterAbilities(state,options,controls));
  assert.deepEqual(f({status:'cooldown'}),['Cooling']);
  assert.deepEqual(f({status:'exhausted'}),['No charges']);
  assert.deepEqual(f({status:'active'}),['Stance']);
  assert.deepEqual(f({status:'passive'}),['Blessing']);
});
test('sorting supports name, AP, category, favorites and usable',()=>{
  const {api,state,controls}=setup();
  const f=options=>names(api.filterAbilities(state,options,controls));
  assert.equal(f({sort:'favorites'})[0],'Overdrive');
  assert.equal(f({sort:'name'})[0],'Blessing');
  assert.equal(f({sort:'ap'})[0],'Blessing');
  assert.equal(f({sort:'category'})[0],'Stance');
  const sorted=f({sort:'usable'});
  assert.ok(sorted.indexOf('Stance')<sorted.indexOf('Cooling'));
  assert.ok(sorted.indexOf('Overdrive')<sorted.indexOf('Full Foundry'));
});
test('filter controls, compact mode and reset are usable without changing saved abilities',()=>{
  const {api,state,controls,byId}=setup();let saves=0;
  const manager=api.init(()=>state,()=>saves++,controls);
  const before=JSON.stringify(state);
  byId('abilityTypeFilter').value='passive';byId('abilityTypeFilter').emit('change');
  assert.match(byId('abilityList').innerHTML,/Blessing/);
  assert.doesNotMatch(byId('abilityList').innerHTML,/Overdrive/);
  byId('abilityClearFilters').emit('click');
  assert.match(byId('abilityList').innerHTML,/Overdrive/);
  assert.match(byId('abilityList').innerHTML,/Blessing/);
  assert.equal(byId('abilityTypeFilter').value,'');
  byId('abilityCompact').checked=true;byId('abilityCompact').emit('change');
  assert.equal(byId('abilityList').classList.last,'is-compact');
  assert.match(byId('abilityList').innerHTML,/ability-quick-use/);
  assert.equal(saves,0,'Changing filter settings should not save or mutate a character');
  assert.equal(JSON.stringify(state),before);
});
test('UI contains all advanced controls and one versioned set of static assets',()=>{
  const html=read('index.html');
  for(const key of ['abilitySearch','abilityCategory','abilityTypeFilter','abilityResourceFilter',
    'abilityStatusFilter','abilityApFilter','abilitySortFilter','abilityFavorites',
    'abilityCompact','abilityClearFilters','abilityAdd']) {
    assert.equal((html.match(new RegExp('id="'+key+'"','g'))||[]).length,1,key);
  }
  const css=read('css/sheet.css');
  assert.match(css,/\.ability-list\.is-compact/);
  assert.match(css,/\.ability-list\.is-compact \.ability-quick-use/);
});
