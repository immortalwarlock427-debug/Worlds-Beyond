/* Shared combat attack/defense resolution — no UI or random dice required. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
function rules() {
  const ctx={window:{},Math,Date,Set,Map};
  vm.runInNewContext(read('js/combat-core.js'),ctx);
  return ctx.window.WBCombat;
}
test('natural 20 hits even if below target Evasion; ordinary attacks compare >=',()=>{
  const r=rules();
  assert.equal(r.attackHits(3,30,20),true);
  assert.equal(r.attackHits(15,15,14),true);
  assert.equal(r.attackHits(14,15,14),false);
  assert.equal(r.attackHits(15,15,1),true,'Existing rules have no automatic miss on natural 1');
  assert.deepEqual(plain(r.dualHits(5,16,20,8,14)),{main:true,off:true});
  assert.deepEqual(plain(r.dualHits(10,13,2,3,14)),{main:false,off:false});
});
test('critical damage is max dice plus dice rolled; negative weapon damage clamps',()=>{
  const r=rules();
  assert.equal(r.criticalTotal(5,12,true),17);
  assert.equal(r.criticalTotal(5,12,false),5);
  assert.deepEqual(plain(r.damagePacket(7,3,2,[4,-8,6])),{
    weaponDmg:12,extras:[4,0,6],total:22
  });
  assert.deepEqual(plain(r.damagePacket(1,-8,-2,[-9])),{
    weaponDmg:0,extras:[0],total:0
  });
  assert.equal(r.armorDamage(9,12),0);
  assert.equal(r.armorDamage(19,4),15);
});
test('dual-wielding halves offhand before subtracting armor separately from each hit',()=>{
  const r=rules();
  assert.equal(r.offhandDamage(11),5);
  assert.equal(r.dualArmorDamage(13,11,4,true,true),10); // 13-4 + floor(11/2)-4 = 10
  assert.equal(r.dualArmorDamage(13,11,4,false,true),1);
  assert.equal(r.dualArmorDamage(13,11,4,true,false),9);
  assert.equal(r.dualArmorDamage(13,11,4,false,false),0);
  assert.equal(r.dualArmorDamage(5,5,9,true,true),0);
});
test('resistance halves raw damage first, then armor reduces it',()=>{
  const r=rules();
  assert.equal(r.resistedDamage({dmg:25,res:true}),12);
  assert.equal(r.afterArmor({dmg:25,res:true,ar:5,of:false}),7);
  assert.equal(r.afterArmor({dmg:25,res:false,ar:5,of:false}),20);
  assert.equal(r.afterArmor({dmg:2,res:false,ar:99,of:false}),0);
  assert.equal(r.afterArmor({dmg:null,res:false,ar:5,of:false}),null);
});
test('Overwhelming Force enforces final half-raw-damage floor after block and armor',()=>{
  const r=rules();
  const df={type:'block',dmg:21,ar:30,res:true,of:true,amt:40};
  assert.equal(r.afterArmor(df),10);
  assert.deepEqual(plain(r.defenseResult(df,null,false)),{
    won:false,unresolved:false,take:10
  });
  assert.equal(r.defenseResult({...df,of:false},null,false).take,0);
  assert.equal(r.defenseResult({...df,dmg:null},null,false).take,null);
  assert.equal(r.overwhelmFloor(1,{of:true,dmg:21}),10);
});
test('dodge and parry beat attack roll; saves meet DC; natural 20 still uses special dodge prohibition in UI',()=>{
  const r=rules();
  const input={type:'dodge',vs:15,dmg:20,ar:3,res:false,area:false,of:false};
  assert.deepEqual(plain(r.defenseResult(input,16,false)),{
    won:true,unresolved:false,take:0
  });
  assert.deepEqual(plain(r.defenseResult(input,15,false)),{
    won:false,unresolved:false,take:17
  });
  assert.equal(r.defenseResult({...input,type:'parry'},16,false).take,0);
  assert.equal(r.defenseResult({...input,type:'parry'},15,false).take,17);
  assert.equal(r.defenseResult({...input,vs:null},16,false).unresolved,true);
  assert.equal(r.defenseResult({...input,vs:null},16,true).won,true);
  const area={...input,area:true,vs:15,res:true,dmg:25};
  assert.deepEqual(plain(r.defenseResult(area,15,false)),{
    won:true,unresolved:false,take:3 // floor(floor(25/2)/2) - 3 = 3
  });
  assert.equal(r.defenseResult(area,14,false).take,9); // floor(25/2) - 3 = 9
  assert.equal(r.defenseResult({...area,of:true},15,false).take,12,
    'Preserves current game interpretation of Overwhelming Force on area saves');
});
test('Death Threshold includes trauma; Deaths Mercy caps first below-zero hit',()=>{
  const r=rules();
  assert.equal(r.deathThreshold(12,22,0),34);
  assert.equal(r.deathThreshold(12,22,2),24);
  assert.equal(r.deathThreshold(1,1,5),0);
  assert.equal(r.deathThreshold(12,null,0),null);
  assert.equal(r.diesAt(-10,10),true);
  assert.equal(r.diesAt(-1,0),true);
  assert.equal(r.diesAt(0,0),false);
  const before={mercy:false,stable:false};
  const result=plain(r.damageHealth(14,100,30,null));
  assert.deepEqual(result,{after:-15,down:{mercy:true,stable:false},dropped:true,dead:false,
    mercyCapped:true,concentrationDc:50,amount:100});
  assert.deepEqual(plain(before),{mercy:false,stable:false},'No mutation');
  const later=plain(r.damageHealth(-15,20,30,result.down));
  assert.equal(later.after,-35,'The mercy cap only applies once');
  assert.equal(later.dead,true);
  const toZero=plain(r.damageHealth(4,4,15,null));
  assert.equal(toZero.after,0);
  assert.equal(toZero.dropped,true);
  assert.equal(toZero.down.mercy,false);
  assert.equal(r.damageHealth(0,7,15,toZero.down).after,-7);
  assert.equal(r.damageHealth(10,20,0,null).dead,true,'Threshold zero kills below zero even with mercy');
  assert.equal(r.damageHealth(4,0,30,null).down,null);
});
test('sheet delegates attack and defense decisions to shared rules, not duplicate formulas',()=>{
  const app=read('js/app.js');
  for(const name of [
    'WBCombat.attackHits(', 'WBCombat.dualHits(', 'WBCombat.damagePacket(',
    'WBCombat.criticalTotal(', 'WBCombat.armorDamage(',
    'WBCombat.defenseResult(', 'WBCombat.afterArmor',
    'WBCombat.deathThreshold(', 'WBCombat.damageHealth('
  ]) assert.ok(app.includes(name),name);
  assert.doesNotMatch(app,/r\.d20 === 20 \|\| r\.total >= foe\.ev/);
  assert.doesNotMatch(app,/const weaponDmg = Math\.max\(0, base\.t \+ m \+ fb\)/);
});
