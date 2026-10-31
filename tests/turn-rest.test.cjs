const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
function setup(){
 const context={window:{},Date:{now(){throw Error('clock');}},Math:Object.create(Math)};
 context.Math.random=()=>{throw Error('random');};
 Object.defineProperty(context,'document',{get(){throw Error('DOM');}});
 for(const name of ['combat-core','equipment-profiles','abilities','status','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),context);
 const state={fields:{charName:'Turn Tester',level:'1',hpCur:'-3',mpCur:'2',sessionNotes:'Remember'},
  hist:{VIT:{1:'16'},INT:{1:'16'},AGL:{1:'21'}},over:{hpMax:'30',mpMax:'20'},
  apAvail:0,reactAvail:0,apGiven:{n:4,fresh:true},move:{paid:3},parryUsed:true,parryOutsideSpent:2,
  wonderAvail:0,trauma:1,down:{mercy:true,stable:false,extra:'kept'},inCombat:true,
  abilities:[{id:'abilturnone',name:'Boost',uses:2,usesLeft:0,usesPer:'round',outsideUsesSpent:3,
   cooldownLeft:2,durationLeft:1,capacityCurrent:2,effects:[{target:'resource-max',resourceId:'resenergyone',value:100}]}],
  resources:[{id:'resenergyone',max:100,current:150,regen:5,refillOnRest:true},
   {id:'resotherone',max:30,current:2,regen:3,refillOnRest:false,loadoutIds:['other']}],
  abilityLoadouts:[{id:'other'}],activeAbilityLoadoutId:'',
  statuses:[{id:'ststimedone',remaining:1},{id:'stsforeverone',remaining:null}],
  milestoneUses:{stratagem:{usesLeft:0,outsideUsesSpent:2,extra:'kept'}},
  items:[{id:'head',type:'head',abilities:[{uses:2,per:'round'}]},
   {id:'hidden',type:'belt',abilities:[{uses:3,per:'rest'}]}],equip:{head:'head'},settled:{old:true},
  spent:{head:{0:2},hidden:{0:2}},equipmentOutsideSpent:{head:{0:1}},
  consumables:[{id:'potion',quantity:2}],rollHistory:[{id:'roll',title:'Old roll'}],future:{kept:true}};
 return {state,core:context.window.WBCharacter,window:context.window};
}
test('StartTurn is deterministic and atomic: regen, timers, max drop, statuses, then one bleed',()=>{
 const {state,core}=setup();freeze(state);const original=JSON.stringify(state);
 const r=core.apply(state,{type:'StartTurn'}),again=core.apply(state,{type:'StartTurn'});
 assert.equal(r.ok,true);assert.deepEqual(plain(r),plain(again));assert.equal(JSON.stringify(state),original);
 assert.equal(r.state.resources[0].current,100);assert.equal(r.state.resources[1].current,2);
 assert.equal(r.state.abilities[0].durationLeft,0);assert.equal(r.state.abilities[0].cooldownLeft,1);
 assert.equal(r.state.abilities[0].usesLeft,2);assert.equal(r.state.abilities[0].outsideUsesSpent,3);
 assert.deepEqual(plain(r.state.statuses),[{id:'stsforeverone',remaining:null}]);assert.equal(r.state.fields.hpCur,'-7');
 assert.equal(r.transitionPlan.bleeding.after,-7);assert.equal(r.transitionPlan.bleeding.concentration,false);
 assert.equal(r.events.filter(e=>e.type==='health.damaged').length,1);
 const stages=r.events.map(e=>e.stage);assert.ok(stages.indexOf('regeneration')<stages.indexOf('abilities'));
 assert.ok(stages.indexOf('maximums')<stages.indexOf('bleeding'));assert.equal(r.events.at(-1).type,'turn.started');
});
test('turn reset carries fresh Command once, refills AP/reactions and keeps outside allowances',()=>{
 const {state,core}=setup();state.inCombat=false;state.down.stable=true;
 const r=core.apply(freeze(state),{type:'StartTurn'});
 assert.equal(r.state.apAvail,null);assert.equal(r.state.reactAvail,null);assert.equal(r.state.move,null);
 assert.equal(r.state.parryUsed,false);assert.equal(r.state.parryOutsideSpent,2);
 assert.deepEqual(plain(r.state.apGiven),{n:4,fresh:false});assert.equal(core.derive(r.state).ap.total,19);
 assert.equal(r.state.abilities[0].usesLeft,0);assert.equal(r.state.abilities[0].outsideUsesSpent,3);
 assert.equal(r.state.milestoneUses.stratagem.outsideUsesSpent,2);
 assert.equal(r.state.spent.head,undefined);assert.equal(r.state.spent.hidden[0],2);
 assert.equal(core.apply(r.state,{type:'StartTurn'}).state.apGiven,null);
});
test('regeneration sees the active bonus before expiry and ignores pools belonging to another form',()=>{
 const {state,core}=setup();state.abilities[0].durationLeft=2;state.resources[0].current=100;
 const r=core.apply(state,{type:'StartTurn'});assert.equal(r.state.resources[0].current,105);
 assert.equal(r.state.resources[1].current,2);assert.equal(r.state.abilities[0].durationLeft,1);
 state.resources[0].current=220;assert.equal(core.apply(state,{type:'StartTurn'}).state.resources[0].current,220);
});
test('a VIT effect expiring before bleeding can reach death threshold without another damage event',()=>{
 const {state,core}=setup();state.trauma=0;state.fields.hpCur='-18';
 state.abilities[0].effects=[{target:'stat',stat:'VIT',value:10}];
 assert.equal(core.health(state).dead,false);const r=core.apply(state,{type:'StartTurn'});
 assert.equal(core.health(r.state).dead,true);assert.equal(r.state.fields.hpCur,'-18');
 assert.equal(r.transitionPlan.bleeding,null);assert.equal(r.events.filter(e=>e.type==='health.damaged').length,0);
});
test('bleeding skips stable, dead, positive and unknown Health; zero uses existing Mercy math once',()=>{
 const {state,core}=setup();
 for(const mode of ['stable','dead','positive','unknown']){
  const s=plain(state);if(mode==='stable')s.down.stable=true;
  if(mode==='dead')s.fields.hpCur='-100';if(mode==='positive')s.fields.hpCur='3';
  if(mode==='unknown'){s.fields.hpCur='';s.over={};s.hist={};}
  const r=core.apply(freeze(s),{type:'StartTurn'});assert.equal(r.ok,true);assert.equal(r.transitionPlan.bleeding,null);
 }
 const s={...state,fields:{...state.fields,hpCur:'0'},down:{mercy:false,stable:false},trauma:0};
 const r=core.apply(s,{type:'StartTurn'});assert.equal(r.state.fields.hpCur,'-4');assert.equal(r.state.down.mercy,true);
});
test('LongRest refills legacy pools, resets timers and counters, settles only worn items, and retains statuses/capacity/combat',()=>{
 const {state,core}=setup();freeze(state);const r=core.apply(state,{type:'LongRest'});
 assert.equal(r.ok,true);assert.equal(r.state.fields.hpCur,'30');assert.equal(r.state.fields.mpCur,'20');
 assert.equal(r.state.trauma,0);assert.equal(r.state.down,null);assert.equal(r.state.wonderAvail,null);
 assert.equal(r.state.apAvail,null);assert.equal(r.state.reactAvail,null);assert.equal(r.state.apGiven,null);assert.equal(r.state.move,null);
 assert.equal(r.state.parryOutsideSpent,0);assert.equal(r.state.resources[0].current,100);assert.equal(r.state.resources[1].current,2);
 assert.equal(r.state.abilities[0].durationLeft,0);assert.equal(r.state.abilities[0].cooldownLeft,0);
 assert.equal(r.state.abilities[0].usesLeft,2);assert.equal(r.state.abilities[0].outsideUsesSpent,0);assert.equal(r.state.abilities[0].capacityCurrent,2);
 assert.deepEqual(plain(r.state.settled),{old:true,head:true});assert.deepEqual(plain(r.state.spent),{});
 assert.deepEqual(plain(r.state.equipmentOutsideSpent),{});assert.equal(r.state.inCombat,true);
 assert.deepEqual(plain(r.state.statuses),plain(state.statuses));assert.equal(r.events.at(-1).type,'rest.completed');
 for(const key of ['consumables','rollHistory','items','equip','future'])assert.equal(r.state[key],state[key]);
});
test('rest uses state maxima, preserves signed maxima and hidden Mana, and leaves unknown pools unset',()=>{
 const {state,core}=setup();state.showMana=false;state.over.hpMax='-2';state.over.mpMax='-5';
 let r=core.apply(state,{type:'LongRest'});assert.equal(r.state.fields.hpCur,'-2');assert.equal(r.state.fields.mpCur,'-5');
 assert.equal(r.state.down.mercy,true);assert.equal(r.state.trauma,0);
 state.over={};state.hist={};r=core.apply(state,{type:'LongRest'});
 assert.equal(r.state.fields.hpCur,'-3');assert.equal(r.state.fields.mpCur,'2');assert.equal(r.state.trauma,0);
});
test('UndoLongRest restores owned trackers but preserves later notes, stock, rolls, statuses and unknown fields',()=>{
 const {state,core}=setup();const original=plain(state),r=core.apply(freeze(state),{type:'LongRest'});
 const edited={...r.state,fields:{...r.state.fields,sessionNotes:'After rest',charName:'New name'},
  consumables:[{id:'potion',quantity:1}],rollHistory:[{id:'new'}],statuses:[{id:'newcondition'}],future:{new:true}};
 freeze(edited);freeze(r.restReceipt);const undo=core.apply(edited,{type:'UndoLongRest',receipt:r.restReceipt});
 assert.equal(undo.ok,true);assert.deepEqual(plain(undo.state.abilities),original.abilities);
 assert.deepEqual(plain(undo.state.resources),original.resources);assert.deepEqual(plain(undo.state.down),original.down);
 assert.equal(undo.state.fields.hpCur,'-3');assert.equal(undo.state.fields.mpCur,'2');assert.equal(undo.state.trauma,1);
 assert.equal(undo.state.fields.sessionNotes,'After rest');assert.equal(undo.state.fields.charName,'New name');
 for(const key of ['consumables','rollHistory','statuses','future'])assert.equal(undo.state[key],edited[key]);
 assert.deepEqual(plain(undo.events),[]);assert.ok(JSON.stringify(r.restReceipt).length<4000);
});
test('Undo receipt does not capture portraits and restores originally absent keys without inventing defaults',()=>{
 const {state,core}=setup();for(const key of ['wonderAvail','down','settled','milestoneUses','parryOutsideSpent'])delete state[key];
 delete state.fields.mpCur;state.portraits=[{data:'huge-image-data'}];
 const r=core.apply(state,{type:'LongRest'}),undo=core.apply(r.state,{type:'UndoLongRest',receipt:r.restReceipt});
 assert.equal(JSON.stringify(r.restReceipt).includes('huge-image-data'),false);assert.equal('mpCur' in undo.state.fields,false);
 assert.equal('wonderAvail' in undo.state,false);assert.equal('settled' in undo.state,false);
 for(const receipt of [null,{},r.restReceipt.values,{...r.restReceipt,version:2}]){
  const rejected=core.apply(state,{type:'UndoLongRest',receipt});assert.equal(rejected.ok,false);assert.equal(rejected.patch,undefined);
 }
});
test('late turn/rest failures reject the entire private transaction without changed trackers or receipt',()=>{
 for(const type of ['StartTurn','LongRest']){
  const {state,core,window}=setup(),original=JSON.stringify(state);
  if(type==='StartTurn')window.WBStatus.advanceTurn=s=>{s.statuses[0].remaining=99;throw Error('late failure');};
  else window.WBAbilities.resetForRest=s=>{s.abilities[0].cooldownLeft=99;throw Error('late failure');};
  const r=core.apply(freeze(state),{type});assert.equal(r.ok,false);assert.equal(r.error,'TRANSACTION_FAILED');
  assert.equal(r.patch,undefined);assert.equal(r.events,undefined);assert.equal(r.restReceipt,undefined);assert.equal(JSON.stringify(state),original);
 }
});
