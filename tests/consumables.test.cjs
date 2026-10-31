const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['persistence','combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 const state={id:'cconsumablehero',fields:{level:'1',hpCur:'8',mpCur:'5',sessionNotes:'Keep this story.'},hist:{VIT:{1:16}},over:{},
  apAvail:2,reactAvail:0,apGiven:{n:3,fresh:false},inCombat:false,items:[],equip:{},abilities:[],resources:[{id:'resenergyone',max:20,current:7}],
  consumables:[{id:'potion',name:'Potion',description:'Heal; pay costs at the table.',quantity:3,healingDice:'2d6+2',futureItem:{kept:true}},
   {id:'ration',name:'Ration',quantity:2,description:'Food',healingDice:''}],futureCharacter:{kept:true}};
 ctx.Date={now(){throw Error('clock');}};ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 return {state,core:ctx.window.WBCharacter,persistence:ctx.window.WBPersistence,
  apply:(s,type,extra={})=>ctx.window.WBCharacter.apply(s,{type,...extra})};
}
test('legacy characters start with an empty consumable view and Add is pure and deterministic',()=>{
 const {state,core,apply}=setup();delete state.consumables;freeze(state);const before=JSON.stringify(state);
 assert.deepEqual(plain(core.consumables(state)),[]);
 const command={consumable:{id:'new',name:'  Food  ',quantity:'4',description:'A meal',healingDice:'',futureField:true}};
 const r=apply(state,'AddConsumable',command);assert.equal(r.ok,true);assert.equal(r.state.consumables[0].name,'Food');
 assert.equal(r.state.consumables[0].quantity,4);assert.equal(r.state.consumables[0].futureField,true);
 assert.equal(r.events[0].source,'configuration');assert.equal(JSON.stringify(apply(state,'AddConsumable',command)),JSON.stringify(r));
 assert.equal(JSON.stringify(state),before);
});
test('Use spends exactly one quantity and returns a complete healing plan without paying or healing',()=>{
 const {state,apply}=setup();freeze(state);const before=JSON.stringify(state),r=apply(state,'UseConsumable',{consumableId:'potion'});
 assert.equal(r.ok,true);assert.equal(r.state.consumables[0].quantity,2);assert.equal(r.state.consumables[1],state.consumables[1]);
 assert.equal(r.state.consumables[0].futureItem,state.consumables[0].futureItem);assert.equal(r.consumablePlan.healing.expression,'2d6+2');
 assert.equal(r.consumablePlan.healing.flat,2);assert.equal(r.events[0].type,'consumable.used');
 for(const key of ['fields','resources','abilities','items','equip','apGiven','futureCharacter'])assert.equal(r.state[key],state[key]);
 assert.equal(r.state.apAvail,2);assert.equal(r.state.reactAvail,0);assert.equal(JSON.stringify(state),before);
 const ration=apply(state,'UseConsumable',{consumableId:'ration'});assert.equal(ration.consumablePlan.healing,null);assert.equal(ration.state.consumables[1].quantity,1);
});
test('zero, invalid quantities and missing or ambiguous identifiers reject with no partial patch',()=>{
 const {state,apply}=setup();
 for(const quantity of [0,-1,1.5,'',null,Infinity,NaN,'bad',true,Number.MAX_SAFE_INTEGER+1]){
  const s={...state,consumables:[{...state.consumables[0],quantity}]};freeze(s);const before=JSON.stringify(s);
  const r=apply(s,'UseConsumable',{consumableId:'potion'});assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(r.consumablePlan,undefined);assert.equal(JSON.stringify(s),before);
 }
 for(const consumableId of ['missing','',null,5])assert.equal(apply(state,'UseConsumable',{consumableId}).ok,false);
 const duplicated={...state,consumables:[state.consumables[0],state.consumables[0]]};
 for(const type of ['UseConsumable','SetConsumableQuantity','RemoveConsumable'])assert.equal(apply(duplicated,type,{consumableId:'potion',value:2}).ok,false);
});
test('whole quantity corrections allow zero and large balances, preserving definitions and unrelated records',()=>{
 const {state,apply}=setup();freeze(state);
 for(const value of [0,4,'1000001',Number.MAX_SAFE_INTEGER]){
  const r=apply(state,'SetConsumableQuantity',{consumableId:'potion',value});assert.equal(r.ok,true);assert.equal(r.state.consumables[0].quantity,Number(value));
  assert.equal(r.events[0].source,'correction');assert.equal(r.state.consumables[0].healingDice,'2d6+2');assert.equal(r.state.consumables[0].futureItem,state.consumables[0].futureItem);
 }
 for(const value of [-1,0.2,'',NaN,Infinity,true])assert.equal(apply(state,'SetConsumableQuantity',{consumableId:'potion',value}).ok,false);
});
test('definition edits keep the current quantity even if an editor supplies a stale count',()=>{
 const {state,apply}=setup(),used=apply(state,'UseConsumable',{consumableId:'potion'}).state;freeze(used);
 const r=apply(used,'EditConsumable',{consumableId:'potion',consumable:{name:'Renamed potion',quantity:99,description:'New reminder',healingDice:'1d8+4'}});
 assert.equal(r.ok,true);assert.equal(r.state.consumables[0].quantity,2);assert.equal(r.state.consumables[0].name,'Renamed potion');
 assert.equal(r.state.consumables[0].futureItem,used.consumables[0].futureItem);assert.equal(used.consumables[0].name,'Potion');
});
test('invalid definitions and complete invalid healing expressions reject before any quantity changes',()=>{
 const {state,apply}=setup();freeze(state);
 const invalid=['2d6oops','2d6 +','2d0','0d6','-1d6','1001d6','2d6 + 1 2','1.5','9'.repeat(121),'1d6+9007199254740991'];
 for(const healingDice of invalid){
  for(const type of ['AddConsumable','EditConsumable']){
   const r=apply(state,type,{consumableId:'potion',consumable:{id:'new',name:'New',quantity:3,healingDice}});assert.equal(r.ok,false);assert.equal(r.patch,undefined);
  }
  const s={...state,consumables:[{...state.consumables[0],healingDice}]},r=apply(s,'UseConsumable',{consumableId:'potion'});
  assert.equal(r.ok,false);assert.equal(s.consumables[0].quantity,3);
 }
 for(const name of ['', '  ',null])assert.equal(apply(state,'AddConsumable',{consumable:{id:'new',name,quantity:1}}).ok,false);
 assert.equal(apply(state,'AddConsumable',{consumable:{id:'potion',name:'Duplicate',quantity:1}}).ok,false);
});
test('healing plans accept signed flat bonuses and constants, independently of stats and dice modes',()=>{
 const {state,apply}=setup();
 for(const [healingDice,flat,count] of [['2D6 + 2',2,2],['5',5,0],['1d1-10',-10,1],['0',0,0]]){
  const s={...state,advMode:'adv',consumables:[{...state.consumables[0],healingDice}]},r=apply(s,'UseConsumable',{consumableId:'potion'});
  assert.equal(r.ok,true);assert.equal(r.consumablePlan.healing.flat,flat);assert.equal(r.consumablePlan.healing.count,count);
  assert.equal(r.state.advMode,'adv');assert.equal(r.state.fields.hpCur,'8');
 }
});
test('turns, combat transitions and rests do not replenish consumables or overwrite unknown data',()=>{
 const {state,apply}=setup();let s=state;
 for(const type of ['StartCombat','AdvanceAbilityTurn','EndCombat','AdvanceAbilityTurn','RestAbilities']){
  freeze(s);const r=apply(s,type);assert.equal(r.ok,true);assert.equal(r.state.consumables,s.consumables);s=r.state;
 }
 assert.equal(s.consumables[0].quantity,3);
});
test('removing a consumable preserves other entries and unsupported collections cannot be silently overwritten',()=>{
 const {state,apply,core}=setup();state.consumables.push(null,{futureShape:true});freeze(state);
 const r=apply(state,'RemoveConsumable',{consumableId:'potion'});assert.equal(r.ok,true);
 assert.equal(r.state.consumables[0],state.consumables[1]);assert.equal(r.state.consumables.length,3);assert.equal(r.state.consumables[2],state.consumables[3]);
 const future={...state,consumables:{futureCollection:true}};freeze(future);assert.equal(core.consumables(future),null);
 const rejected=apply(future,'AddConsumable',{consumable:{id:'new',name:'New',quantity:1}});assert.equal(rejected.ok,false);assert.equal(rejected.patch,undefined);
 assert.equal(future.consumables.futureCollection,true);
});
test('v1 and historical raw export/import preserve exact consumable definitions and quantities',()=>{
 const {state,apply,persistence}=setup();const s=apply(state,'UseConsumable',{consumableId:'potion'}).state;
 const file=persistence.exportCharacter(s,'2026-10-31T00:00:00Z'),envelope=JSON.parse(file);assert.equal(envelope.version,1);
 assert.deepEqual(plain(persistence.parseCharacterFile(file).consumables),plain(s.consumables));
 assert.deepEqual(plain(persistence.parseCharacterFile(JSON.stringify(s)).consumables),plain(s.consumables));
});
