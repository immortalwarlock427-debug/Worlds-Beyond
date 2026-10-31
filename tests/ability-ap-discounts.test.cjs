const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 const state={fields:{level:'1',apMax:'15',mpCur:'10'},hist:{STR:{1:'20'},DEX:{1:'14'},INT:{1:'16'},FTH:{1:'9'}},over:{},
  apAvail:3,apGiven:{n:3,fresh:true},showMana:true,resources:[{id:'resenergyone',name:'Energy',max:10,current:10}],
  abilities:[{id:'abilstrikeone',name:'Strike',apCost:10,apDiscountStat:'STR',favorite:true}],
  abilityLoadouts:[{id:'loadbeastone',name:'Beast',statBonuses:{STR:2}}],activeAbilityLoadoutId:'',items:[],equip:{}};
 const {WBCombat:combat,WBAbilities:abilities,WBCharacter:character}=ctx.window;
 abilities.normalizeState(state);
 const price=()=>abilities.abilityApCost(state,state.abilities[0]);
 return {state,combat,abilities,character,price};
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const command={type:'ActivateAbility',abilityId:'abilstrikeone'};

test('shared AP math rounds the half-cost floor up, allows penalties, and keeps blank/zero free',()=>{
 const {combat}=setup();
 for(const [base,modifier,expected] of [[10,4,6],[10,90,5],[11,90,6],[11,1,10],[10,-2,12],[1,9,1],['',-8,0],[0,-8,0]])
  assert.equal(combat.abilityApCost(base,modifier),expected);
});

test('all four discount stats use their current modifier and legacy/invalid selections keep flat costs',()=>{
 const {state,abilities,price}=setup(),a=state.abilities[0];
 for(const [stat,expected] of [['STR',6],['DEX',9],['INT',8],['FTH',11],['',10],['VIT',10],['CHA',10]]){
  a.apDiscountStat=stat;assert.equal(price(),expected,stat);
 }
 delete a.apDiscountStat;assert.equal(price(),10);
 abilities.normalizeState(state);assert.equal(state.abilities[0].apDiscountStat,'');
 assert.equal(state.abilities[0].apCost,10);
});

test('prices follow advancement, worn gear, active effects, forms and manual modifier overrides',()=>{
 const {state,price}=setup();state.hist.STR={1:'12',4:'14'};state.fields.level='4';state.asi={4:{STR:2}};
 assert.equal(price(),8);
 state.items=[{id:'helm',bonuses:[{t:'STR',v:2}]},{id:'spare',bonuses:[{t:'STR',v:20}]}];state.equip.head='helm';
 assert.equal(price(),7,'only worn gear counts');
 state.abilities.push({durationLeft:1,effects:[{target:'stat',stat:'STR',value:2}]});
 assert.equal(price(),6);
 state.activeAbilityLoadoutId='loadbeastone';assert.equal(price(),5);
 state.abilities[1].durationLeft=0;assert.equal(price(),6,'expired effects stop discounting');
 state.over['mod-STR']='−2';assert.equal(price(),12,'manual override replaces all derived bonuses');
 state.over['mod-STR']='';assert.equal(price(),6);
 state.activeAbilityLoadoutId='';state.equip={};assert.equal(price(),8);
 assert.equal(state.abilities[0].apCost,10,'effective price never replaces the base');
});

test('readiness, AP bands and AP sorting all use the same derived price without mutation',()=>{
 const {state,abilities,character}=setup();
 state.abilities.push({id:'abilflatone',name:'Flat',apCost:7},{id:'abilfreeone',name:'Free',apCost:0,apDiscountStat:'FTH'},
  {id:'abilpenaltyone',name:'Penalty',apCost:10,apDiscountStat:'FTH'});
 abilities.normalizeState(state);freeze(state);const before=JSON.stringify(state);
 const controls={getAp:()=>character.derive(state).ap.total,spendAp(){throw Error('read-only');}};
 const find=filters=>Array.from(abilities.filterAbilities(state,filters,controls),a=>a.name);
 assert.deepEqual(find({status:'usable',sort:'ap'}),['Free','Strike']);
 assert.deepEqual(find({ap:'6-10',sort:'ap'}),['Strike','Flat']);
 assert.deepEqual(find({ap:'11+'}),['Penalty']);assert.deepEqual(find({ap:'free'}),['Free']);
 assert.deepEqual(find({sort:'ap'}),['Free','Strike','Flat','Penalty']);
 assert.equal(abilities.checkActivation(state,'abilstrikeone',controls).ap,6);
 assert.equal(JSON.stringify(state),before);
});

test('discounted activation spends Command AP first and keeps the base definition intact',()=>{
 const {state,character}=setup(),before=JSON.stringify(state);freeze(state);
 const r=character.apply(state,command);
 assert.equal(r.ok,true);assert.equal(r.state.apGiven.n,0);assert.equal(r.state.apAvail,0);
 assert.equal(r.state.abilities[0].apCost,10);assert.equal(r.state.abilities[0].apDiscountStat,'STR');
 assert.deepEqual(Array.from(r.events,e=>e.type),['ap.changed','ability.used']);
 assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(character.apply(state,command)),JSON.stringify(r));
});

test('combined AP, Mana and custom-resource rejections publish no partial discounted activation',()=>{
 for(const failure of ['AP','Mana','custom']){
  const {state,abilities,character}=setup();
  Object.assign(state.abilities[0],{resourceId:failure==='custom'?'resenergyone':'base-mana',resourceCost:4,uses:2,usesLeft:2,
   cooldown:2,duration:2,capacityMax:2,capacityCurrent:0});
  if(failure==='AP')state.apAvail=2;
  if(failure==='Mana')state.fields.mpCur='3';
  if(failure==='custom')state.resources[0].current=3;
  abilities.normalizeState(state);freeze(state);const before=JSON.stringify(state),r=character.apply(state,command);
  assert.equal(r.ok,false,failure);assert.equal(r.patch,undefined);assert.equal(r.events,undefined);
  assert.equal(JSON.stringify(state),before);
 }
 const {state,abilities,character}=setup();
 Object.assign(state.abilities[0],{resourceId:'base-mana',resourceCost:4,uses:2,usesLeft:2,cooldown:2,duration:2});
 abilities.normalizeState(state);const paid=character.apply(freeze(state),command);
 assert.equal(paid.ok,true);assert.equal(paid.state.fields.mpCur,'6');assert.equal(paid.state.apAvail,0);
 assert.equal(paid.state.abilities[0].usesLeft,1);assert.equal(paid.state.abilities[0].cooldownLeft,2);
});

test('blank and zero discounted abilities remain free with negative modifiers and no AP',()=>{
 for(const base of ['',0]){
  const {state,character}=setup();state.apAvail=0;state.apGiven=null;state.abilities[0].apCost=base;state.over['mod-STR']='-10';
  const r=character.apply(freeze(state),command);
  assert.equal(r.ok,true);assert.equal(r.state.apAvail,0);assert.equal(r.state.abilities[0].apCost,base);
 }
});

test('normalization and JSON round trips preserve base cost, discount selection and legacy defaults',()=>{
 const {state,abilities,price}=setup();
 for(const selection of ['STR','DEX','INT','FTH','',undefined,'WIS']){
  state.abilities[0].apDiscountStat=selection;
  const roundtrip=JSON.parse(JSON.stringify(state));abilities.normalizeState(roundtrip);
  assert.equal(roundtrip.abilities[0].apDiscountStat,['STR','DEX','INT','FTH'].includes(selection)?selection:'');
  assert.equal(roundtrip.abilities[0].apCost,10);
 }
 delete state.abilities[0].apDiscountStat;abilities.normalizeState(state);assert.equal(price(),10);
});
