const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','equipment-profiles','abilities'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
 return {w:ctx.window,state:{fields:{level:'1'},hist:{VIT:{1:20},AGL:{1:16}},over:{},abilities:[],abilityLoadouts:[],items:[],equip:{}}};
}
test('pants and one pair of boots contribute their full stats and effects once',()=>{
 const {w,state}=setup();state.items=[{id:'pants',type:'pants',ar:1,armorWeight:'light',lightEvasion:1},
  {id:'boots',type:'boots',ar:2,armorWeight:'light',lightEvasion:2,bonuses:[{t:'AGL',v:2}],effects:[{k:'flat',v:3}]}];state.equip={pants:'pants',boots:'boots'};
 w.WBEquipment.normalizeState(state);assert.deepEqual(plain(state.equip),{pants:'pants',boots:'boots'});
 assert.equal(w.WBCombat.gearArmor(state),3);assert.equal(w.WBCombat.gearBonus(state,'AGL'),2);
 assert.equal(w.WBCombat.armorProfile(state).evasionBonus,3);assert.equal(w.WBCombat.attackEffects(state).length,1);
});
test('a table leg-armor pair can use the Pants slot with its Armor Rating and light bonus once',()=>{
 const {w,state}=setup();state.items=[{id:'guards',type:'legs',pair:true,ar:2,armorWeight:'light',lightEvasion:1}];state.equip={pants:'guards'};
 w.WBEquipment.normalizeState(state);assert.equal(state.equip.pants,'guards');assert.equal(state.equip.rleg,undefined);
 assert.equal(w.WBCombat.gearArmor(state),2);assert.equal(w.WBCombat.armorProfile(state).evasionBonus,1);
});
test('previous leg slots, including incomplete pairs and separately worn pants, keep their exact stats on load',()=>{
 const {w,state}=setup();state.items=[{id:'one',name:'Boots',type:'legs',ar:3,armorWeight:'light',lightEvasion:2,bonuses:[{t:'AGL',v:1}]},
  {id:'two',type:'legs',ar:1,armorWeight:'light',lightEvasion:1},{id:'pants',type:'pants',ar:1,armorWeight:'light',lightEvasion:1}];
 for(const equip of [{rleg:'one'},{rleg:'one',lleg:'two'},{rleg:'one',lleg:'two',pants:'pants'}]){
  state.equip={...equip};const ar=w.WBCombat.gearArmor(state),ne=w.WBCombat.armorProfile(state).evasionBonus;
  w.WBEquipment.normalizeState(state);assert.deepEqual(plain(state.equip),equip);
  assert.equal(w.WBCombat.gearArmor(state),ar);assert.equal(w.WBCombat.armorProfile(state).evasionBonus,ne);
  assert.equal(state.items[0].type,'legs','Custom names do not determine a new item type');
 }
});
test('pants/boots and previous leg layouts survive forms, JSON and profile cleanup without changing item counters',()=>{
 const {w,state}=setup();state.items=[{id:'old',type:'legs',pair:true,ar:2},{id:'pants',type:'pants',ar:1},{id:'boots',type:'boots',ar:1}];
 state.equip={rleg:'old'};state.spent={old:{0:2},boots:{0:1}};state.equipmentOutsideSpent={boots:{0:3}};
 state.abilityLoadouts=[{id:'loadwinterone',name:'Winter'}];state.equipmentProfiles={base:{rleg:'old'},loadwinterone:{pants:'pants',boots:'boots'}};
 w.WBEquipment.normalizeState(state);const counters=JSON.stringify([state.spent,state.equipmentOutsideSpent]);
 w.WBEquipment.switchForm(state,'loadwinterone');state.activeAbilityLoadoutId='loadwinterone';assert.deepEqual(plain(state.equip),{pants:'pants',boots:'boots'});
 const restored=plain(state);w.WBEquipment.normalizeState(restored);w.WBEquipment.switchForm(restored,'');restored.activeAbilityLoadoutId='';
 assert.deepEqual(plain(restored.equip),{rleg:'old'});assert.equal(JSON.stringify([restored.spent,restored.equipmentOutsideSpent]),counters);
 w.WBEquipment.removeItem(restored,'boots');assert.equal(restored.equipmentProfiles.loadwinterone.boots,undefined);
 assert.equal(restored.equipmentProfiles.base.rleg,'old');
});
