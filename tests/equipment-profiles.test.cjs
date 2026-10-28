/* Equipment profile tests; run node --test tests/equipment-profiles.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness() {
  const ctx={window:{},Date,Math,Map,Set};
  vm.runInNewContext(read('js/equipment-profiles.js'),ctx);
  vm.runInNewContext(read('js/abilities.js'),ctx);
  const equip=ctx.window.WBEquipment, abilities=ctx.window.WBAbilities;
  const state={
    abilityLoadouts:[],activeAbilityLoadoutId:'',abilities:[],
    items:[
      {id:'helm1',name:'Iron Helm',type:'head',ar:2},
      {id:'helm2',name:'Magic Helm',type:'head',ar:5},
      {id:'sword1',name:'Sword',type:'onehand',ar:0},
      {id:'shield1',name:'Shield',type:'shield',ar:3},
      {id:'greatsword',name:'Greatsword',type:'twohand',ar:0},
      {id:'boots1',name:'Boots',type:'legs',pair:true,ar:2},
      {id:'leg1',name:'Leg Guard',type:'legs',ar:1},
    ],equip:{head:'helm1',main:'sword1'},settled:{helm1:true},spent:{},
    resources:[],portraits:[]
  };
  abilities.normalizeState(state);
  equip.normalizeState(state);
  return {state,equip,abilities};
}
function snap(x) {return JSON.parse(JSON.stringify(x));}
test('old characters and forms inherit original worn equipment without moving inventory',()=>{
  const {state,equip,abilities}=harness();
  const form=abilities.createLoadout(state,'Monster');
  assert.equal(state.activeAbilityLoadoutId,form.id);
  assert.equal(state.equip.head,'helm1');
  assert.equal(state.equipmentProfiles.base.head,'helm1');
  assert.equal(state.equipmentProfiles[form.id].head,'helm1');
  assert.equal(state.items.length,7);
  assert.equal(state.settled.helm1,true);
});
test('form switching restores independent worn equipment and live gear without resetting trackers',()=>{
  const {state,equip,abilities}=harness();
  const monster=abilities.createLoadout(state,'Monster');
  state.equip={head:'helm2',main:'greatsword'};
  equip.capture(state);
  const cooldown=4,energy=12;
  state.abilities=[{id:'abilabcdefg',name:'Berserk',cooldownLeft:cooldown,loadoutIds:[monster.id]}];
  state.resources=[{id:'resabcdefg',name:'Energy',max:100,current:energy}];
  assert.equal(abilities.selectLoadout(state,''),true);
  assert.equal(state.equip.head,'helm1');
  assert.equal(state.equip.main,'sword1');
  state.equip={head:'helm1',main:'sword1',off:'shield1'};
  equip.capture(state);
  assert.equal(abilities.selectLoadout(state,monster.id),true);
  assert.equal(state.equip.head,'helm2');
  assert.equal(state.equip.main,'greatsword');
  assert.equal(state.equip.off,undefined);
  assert.equal(state.equipmentProfiles.base.off,'shield1');
  assert.equal(state.resources[0].current,energy);
  assert.equal(state.abilities[0].cooldownLeft,cooldown);
  assert.equal(state.settled.helm1,true);
  assert.equal(state.items.length,7);
});
test('portrait switching also changes worn equipment for linked forms',()=>{
  const {state,equip,abilities}=harness();
  state.portraits=[{id:'humanpic',name:'Human'},{id:'monsterpic',name:'Monster'}];
  const monster=abilities.createLoadout(state,'Monster');
  abilities.configureLoadout(state,monster.id,'portraitId','monsterpic');
  state.equip={head:'helm2',main:'greatsword'};equip.capture(state);
  state.activeAbilityLoadoutId=monster.id;
  assert.equal(abilities.selectPortrait(state,'humanpic'),true);
  assert.equal(state.activeAbilityLoadoutId,'');
  assert.equal(state.equip.head,'helm1');
  assert.equal(abilities.selectPortrait(state,'monsterpic'),true);
  assert.equal(state.activeAbilityLoadoutId,monster.id);
  assert.equal(state.equip.head,'helm2');
});
test('equip profiles survive export/import, then return to correct slots after switching',()=>{
  const {state,equip,abilities}=harness();
  const form=abilities.createLoadout(state,'Archer');
  state.equip={head:'helm2',main:'greatsword'};
  equip.capture(state);
  const saved=snap(state);
  abilities.normalizeState(saved);
  equip.normalizeState(saved);
  assert.equal(saved.activeAbilityLoadoutId,form.id);
  assert.equal(saved.equipmentProfiles.base.head,'helm1');
  assert.equal(saved.equipmentProfiles[form.id].head,'helm2');
  abilities.selectLoadout(saved,'');
  assert.equal(saved.equip.head,'helm1');
  abilities.selectLoadout(saved,form.id);
  assert.equal(saved.equip.head,'helm2');
});
test('deleted gear is removed from all form profiles and invalid slots are sanitized',()=>{
  const {state,equip,abilities}=harness();
  const f=abilities.createLoadout(state,'Monster');
  state.equip={head:'helm2',main:'greatsword',off:'shield1',rleg:'boots1'};
  const clean=equip.sanitize(state,state.equip);
  assert.equal(clean.off,undefined,'A twohand weapon blocks the offhand');
  assert.equal(clean.rleg,undefined,'A pair of boots must use its primary left slot');
  assert.equal(clean.head,'helm2');
  equip.capture(state);
  equip.removeItem(state,'helm2');
  state.items=state.items.filter(x=>x.id!=='helm2');
  assert.equal(state.equipmentProfiles[f.id].head,undefined);
  abilities.selectLoadout(state,'');
  abilities.selectLoadout(state,f.id);
  assert.equal(state.equip.head,undefined);
});
test('deleting an active form restores Base gear and removes its profile',()=>{
  const {state,equip,abilities}=harness();
  const f=abilities.createLoadout(state,'Monster');
  state.equip={head:'helm2',main:'greatsword'};equip.capture(state);
  assert.equal(abilities.removeLoadout(state,f.id),true);
  assert.equal(state.activeAbilityLoadoutId,'');
  assert.equal(state.equip.head,'helm1');
  assert.equal(state.equipmentProfiles[f.id],undefined);
});
test('copy Base and clear form affect worn slots only, preserving inventory and gear history',()=>{
  const {state,equip,abilities}=harness();
  const f=abilities.createLoadout(state,'Monster');
  state.equip={head:'helm2',main:'greatsword'};
  equip.capture(state);
  assert.equal(equip.copyBase(state),true);
  assert.equal(state.equip.head,'helm1');
  equip.clearCurrent(state);
  assert.deepEqual(snap(state.equip),{});
  assert.equal(state.items.length,7);
  assert.equal(state.settled.helm1,true);
  assert.equal(abilities.selectLoadout(state,''),true);
  assert.equal(state.equip.head,'helm1');
  assert.equal(abilities.selectLoadout(state,f.id),true);
  assert.deepEqual(snap(state.equip),{});
});
test('equipment UI, exports and module loading preserve character/session ownership',()=>{
  const html=read('index.html'),app=read('js/app.js'),css=read('css/sheet.css'),module=read('js/equipment-profiles.js');
  assert.match(html,/id="equipmentProfileName"/);
  assert.match(html,/id="equipmentCopyBase"/);
  assert.match(html,/id="equipmentClearForm"/);
  assert.ok(html.indexOf('js/equipment-profiles.js')<html.indexOf('js/abilities.js'));
  assert.match(app,/WBEquipment\.normalizeState\(state\)/);
  assert.match(app,/WBEquipment\.capture\(state\)/);
  assert.match(app,/WBEquipment\.removeItem\(state, id\)/);
  assert.match(app,/renderEquipmentProfile\(\)/);
  assert.match(css,/\.equipment-profile-bar/);
  assert.doesNotMatch(module,/worlds-beyond-game-v1/);
});
