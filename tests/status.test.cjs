const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

function setup() {
  class Element {
    constructor() { this.value=''; this.textContent=''; this.innerHTML=''; this.handlers={}; this.classList={toggle(){}}; this.focus=()=>{}; }
    addEventListener(type, fn) { this.handlers[type]=fn; }
    emit(type, event={}) { assert.ok(this.handlers[type], 'missing '+type); this.handlers[type]({ preventDefault(){},target:this,...event }); }
    reset() { this.value=''; }
  }
  const items = new Map();
  const byId = id => { if (!items.has(id)) items.set(id,new Element()); return items.get(id); };
  const context={window:{},document:{getElementById:byId},Date,Math,Set};
  vm.runInNewContext(read('js/status.js'),context);
  const api=context.window.WBStatus;
  const state={statuses:[],abilities:[],resources:[]};
  api.normalizeState(state);
  let saves=0;
  const instance=api.init(()=>state,()=>saves++);
  return {state,api,byId,instance,saves:()=>saves};
}
test('legacy saves have no manual statuses and other character state is preserved',()=>{
  const {api}=setup();
  const st={fields:{charName:'Aran'},abilities:[]};
  api.normalizeState(st);
  assert.equal(st.statuses.length,0);
  assert.equal(st.fields.charName,'Aran');
});
test('manual conditions normalize safely, retain indefinite durations and unique ids',()=>{
  const {api}=setup();const st={statuses:[
    {id:'stsabcdefg',name:'Poisoned',type:'debuff',source:'Wyvern',remaining:3,notes:'-1 to attack'},
    {id:'stsabcdefg',name:'Blessed',type:'buff',remaining:''},
    {name:'<img onerror=alert(1)>',type:'other',remaining:10000000},
    null
  ]};
  api.normalizeState(st);
  assert.equal(st.statuses.length,3);
  assert.equal(st.statuses[0].remaining,3);
  assert.equal(st.statuses[1].remaining,null);
  assert.notEqual(st.statuses[0].id,st.statuses[1].id);
  assert.equal(st.statuses[2].remaining,999999);
  const saved=JSON.parse(JSON.stringify(st));api.normalizeState(saved);
  assert.equal(saved.statuses[1].remaining,null);
});
test('manual status duration counts down on turn start; indefinite statuses persist',()=>{
  const {api}=setup();
  const state={statuses:[
    {id:'stsabcdefg',name:'Poisoned',type:'debuff',remaining:2},
    {id:'stshijklmn',name:'Cursed',type:'condition',remaining:null}
  ]};
  assert.equal(api.advanceTurn(state),true);
  assert.equal(state.statuses[0].remaining,1);
  assert.equal(api.advanceTurn(state),true);
  assert.equal(state.statuses.length,1);
  assert.equal(state.statuses[0].name,'Cursed');
  assert.equal(api.advanceTurn(state),false);
});
test('active ability effects show their source, targets, and duration',()=>{
  const {api}=setup();
  const state={statuses:[],resources:[{id:'resabcdefg',name:'Energy'}],abilities:[
    {id:'abilabcdefg',name:'Overdrive',durationLeft:3,cooldownLeft:2,description:'Faster and tougher',
      effects:[{target:'movement',value:15},{target:'armor',value:2},{target:'evasion',value:3},
               {target:'stat',stat:'STR',value:4},{target:'resource-max',resourceId:'resabcdefg',value:20}]},
    {id:'abilhijklmn',name:'Shielded',durationLeft:0,effects:[{target:'armor',value:5}]}
  ]};
  const found=api.activeEntries(state);
  assert.equal(found.effects.length,1);
  assert.equal(found.total,1);
  assert.equal(found.effects[0].remaining,3);
  assert.deepEqual(Array.from(found.effects[0].labels),
    ['+15 ft/AP Movement','+2 Armor Rating','+3 Evasion','+4 STR','+20 Energy maximum']);
  assert.equal(found.effects[0].cooldownLeft,2);
});
test('manual effects are descriptive, while ending ability uses its authoritative tracker',()=>{
  const {api}=setup();
  const state={statuses:[{id:'stsabcdefg',name:'Fear',type:'condition',remaining:1}],
    abilities:[{id:'abilabcdefg',name:'Overdrive',durationLeft:3,cooldownLeft:2,apCost:5}],resources:[]};
  assert.equal(api.endAbility(state,'abilabcdefg'),true);
  assert.equal(state.abilities[0].durationLeft,0);
  assert.equal(state.abilities[0].cooldownLeft,2);
  assert.equal(state.abilities[0].apCost,5);
  assert.equal(api.endAbility(state,'abilabcdefg'),false);
  assert.equal(api.endManual(state,'stsabcdefg'),true);
  assert.equal(state.statuses.length,0);
});
test('view displays manual status and escapes HTML-like user text',()=>{
  const {state,instance,byId}=setup();
  state.statuses.push({id:'stsabcdefg',name:'<script>bad</script>',type:'condition',source:'<bad>',notes:'<img>',
    remaining:null});
  state.abilities.push({id:'abilabcdefg',name:'Haste',durationLeft:2,description:'faster',
    effects:[{target:'movement',value:15}]});
  instance.render();
  assert.match(byId('statusManualList').innerHTML,/&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(byId('statusManualList').innerHTML,/<script>/);
  assert.match(byId('statusAbilityList').innerHTML,/Haste/);
  assert.match(byId('statusAbilityList').innerHTML,/2 turns left/);
  assert.match(byId('statusSummary').textContent,/2 active statuses/);
});
test('character exports/imports carry statuses; dedicated third view and turn hook are wired',()=>{
  const html=read('index.html'),app=read('js/app.js'),css=read('css/sheet.css');
  assert.ok(html.indexOf('src="js/status.js"')<html.indexOf('src="js/app.js"'));
  assert.match(html,/data-view="status"/);
  assert.match(html,/id="statusSec"/);
  assert.match(app,/WBStatus\.normalizeState\(state\)/);
  assert.match(app,/statusManager\.turnStart\(\)/);
  assert.match(app,/statusManager\.render\(\)/);
  assert.match(app,/statuses: \[\]/);
  assert.match(css,/main\.sheet:not\(\.view-status\) > \.statussec/);
  assert.match(css,/main\.view-status > section:not\(\.statussec\)/);
});
