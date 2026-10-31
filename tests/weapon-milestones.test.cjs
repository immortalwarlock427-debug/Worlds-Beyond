const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 const {WBCombat:combat,WBAbilities:abilities,WBCharacter:character}=ctx.window;
 const state={fields:{level:'1',apMax:'15',mpCur:'3'},hist:{STR:{1:'22'},DEX:{1:'28'},AGL:{1:'21'}},over:{},
  apAvail:null,apGiven:{n:3,fresh:true},reactAvail:null,inCombat:true,
  abilities:[{id:'abilcustomone',name:'Custom',uses:2,usesLeft:1}],resources:[{id:'resenergyone',max:20,current:7}],
  items:[{id:'sword',name:'Sword',type:'onehand',properties:['Balanced','Light'],stat:'STR',dmg:'1d6',effects:[{k:'atk',v:2}]},
   {id:'dagger',name:'Dagger',type:'onehand',properties:['Balanced','Light'],stat:'DEX',dmg:'1d4',effects:[{k:'flat',v:3}]},
   {id:'helm',name:'Helm',type:'head',effects:[{k:'atk',v:1},{k:'dmg',dice:'1d4',dt:'Cold'}]}],
  equip:{main:'sword',off:'dagger',head:'helm'}};
 abilities.normalizeState(state);
 ctx.Date={now(){throw Error('clock');}};ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 const apply=(s,type,extra={})=>character.apply(s,{type,...extra});
 return {state,combat,abilities,character,apply};
}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}

test('weapon attack sources capture current stats and applicable gear without DOM, clock or randomness',()=>{
 const {state,abilities}=setup();freeze(state);const before=JSON.stringify(state),plan=abilities.weaponAttackPlan(state,'dual');
 assert.equal(plan.ok,true);assert.equal(plan.apCost,5);assert.equal(plan.main.attackModifier,8);assert.equal(plan.main.damageModifier,5);
 assert.equal(plan.off.attackModifier,9);assert.equal(plan.off.damageModifier,0);assert.equal(plan.main.flatBonus,0);assert.equal(plan.off.flatBonus,3);
 assert.deepEqual(plain(plan.main.extras),[{dice:'1d4',type:'Cold'}]);assert.equal(plan.main.stat,'STR');
 assert.equal(JSON.stringify(state),before);
});

test('weapon AP payment is Command-first, leaves other domains alone and returns a stable source snapshot',()=>{
 const {state,apply}=setup(),before=JSON.stringify(state);freeze(state);
 const r=apply(state,'BeginWeaponAttack',{slot:'main'});assert.equal(r.ok,true);
 assert.equal(r.state.apAvail,13);assert.equal(r.state.apGiven.n,0);assert.equal(r.weaponAttack.apSpent,5);
 assert.equal(r.state.abilities,state.abilities);assert.equal(r.state.items,state.items);assert.equal(r.state.resources,state.resources);
 assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(apply(state,'BeginWeaponAttack',{slot:'main'})),JSON.stringify(r));
 assert.equal(r.weaponAttack.main.damageModifier,5);assert.equal(r.weaponAttack.main.weaponId,'sword');
});

test('opportunity attacks spend a derived reaction and preserve AP, including overrides, forms and timed AGL effects',()=>{
 const {state,apply,character}=setup();assert.equal(character.derive(state).reactions.max,2);
 state.abilityLoadouts=[{id:'loadswiftone',name:'Swift',statBonuses:{AGL:5}}];state.activeAbilityLoadoutId='loadswiftone';
 state.abilities.push({durationLeft:1,effects:[{target:'stat',stat:'AGL',value:2}]});assert.equal(character.derive(state).reactions.max,3);
 state.over.reactMax='4';const r=apply(freeze(state),'BeginWeaponAttack',{slot:'off',payment:'reaction'});
 assert.equal(r.ok,true);assert.equal(r.state.reactAvail,3);assert.equal(r.state.apAvail,null);assert.equal(r.state.apGiven,state.apGiven);
 assert.equal(r.weaponAttack.apSpent,0);assert.deepEqual(Array.from(r.events,e=>e.type),['reactions.changed','weapon.attack.prepared']);
});

test('invalid hands/payment or insufficient pools reject without spending or producing a roll snapshot',()=>{
 const {state,apply}=setup();
 for(const edit of [s=>{s.apAvail=1;s.apGiven=null;},s=>{s.equip.main='helm';},s=>{s.equip.off='sword';}]){
  const s=plain(state);edit(s);freeze(s);const before=JSON.stringify(s),r=apply(s,'BeginWeaponAttack',{slot:'dual'});
  assert.equal(r.ok,false);assert.equal(r.weaponAttack,undefined);assert.equal(r.patch,undefined);assert.equal(JSON.stringify(s),before);
 }
 const s=plain(state);s.reactAvail=0;freeze(s);assert.equal(apply(s,'BeginWeaponAttack',{slot:'main',payment:'reaction'}).ok,false);
 for(const extra of [{slot:'bad'},{slot:'main',payment:'bad'}])assert.equal(apply(state,'BeginWeaponAttack',extra).ok,false);
});

test('a forced critical never substitutes a natural 20 for hit, Dodge or natural-die handling',()=>{
 const {combat}=setup();assert.equal(combat.weaponCritical(10,true),true);assert.equal(combat.weaponCritical(20,false),true);
 assert.equal(combat.weaponCritical(19,false),false);assert.equal(combat.attackHits(10,30,10),false);
 assert.equal(combat.attackHits(10,30,20),true);
 const blocked={type:'dodge',vs:10,dmg:20,ar:0,nat:false,area:false};assert.equal(combat.defenseResult(blocked,11,false).won,true);
});

test('Singularity commits one chosen hand and its use with AP/reaction payment in one transaction',()=>{
 const {state,apply}=setup();const before=JSON.stringify(state);freeze(state);
 for(const payment of ['ap','reaction']){
  const r=apply(state,'BeginWeaponAttack',{slot:'dual',payment,singularityHand:'off'});
  assert.equal(r.ok,true);assert.equal(r.weaponAttack.singularityHand,'off');assert.equal(r.state.milestoneUses.singularity.usesLeft,0);
  assert.equal(r.state.milestoneUses.singularity.outsideUsesSpent,0);assert.equal(JSON.stringify(state),before);
  assert.equal(r.state.apAvail,payment==='ap'?13:null);assert.equal(r.state.reactAvail,payment==='reaction'?1:null);
  assert.deepEqual(Array.from(r.events,e=>e.type),[payment==='ap'?'ap.changed':'reactions.changed','milestone.used','weapon.attack.prepared']);
  assert.equal(r.events.every(e=>e.command==='BeginWeaponAttack'),true);
 }
});

test('failed costs, unavailable Singularity and invalid hand selections publish neither pool nor milestone changes',()=>{
 const {state,apply}=setup();
 const cases=[['ap','main',s=>{s.apAvail=0;s.apGiven=null;}],['reaction','main',s=>{s.reactAvail=0;}],
  ['ap','main',s=>{s.milestoneUses.singularity={usesLeft:0,outsideUsesSpent:0};}],['ap','main',s=>{s.hist.DEX[1]='27';}],
  ['ap','both',()=>{}]];
 for(const [payment,hand,edit] of cases){const s=plain(state);edit(s);freeze(s);const before=JSON.stringify(s);
  const r=apply(s,'BeginWeaponAttack',{slot:'dual',payment,singularityHand:hand});assert.equal(r.ok,false);
  assert.equal(r.patch,undefined);assert.equal(r.weaponAttack,undefined);assert.equal(JSON.stringify(s),before);
 }
 assert.equal(apply(state,'BeginWeaponAttack',{slot:'main',singularityHand:'off'}).ok,false);
});

test('Titan’s Might spends the shared STR allowance and the removed Devastate command is rejected',()=>{
 const {state,apply}=setup();freeze(state);
 const r=apply(state,'UseMilestone',{milestoneId:'titans-might'});assert.equal(r.ok,true);assert.equal(r.state.milestoneUses['titans-might'].usesLeft,0);
 assert.equal(r.state.apAvail,null);assert.equal(r.state.apGiven,state.apGiven);assert.equal(r.events[0].type,'milestone.used');
 assert.equal(apply(r.state,'UseMilestone',{milestoneId:'titans-might'}).ok,false);
 assert.equal(apply(state,'ApplyDevastate',{damageSource:{stat:'STR',damageModifier:5}}).ok,false);
});

test('weapon milestones keep separate outside allowances through turns, combats and JSON round trips',()=>{
 const {state,apply,abilities}=setup();state.inCombat=false;
 let r=apply(state,'BeginWeaponAttack',{slot:'main',singularityHand:'main'});assert.equal(r.state.milestoneUses.singularity.outsideUsesSpent,1);
 let s=apply(r.state,'StartCombat').state;r=apply(s,'BeginWeaponAttack',{slot:'main',payment:'reaction',singularityHand:'main'});
 assert.equal(r.state.milestoneUses.singularity.usesLeft,0);assert.equal(r.state.milestoneUses.singularity.outsideUsesSpent,1);
 s=apply(r.state,'AdvanceAbilityTurn').state;assert.equal(s.milestoneUses.singularity.usesLeft,1);
 s=apply(s,'EndCombat').state;assert.equal(abilities.milestoneAction(s,'singularity').usage.remaining,7);
 const restored=plain(s);abilities.normalizeState(restored);assert.equal(abilities.milestoneAction(restored,'singularity').usage.remaining,7);
 s=apply(restored,'RestAbilities').state;assert.equal(s.milestoneUses.singularity.outsideUsesSpent,0);
});
