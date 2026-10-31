const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const context={window:{}};
vm.runInNewContext(read('js/combat-core.js'),context);
vm.runInNewContext(read('js/abilities.js'),context);
vm.runInNewContext(read('js/character-core.js'),context,{filename:'character-core.js'});
const api=context.window.WBCharacter;
const simple=()=>({resources:[{id:'resabcdefg',name:'Rage',max:100,current:80,regen:8,refillOnRest:true,loadoutIds:[]}],abilities:[]});
test('pure derive includes active effects and is read-only',()=>{
 const state=simple();
 state.resources[0].current=150;
 state.abilities=[{durationLeft:2,effects:[{target:'resource-max',resourceId:'resabcdefg',value:100}]}];
 const original=JSON.stringify(state);
 const calc=api.derive(state).resources.resabcdefg;
 assert.equal(calc.baseMax,100);
 assert.equal(calc.effectiveMax,200);
 assert.equal(calc.current,150);
 assert.equal(JSON.stringify(state),original,'derive may not mutate resource state');
});
test('pure spend, gain, and correction commands preserve original and return events',()=>{
 const state=simple(),before=JSON.stringify(state);
 const spent=api.apply(state,{type:'SpendResource',resourceId:'resabcdefg',amount:20});
 assert.equal(spent.ok,true);
 assert.equal(spent.state.resources[0].current,60);
 assert.equal(spent.events.length,1);
 assert.equal(spent.events[0].source,'command');
 assert.equal(JSON.stringify(state),before);
 const gained=api.apply(spent.state,{type:'GainResource',resourceId:'resabcdefg',amount:100});
 assert.equal(gained.state.resources[0].current,100);
 const edit=api.apply(gained.state,{type:'SetResourceCurrent',resourceId:'resabcdefg',value:27});
 assert.equal(edit.events[0].source,'correction');
 assert.equal(edit.state.resources[0].current,27);
});
test('invalid command fails without spending or mutating state',()=>{
 const state=simple(),old=JSON.stringify(state);
 for(const command of [
  {type:'GainResource',resourceId:'resabcdefg',amount:-10},
  {type:'SpendResource',resourceId:'resabcdefg',amount:'oops'},
  {type:'FillResource',resourceId:'missing'},
  {type:'Unknown'}
 ])assert.equal(api.apply(state,command).ok,false);
 assert.equal(JSON.stringify(state),old);
});
test('resource actions never lower existing overflow; manual maximum drop reconciles once',()=>{
 const state=simple();state.resources[0].current=150;
 const filled=api.apply(state,{type:'FillResource',resourceId:'resabcdefg'});
 assert.equal(filled.state.resources[0].current,150);
 const restored=api.apply(state,{type:'GainResource',resourceId:'resabcdefg',amount:5});
 assert.equal(restored.state.resources[0].current,150);
 const regen=api.apply(state,{type:'ResourceTurnStart'});
 assert.equal(regen.state.resources[0].current,150);
 const lower=api.apply({...state,abilities:[{durationLeft:1,effects:[{
  target:'resource-max',resourceId:'resabcdefg',value:100}]}]},
 {type:'SetResourceMaximum',resourceId:'resabcdefg',value:50});
 assert.equal(lower.state.resources[0].current,150,'effective cap is still 150');
 assert.equal(lower.state.resources[0].max,50);
});
test('effect expiration reconciles after state change, not while loading or rendering',()=>{
 const state=simple();
 state.resources[0].current=150;
 state.abilities=[{durationLeft:1,effects:[{target:'resource-max',resourceId:'resabcdefg',value:100}]}];
 const before=api.derive(state).resources.resabcdefg.effectiveMax;
 assert.equal(before,200);
 const expired={...state,abilities:[{...state.abilities[0],durationLeft:0}]};
 assert.equal(api.derive(expired).resources.resabcdefg.current,150);
 const result=api.apply(expired,{type:'ReconcileResourceMaximums',previousMaxima:{resabcdefg:before}});
 assert.equal(result.state.resources[0].current,100);
 assert.equal(expired.resources[0].current,150,'reconcile is pure');
 assert.equal(api.apply(result.state,{type:'ReconcileResourceMaximums',previousMaxima:{resabcdefg:100}}).events.length,0);
});
test('turn regeneration applies only to available forms, rest uses legacy base maximum',()=>{
 const s={resources:[
  {id:'resabcdefg',current:25,max:80,regen:15,refillOnRest:true,loadoutIds:['loadabcdefg']},
  {id:'reshijklmn',current:20,max:100,regen:10,refillOnRest:false,loadoutIds:['loadhijklmn']}
 ],abilityLoadouts:[{id:'loadabcdefg'},{id:'loadhijklmn'}],activeAbilityLoadoutId:'loadabcdefg',abilities:[]};
 const turn=api.apply(s,{type:'ResourceTurnStart'});
 assert.equal(turn.state.resources[0].current,40);
 assert.equal(turn.state.resources[1].current,20);
 const rest=api.apply(turn.state,{type:'ResourceLongRest'});
 assert.equal(rest.state.resources[0].current,80);
 assert.equal(rest.state.resources[1].current,20);
});
