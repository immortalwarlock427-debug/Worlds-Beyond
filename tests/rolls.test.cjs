const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function setup(){
 const ctx={window:{},Date,Math};
 for(const name of ['persistence','combat-core','equipment-profiles','abilities','rolls','character-core'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),ctx);
 ctx.Date=class extends Date{constructor(...args){if(!args.length)throw Error('clock');super(...args);}static now(){throw Error('clock');}};
 ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw Error('random');};Object.defineProperty(ctx,'document',{get(){throw Error('DOM');}});
 const state={fields:{hpCur:'8',sessionNotes:'Keep this'},hist:{},apAvail:7,resources:[{id:'energy',current:5}],consumables:[{id:'potion',quantity:3}],futureState:{kept:true}};
 return {state,rolls:ctx.window.WBRolls,persistence:ctx.window.WBPersistence,apply:(s,type,extra={})=>ctx.window.WBCharacter.apply(s,{type,...extra})};
}
const entry=(id='roll1')=>({id,at:'2026-10-31T05:00:00.000Z',kind:'check',title:'Strength check',total:17,math:'d20 (12) + 5',note:'Table result',d20:12,mode:'norm'});

test('legacy history is empty and recording a snapshot is pure, deterministic and never a gameplay event',()=>{
 const {state,rolls,apply}=setup();freeze(state);const before=JSON.stringify(state);
 assert.deepEqual(plain(rolls.view(state)),[]);const r=apply(state,'RecordRoll',{entry:entry()});
 assert.equal(r.ok,true);assert.equal(r.state.rollHistory.length,1);assert.deepEqual(plain(r.events),[]);
 for(const key of ['fields','hist','resources','consumables','futureState'])assert.equal(r.state[key],state[key]);
 assert.equal(r.state.apAvail,7);assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(apply(state,'RecordRoll',{entry:entry()})),JSON.stringify(r));
});
test('history stores display primitives and cannot retain roll actions, targets, costs or live source objects',()=>{
 const {state,apply}=setup();const value={...entry(),acts:[['hurt','Damage']],weapon:{id:'sword'},abilityRoll:{apCost:10},consumableHealing:{amount:5},foe:'enemy',historyId:'old'};
 const r=apply(state,'RecordRoll',{entry:value});assert.equal(r.ok,true);
 assert.deepEqual(Object.keys(r.state.rollHistory[0]).sort(),['id','at','kind','title','total','math','note','mode','d20'].sort());
 assert.equal(value.weapon.id,'sword');
});
test('only the latest twenty entries remain, in newest-first order',()=>{
 const {state,apply}=setup();let s=state;
 for(let i=0;i<25;i++)s=apply(freeze(s),'RecordRoll',{entry:entry('roll'+i)}).state;
 assert.equal(s.rollHistory.length,20);assert.equal(s.rollHistory[0].id,'roll24');assert.equal(s.rollHistory[19].id,'roll5');
 const before=JSON.stringify(s),r=apply(s,'RecordRoll',{entry:entry('roll24')});assert.equal(r.ok,false);assert.equal(r.patch,undefined);assert.equal(JSON.stringify(s),before);
});
test('revising an existing result preserves its id, timestamp and place without creating another roll',()=>{
 const {state,apply}=setup();let s=apply(state,'RecordRoll',{entry:{...entry('older'),futureEntry:{kept:true}}}).state;
 s.rollHistory[0].futureEntry={kept:true};s=apply(s,'RecordRoll',{entry:entry('newer')}).state;freeze(s);
 const r=apply(s,'ReviseRoll',{rollId:'older',result:{...entry(),id:'replacement',at:'2030-01-01',total:22,note:'Devastate',success:true}});
 assert.equal(r.ok,true);assert.equal(r.state.rollHistory.length,2);assert.equal(r.state.rollHistory[1].id,'older');
 assert.equal(r.state.rollHistory[1].at,entry().at);assert.equal(r.state.rollHistory[1].total,22);assert.equal(r.state.rollHistory[1].success,true);
 assert.equal(r.state.rollHistory[1].futureEntry,s.rollHistory[1].futureEntry);assert.equal(s.rollHistory[1].total,17);
 assert.equal(apply(r.state,'ReviseRoll',{rollId:'gone',result:entry()}).ok,false);
});
test('invalid snapshot metadata rejects without changing history or partially recording a result',()=>{
 const {state,apply}=setup();freeze(state);
 for(const patch of [{id:''},{at:'bad time'},{kind:'notice'},{total:Infinity},{total:'17'},{total:undefined}]){
  const r=apply(state,'RecordRoll',{entry:{...entry(),...patch}});assert.equal(r.ok,false);assert.equal(r.patch,undefined);
 }
 const dual=apply(state,'RecordRoll',{entry:{...entry(),kind:'dual',total:null}});assert.equal(dual.ok,true);
});
test('long display details are explicitly shortened and imported unsafe fields never appear in the view',()=>{
 const {state,rolls,apply}=setup();const r=apply(state,'RecordRoll',{entry:{...entry(),math:'x'.repeat(8000),note:'y'.repeat(5000),title:'z'.repeat(300)}});
 assert.equal(r.ok,true);assert.match(r.state.rollHistory[0].math,/details shortened/);assert.ok(r.state.rollHistory[0].math.length<4100);
 const loaded={...state,rollHistory:[{...entry(),acts:[['hurt','Damage']],future:'kept'}]};freeze(loaded);const before=JSON.stringify(loaded);
 assert.equal(rolls.view(loaded)[0].acts,undefined);assert.equal(JSON.stringify(loaded),before);assert.equal(loaded.rollHistory[0].future,'kept');
});
test('unsupported collections and malformed entries are retained during read-only views',()=>{
 const {state,rolls,apply}=setup();const s={...state,rollHistory:{futureSchema:true}};freeze(s);
 assert.equal(rolls.collection(s),null);assert.deepEqual(plain(rolls.view(s)),[]);
 for(const type of ['RecordRoll','ReviseRoll','ClearRollHistory'])assert.equal(apply(s,type,{entry:entry(),rollId:'roll1',result:entry()}).ok,false);
 const malformed={...state,rollHistory:[null,{futureShape:true},entry()]};freeze(malformed);
 assert.equal(rolls.view(malformed).length,1);assert.equal(malformed.rollHistory.length,3);
});
test('clear changes only the history and does not create or undo gameplay actions',()=>{
 const {state,apply}=setup();const s=apply(state,'RecordRoll',{entry:entry()}).state;freeze(s);
 const r=apply(s,'ClearRollHistory');assert.equal(r.ok,true);assert.deepEqual(plain(r.state.rollHistory),[]);
 assert.equal(r.state.fields,s.fields);assert.equal(r.state.consumables,s.consumables);assert.equal(r.state.resources,s.resources);assert.deepEqual(plain(r.events),[]);
});
test('free dice validate the whole expression and safe totals before any caller draws dice',()=>{
 const {rolls}=setup();
 for(const value of ['3d6+2','1d20 - 3','5','0','2D6+1d4'])assert.ok(rolls.freeDicePlan(value),value);
 for(const value of ['','2d6oops','1d6+','1001d6','0d6','2d0','-1d6','1.5','1d6+9007199254740991','9'.repeat(121),{},null])assert.equal(rolls.freeDicePlan(value),null);
});
test('v1 exports and raw legacy files retain history without adding action payloads',()=>{
 const {state,apply,persistence}=setup();const s=apply(state,'RecordRoll',{entry:entry()}).state;
 const file=persistence.exportCharacter(s,'2026-10-31T05:00:00Z');assert.equal(JSON.parse(file).version,1);
 assert.deepEqual(plain(persistence.parseCharacterFile(file).rollHistory),plain(s.rollHistory));
 assert.deepEqual(plain(persistence.parseCharacterFile(JSON.stringify(s)).rollHistory),plain(s.rollHistory));
});
