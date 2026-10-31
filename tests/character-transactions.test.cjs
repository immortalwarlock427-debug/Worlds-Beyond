const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function kernel(){
 const ctx={window:{},Date:{now(){throw Error('clock');}},Math:Object.create(Math)};
 ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])vm.runInNewContext(read(name),ctx);
 return {api:ctx.window.WBCharacter,abilities:ctx.window.WBAbilities,equipment:ctx.window.WBEquipment};
}
function state(){return {
 fields:{charName:'Transaction Tester',level:'1',apMax:'15',mpCur:''},hist:{INT:{1:'16'},VIT:{1:'16'}},over:{},
 apAvail:null,apGiven:{n:3,fresh:true},showMana:true,resources:[
  {id:'resenergyone',name:'Energy',max:100,current:80,loadoutIds:[],futureResource:{kept:true}}
 ],abilities:[{
  id:'abilpulseone',name:'Pulse',type:'active',apCost:5,resourceId:'resenergyone',resourceCost:10,
  uses:2,usesLeft:2,cooldown:2,cooldownLeft:0,duration:3,durationLeft:0,capacityMax:2,capacityCurrent:0,
  loadoutIds:[],effects:[{id:'effboostone',target:'resource-max',resourceId:'resenergyone',value:100}],futureAbility:{kept:true}
 }],abilityLoadouts:[{
  id:'loadbeastone',name:'Beast',portraitId:'beastpic',manaMode:'hide',entryApCost:4,
  entryResourceId:'resenergyone',entryResourceCost:20
 }],activeAbilityLoadoutId:'',formId:'basepic',
 portraits:[{id:'basepic',name:'Base',src:'data:image/png;base64,a'},{id:'beastpic',name:'Beast',src:'data:image/png;base64,b'}],
 items:[{id:'basehelm',type:'head',bonuses:[{t:'mp',v:8}]},{id:'beasthelm',type:'head',bonuses:[{t:'mp',v:30}]}],
 equip:{head:'basehelm'},equipmentProfiles:{base:{head:'basehelm'},loadbeastone:{head:'beasthelm'}},
 cloudSync:{endpoint:'https://example.supabase.co',ownerId:'owner',revision:3},futureCharacter:{kept:true}
};}
function freeze(value){
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
 return value;
}
const activate={type:'ActivateAbility',abilityId:'abilpulseone'};

test('activation atomically pays AP/custom resource and commits charges, capacity, cooldown and effects',()=>{
 const {api}=kernel(),s=state(),before=JSON.stringify(s);freeze(s);
 const r=api.apply(s,activate);
 assert.equal(r.ok,true);
 assert.equal(r.state.apAvail,13);assert.equal(r.state.apGiven.n,0);
 assert.equal(r.state.resources[0].current,70);
 assert.equal(r.state.abilities[0].usesLeft,1);assert.equal(r.state.abilities[0].capacityCurrent,1);
 assert.equal(r.state.abilities[0].cooldownLeft,2);assert.equal(r.state.abilities[0].durationLeft,3);
 assert.equal(api.derive(r.state).resources.resenergyone.effectiveMax,200);
 assert.equal(JSON.stringify(s),before);
 assert.deepEqual(Array.from(r.events,e=>e.type),['ap.changed','resource.changed','ability.used']);
 const resource=r.events.find(e=>e.type==='resource.changed');
 assert.equal(resource.previous,80);assert.equal(resource.current,70);
 assert.equal(resource.previousMaximum,100);assert.equal(resource.currentMaximum,200);
 assert.equal(r.events.at(-1).abilityId,'abilpulseone');
 assert.equal(r.state.portraits,s.portraits,'large portrait data need not be copied');
 assert.equal(r.state.cloudSync,s.cloudSync);assert.equal(r.state.futureCharacter,s.futureCharacter);
 assert.equal(r.state.abilities[0].futureAbility,s.abilities[0].futureAbility);
});

test('every rejected activation leaves all pools, trackers, effects, forms, portraits and gear untouched',()=>{
 const {api}=kernel();
 const cases=[
  s=>{s.apAvail=1;s.apGiven=null;},s=>{s.resources[0].current=9;},
  s=>{s.abilities[0].cooldownLeft=1;},s=>{s.abilities[0].usesLeft=0;},
  s=>{s.abilities[0].capacityCurrent=2;},s=>{s.abilities[0].type='passive';},
  s=>{s.abilities[0].duration='';},s=>{s.abilities[0].effects[0].resourceId='missing';},
  s=>{s.abilities[0].resourceId='missing';},
  s=>{s.abilities[0].loadoutIds=['loadbeastone'];},
  s=>{s.resources[0].loadoutIds=['loadbeastone'];},
  s=>{s.abilities[0].resourceId='base-mana';s.abilities[0].resourceCost=57;},
  s=>{s.abilities[0].resourceId='base-mana';s.showMana=false;}
 ];
 for(const edit of cases){
  const s=state();edit(s);freeze(s);const before=JSON.stringify(s);
  const r=api.apply(s,activate);
  assert.equal(r.ok,false,r.message);assert.equal(r.patch,undefined);assert.equal(r.events,undefined);
  assert.equal(JSON.stringify(s),before);
 }
});

test('Mana activation materializes the source blank/full balance without losing unrelated fields',()=>{
 const {api}=kernel(),s=state();s.abilities[0].resourceId='base-mana';s.abilities[0].resourceCost=6;
 freeze(s);const r=api.apply(s,activate);
 assert.equal(r.ok,true);assert.equal(r.state.fields.mpCur,'50');
 assert.equal(r.state.fields.charName,s.fields.charName);assert.equal(r.state.resources[0].current,80);
 assert.deepEqual(Array.from(r.events,e=>e.type),['ap.changed','mana.changed','resource.changed','ability.used']);
 assert.equal(s.fields.mpCur,'');
});

test('free unlimited activation still emits one ability event while repeated blocked use emits none',()=>{
 const {api}=kernel(),s=state();
 Object.assign(s.abilities[0],{apCost:'',resourceCost:'',uses:'',usesLeft:null,capacityMax:'',cooldown:'',duration:'',effects:[]});
 const r=api.apply(freeze(s),activate);
 assert.equal(r.ok,true);assert.equal(r.state.apAvail,null);
 assert.deepEqual(plain(r.patch),{});assert.deepEqual(Array.from(r.events,e=>e.type),['ability.used']);
 const paid=api.apply(state(),activate);
 const snapshot=JSON.stringify(paid.state);
 const retry=api.apply(freeze(paid.state),activate);
 assert.equal(retry.ok,false);assert.match(retry.message,/cooling down/);
 assert.equal(retry.events,undefined);assert.equal(JSON.stringify(paid.state),snapshot);
});

test('paid form entry commits custom costs, portrait and gear together and allows a hidden entry pool',()=>{
 const {api}=kernel(),s=state();s.resources[0].loadoutIds=['other-form'];
 const before=JSON.stringify(s);freeze(s);
 const r=api.apply(s,{type:'EnterForm',formId:'loadbeastone'});
 assert.equal(r.ok,true);assert.equal(r.state.apAvail,14);assert.equal(r.state.apGiven.n,0);
 assert.equal(r.state.resources[0].current,60);
 assert.equal(r.state.activeAbilityLoadoutId,'loadbeastone');assert.equal(r.state.formId,'beastpic');
 assert.equal(r.state.equip.head,'beasthelm');assert.equal(r.state.equipmentProfiles.base.head,'basehelm');
 assert.equal(JSON.stringify(s),before);
 assert.ok(r.events.some(e=>e.type==='form.entered'&&e.formId==='loadbeastone'));
 assert.ok(r.events.some(e=>e.type==='portrait.changed'&&e.current==='beastpic'));
 assert.ok(r.events.some(e=>e.type==='equipment.changed'));
 const again=api.apply(freeze(r.state),{type:'EnterForm',formId:'loadbeastone'});
 assert.equal(again.state.resources[0].current,60);assert.equal(again.state.apAvail,14);
 assert.equal(again.events.length,0);
 const base=api.apply(again.state,{type:'EnterForm',formId:''});
 assert.equal(base.state.equip.head,'basehelm');assert.equal(base.state.resources[0].current,60);
 assert.equal(base.state.apAvail,14);assert.equal(base.state.formId,'beastpic','Base leaves the selected portrait as before');
 assert.ok(base.events.some(e=>e.type==='form.left'));
});

test('named form and linked portrait commands make the same source-profile Mana payment',()=>{
 const {api}=kernel(),s=state();s.showMana=false;
 Object.assign(s.abilityLoadouts[0],{entryResourceId:'base-mana',entryResourceCost:6});
 freeze(s);
 const form=api.apply(s,{type:'EnterForm',formId:'loadbeastone'});
 const portrait=api.apply(s,{type:'SelectPortrait',portraitId:'beastpic'});
 assert.equal(form.ok,true);assert.equal(portrait.ok,true);
 assert.deepEqual(plain(form.state),plain(portrait.state));
 assert.equal(form.state.fields.mpCur,'72');assert.equal(api.derive(form.state).mana.max,78);
 const mana=form.events.find(e=>e.type==='mana.changed');
 assert.equal(mana.previous.max,56);assert.equal(mana.current.max,78);
 assert.equal(mana.previous.current,56);assert.equal(mana.current.current,72);
 const back=api.apply(portrait.state,{type:'SelectPortrait',portraitId:'basepic'});
 assert.equal(back.state.activeAbilityLoadoutId,'');assert.equal(back.state.equip.head,'basehelm');
 assert.equal(back.state.fields.mpCur,'50');
});

test('unaffordable forms, missing targets and malformed command identifiers produce no partial change',()=>{
 const {api}=kernel();
 for(const type of ['EnterForm','SelectPortrait']){
  for(const kind of ['AP','resource','Mana']){
   const s=state();
   if(kind==='AP'){s.apAvail=0;s.apGiven=null;}
   if(kind==='resource')s.resources[0].current=19;
   if(kind==='Mana'){s.abilityLoadouts[0].entryResourceId='base-mana';s.fields.mpCur='1';}
   const before=JSON.stringify(s);freeze(s);
   const r=api.apply(s,type==='EnterForm'?{type,formId:'loadbeastone'}:{type,portraitId:'beastpic'});
   assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(JSON.stringify(s),before);
  }
 }
 for(const cmd of [{type:'ActivateAbility',abilityId:'missing'},{type:'EnterForm',formId:'missing'},
  {type:'SelectPortrait',portraitId:'missing'},{type:'ActivateAbility',abilityId:[]},
  {type:'EnterForm',formId:null},{type:'SelectPortrait',portraitId:42}]){
  const s=freeze(state());assert.equal(api.apply(s,cmd).ok,false);
 }
});

test('an equipment helper failure rolls back its private changes to pools, profiles and selection',()=>{
 const {api,equipment}=kernel(),s=state(),before=JSON.stringify(s);freeze(s);
 const original=equipment.switchForm;
 for(const throws of [false,true]){
  equipment.switchForm=(copy)=>{
   copy.fields.mpCur='0';copy.resources[0].current=0;copy.equip.head='damaged';
   copy.equipmentProfiles.base.head='damaged';copy.activeAbilityLoadoutId='damaged';
   if(throws)throw Error('equipment failure');
   return false;
  };
  const r=api.apply(s,{type:'EnterForm',formId:'loadbeastone'});
  assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(JSON.stringify(s),before);
 }
 equipment.switchForm=original;
 assert.equal(api.apply(s,{type:'EnterForm',formId:'loadbeastone'}).ok,true);
});

test('legacy missing equipment profiles initialize privately and imported future fields survive the command',()=>{
 const {api}=kernel(),s=state();delete s.equipmentProfiles;
 const r=api.apply(freeze(s),{type:'EnterForm',formId:'loadbeastone'});
 assert.equal(r.ok,true);assert.equal(r.state.equip.head,'basehelm');
 assert.equal(s.equipmentProfiles,undefined);
 assert.equal(r.state.futureCharacter,s.futureCharacter);assert.equal(r.state.resources[0].futureResource,s.resources[0].futureResource);
});

test('render/readiness checks do not apply a transaction, and commands are deterministic without DOM/clock/random',()=>{
 const {api,abilities}=kernel(),s=freeze(state()),before=JSON.stringify(s);
 const controls={getAp:()=>api.derive(s).ap.total,spendAp(){throw Error('mutation');}};
 for(let i=0;i<3;i++){
  assert.equal(abilities.checkActivation(s,'abilpulseone',controls).ok,true);
  api.derive(s);
 }
 assert.equal(JSON.stringify(s),before);
 for(const command of [activate,{type:'EnterForm',formId:'loadbeastone'},{type:'SelectPortrait',portraitId:'beastpic'}])
  assert.equal(JSON.stringify(api.apply(s,command)),JSON.stringify(api.apply(s,command)));
});

test('unreadable runtime counters or balances cannot publish NaN after an otherwise affordable payment',()=>{
 const {api}=kernel();
 for(const field of ['usesLeft','capacityCurrent','cooldown','duration','resource']){
  const s=state();
  if(field==='resource')s.resources[0].current='unreadable';else s.abilities[0][field]='unreadable';
  freeze(s);const before=JSON.stringify(s),r=api.apply(s,activate);
  assert.equal(r.ok,false,field);assert.equal(r.patch,undefined);assert.equal(r.events,undefined);
  assert.equal(JSON.stringify(s),before);
 }
});
