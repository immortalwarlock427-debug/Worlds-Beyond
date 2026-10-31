const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 const {WBAbilities:abilities,WBCharacter:character}=ctx.window;
 const state={fields:{level:'1',apMax:'15',hpCur:'8',mpCur:'3'},hist:Object.fromEntries(['STR','VIT','DEX','AGL','INT','WIS','CHA','FTH'].map(s=>[s,{1:'28'}])),
  over:{},apAvail:null,apGiven:{n:3,fresh:true},resources:[{id:'resenergyone',name:'Energy',max:20,current:7}],
  items:[],equip:{},abilities:[{id:'abilcustomone',name:'Custom',uses:2,usesLeft:1}],statuses:[{id:'keep',name:'Stunned'}],inCombat:true};
 abilities.normalizeState(state);
 ctx.Date={now(){throw Error('clock');}};ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 const apply=(s,type,extra={})=>character.apply(s,{type,...extra});
 const use=(s,id)=>apply(s,'UseMilestone',{milestoneId:id});
 return {state,abilities,character,apply,use,action:(s,id)=>abilities.milestoneAction(s,id)};
}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}

test('built-in actions derive without creating custom abilities or spending counters during render',()=>{
 const {state,abilities}=setup();freeze(state);const before=JSON.stringify(state);
 const actions=abilities.milestoneActions(state);assert.equal(actions.length,9);assert.equal(actions.every(a=>a.unlocked),true);
 assert.equal(state.abilities.length,1);assert.deepEqual(plain(state.milestoneUses),{});
 assert.equal(JSON.stringify(state),before);assert.equal(abilities.milestoneAction(state,'bad'),null);
});

test('unlock scores include worn gear, forms and active effects; modifier overrides alone do not unlock a milestone',()=>{
 const {state,action,use}=setup();state.hist.INT[1]='20';state.over['mod-INT']='100';
 assert.equal(action(state,'stratagem').unlocked,false);assert.equal(use(state,'stratagem').error,'MILESTONE_LOCKED');
 state.items=[{id:'helm',type:'head',bonuses:[{t:'INT',v:1}]}];state.equip.head='helm';assert.equal(action(state,'stratagem').unlocked,true);
 assert.equal(action(state,'absolute-comprehension').unlocked,false);
 state.abilityLoadouts=[{id:'loadmageone',name:'Mage',statBonuses:{INT:5}}];state.activeAbilityLoadoutId='loadmageone';
 state.abilities.push({durationLeft:1,effects:[{target:'stat',stat:'INT',value:2}]});assert.equal(action(state,'absolute-comprehension').unlocked,true);
 const paid=use(state,'stratagem');assert.equal(paid.ok,true);assert.equal(paid.milestonePlan.total,100);
 delete paid.state.equip.head;paid.state.activeAbilityLoadoutId='';paid.state.abilities[1].durationLeft=0;
 assert.equal(action(paid.state,'stratagem').unlocked,false);paid.state.equip.head='helm';
 assert.equal(action(paid.state,'stratagem').usage.remaining,0,'losing and regaining the milestone does not refill it');
});

test('milestone activation reuses atomic fixed-five-AP payment, spends Command first and preserves the editable library',()=>{
 const {state,use}=setup();state.over['mod-INT']='100';const before=JSON.stringify(state);freeze(state);
 const r=use(state,'stratagem');assert.equal(r.ok,true);assert.equal(r.state.apAvail,13);assert.equal(r.state.apGiven.n,0);
 assert.equal(r.state.milestoneUses.stratagem.usesLeft,0);assert.equal(r.state.abilities,state.abilities);
 assert.equal(r.state.fields,state.fields);assert.equal(r.state.resources,state.resources);assert.equal(r.state.statuses,state.statuses);
 assert.deepEqual(Array.from(r.events,e=>e.type),['ap.changed','milestone.used']);
 assert.equal(r.events.every(e=>e.command==='UseMilestone'),true);assert.equal(r.events.at(-1).milestoneId,'stratagem');
 assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(use(state,'stratagem')),JSON.stringify(r));
});

test('insufficient AP, spent uses, locked milestones and invalid ids reject without changing any character data',()=>{
 const {state,use}=setup();
 const cases=[['stratagem',s=>{s.apAvail=1;s.apGiven=null;}],['stratagem',s=>{s.milestoneUses.stratagem={usesLeft:0,outsideUsesSpent:0};}],
  ['miracle',s=>{s.hist.FTH[1]='27';}],['bad',()=>{}],[[],()=>{}],[null,()=>{}]];
 for(const [id,edit] of cases){const s=plain(state);edit(s);freeze(s);const before=JSON.stringify(s),r=use(s,id);
  assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(r.milestonePlan,undefined);assert.equal(JSON.stringify(s),before);
 }
});

test('round and combat milestones use separate outside allowances, with scoped turn/combat/rest resets',()=>{
 const {state,use,apply,action}=setup();state.inCombat=false;
 let s=use(state,'stratagem').state;assert.equal(s.milestoneUses.stratagem.outsideUsesSpent,1);assert.equal(s.milestoneUses.stratagem.usesLeft,1);
 assert.equal(action(s,'stratagem').usage.maximum,6);
 s=apply(s,'AdvanceAbilityTurn').state;assert.equal(s.milestoneUses.stratagem.outsideUsesSpent,1);
 s=apply(s,'StartCombat').state;s=use(s,'stratagem').state;assert.equal(action(s,'stratagem').usage.remaining,0);
 const before=plain(s.milestoneUses);s=apply(s,'EndCombat').state;assert.deepEqual(plain(s.milestoneUses),before);
 assert.equal(action(s,'stratagem').usage.remaining,5);
 s=apply(s,'StartCombat').state;assert.equal(action(s,'stratagem').usage.remaining,1);
 s=use(s,'indomitable-status').state;assert.equal(action(s,'indomitable-status').usage.remaining,0);
 s=apply(s,'AdvanceAbilityTurn').state;assert.equal(action(s,'indomitable-status').usage.remaining,0);
 s=apply(s,'EndCombat').state;s=use(s,'indomitable-status').state;assert.equal(action(s,'indomitable-status').usage.remaining,0);
 s=apply(s,'RestAbilities').state;assert.equal(action(s,'indomitable-status').usage.remaining,1);assert.equal(s.milestoneUses.stratagem.outsideUsesSpent,0);
});

test('Miracle is free and once per long rest, and neither combat nor turn changes restore it',()=>{
 const {state,use,apply,action}=setup();state.apAvail=0;state.apGiven=null;let s=use(state,'miracle').state;
 assert.equal(s.apAvail,0);assert.equal(use(s,'miracle').ok,false);
 s=apply(s,'AdvanceAbilityTurn').state;s=apply(s,'EndCombat').state;s=apply(s,'StartCombat').state;
 assert.equal(action(s,'miracle').usage.remaining,0);assert.match(action(s,'miracle').plan.text,/own limit/);
 s=apply(s,'RestAbilities').state;assert.equal(use(s,'miracle').ok,true);
});

test('milestone plans keep Eyes of Truth as a check and Commanding Presence on the normal 12 + CHA DC',()=>{
 const {state,action}=setup();assert.equal(action(state,'eyes-of-truth').plan.kind,'check');assert.equal(action(state,'eyes-of-truth').plan.modifier,6);
 assert.equal(action(state,'commanding-presence').plan.total,18);state.over['mod-CHA']='−2';assert.equal(action(state,'commanding-presence').plan.total,10);
 assert.equal(action(state,'sixth-sense').ap,0);assert.equal(action(state,'sixth-sense').plan.kind,'notice');
 assert.equal(action(state,'absolute-comprehension').plan.kind,'notice');
});

test('current-allowance corrections are pure, preserve the other allowance and survive JSON plus normalization',()=>{
 const {state,apply,abilities,action}=setup();state.inCombat=false;state.milestoneUses.stratagem={usesLeft:0,outsideUsesSpent:4,future:{keep:true}};
 state.milestoneUses.futureMilestone={unknown:true};const before=JSON.stringify(state);freeze(state);
 const r=apply(state,'SetMilestoneUses',{milestoneId:'stratagem',value:5});assert.equal(r.ok,true);
 assert.equal(r.state.milestoneUses.stratagem.usesLeft,0);assert.equal(r.state.milestoneUses.stratagem.outsideUsesSpent,1);
 assert.equal(r.state.apAvail,state.apAvail);assert.equal(r.events[0].source,'correction');assert.equal(JSON.stringify(state),before);
 const restored=plain(r.state);abilities.normalizeState(restored);assert.equal(action(restored,'stratagem').usage.remaining,5);
 assert.deepEqual(restored.milestoneUses.stratagem.future,{keep:true});assert.deepEqual(restored.milestoneUses.futureMilestone,{unknown:true});
 const rested=apply(restored,'RestAbilities');assert.deepEqual(plain(rested.state.milestoneUses.futureMilestone),{unknown:true});
 assert.equal(apply(state,'SetMilestoneUses',{milestoneId:'stratagem',value:'bad'}).ok,false);
});

test('a custom ability with a built-in-looking id cannot be used, removed or changed by a milestone command',()=>{
 const {state,use}=setup();state.abilities[0].id='@milestone/stratagem';const before=JSON.stringify(state.abilities);
 const r=use(state,'stratagem');assert.equal(r.ok,true);assert.equal(JSON.stringify(r.state.abilities),before);
 assert.equal(r.state.abilities[0].usesLeft,1);assert.equal(r.state.milestoneUses.stratagem.usesLeft,0);
});
