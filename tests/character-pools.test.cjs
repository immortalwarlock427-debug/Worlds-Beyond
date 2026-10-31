const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const context={window:{}};
for(const name of ['combat-core','equipment-profiles','abilities','character-core'])
  vm.runInNewContext(read(name),context);
const api=context.window.WBCharacter,combat=context.window.WBCombat,abilities=context.window.WBAbilities;
function hero(){return {
 fields:{level:'3',manaKind:'mana',apMax:'15',mpCur:''},hist:{INT:{1:'16'},FTH:{1:'13'}},
 over:{},lvGear:{},asi:{},items:[],equip:{},equipmentProfiles:{base:{}},
 apAvail:null,apGiven:{n:3,fresh:true},abilities:[],resources:[],
 abilityLoadouts:[],activeAbilityLoadoutId:'',showMana:true
};}
function freeze(value){
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
 return value;
}
function controlsFor(state){return {
 getAp:()=>api.derive(state).ap.total,
 getMana:()=>{const m=api.derive(state).mana;return m.configured?m.current:null;},
 spendAp:()=>{throw Error('prepared payment must be used');},
 spendMana:()=>{throw Error('prepared payment must be used');},
 planPools:costs=>api.apply(state,{type:'SpendPools',...costs}),
 commitPools:result=>Object.assign(state,result.patch)
};}

test('AP derivation preserves blank/full sentinels and legacy tracker bounds without writing state',()=>{
 const state=hero(),before=JSON.stringify(state);
 assert.deepEqual(plain(api.derive(freeze(state)).ap),{max:15,own:15,given:3,total:18});
 assert.equal(JSON.stringify(state),before);
 for(const [value,max] of [['',15],['0',0],['-7',0],['200',40],['4.8',4]]){
  const copy=hero();copy.fields.apMax=value;
  assert.equal(api.derive(copy).ap.max,max);
 }
 for(const [current,expected] of [[undefined,15],[null,15],['6',6],[-5,0],[200,15],['broken',0]]){
  const copy=hero();copy.apAvail=current;
  assert.equal(api.derive(copy).ap.own,expected);
 }
 const broken=hero();broken.apGiven={n:'broken',fresh:true};
 assert.equal(api.derive(broken).ap.given,0);
});

test('Mana progression shares table thresholds and uses historical scores, ASI, snapshots and current pool gear',()=>{
 for(const [score,expected] of [[12,0],[13,6],[16,8],[19,10],[22,12],[25,14],[28,18],[40,18]])
  assert.equal(combat.manaPerLevel(score),expected);
 const s=hero();
 assert.equal(api.derive(s).mana.max,28,'12 at first level, then 8 per level');
 s.lvGear={2:{INT:'3'}};
 s.items=[{id:'helm',type:'head',bonuses:[{t:'INT',v:12},{t:'mp',v:4},{t:'holy',v:7}]}];s.equip.head='helm';
 assert.equal(api.derive(s).mana.max,34,'only the historical snapshot and explicit pool bonus count');
 s.abilities=[{durationLeft:3,effects:[{target:'stat',stat:'INT',value:20}]}];
 s.abilityLoadouts=[{id:'form',statBonuses:{INT:20},manaMode:'show'}];s.activeAbilityLoadoutId='form';
 assert.equal(api.derive(s).mana.max,34,'current temporary/form stats are not retroactive advancement');
 s.fields.manaKind='holy';
 assert.equal(api.derive(s).mana.max,22,'FTH: 3 + 6 + 6, plus 7 worn Holy Power');
 s.fields.manaKind='mana';s.fields.level='4';s.hist.INT={1:'18'};s.lvGear={};s.asi={4:{INT:2}};
 assert.equal(api.derive(s).mana.max,48,'18 + 8 + 8 + 10 + 4 gear');
});

test('Mana manual overrides, blank/full and above-max corrections remain independent of visibility',()=>{
 const s=hero();s.over.mpMax='20';
 assert.equal(api.derive(s).mana.current,20);
 s.fields.mpCur='27';s.showMana=false;
 const m=api.derive(freeze(s)).mana;
 assert.equal(m.current,27);assert.equal(m.max,20);assert.equal(m.visible,false);assert.equal(m.available,false);
 const corrected=api.apply(s,{type:'SetManaCurrent',value:'-5'});
 assert.equal(corrected.state.fields.mpCur,'-5');
 assert.equal(api.derive(corrected.state).mana.current,0);
 assert.equal(corrected.events[0].source,'correction');
 const blank=api.apply(s,{type:'SetManaCurrent',value:''});
 assert.equal(blank.state.fields.mpCur,'');assert.equal(api.derive(blank.state).mana.current,20);
 const noStats=hero();noStats.hist={};
 assert.equal(api.derive(noStats).mana.max,null);
 assert.equal(api.derive(noStats).mana.current,null);
 noStats.over.mpMax='9';
 assert.equal(api.derive(noStats).mana.current,9,'manually configured legacy pools work without a stat');
});

test('Command AP is spent before personal AP with no input mutation or unrelated field loss',()=>{
 const s=hero();s.extension={future:'kept'};freeze(s);
 const paid=api.apply(s,{type:'SpendAP',amount:5});
 assert.equal(paid.ok,true);
 assert.equal(paid.state.apAvail,13);
 assert.deepEqual(plain(paid.state.apGiven),{n:0,fresh:true});
 assert.equal(s.apAvail,null);assert.equal(s.apGiven.n,3);
 assert.equal(paid.state.extension,s.extension);
 assert.equal(paid.events[0].type,'ap.changed');assert.equal(paid.events[0].source,'command');
 const zero=api.apply(s,{type:'SpendAP',amount:0});
 assert.equal(zero.state.apAvail,null,'a free action must keep the blank/full sentinel');
 assert.equal(zero.events.length,0);
});

test('refunds fill personal AP first and preserve existing overflow/freshness behavior',()=>{
 const s=hero();s.fields.apMax='4';s.apAvail=1;s.apGiven={n:2,fresh:false};freeze(s);
 const result=api.apply(s,{type:'RefundAP',amount:5});
 assert.equal(result.state.apAvail,4);
 assert.deepEqual(plain(result.state.apGiven),{n:4,fresh:false});
 assert.equal(s.apAvail,1);assert.equal(s.apGiven.n,2);
});

test('combined AP/Mana payments reject either insufficient pool without a partial patch',()=>{
 const s=freeze(hero()),original=JSON.stringify(s);
 for(const costs of [{ap:19,mana:1},{ap:2,mana:29}]){
  const r=api.apply(s,{type:'SpendPools',...costs});
  assert.equal(r.ok,false);assert.equal(r.patch,undefined);
  assert.equal(JSON.stringify(s),original);
 }
 const r=api.apply(s,{type:'SpendPools',ap:5,mana:9});
 assert.equal(r.state.apAvail,13);assert.equal(r.state.apGiven.n,0);
 assert.equal(r.state.fields.mpCur,'19');
 assert.equal(s.fields.mpCur,'');
 assert.deepEqual(Array.from(r.events,e=>e.type),['ap.changed','mana.changed']);
});

test('hidden Mana keeps its balance and can only be spent through explicit form-entry payment',()=>{
 const s=hero();s.fields.mpCur='17';s.abilityLoadouts=[{id:'hidden',manaMode:'hide'}];s.activeAbilityLoadoutId='hidden';
 assert.equal(api.derive(s).mana.current,17);
 assert.equal(api.apply(s,{type:'SpendMana',amount:5}).error,'MANA_UNAVAILABLE');
 const r=api.apply(s,{type:'SpendPools',ap:2,mana:5,allowHiddenMana:true});
 assert.equal(r.ok,true);assert.equal(r.state.fields.mpCur,'12');assert.equal(r.state.apAvail,15);assert.equal(r.state.apGiven.n,1);
 s.showMana=false;s.abilityLoadouts[0].manaMode='show';
 assert.equal(api.derive(s).mana.available,true);
 assert.equal(api.apply(s,{type:'SpendMana',amount:5}).ok,true);
 s.over.mpMax='0';
 assert.equal(api.apply(s,{type:'SpendPools',ap:2,mana:1,allowHiddenMana:true}).error,'MANA_NOT_CONFIGURED');
});

test('manual AP/current/max edits and Mana overrides are pure corrections, not gameplay gains',()=>{
 const s=freeze(hero());
 const r=api.apply(s,{type:'SetAPCurrent',value:5});
 assert.equal(r.state.apAvail,5);assert.equal(r.events[0].source,'correction');
 assert.equal(api.apply(r.state,{type:'SetAPCurrent',value:null}).state.apAvail,null);
 assert.equal(api.apply(s,{type:'SetAPCurrent',value:99}).state.apAvail,15);
 const changed=api.apply(s,{type:'SetAPMaximum',value:'8'});
 assert.equal(api.derive(changed.state).ap.own,8);assert.equal(changed.state.apAvail,null);
 const overridden=api.apply(s,{type:'SetManaMaximum',value:'55'});
 assert.equal(overridden.state.over.mpMax,'55');assert.equal(api.derive(overridden.state).mana.current,55);
 const cleared=api.apply(overridden.state,{type:'SetManaMaximum',value:''});
 assert.equal(cleared.state.over.mpMax,undefined);assert.equal(api.derive(cleared.state).mana.max,28);
});

test('malformed and negative payments reject without mutating a character or converting blank pools',()=>{
 const s=freeze(hero()),original=JSON.stringify(s);
 for(const type of ['SpendAP','SpendMana','RefundAP'])
  for(const amount of [-1,NaN,Infinity,'',undefined,null,'bad',{},[],true])
   assert.equal(api.apply(s,{type,amount}).error,'INVALID_AMOUNT',type+' '+String(amount));
 for(const type of ['SetManaCurrent','SetManaMaximum','SetAPCurrent','SetAPMaximum'])
  assert.equal(api.apply(s,{type,value:'bad'}).error,'INVALID_VALUE');
 assert.equal(JSON.stringify(s),original);
});

test('derivation and payments need no DOM, clock or random source, and are deterministic',()=>{
 const ctx={window:{},Date:{now(){throw Error('clock');}},Math:Object.create(Math)};
 ctx.Math.random=()=>{throw Error('random');};
 Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 for(const name of ['combat-core','abilities','character-core'])vm.runInNewContext(read(name),ctx);
 const s=freeze(hero()),command={type:'SpendPools',ap:4,mana:3};
 assert.equal(JSON.stringify(ctx.window.WBCharacter.apply(s,command)),JSON.stringify(api.apply(s,command)));
});

test('form entry plans blank Mana before equipment changes and leaves source/gear intact on rejected costs',()=>{
 const s=hero();s.hist.INT={1:'16'};s.fields.level='1';s.apGiven=null;
 s.items=[{id:'basehelm',type:'head',bonuses:[{t:'mp',v:8}]},
          {id:'formhelm',type:'head',bonuses:[{t:'mp',v:30}]}];
 s.equip={head:'basehelm'};s.equipmentProfiles={base:{head:'basehelm'},loadcostform:{head:'formhelm'}};
 s.abilityLoadouts=[{id:'loadcostform',name:'Mage',manaMode:'hide',entryApCost:4,entryResourceId:'base-mana',entryResourceCost:6}];
 const controls=controlsFor(s);
 assert.equal(abilities.selectLoadout(s,'loadcostform',controls),true);
 assert.equal(s.fields.mpCur,'14','20 in the old profile minus 6, never 42 minus 6');
 assert.equal(s.apAvail,11);assert.equal(s.equip.head,'formhelm');
 assert.equal(abilities.selectLoadout(s,'loadcostform',controls),true);
 assert.equal(s.fields.mpCur,'14','reselecting the form is free');
 assert.equal(abilities.selectLoadout(s,'',controls),true);
 assert.equal(s.fields.mpCur,'14','Base is free');
 s.fields.mpCur='5';const before=JSON.stringify(s);
 assert.equal(abilities.selectLoadout(s,'loadcostform',controls),false);
 assert.equal(JSON.stringify(s),before);
});

test('linked portraits use the same planned payment, including a lower destination Mana maximum',()=>{
 const s=hero();s.fields.level='1';s.apGiven=null;
 s.portraits=[{id:'basepic',src:'data:image/png;base64,a'},{id:'magepic',src:'data:image/png;base64,b'}];s.formId='basepic';
 s.items=[{id:'basehelm',type:'head',bonuses:[{t:'mp',v:8}]}];s.equip={head:'basehelm'};
 s.equipmentProfiles={base:{head:'basehelm'},loadcostform:{}};
 s.abilityLoadouts=[{id:'loadcostform',name:'Mage',portraitId:'magepic',entryApCost:4,entryResourceId:'base-mana',entryResourceCost:6}];
 assert.equal(abilities.selectPortrait(s,'magepic',controlsFor(s)),true);
 assert.equal(s.fields.mpCur,'14');assert.equal(api.derive(s).mana.max,12);
 assert.equal(s.formId,'magepic');assert.equal(s.activeAbilityLoadoutId,'loadcostform');
 assert.equal(abilities.selectPortrait(s,'magepic',controlsFor(s)),true);
 assert.equal(s.fields.mpCur,'14');assert.equal(s.apAvail,11);
});

test('a failed equipment switch cannot commit a previously planned AP/Mana payment',()=>{
 const s=hero();s.abilityLoadouts=[{id:'loadcostform',name:'Mage',entryApCost:4,entryResourceId:'base-mana',entryResourceCost:6}];
 const before=JSON.stringify(s),equipment=context.window.WBEquipment,original=equipment.switchForm;
 try{
  equipment.switchForm=()=>false;
  assert.equal(abilities.selectLoadout(s,'loadcostform',controlsFor(s)),false);
  assert.equal(JSON.stringify(s),before);
 }finally{equipment.switchForm=original;}
});
