const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 const {WBAbilities:abilities,WBCharacter:character}=ctx.window;
 const state={fields:{level:'1',apMax:'15',hpCur:'8',mpCur:'3'},hist:{DEX:{1:'20'},INT:{1:'16'}},over:{},
  apAvail:2,apGiven:{n:3,fresh:false},reactAvail:0,parryUsed:true,move:{ft:20,left:5},wonderAvail:0,
  resources:[{id:'resenergyone',name:'Energy',max:20,current:7}],items:[],equip:{},
  abilities:[{id:'abilcombatone',name:'Combat',uses:1,usesLeft:0,usesPer:'combat',outsideUsesSpent:1,apCost:2},
   {id:'abilroundone',name:'Round',uses:1,usesLeft:0,usesPer:'round',outsideUsesStat:'DEX',outsideUsesSpent:2},
   {id:'abillegacyone',name:'Legacy',uses:2,usesLeft:1}],futureCharacter:{kept:true},inCombat:false};
 abilities.normalizeState(state);
 ctx.Date={now(){throw Error('clock');}};ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 const apply=(state,type,extra={})=>character.apply(state,{type,...extra});
 return {state,abilities,character,apply};
}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}

test('legacy abilities retain long-rest counts and loading does not start a combat or refill them',()=>{
 const {state,abilities}=setup();delete state.abilities[2].usesPer;
 state.inCombat='true';abilities.normalizeState(state);
 assert.equal(state.inCombat,false);assert.equal(state.abilities[2].usesPer,'rest');assert.equal(state.abilities[2].usesLeft,1);
 const restored=JSON.parse(JSON.stringify(state));abilities.normalizeState(restored);
 assert.equal(restored.abilities[0].outsideUsesSpent,1);assert.equal(restored.abilities[0].usesLeft,0);
 assert.equal(restored.abilities[1].outsideUsesStat,'DEX');
});

test('starting combat restores only combat/round counts and Parry, leaving all pools and timed effects intact',()=>{
 const {state,apply}=setup();state.abilities[0].cooldownLeft=2;state.abilities[0].durationLeft=3;
 const before=JSON.stringify(state),r=apply(freeze(state),'StartCombat');assert.equal(r.ok,true);
 assert.equal(r.state.inCombat,true);assert.equal(r.state.parryUsed,false);
 assert.deepEqual(Array.from(r.state.abilities,a=>a.usesLeft),[1,1,1]);
 assert.equal(r.state.abilities[0].outsideUsesSpent,1);assert.equal(r.state.abilities[1].outsideUsesSpent,2);
 assert.equal(r.state.abilities[0].cooldownLeft,2);assert.equal(r.state.abilities[0].durationLeft,3);
 for(const field of ['fields','resources','apGiven','move','futureCharacter'])assert.equal(r.state[field],state[field]);
 assert.equal(r.state.apAvail,2);assert.equal(r.state.reactAvail,0);assert.equal(r.state.wonderAvail,0);
 assert.equal(JSON.stringify(state),before);assert.equal(r.events[0].type,'combat.started');
 assert.equal(JSON.stringify(apply(state,'StartCombat')),JSON.stringify(r));
});

test('repeated start/end commands are inert and ending combat never refills either allowance',()=>{
 const {state,apply}=setup();let s=apply(state,'StartCombat').state;s.abilities[0].usesLeft=0;
 const again=apply(freeze(s),'StartCombat');assert.deepEqual(plain(again.patch),{});assert.equal(again.events.length,0);
 const ended=apply(s,'EndCombat');assert.equal(ended.state.inCombat,false);assert.equal(ended.state.abilities[0].usesLeft,0);
 assert.equal(ended.state.abilities[0].outsideUsesSpent,1);assert.equal(ended.events[0].type,'combat.ended');
 assert.equal(apply(ended.state,'EndCombat').events.length,0);
});

test('combat and outside activations consume separate allowances, persisting across mode switches',()=>{
 const {state,apply,abilities}=setup();state.abilities[0].outsideUsesSpent=0;
 let s=apply(state,'ActivateAbility',{abilityId:'abilcombatone'}).state;
 assert.equal(s.abilities[0].outsideUsesSpent,1);assert.equal(s.abilities[0].usesLeft,0);
 assert.equal(apply(s,'ActivateAbility',{abilityId:'abilcombatone'}).ok,false);
 s=apply(s,'StartCombat').state;s=apply(s,'ActivateAbility',{abilityId:'abilcombatone'}).state;
 assert.equal(s.abilities[0].usesLeft,0);assert.equal(s.abilities[0].outsideUsesSpent,1);
 s=apply(s,'EndCombat').state;assert.equal(abilities.usageState(s,s.abilities[0]).remaining,0);
 s=apply(s,'StartCombat').state;assert.equal(s.abilities[0].usesLeft,1);assert.equal(s.abilities[0].outsideUsesSpent,1);
});

test('turn advancement resets round counts only in combat and preserves cooldown/duration processing',()=>{
 const {state,apply,abilities}=setup();state.abilities[1].cooldownLeft=2;state.abilities[1].durationLeft=2;
 let r=apply(freeze(state),'AdvanceAbilityTurn');assert.equal(r.state.abilities[1].usesLeft,0);
 assert.equal(r.state.abilities[1].cooldownLeft,1);assert.equal(r.state.abilities[1].durationLeft,1);
 assert.equal(abilities.usageState(r.state,r.state.abilities[1]).remaining,2);
 r=apply({...r.state,inCombat:true},'AdvanceAbilityTurn');assert.equal(r.state.abilities[1].usesLeft,1);
 assert.equal(r.state.abilities[0].usesLeft,0);assert.equal(r.state.abilities[2].usesLeft,1);
 assert.equal(r.state.abilities[1].outsideUsesSpent,2);assert.equal(r.state.abilities[1].durationLeft,0);
});

test('outside round allowance follows the selected current modifier without losing spent uses as stats change',()=>{
 const {state,abilities}=setup(),a=state.abilities[1],usage=()=>abilities.usageState(state,a);
 assert.equal(usage().remaining,2);state.over['mod-DEX']='1';assert.equal(usage().remaining,0);
 state.over['mod-DEX']='5';assert.equal(usage().remaining,3);assert.equal(a.outsideUsesSpent,2);
 state.over['mod-DEX']='2.9';assert.equal(usage().maximum,2,'use counts stay whole with a fractional manual override');
 state.over['mod-DEX']='-2';assert.equal(usage().maximum,0);assert.equal(usage().remaining,0);
 delete state.over['mod-DEX'];state.items=[{id:'helm',bonuses:[{t:'DEX',v:2}]}];state.equip.head='helm';
 state.abilityLoadouts=[{id:'loadbeastone',name:'Beast',statBonuses:{DEX:2}}];state.activeAbilityLoadoutId='loadbeastone';
 state.abilities.push({durationLeft:1,effects:[{target:'stat',stat:'DEX',value:2}]});assert.equal(usage().maximum,7);
 a.outsideUsesStat='';assert.equal(usage().maximum,1,'custom round abilities may explicitly keep a fixed outside count');
});

test('long rest restores all allowances and clears timers, preserving capacity and unrelated character fields',()=>{
 const {state,apply}=setup();Object.assign(state.abilities[1],{cooldownLeft:2,durationLeft:3,capacityMax:3,capacityCurrent:2});
 const r=apply(freeze(state),'RestAbilities');assert.equal(r.ok,true);
 assert.deepEqual(Array.from(r.state.abilities,a=>a.usesLeft),[1,1,2]);
 for(const a of r.state.abilities){assert.equal(a.outsideUsesSpent,0);assert.equal(a.cooldownLeft,0);assert.equal(a.durationLeft,0);}
 assert.equal(r.state.abilities[1].capacityCurrent,2);assert.equal(r.state.fields,state.fields);assert.equal(r.state.resources,state.resources);
 assert.equal(r.state.inCombat,false);assert.equal(apply(freeze(r.state),'RestAbilities').events.length,0);
});

test('readiness/exhausted filters and atomic payment failures use the current allowance without mutation',()=>{
 const {state,abilities,character,apply}=setup();const controls={getAp:()=>character.derive(state).ap.total,spendAp(){throw Error('mutation');}};
 const before=JSON.stringify(state);assert.equal(abilities.checkActivation(state,'abilcombatone',controls).ok,false);
 assert.deepEqual(Array.from(abilities.filterAbilities(state,{status:'exhausted'},controls),a=>a.name),['Combat']);
 assert.equal(JSON.stringify(state),before);
 for(const failure of ['AP','Mana','resource']){
  const s=plain(state);s.abilities[0].outsideUsesSpent=0;
  if(failure==='AP'){s.apAvail=0;s.apGiven=null;}
  else Object.assign(s.abilities[0],{resourceId:failure==='Mana'?'base-mana':'resenergyone',resourceCost:10});
  const snapshot=JSON.stringify(s),r=apply(freeze(s),'ActivateAbility',{abilityId:'abilcombatone'});
  assert.equal(r.ok,false);assert.equal(r.events,undefined);assert.equal(JSON.stringify(s),snapshot);
 }
});
