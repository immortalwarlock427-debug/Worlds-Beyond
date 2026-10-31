const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const ctx={window:{},Date:{now(){throw Error('clock');}},Math:Object.create(Math)};ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 for(const name of ['combat-core','rules-catalog','equipment-profiles','abilities','status','character-core'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
 const state={id:'cruleshero',fields:{level:'1',hpCur:'8',mpCur:'20',concOn:'1'},hist:{STR:{1:22},DEX:{1:22},VIT:{1:21},INT:{1:21},AGL:{1:16},FTH:{1:16}},over:{},abilities:[],abilityLoadouts:[],resources:[],items:[],equip:{},statuses:[],consumables:[],inCombat:true};
 return {state,w:ctx.window,c:ctx.window.WBCombat,core:ctx.window.WBCharacter};
}
test('current-stat Health, Mana and AP use the confirmed formulas including AP after 20',()=>{
 const {state,c}=setup();assert.equal(c.characterMaxHealth(state).max,21);assert.equal(c.characterMaxMana(state),63);
 state.fields.level='5';assert.equal(c.characterMaxHealth(state).max,105);assert.equal(c.characterMaxMana(state),147);
 for(const [level,ap] of [[1,15],[4,15],[5,17],[20,23],[25,25],[100,55]]){state.fields.level=level;assert.equal(c.apMaximum(state),ap);}
 state.fields.apMax='18';assert.equal(c.apMaximum(state),18);state.fields.apMax='';assert.equal(c.apMaximum(state),55);
 assert.equal(c.scalingTier(state),5,'unanswered Block/weapon scaling remains at the supplied tier');
});
test('migration keeps current pools once, reports old/new maxima and deletes only obsolete advancement records',()=>{
 const {state,c}=setup();state.fields.level='2';state.rolls={2:7};state.lvGear={};state.settled={old:true};state.levels=[];state.asi={};
 c.migrateVitals(state);assert.equal(state.fields.hpCur,'8');assert.equal(state.fields.mpCur,'20');assert.equal(state.vitalMigration.oldHealth,37);assert.equal(state.vitalMigration.newHealth,42);
 assert.equal(state.vitalMigration.newMana,84);assert.equal(state.vitalMigration.acknowledged,false);
 for(const key of ['rolls','lvGear','settled','levels'])assert.equal(key in state,false);
 const before=JSON.stringify(state);c.migrateVitals(state);assert.equal(JSON.stringify(state),before);assert.ok(state.hist.STR);assert.ok(state.asi);
});
test('gear life loss moves current by max delta without damage or Mercy and ends concentration when downed',()=>{
 const {state,core}=setup(),old=core.vitalMaximums(state);state.items=[{id:'gear',type:'head',bonuses:[{t:'hp',v:-12}]}];state.equip.head='gear';
 const r=core.apply(state,{type:'ReconcileVitalMaximums',previous:old});assert.equal(r.state.fields.hpCur,'-4');assert.equal(r.state.down.mercy,false);assert.equal(r.state.fields.concOn,'0');
 assert.equal(r.events.some(e=>e.type==='health.damaged'),false);assert.equal(core.apply(r.state,{type:'DamageHealth',amount:1}).state.down.mercy,true);
});
test('Mana falls and rises with its max, blank/full stays blank, and no render reconciliation occurs',()=>{
 const {state,core}=setup(),old=core.vitalMaximums(state);state.items=[{id:'gear',type:'head',bonuses:[{t:'INT',v:3}]}];state.equip.head='gear';
 const r=core.apply(state,{type:'ReconcileVitalMaximums',previous:old});assert.equal(r.state.fields.mpCur,'29');assert.equal(state.fields.mpCur,'20');
 const up=core.vitalMaximums(r.state),off={...r.state,equip:{}};assert.equal(core.apply(off,{type:'ReconcileVitalMaximums',previous:up}).state.fields.mpCur,'20');
 state.fields.mpCur='';assert.equal(core.apply(state,{type:'ReconcileVitalMaximums',previous:old}).state.fields.mpCur,'');
});
test('forms and timer expiry reconcile pools exactly once and retain deficits',()=>{
 const {state,core}=setup();state.abilities=[{id:'buff',durationLeft:1,cooldownLeft:0,uses:'',effects:[{target:'stat',stat:'VIT',value:5},{target:'stat',stat:'INT',value:3}]}];
 state.fields.hpCur='10';state.fields.mpCur='20';const r=core.apply(state,{type:'StartTurn'});
 assert.equal(r.state.fields.hpCur,'5');assert.equal(r.state.fields.mpCur,'11');assert.equal(r.state.abilities[0].durationLeft,0);
});
test('arm armor counts highest once; legs need a pair, with both arm effects retained',()=>{
 const {state,c}=setup();state.items=[{id:'a',type:'arms',ar:2,bonuses:[{t:'STR',v:1}]},{id:'b',type:'arms',ar:4,bonuses:[{t:'STR',v:2}]},{id:'l',type:'legs',ar:3}];state.equip={rarm:'a',larm:'b',rleg:'l'};
 assert.equal(c.gearArmor(state),4);assert.equal(c.gearBonus(state,'STR'),3);state.items[2].pair=true;assert.equal(c.gearArmor(state),7);
 state.items[2].pair=false;state.items.push({id:'l2',type:'legs',ar:1});state.equip.lleg='l2';assert.equal(c.gearArmor(state),8);
});
test('heaviest armor controls Evasion, Heavy AGL is capped at three and item material metadata never changes its stats',()=>{
 const {state,c}=setup();state.items=[{id:'armor',type:'torso',ar:8,armorWeight:'heavy',metal:'Titanium'}];state.equip.torso='armor';
 assert.equal(c.armorProfile(state).aglPenalty,3);assert.equal(c.currentScore(state,'AGL'),13);assert.equal(c.gearArmor(state),8);
 state.items[0].armorWeight='light';state.items[0].lightEvasion=2;assert.equal(c.evasion(state),16);state.items.push({id:'hat',type:'head',armorWeight:'medium',ar:1});state.equip.head='hat';
 assert.equal(c.armorProfile(state).evasionBonus,0);assert.equal(c.gearArmor(state),9,'Only entered armor stats count');
});
test('Block and weapon dice scale at every documented tier and use shield die size',()=>{
 const {state,c}=setup();state.items=[{id:'shield',type:'shield',block:'1d10',blockMultiplier:1.5}];state.equip.off='shield';
 for(const level of [1,5,10,15,20,25]){state.fields.level=level;const count=1+Math.floor(Math.min(20,level)/5);assert.equal(c.blockDice(state).count,count);assert.equal(c.blockDice(state).sides,10);assert.equal(c.blockDice(state).multiplier,1.5);assert.equal(c.scaleDice('2d6+3',count),2*count+'d6+3');}
});
test('Heavy and Paragon double damage modifier while AP uses the single chosen modifier',()=>{
 const {state,w}=setup();state.items=[{id:'axe',name:'Axe',type:'onehand',stat:'DEX',properties:['Heavy'],dmg:'1d8'}];state.equip.main='axe';
 let p=w.WBAbilities.weaponAttackPlan(state,'main');assert.equal(p.main.stat,'STR');assert.equal(p.main.damageModifier,10);assert.equal(p.apCost,5);
 state.items[0].properties=['Paragon'];p=w.WBAbilities.weaponAttackPlan(state,'main');assert.equal(p.main.stat,'DEX');assert.equal(p.main.damageModifier,10);assert.equal(p.main.criticalFrom,18);
});
test('dual attacks require Light and lose the off-hand modifier only for the dual attack',()=>{
 const {state,w}=setup();state.items=[{id:'a',name:'A',type:'onehand',stat:'STR',dmg:'1d6'},{id:'b',name:'B',type:'onehand',stat:'DEX',dmg:'1d4'}];state.equip={main:'a',off:'b'};
 assert.equal(w.WBAbilities.weaponAttackPlan(state,'dual').ok,false);state.items.forEach(it=>it.properties=['Balanced','Light']);
 assert.equal(w.WBAbilities.weaponAttackPlan(state,'dual').off.damageModifier,0);assert.equal(w.WBAbilities.weaponAttackPlan(state,'off').main.damageModifier,5);
});
test('Finesse 18/19 criticals preserve natural die semantics and Two-handed/Puncture order',()=>{
 const {c}=setup();assert.equal(c.weaponCritical(18,false,18),true);assert.equal(c.attackHits(10,15,18),false);assert.equal(c.attackHits(10,15,20),true);
 assert.equal(c.effectiveArmor(7,true,2),2);assert.equal(c.afterArmor({dmg:20,ar:7,twoHanded:true,puncture:2,res:true}),8);
});
test('Thrown has independent melee and ranged modes; Mount applies its approach to damage',()=>{
 const {state,c,w}=setup();const spear={id:'spear',name:'Spear',type:'onehand',stat:'STR',dmg:'1d8',properties:['Thrown','Reach','Mount'],mounted:true,range:5,thrownRange:20,thrownLongRange:40};state.items=[spear];state.equip.main='spear';state.mountApproach=30;
 assert.equal(c.weaponRules(state,spear).normalRange,10);assert.equal(c.weaponRules(state,spear).melee,true);assert.equal(w.WBAbilities.weaponSource(state,'spear').flatBonus,3);
 spear.attackMode='ranged';assert.equal(c.weaponRules(state,spear).stat,'DEX');assert.equal(c.weaponRules(state,spear).normalRange,20);assert.equal(c.weaponRules(state,spear).longRange,40);
});
test('Loading validates before payment, spends one shot, reloads and preserves rollback',()=>{
 const {state,core}=setup();state.items=[{id:'crossbow',name:'Crossbow',type:'onehand',stat:'DEX',dmg:'1d10',properties:['Ranged','Strapped','Loading'],loadingCapacity:1}];state.equip.strapped='crossbow';
 const r=core.apply(state,{type:'BeginWeaponAttack',slot:'strapped'});assert.equal(r.ok,true);assert.equal(r.state.weaponShots.crossbow,0);assert.equal(state.weaponShots,undefined);
 const before=JSON.stringify(r.state);assert.equal(core.apply(r.state,{type:'BeginWeaponAttack',slot:'strapped'}).ok,false);assert.equal(JSON.stringify(r.state),before);
 const reloaded=core.apply(r.state,{type:'ReloadWeapon',weaponId:'crossbow'});assert.equal(reloaded.ok,true);assert.equal(reloaded.state.weaponShots.crossbow,1);
});
test('Titan’s Might replaces Devastate without deleting legacy counters and uses separate outside allowances',()=>{
 const {state,core,w}=setup();state.milestoneUses={devastate:{usesLeft:0,outsideUsesSpent:1}};
 assert.equal(w.WBAbilities.milestoneAction(state,'devastate'),null);assert.equal(w.WBAbilities.milestoneAction(state,'titans-might').usage.remaining,0);
 const turn=core.apply(state,{type:'AdvanceAbilityTurn'});assert.equal(turn.state.milestoneUses['titans-might'].usesLeft,1);assert.ok(turn.state.milestoneUses.devastate);
 state.inCombat=false;const r=core.apply(state,{type:'UseMilestone',milestoneId:'titans-might'});assert.equal(r.ok,true);assert.equal(r.state.milestoneUses['titans-might'].outsideUsesSpent,2);assert.ok(r.state.milestoneUses.devastate);
 assert.equal(core.apply(state,{type:'ApplyDevastate',damageSource:{stat:'STR',damageModifier:5}}).ok,false);
});
test('all non-AGL stats can discount abilities and Commanding Presence has the normal save DC',()=>{
 const {state,w,c}=setup();assert.equal(w.WBAbilities.milestoneAction({...state,hist:{...state.hist,CHA:{1:21}}},'commanding-presence').plan.total,15);
 for(const stat of ['STR','VIT','DEX','INT','WIS','CHA','FTH'])assert.equal(c.abilityApCost(5,2),3);
});
test('manual tracker commands and effect ending update the same state without repaying',()=>{
 const {state,core}=setup();state.abilities=[{id:'a',name:'A',uses:3,usesLeft:1,usesPer:'rest',durationLeft:2,cooldownLeft:1,capacityMax:3,capacityCurrent:2,effects:[]}];
 let r=core.apply(state,{type:'SetAbilityTracker',abilityId:'a',field:'durationLeft',value:4});assert.equal(r.state.abilities[0].durationLeft,4);assert.equal(state.abilities[0].durationLeft,2);
 r=core.apply(r.state,{type:'ReleaseAbilityCapacity',abilityId:'a'});assert.equal(r.state.abilities[0].capacityCurrent,1);r=core.apply(r.state,{type:'EndAbilityEffect',abilityId:'a'});assert.equal(r.state.abilities[0].durationLeft,0);assert.equal(r.state.apAvail,undefined);
});
test('Shake It Off requires a DC, spends VIT-discounted AP once, and healing ends Bleeding',()=>{
 const {state,core}=setup();state.statuses=[{id:'burn',name:'Burning',preset:'Burning',dc:12},{id:'bleed',name:'Bleeding',preset:'Bleeding',dc:12}];
 const r=core.apply(state,{type:'BeginShakeItOff',statusId:'burn'});assert.equal(r.ok,true);assert.equal(r.shakePlan.cost,3);assert.equal(r.state.apAvail,12);assert.equal(r.state.statuses.length,2);
 const healed=core.apply(state,{type:'HealHealth',amount:1});assert.deepEqual(Array.from(healed.state.statuses,s=>s.id),['burn']);
 state.statuses[0].dc=null;assert.equal(core.apply(state,{type:'BeginShakeItOff',statusId:'burn'}).ok,false);
});
test('catalog contains supplied equipment prices, complete status text and the DM Burning override',()=>{
 const {w}=setup(),catalog=w.WBRulesCatalog;assert.equal(catalog.equipment.length,70);assert.equal(Object.keys(catalog.statuses).length,16);
 assert.equal(catalog.equipment.find(it=>it.name==='Hand Crossbow').loadingCapacity,1);assert.equal(catalog.equipment.find(it=>it.name==='Plate shield').ar,1);
 assert.match(catalog.statuses.Burning,/requires a VIT roll/);assert.doesNotMatch(catalog.statuses.Burning,/spends 5 AP to put out/);
});
test('inventory counts stock stacks and warns independently of commands or edits',()=>{
 const {state,c}=setup();state.items=[{id:'a',type:'twohand'},{id:'shield',type:'shield'},{id:'pack',type:'belt',backpackBonus:6},{id:'ammo',type:'belt',ammoQuantity:11}];state.equip={main:'a'};state.consumables=[{quantity:6}];
 const before=JSON.stringify(state),i=c.inventory(state);assert.equal(i.used,8);assert.equal(i.capacity,21);assert.equal(JSON.stringify(state),before);
});
test('drawing and drinking validate the complete payment before changing gear or stock',()=>{
 const {state,core}=setup();state.items=[{id:'sword',name:'Sword',type:'onehand',stat:'STR',dmg:'1d6',properties:['Light'],bonuses:[{t:'hp',v:2}]}];
 let r=core.apply(state,{type:'DrawWeapon',weaponId:'sword'});assert.equal(r.ok,true);assert.equal(r.state.apAvail,14);assert.equal(r.state.equip.main,'sword');assert.equal(r.state.fields.hpCur,'10');assert.equal(state.equip.main,undefined);
 state.consumables=[{id:'potion',name:'Potion',quantity:2,healingDice:'1d6'}];r=core.apply(state,{type:'DrinkConsumable',consumableId:'potion'});assert.equal(r.ok,true);assert.equal(r.state.apAvail,12);assert.equal(r.state.consumables[0].quantity,1);assert.equal(r.state.fields.hpCur,'8');
 state.apAvail=0;for(const command of [{type:'DrawWeapon',weaponId:'sword'},{type:'DrinkConsumable',consumableId:'potion'}]){const before=JSON.stringify(state);assert.equal(core.apply(state,command).ok,false);assert.equal(JSON.stringify(state),before);}
 state.items[0].signatures=['Quickdraw'];assert.equal(core.apply(state,{type:'DrawWeapon',weaponId:'sword'}).ok,true);
});
