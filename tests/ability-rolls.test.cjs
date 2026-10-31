const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 const {WBCombat:combat,WBAbilities:abilities,WBCharacter:character}=ctx.window;
 const state={fields:{level:'4',apMax:'15',mpCur:'10'},hist:{STR:{1:'20'},INT:{1:'16'},DEX:{1:'14'},FTH:{1:'21'}},
  over:{},apAvail:null,apGiven:{n:3,fresh:true},showMana:true,resources:[{id:'resenergyone',name:'Energy',max:10,current:10}],
  abilities:[{id:'abilstarfire',name:'Starfire',apCost:10,apDiscountStat:'STR',attackStat:'INT',damageDice:'2d6 + 3',
   damageStat:'DEX',damageType:'Fire',saveDcStat:'FTH',targetSaveStat:'AGL',resourceId:'resenergyone',resourceCost:4,
   uses:2,usesLeft:2,cooldown:2,duration:2}],items:[],equip:{}};
 abilities.normalizeState(state);
 ctx.Date={now(){throw Error('clock');}};ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 return {combat,abilities,character,state,plan:()=>abilities.abilityRollPlan(state,state.abilities[0])};
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const activate={type:'ActivateAbility',abilityId:'abilstarfire'};

test('damage expressions parse completely and keep critical dice maximum separate from fixed bonuses',()=>{
 const {combat}=setup();
 for(const [value,count,maximum,flat] of [['2d6 + 3',2,12,3],['d8 + 2d4 − 2',3,16,-2],['5',0,0,5],['-2',0,0,-2],['0',0,0,0],[0,0,0,0],['2 D 6 + 1',2,12,1]]){
  const parsed=combat.parseDamageDice(value);assert.ok(parsed,value);
  assert.deepEqual([parsed.count,parsed.maximum,parsed.flat],[count,maximum,flat]);
 }
 assert.equal(combat.criticalTotal(7,12,true)+3,22,'dice max is added once; fixed +3 stays single');
 for(const value of ['', '2d6 garbage','2d6+','2d6*2','2d6-1d4','-d6','2d0','0d6','1001d6','1 0d6','1e3','1d4294967297','1d9007199254740992','2d6'.repeat(50)])
  assert.equal(combat.parseDamageDice(value),null,value);
});

test('attack, damage bonus, AP discount, save DC and target save are independent pure derivations',()=>{
 const {state,plan,abilities,combat}=setup();freeze(state);const before=JSON.stringify(state),roll=plan();
 assert.equal(roll.ok,true);assert.deepEqual(plain(roll.attack),{stat:'INT',modifier:2});
 assert.equal(roll.damage.modifier,1);assert.equal(roll.damage.dice,'2d6+3');assert.equal(roll.damage.type,'Fire');
 assert.deepEqual(plain(roll.save),{stat:'FTH',targetStat:'AGL',dc:15});
 assert.equal(abilities.abilityApCost(state,state.abilities[0]),6);
 assert.equal(combat.abilitySaveDc(-2),10);assert.equal(JSON.stringify(state),before);
 assert.equal(JSON.stringify(plan()),JSON.stringify(roll));
});

test('roll modifiers follow advancement, equipment, active effects, forms and overrides',()=>{
 const {state,plan}=setup();state.asi={4:{INT:2}};
 state.items=[{id:'helm',type:'head',bonuses:[{t:'INT',v:2}]}];state.equip.head='helm';
 state.abilityLoadouts=[{id:'loadmageone',name:'Mage',statBonuses:{INT:2}}];state.activeAbilityLoadoutId='loadmageone';
 state.abilities.push({durationLeft:1,effects:[{target:'stat',stat:'INT',value:2}]});
 assert.equal(plan().attack.modifier,4);
 state.over['mod-INT']='−3';assert.equal(plan().attack.modifier,-3);
 state.over['mod-FTH']='-2';assert.equal(plan().save.dc,10);
});

test('shared worn attack effects include the source weapon only and all non-weapon gear',()=>{
 const {state,combat,plan}=setup();
 state.items=[{id:'main',type:'onehand',effects:[{k:'atk',v:50}]},{id:'off',type:'onehand',effects:[{k:'flat',v:90}]},
  {id:'helm',type:'head',effects:[{k:'atk',v:2},{k:'flat',v:3},{k:'dmg',dice:'1d4',dt:'Cold'},{k:'onhit',text:'Mark'}]},
  {id:'spare',type:'amulet',effects:[{k:'atk',v:99}]}];state.equip={main:'main',off:'off',head:'helm'};
 assert.equal(combat.attackEffects(state,'main').length,5);assert.equal(combat.attackEffects(state,'off').length,5);
 const roll=plan();assert.equal(roll.attack.modifier,4);assert.equal(roll.damage.flatBonus,3);
 assert.deepEqual(plain(roll.damage.extras),[{dice:'1d4',type:'Cold'}]);assert.deepEqual(plain(roll.damage.hits),['Mark']);
 const packet=combat.damagePacket(10,roll.damage.modifier,roll.damage.flatBonus,[2]);assert.equal(packet.total,16);
});

test('activation returns a deterministic pre-activation roll snapshot and commits costs and trackers once',()=>{
 const {state,character,abilities}=setup();
 state.abilities[0].effects=[{id:'effboostone',target:'stat',stat:'INT',value:6}];
 freeze(state);const before=JSON.stringify(state),r=character.apply(state,activate);
 assert.equal(r.ok,true);assert.equal(r.rollPlan.attack.modifier,2);
 assert.equal(abilities.abilityRollPlan(r.state,r.state.abilities[0]).attack.modifier,4,'new effect changes only later rolls');
 assert.equal(r.state.apAvail,12);assert.equal(r.state.apGiven.n,0);assert.equal(r.state.resources[0].current,6);
 assert.equal(r.state.abilities[0].usesLeft,1);assert.equal(r.state.abilities[0].cooldownLeft,2);
 assert.equal(JSON.stringify(character.apply(state,activate)),JSON.stringify(r));assert.equal(JSON.stringify(state),before);
 assert.equal(character.apply(r.state,activate).ok,false);
});

test('invalid dice/setup or rejected costs cannot return a roll or spend any pools/trackers',()=>{
 for(const edit of [s=>{s.abilities[0].damageDice='2d6+bad';},s=>{s.abilities[0].damageDice='1+'.repeat(100)+'1';},
  s=>{s.abilities[0].saveDcStat='';},s=>{s.apAvail=0;s.apGiven=null;},s=>{s.resources[0].current=3;},
  s=>{s.abilities[0].resourceId='base-mana';s.fields.mpCur='3';},s=>{s.abilities[0].usesLeft=0;}]){
  const {state,character}=setup();edit(state);freeze(state);const before=JSON.stringify(state),r=character.apply(state,activate);
  assert.equal(r.ok,false);assert.equal(r.rollPlan,undefined);assert.equal(r.patch,undefined);assert.equal(JSON.stringify(state),before);
 }
});

test('legacy, attack-only, damage-only and save-only abilities retain distinct behavior',()=>{
 const {state,abilities,character}=setup();const a=state.abilities[0];
 for(const key of ['attackStat','damageDice','damageStat','saveDcStat','targetSaveStat'])a[key]='';
 assert.deepEqual(plain(abilities.abilityRollPlan(state,a)),{ok:true,configured:false});
 assert.equal(character.apply(state,activate).rollPlan,undefined);
 a.attackStat='INT';let roll=abilities.abilityRollPlan(state,a);assert.ok(roll.attack);assert.equal(roll.damage,null);
 a.attackStat='';a.damageDice='5';roll=abilities.abilityRollPlan(state,a);assert.equal(roll.attack,null);assert.equal(roll.damage.modifier,0);
 a.damageDice='';a.saveDcStat='INT';roll=abilities.abilityRollPlan(state,a);assert.equal(roll.save.dc,14);assert.equal(roll.damage,null);
});

test('roll fields survive normalization and JSON round trips without altering base cost or legacy defaults',()=>{
 const {state,abilities}=setup(),restored=JSON.parse(JSON.stringify(state));abilities.normalizeState(restored);
 for(const key of ['attackStat','damageDice','damageStat','damageType','saveDcStat','targetSaveStat','apDiscountStat','apCost'])
  assert.equal(restored.abilities[0][key],state.abilities[0][key],key);
 const old={abilities:[{id:'abiloldhero',name:'Old',apCost:7}]};abilities.normalizeState(old);
 for(const key of ['attackStat','damageDice','damageStat','damageType','saveDcStat','targetSaveStat'])assert.equal(old.abilities[0][key],'');
 assert.equal(old.abilities[0].apCost,7);
});
