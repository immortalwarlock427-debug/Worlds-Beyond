const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['persistence','combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 ctx.Date={now(){throw Error('clock');}};ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 const state={id:'chealthhero',fields:{charName:'Health Hero',level:'1',hpCur:'8',mpCur:'5',concOn:'1',sessionNotes:'Keep these notes.'},
  hist:{VIT:{1:'16'},INT:{1:'16'}},over:{hpMax:'20'},rolls:{},lvGear:{},trauma:0,down:null,
  items:[],equip:{},equipmentProfiles:{base:{}},abilities:[],resources:[{id:'resenergyone',max:20,current:7}],
  consumables:[{id:'potion',quantity:3}],rollHistory:[{id:'rollkept',total:12}],apAvail:7,reactAvail:1,futureState:{kept:true}};
 return {state,core:ctx.window.WBCharacter,combat:ctx.window.WBCombat,persistence:ctx.window.WBPersistence,
  apply:(s,type,extra={})=>ctx.window.WBCharacter.apply(s,{type,...extra})};
}
test('Health derives purely from history and current equipment; blank means full and live VIT boosts only change the threshold',()=>{
 const {state,core}=setup();delete state.over.hpMax;state.fields.hpCur='';
 state.items=[{id:'helm',type:'head',bonuses:[{t:'VIT',v:2},{t:'hp',v:3}]}];state.equip={head:'helm'};
 state.abilityLoadouts=[{id:'loadhealth',statBonuses:{VIT:3}}];state.activeAbilityLoadoutId='loadhealth';
 state.abilities=[{durationLeft:1,effects:[{target:'stat',stat:'VIT',value:2}]}];freeze(state);const before=JSON.stringify(state);
 const h=core.derive(state).health;assert.equal(h.automaticMax,19);assert.equal(h.max,19);assert.equal(h.current,19);
 assert.equal(h.vit,23);assert.equal(h.threshold,24);assert.equal(h.down,null);assert.equal(JSON.stringify(state),before);
});
test('historical string gear values and partial advancement use shared Health math without retroactive form boosts',()=>{
 const {state,core}=setup();state.fields.level='2';delete state.over.hpMax;state.fields.hpCur='';
 state.lvGear={1:{VIT:'2'},2:{VIT:'4'}};state.rolls={2:'5'};
 state.items=[{id:'boots',type:'legs',pair:true,bonuses:[{t:'hp',v:3}]}];state.equip={rleg:'boots'};
 assert.equal(core.health(state).max,35);delete state.rolls[2];assert.equal(core.health(state).max,20);assert.deepEqual(plain(core.health(state).missing),[2]);
});
test('unknown Health is never guessed as zero and unsupported manual maxima do not silently become automatic',()=>{
 const {state,core,apply}=setup();state.hist={};state.over={};state.fields.hpCur='';freeze(state);
 assert.equal(core.health(state).current,null);assert.equal(core.health(state).max,null);
 for(const type of ['DamageHealth','HealHealth']){const r=apply(state,type,{amount:5});assert.equal(r.ok,false);assert.equal(r.patch,undefined);}
 const invalid={...state,hist:{VIT:{1:16}},over:{hpMax:'invalid'},fields:{...state.fields,hpCur:'8'}};
 assert.equal(core.health(invalid).max,null);assert.equal(apply(invalid,'HealHealth',{amount:5}).state.fields.hpCur,'13');
});
test("damage applies Death's Mercy once, then continues into negative Health and death without touching other records",()=>{
 const {state,apply}=setup();freeze(state);const before=JSON.stringify(state),r=apply(state,'DamageHealth',{amount:100});
 assert.equal(r.ok,true);assert.equal(r.state.fields.hpCur,'-8');assert.equal(r.healthPlan.mercyCapped,true);assert.equal(r.healthPlan.dead,false);
 assert.equal(r.healthPlan.concentrationDc,50);assert.equal(r.healthPlan.concentration,true);
 assert.equal(r.events.find(event=>event.type==='health.damaged').amount,100);assert.equal(r.events.find(event=>event.type==='health.damaged').applied,16);
 assert.deepEqual(plain(r.state.down),{mercy:true,stable:false});
 for(const key of ['items','equip','abilities','resources','consumables','rollHistory','futureState'])assert.equal(r.state[key],state[key]);
 assert.equal(r.state.apAvail,7);assert.equal(r.state.reactAvail,1);assert.equal(JSON.stringify(state),before);
 const next=apply(freeze(r.state),'DamageHealth',{amount:10});assert.equal(next.state.fields.hpCur,'-18');assert.equal(next.healthPlan.dead,true);assert.equal(next.healthPlan.mercyCapped,false);
});
test('zero, first-negative, imported-negative and threshold-zero paths preserve the existing downed rules',()=>{
 const {state,apply}=setup();let s=apply(state,'DamageHealth',{amount:8}).state;
 assert.equal(s.fields.hpCur,'0');assert.equal(s.down.mercy,false);s=apply(s,'DamageHealth',{amount:100}).state;assert.equal(s.fields.hpCur,'-8');
 const imported={...state,fields:{...state.fields,hpCur:'-5'},down:null};
 assert.equal(apply(imported,'DamageHealth',{amount:4}).state.fields.hpCur,'-9');
 const zero={...state,trauma:4};const r=apply(zero,'DamageHealth',{amount:20});assert.equal(r.healthPlan.threshold,0);assert.equal(r.state.fields.hpCur,'-12');assert.equal(r.healthPlan.dead,true);
});
test('healing from negative Health retains partial downed flags, adds Trauma once on recovery and respects maxima without truncating excess',()=>{
 const {state,apply}=setup();state.fields.hpCur='-5';state.down={mercy:true,stable:true,futureDown:{kept:true}};
 let r=apply(state,'HealHealth',{amount:3});assert.equal(r.state.fields.hpCur,'-2');assert.equal(r.healthPlan.recovered,false);assert.equal(r.state.down.stable,true);
 r=apply(r.state,'HealHealth',{amount:5});assert.equal(r.state.fields.hpCur,'3');assert.equal(r.state.trauma,1);assert.equal(r.state.down,null);
 r=apply(r.state,'HealHealth',{amount:100});assert.equal(r.state.fields.hpCur,'20');assert.equal(r.state.trauma,1);
 const above={...state,fields:{...state.fields,hpCur:'40'},down:null};assert.equal(apply(above,'HealHealth',{amount:5}).state.fields.hpCur,'40');
 const dead={...state,fields:{...state.fields,hpCur:'-17'}};assert.equal(apply(dead,'HealHealth',{amount:20}).state.fields.hpCur,'3','Preserve the existing unrestricted healing control');
});
test('manual current/maximum corrections preserve full sentinels, excess and signed values without awarding recovery or damage events',()=>{
 const {state,apply,core}=setup();let r=apply(state,'SetHealthCurrent',{value:'-30'});
 assert.equal(r.state.fields.hpCur,'-30');assert.equal(r.state.trauma,0);assert.equal(r.state.down.mercy,true);assert.ok(r.events.every(event=>event.source==='correction'));
 r=apply(r.state,'SetHealthCurrent',{value:'40'});assert.equal(r.state.fields.hpCur,'40');assert.equal(r.state.down,null);assert.equal(r.state.trauma,0);
 r=apply(r.state,'SetHealthCurrent',{value:''});assert.equal(r.state.fields.hpCur,'');assert.equal(core.health(r.state).current,20);
 r=apply(r.state,'SetHealthMaximum',{value:30});assert.equal(core.health(r.state).current,30);assert.equal(r.state.fields.hpCur,'');
 r=apply(r.state,'SetHealthMaximum',{value:''});assert.equal(r.state.over.hpMax,undefined);assert.equal(core.health(r.state).current,16);
 const fixed=apply(state,'SetHealthMaximum',{value:5});assert.equal(fixed.state.fields.hpCur,'8');assert.equal(core.health(fixed.state).current,8);
});
test('stability, Trauma and treatment share the same state without creating new treatment or death restrictions',()=>{
 const {state,apply}=setup();state.fields.hpCur='-2';state.down={mercy:true,stable:false,futureDown:{kept:true}};
 let r=apply(state,'SetHealthStability',{stable:true});assert.equal(r.state.down.stable,true);assert.equal(r.state.down.futureDown,state.down.futureDown);
 r=apply(r.state,'SetHealthTrauma',{value:3});assert.equal(r.healthPlan.threshold,2);assert.equal(r.state.fields.hpCur,'-2');assert.equal(apply(r.state,'TreatHealth').ok,false);
 r=apply(r.state,'SetHealthTrauma',{value:0});r=apply(r.state,'TreatHealth');assert.equal(r.state.fields.hpCur,'1');assert.equal(r.state.trauma,1);assert.equal(r.state.down,null);
 assert.equal(apply(r.state,'TreatHealth').ok,false);assert.equal(apply(state,'SetHealthStability',{stable:'true'}).ok,false);
});
test('bleeding and damage prompts derive from incoming damage and effective VIT without drawing dice or dispatching effects',()=>{
 const {state,apply}=setup();state.hist.VIT={1:21};state.fields.hpCur='8';
 let r=apply(state,'DamageHealth',{amount:10});assert.equal(r.healthPlan.indomitable,true);assert.equal(r.healthPlan.concentration,true);
 r=apply(r.state,'DamageHealth',{amount:4,source:'bleeding'});assert.equal(r.healthPlan.concentration,false);assert.equal(r.healthPlan.bleeding,true);
 assert.equal(r.events.find(event=>event.type==='health.damaged').source,'bleeding');
});
test('invalid inputs and nonfinite outcomes reject atomically; finite amounts use the existing integer rounding',()=>{
 const {state,apply}=setup();freeze(state);
 for(const type of ['DamageHealth','HealHealth'])for(const amount of [-1,NaN,Infinity,'',null,true,'bad']){
  const r=apply(state,type,{amount});assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(r.healthPlan,undefined);
 }
 for(const type of ['SetHealthCurrent','SetHealthMaximum'])for(const value of [NaN,Infinity,true,'bad'])assert.equal(apply(state,type,{value}).ok,false);
 for(const value of [-1,1.2,Infinity])assert.equal(apply(state,'SetHealthTrauma',{value}).ok,false);
 assert.equal(apply(state,'DamageHealth',{amount:2.5}).state.fields.hpCur,'5');
 const huge={...state,hist:{},over:{},fields:{...state.fields,hpCur:String(-Number.MAX_VALUE)}};assert.equal(apply(huge,'DamageHealth',{amount:Number.MAX_VALUE}).ok,false);
});
test('tracker reconciliation is pure metadata hydration and config changes never masquerade as recovery',()=>{
 const {state,core,apply}=setup();state.fields.hpCur='-2';state.down=null;freeze(state);const before=JSON.stringify(state);
 const patch=core.healthTrackingPatch(state);assert.deepEqual(plain(patch),{down:{mercy:true,stable:false}});assert.equal(JSON.stringify(state),before);
 const configured={...state,fields:{...state.fields,hpCur:''},over:{hpMax:'-2'},down:{mercy:true,stable:true}};
 const r=apply(configured,'SetHealthMaximum',{value:20});assert.equal(r.state.down,null);assert.equal(r.state.trauma,0);assert.equal(r.healthPlan.recovered,false);
 assert.deepEqual(plain(core.healthTrackingPatch(r.state)),{});
});
test('v1 files keep current Health, flags, Trauma, and unknown data through damage and healing',()=>{
 const {state,apply,persistence}=setup();state.fields.hpCur='-2';state.down={mercy:true,stable:false,futureDown:{kept:true}};
 let s=apply(state,'DamageHealth',{amount:1}).state;assert.equal(s.down.futureDown,state.down.futureDown);
 s=apply(s,'HealHealth',{amount:1}).state;
 const text=persistence.exportCharacter(s,'2026-10-31T05:00:00Z'),loaded=persistence.parseCharacterFile(text);assert.equal(JSON.parse(text).version,1);
 assert.equal(loaded.fields.hpCur,'-2');assert.deepEqual(plain(loaded.down),plain(s.down));assert.equal(loaded.fields.sessionNotes,'Keep these notes.');assert.deepEqual(plain(loaded.futureState),{kept:true});
});
