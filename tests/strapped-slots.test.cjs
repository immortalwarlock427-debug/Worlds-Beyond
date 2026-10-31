const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['combat-core','rules-catalog','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
 const state={id:'cstrappedhero',fields:{level:'1',hpCur:'20',mpCur:'30'},hist:{STR:{1:22},DEX:{1:28},VIT:{1:20},INT:{1:20}},over:{},
  items:[{id:'right',name:'Right bow',type:'onehand',dmg:'1d10',stat:'DEX',ar:0,properties:['Balanced','Ranged','Strapped','Loading'],loadingCapacity:1,bonuses:[{t:'DEX',v:1}]},
   {id:'left',name:'Left bow',type:'onehand',dmg:'1d8',stat:'DEX',ar:0,properties:['Balanced','Ranged','Strapped','Loading'],loadingCapacity:2,bonuses:[{t:'DEX',v:1}]},
   {id:'sword',name:'Sword',type:'twohand',dmg:'2d6',stat:'STR',properties:['Heavy'],ar:0},
   {id:'guard',name:'Guard',type:'arms',ar:1}],equip:{strapped:'right',main:'sword',rarm:'guard'},
  abilities:[],abilityLoadouts:[{id:'loadotherone',name:'Other'}],equipmentProfiles:{base:{strapped:'right'},loadotherone:{lstrapped:'left'}},
  apAvail:15,reactAvail:2,resources:[],inCombat:true,spent:{right:{0:1}},equipmentOutsideSpent:{left:{0:2}}};
 ctx.window.WBAbilities.normalizeState(state);ctx.window.WBEquipment.normalizeState(state);
 return {state,w:ctx.window};
}
test('left Draw preserves the legacy right attachment, held two-hander, arm guard and item counters',()=>{
 const {state,w}=setup(),before=JSON.stringify(state);let r=w.WBCharacter.apply(state,{type:'DrawWeapon',weaponId:'left',slot:'off'});
 assert.equal(r.ok,true);assert.deepEqual(plain(r.state.equip),{strapped:'right',lstrapped:'left',main:'sword',rarm:'guard'});
 assert.equal(r.state.equipmentProfiles.base.lstrapped,'left');assert.equal(r.state.spent,state.spent);assert.equal(r.state.equipmentOutsideSpent,state.equipmentOutsideSpent);
 assert.equal(JSON.stringify(state),before);assert.equal(w.WBCombat.gearBonus(r.state,'DEX'),2);
});
test('left attacks snapshot the left weapon and atomically spend its shot, payment and Singularity',()=>{
 const {state,w}=setup();state.equip.lstrapped='left';const before=JSON.stringify(state);
 const r=w.WBCharacter.apply(state,{type:'BeginWeaponAttack',slot:'lstrapped',singularityHand:'lstrapped'});
 assert.equal(r.ok,true);assert.equal(r.weaponAttack.main.weaponId,'left');assert.equal(r.weaponAttack.singularityHand,'lstrapped');assert.equal(r.state.milestoneUses.singularity.usesLeft,0);
 assert.equal(r.state.weaponShots.left,1);assert.equal(r.state.weaponShots.right,undefined);assert.equal(JSON.stringify(state),before);
 const dry=w.WBCharacter.apply({...state,weaponShots:{left:0}},{type:'BeginWeaponAttack',slot:'lstrapped',singularityHand:'lstrapped'});
 assert.equal(dry.ok,false);assert.equal(dry.patch,undefined);
});
test('both attachment slots survive form capture, JSON reload and removal without duplicating an item',()=>{
 const {state,w}=setup();state.equip.lstrapped='left';w.WBEquipment.capture(state);
 assert.equal(w.WBEquipment.switchForm(state,'loadotherone'),true);state.activeAbilityLoadoutId='loadotherone';
 assert.deepEqual(plain(state.equip),{lstrapped:'left'});
 w.WBEquipment.switchForm(state,'');state.activeAbilityLoadoutId='';
 const restored=plain(state);w.WBEquipment.normalizeState(restored);
 assert.equal(restored.equip.strapped,'right');assert.equal(restored.equip.lstrapped,'left');
 assert.equal(w.WBEquipment.sanitize(restored,{strapped:'right',lstrapped:'right'}).lstrapped,undefined);
 w.WBEquipment.removeItem(restored,'left');assert.equal(restored.equipmentProfiles.base.lstrapped,undefined);
 assert.equal(restored.equipmentProfiles.loadotherone.lstrapped,undefined);assert.equal(restored.equipmentProfiles.base.strapped,'right');
});
