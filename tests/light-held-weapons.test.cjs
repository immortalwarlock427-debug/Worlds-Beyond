const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities','character-core'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
 const state={id:'clighthands',fields:{level:'1',hpCur:'15',mpCur:'20'},hist:{STR:{1:22},DEX:{1:28},VIT:{1:20},INT:{1:20}},over:{},
  items:[{id:'kusari',name:'Kusarigama',type:'onehand',dmg:'1d8',stat:'DEX',ar:0,properties:['Finesse']},
   {id:'light',name:'Light blade',type:'onehand',dmg:'1d6',stat:'STR',ar:0,properties:['Balanced','Light']},
   {id:'other',name:'Other light blade',type:'onehand',dmg:'1d6',stat:'STR',ar:0,properties:['Balanced','Light']},
   {id:'shield',name:'Shield',type:'shield',ar:1},{id:'great',name:'Greatsword',type:'twohand',dmg:'2d6',stat:'STR',properties:['Heavy']},
   {id:'bow',name:'Strapped bow',type:'onehand',dmg:'1d10',stat:'DEX',properties:['Ranged','Strapped','Loading'],loadingCapacity:1}],
  equip:{},abilities:[],resources:[],abilityLoadouts:[],apAvail:15,reactAvail:2,inCombat:true,spent:{kusari:{0:1}},equipmentOutsideSpent:{kusari:{0:2}}};
 ctx.window.WBAbilities.normalizeState(state);ctx.window.WBEquipment.normalizeState(state);
 return {state,w:ctx.window};
}
test('any held weapon without Light conflicts with another held weapon, regardless of hand or family',()=>{
 const {state,w}=setup();for(const equip of [{main:'kusari',off:'light'},{main:'light',off:'kusari'},{main:'kusari',off:'bow'}])assert.ok(w.WBCombat.heldWeaponConflict({...state,equip}));
 for(const equip of [{main:'light',off:'other'},{main:'kusari'},{off:'kusari'},{main:'kusari',off:'shield',strapped:'bow'}])assert.equal(w.WBCombat.heldWeaponConflict({...state,equip}),null);
 const rules=w.WBCombat.weaponRules(state,state.items[0]);assert.equal(rules.twoHanded,false);assert.equal(w.WBCombat.effectiveArmor(10,rules.twoHanded),10);
 assert.equal(w.WBAbilities.weaponSource(state,'kusari').dice,'1d8');
});
test('explicit hand changes retain the selected weapon and preserve shields and separate attachments',()=>{
 const {state,w}=setup();state.equip={main:'kusari',off:'light',strapped:'bow'};const before=JSON.stringify(state);
 assert.deepEqual(plain(w.WBEquipment.resolveHands(state,state.equip,'main')),{main:'kusari',strapped:'bow'});
 assert.deepEqual(plain(w.WBEquipment.resolveHands(state,state.equip,'off')),{off:'light',strapped:'bow'});
 assert.deepEqual(plain(w.WBEquipment.resolveHands(state,{main:'kusari',off:'shield',strapped:'bow'})),{main:'kusari',off:'shield',strapped:'bow'});
 assert.deepEqual(plain(w.WBEquipment.resolveHands(state,{main:'great',off:'shield',strapped:'bow'})),{main:'great',strapped:'bow'});
 assert.equal(JSON.stringify(state),before);
});
test('paid Draw commits the chosen hand and AP together while retaining all inventory and use counters',()=>{
 const {state,w}=setup();state.equip={main:'light',off:'other',strapped:'bow'};const before=JSON.stringify(state);
 let r=w.WBCharacter.apply(state,{type:'DrawWeapon',weaponId:'kusari',slot:'main'});assert.equal(r.ok,true);assert.deepEqual(plain(r.state.equip),{main:'kusari',strapped:'bow'});
 assert.equal(r.state.items,state.items);assert.equal(r.state.spent,state.spent);assert.equal(r.state.equipmentOutsideSpent,state.equipmentOutsideSpent);
 assert.equal(JSON.stringify(state),before);assert.ok(r.state.apAvail<15);
 r=w.WBCharacter.apply({...state,equip:{main:'kusari'}},{type:'DrawWeapon',weaponId:'light',slot:'off'});assert.equal(r.ok,true);assert.deepEqual(plain(r.state.equip),{off:'light'});
 const rejected=w.WBCharacter.apply({...state,apAvail:0},{type:'DrawWeapon',weaponId:'kusari',slot:'main'});assert.equal(rejected.ok,false);assert.equal(rejected.patch,undefined);
});
test('saved conflicting pairs and forms stay readable until a choice; held attacks spend nothing meanwhile',()=>{
 const {state,w}=setup();state.equip={main:'kusari',off:'light',strapped:'bow'};state.abilityLoadouts=[{id:'loadotherone',name:'Other'}];
 state.equipmentProfiles={base:{...state.equip},loadotherone:{main:'light',off:'kusari'}};w.WBEquipment.normalizeState(state);
 assert.equal(state.equip.off,'light');const before=JSON.stringify(state);
 for(const slot of ['main','off','dual'])for(const payment of ['ap','reaction']){
  const r=w.WBCharacter.apply(state,{type:'BeginWeaponAttack',slot,payment,singularityHand:slot==='dual'?'main':slot});
  assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(r.events,undefined);
 }
 assert.equal(w.WBAbilities.weaponAttackPlan(state,'strapped').ok,true);assert.equal(JSON.stringify(state),before);
 w.WBEquipment.switchForm(state,'loadotherone');assert.deepEqual(plain(state.equip),{main:'light',off:'kusari'});
});
test('two Light weapons retain the existing dual attack and off-hand damage rules',()=>{
 const {state,w}=setup();state.equip={main:'light',off:'other'};
 const plan=w.WBAbilities.weaponAttackPlan(state,'dual');assert.equal(plan.ok,true);assert.equal(plan.off.damageModifier,0);
 assert.equal(w.WBCharacter.apply(state,{type:'BeginWeaponAttack',slot:'dual'}).ok,true);
});
