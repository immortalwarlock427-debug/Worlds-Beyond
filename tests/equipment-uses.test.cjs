const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 const {WBAbilities:abilities,WBCharacter:character}=ctx.window;
 const state={fields:{level:'1',apMax:'15',hpCur:'8',mpCur:'3'},hist:{DEX:{1:'20'}},over:{},inCombat:false,
  apAvail:2,apGiven:{n:3,fresh:false},reactAvail:0,resources:[{id:'resenergyone',max:20,current:7}],abilities:[],
  items:[{id:'helm',name:'Helm',type:'head',abilities:[
   {name:'Old round',effect:'Legacy',uses:3,per:'round'},
   {name:'Fixed round',effect:'Fixed',uses:3,per:'round',outsideUsesStat:''},
   {name:'Stat round',effect:'Stat',uses:1,per:'round',outsideUsesStat:'DEX'},
   {name:'Rest',effect:'Rest',uses:2,per:'rest'}]},
   {id:'spare',name:'Spare',type:'amulet',abilities:[{name:'Hidden',effect:'Hidden',uses:2,per:'round',outsideUsesStat:''}]}],equip:{head:'helm'},
  spent:{helm:{0:1,1:2,2:1,3:1},spare:{0:1}},equipmentOutsideSpent:{helm:{1:1,2:2},spare:{0:1}},
  futureCharacter:{kept:true}};
 abilities.normalizeState(state);
 ctx.Date={now(){throw Error('clock');}};ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 const apply=(s,type,extra={})=>character.apply(s,{type,...extra});
 const use=(s,index)=>apply(s,'UseEquipmentAbility',{itemId:'helm',abilityIndex:index});
 return {state,abilities,character,apply,use,usage:(s,index)=>abilities.equipmentAbility(s,'helm',index).usage};
}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}

test('missing outside metadata preserves legacy round behavior and fixed/stat choices use shared allowances',()=>{
 const {state,abilities,usage}=setup();freeze(state);const before=JSON.stringify(state);
 assert.equal(abilities.equipmentOutsideSetting(state.items[0].abilities[0]),'legacy');
 assert.equal(usage(state,0).remaining,2);assert.equal(usage(state,0).period,'round');assert.equal(usage(state,0).outside,false);
 assert.equal(usage(state,1).remaining,2);assert.equal(usage(state,1).period,'long rest');
 assert.equal(usage(state,2).maximum,4);assert.equal(usage(state,2).remaining,2);
 assert.equal(usage(state,3).remaining,1);assert.equal(JSON.stringify(state),before);
});

test('Use consumes only the active equipment allowance and never spends AP/resources or edits definitions',()=>{
 const {state,use}=setup(),before=JSON.stringify(state);freeze(state);
 const r=use(state,1);assert.equal(r.ok,true);assert.equal(r.state.equipmentOutsideSpent.helm[1],2);assert.equal(r.state.spent,state.spent);
 for(const key of ['items','abilities','fields','resources','apGiven','futureCharacter'])assert.equal(r.state[key],state[key]);
 assert.equal(r.state.apAvail,2);assert.equal(r.state.reactAvail,0);assert.equal(r.equipmentAbilityPlan.effect,'Fixed');
 assert.equal(r.events[0].type,'equipment.ability.used');assert.equal(JSON.stringify(state),before);
 assert.equal(JSON.stringify(use(state,1)),JSON.stringify(r));
 const legacy=use(state,0);assert.equal(legacy.state.spent.helm[0],2);assert.equal(legacy.state.equipmentOutsideSpent,state.equipmentOutsideSpent);
});

test('exhausted/unknown/invalid uses reject without changing any counter or returning a plan',()=>{
 const {state,apply}=setup();state.equipmentOutsideSpent.helm[1]=3;
 for(const command of [{type:'UseEquipmentAbility',itemId:'helm',abilityIndex:1},{type:'UseEquipmentAbility',itemId:'missing',abilityIndex:0},
  {type:'UseEquipmentAbility',itemId:'helm',abilityIndex:'1'},{type:'UseEquipmentAbility',itemId:'helm',abilityIndex:-1},
  {type:'SetEquipmentAbilityUses',itemId:'helm',abilityIndex:1,value:'bad'}]){
  const s=freeze(plain(state)),before=JSON.stringify(s),r=apply(s,command.type,command);
  assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(r.equipmentAbilityPlan,undefined);assert.equal(JSON.stringify(s),before);
 }
});

test('outside turns reset only legacy round counts; combat turns reset all round counts, including unequipped items',()=>{
 const {state,apply}=setup();let r=apply(freeze(state),'AdvanceAbilityTurn');
 assert.equal(r.state.spent.helm[0],undefined);assert.equal(r.state.spent.helm[1],2);assert.equal(r.state.spent.helm[2],1);
 assert.equal(r.state.spent.helm[3],1);assert.equal(r.state.spent.spare[0],1);assert.equal(r.state.equipmentOutsideSpent,state.equipmentOutsideSpent);
 r=apply({...state,inCombat:true},'AdvanceAbilityTurn');
 assert.deepEqual(plain(r.state.spent),{helm:{3:1}});assert.equal(r.state.equipmentOutsideSpent,state.equipmentOutsideSpent);
});

test('starting combat refills configured combat counts only, ending refills nothing, and rest restores both banks',()=>{
 const {state,apply,use}=setup();let r=apply(state,'StartCombat');
 assert.deepEqual(plain(r.state.spent),{helm:{0:1,3:1}});assert.equal(r.state.equipmentOutsideSpent,state.equipmentOutsideSpent);
 let s=use(r.state,1).state;assert.equal(s.spent.helm[1],1);assert.equal(s.equipmentOutsideSpent.helm[1],1);
 assert.equal(apply(s,'StartCombat').events.length,0);s=apply(s,'EndCombat').state;
 assert.equal(s.spent.helm[1],1);assert.equal(s.equipmentOutsideSpent.helm[1],1);
 r=apply(s,'RestAbilities');assert.deepEqual(plain(r.state.spent),{});assert.deepEqual(plain(r.state.equipmentOutsideSpent),{});
 assert.equal(r.state.items,state.items);
});

test('effective outside stat counts include gear/forms/effects/overrides and preserve spent amounts as maxima change',()=>{
 const {state,usage}=setup();state.items[0].bonuses=[{t:'DEX',v:2}];
 state.abilityLoadouts=[{id:'loadswiftone',name:'Swift',statBonuses:{DEX:2}}];state.activeAbilityLoadoutId='loadswiftone';
 state.abilities.push({durationLeft:1,effects:[{target:'stat',stat:'DEX',value:2}]});assert.equal(usage(state,2).maximum,7);
 state.over['mod-DEX']='1';assert.equal(usage(state,2).remaining,0);state.over['mod-DEX']='30';assert.equal(usage(state,2).remaining,28);
 state.over['mod-DEX']='-2';assert.equal(usage(state,2).maximum,0);assert.equal(state.equipmentOutsideSpent.helm[2],2);
});

test('manual corrections change only the current bank and JSON/reload preserve settings and balances',()=>{
 const {state,apply,abilities,usage}=setup();freeze(state);
 let r=apply(state,'SetEquipmentAbilityUses',{itemId:'helm',abilityIndex:2,value:3});assert.equal(r.state.equipmentOutsideSpent.helm[2],1);
 assert.equal(r.state.spent,state.spent);assert.equal(r.events[0].source,'correction');
 const restored=plain(r.state);abilities.normalizeState(restored);assert.equal(usage(restored,2).remaining,3);assert.equal(usage(restored,2).maximum,4);
 r=apply({...restored,inCombat:true},'SetEquipmentAbilityUses',{itemId:'helm',abilityIndex:2,value:1});
 assert.equal(r.state.spent.helm[2],0);assert.equal(r.state.equipmentOutsideSpent.helm[2],1);
});

test('Forge row remapping preserves renamed counters, shifts retained rows after deletion and starts new rows full',()=>{
 const {state,abilities}=setup();const old=state.items[0].abilities,next=[{...old[2],name:'Renamed'},old[3],{name:'New',uses:1,per:'rest'}];
 freeze(state);const before=JSON.stringify(state),patch=abilities.remapEquipmentUses(state,'helm',next,[2,3,null]);
 assert.deepEqual(plain(patch.spent.helm),{0:1,1:1});assert.deepEqual(plain(patch.equipmentOutsideSpent.helm),{0:2});
 assert.equal(patch.spent.spare,state.spent.spare);assert.equal(JSON.stringify(state),before);
});

test('switching outside tracking explicitly carries currently spent uses into the newly active bank',()=>{
 const {state,abilities}=setup();const old=state.items[0].abilities;
 let patch=abilities.remapEquipmentUses(state,'helm',[{...old[0],outsideUsesStat:''}],[0]);
 assert.equal(patch.equipmentOutsideSpent.helm[0],1);assert.equal(patch.spent.helm[0],1);
 patch=abilities.remapEquipmentUses(state,'helm',[{...old[2],outsideUsesStat:undefined}],[2]);
 assert.equal(patch.spent.helm[0],2);assert.equal(patch.equipmentOutsideSpent.helm[0],2);
 patch=abilities.remapEquipmentUses({...state,inCombat:true},'helm',[{...old[0],outsideUsesStat:'DEX'}],[0]);
 assert.equal(patch.spent.helm[0],1);assert.equal(patch.equipmentOutsideSpent.helm,undefined);
});
