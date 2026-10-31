/* Deterministic, DOM-free character command foundation.
 * Character Health, payments, consumable inventory and ability/form transactions. No automatic triggers.
 */
(function(){
 'use strict';
 const LIMIT=999999;
 const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const numeric=v=>{
   if(typeof v!=='string'&&typeof v!=='number')return NaN;
   const text=String(v).trim().replace(/−/g,'-');
   return text===''?NaN:Number(text);
 };
 const finite=v=>Number.isFinite(numeric(v));
 const amount=v=>finite(v)&&numeric(v)>=0?numeric(v):null;
 const number=(v,defaultValue=0)=>{
   if(v==null||v==='')return defaultValue;
   const n=Number(v);
   return Number.isFinite(n)?Math.max(0,Math.min(LIMIT,Math.round(n))):defaultValue;
 };
 function maximum(state,r){
   let bonus=0;
   for(const a of (Array.isArray(state.abilities)?state.abilities:[])){
     if(!a||!(Number(a.durationLeft)>0))continue;
     for(const e of (Array.isArray(a.effects)?a.effects:[])){
       if(e&&e.target==='resource-max'&&e.resourceId===r.id){
         const n=Number(e.value);
         if(Number.isFinite(n))bonus+=Math.round(n);
       }
     }
   }
   return Math.max(1,number(r.max,1)+bonus);
 }
 function health(state){
   const fields=record(state.fields),over=record(state.over),combat=window.WBCombat,abilities=window.WBAbilities;
   const automatic=combat.characterMaxHealth(state);
   const automaticMax=Number.isFinite(automatic.max)?automatic.max:null;
   const manual=over.hpMax!=null&&String(over.hpMax).trim()!=='';
   const max=manual?(finite(over.hpMax)?numeric(over.hpMax):null):automaticMax;
   const current=finite(fields.hpCur)?numeric(fields.hpCur):max;
   const lv=combat.level(state),bonus=abilities.effectBonus(state,'stat','VIT'),form=abilities.formStatBonus(state,'VIT');
   const score=combat.effectiveScore(state,'VIT',lv,bonus,form);
   const vit=Number.isFinite(score)?score:null;
   const vitModifier=combat.modifier(state,'VIT',lv,bonus,form);
   const trauma=Math.max(0,Math.floor(Number(state.trauma))||0);
   const threshold=combat.deathThreshold(lv,vit,trauma);
   const rawDown=record(state.down);
   const down=current==null||current>0?null:state.down&&typeof state.down==='object'&&!Array.isArray(state.down)?
     {...rawDown,mercy:!!rawDown.mercy,stable:!!rawDown.stable}:{mercy:current<0,stable:false};
   return Object.freeze({automaticMax,max,current,missing:automatic.missing,vit,vitModifier,trauma,threshold,down,
     dead:current!=null&&combat.diesAt(current,threshold)});
 }
 // Loading/configuration/saving may reconcile derived tracker defaults, but
 // rendering is read-only and this reconciliation emits no gameplay events.
 function healthTrackingPatch(state){
   const down=health(state).down;
   return JSON.stringify(down)===JSON.stringify(state.down||null)?{}:{down};
 }
 const healthTypes=new Set(['DamageHealth','HealHealth','SetHealthCurrent','SetHealthMaximum','SetHealthStability','SetHealthTrauma','TreatHealth']);
 function applyHealth(state,command){
   const type=command.type,before=health(state),patch={},combat=window.WBCombat;
   let plan={kind:type,amount:0,recovered:false};
   if(type==='DamageHealth'||type==='HealHealth'){
     const value=amount(command.amount);
     if(value===null)return {ok:false,error:'INVALID_HEALTH_AMOUNT',message:'Enter a finite, nonnegative Health amount.'};
     if(before.current==null)return {ok:false,error:'HEALTH_NOT_CONFIGURED',message:'Set your Health first, or enter VIT so it can be worked out.'};
     const rounded=Math.round(value);
     if(type==='DamageHealth'){
       const outcome=combat.damageHealth(before.current,rounded,before.threshold,before.down);
       if(!Number.isFinite(outcome.after))return {ok:false,error:'INVALID_HEALTH_RESULT',message:'That damage would produce an invalid Health value.'};
       patch.fields={...record(state.fields),hpCur:String(outcome.after)};
       patch.down=outcome.down?{...(before.down||{}),...outcome.down}:null;
       const bleeding=command.source==='bleeding';
       plan={...plan,...outcome,bleeding,
         concentration:!bleeding&&!outcome.dead&&record(state.fields).concOn==='1'&&rounded>before.vitModifier,
         indomitable:outcome.dropped&&!outcome.dead&&before.vit!=null&&before.vit>=21};
     }else{
       const outcome=combat.healHealth(before.current,rounded,before.max,before.trauma);
       if(!Number.isFinite(outcome.after))return {ok:false,error:'INVALID_HEALTH_RESULT',message:'That healing would produce an invalid Health value.'};
       patch.fields={...record(state.fields),hpCur:String(outcome.after)};
       patch.down=outcome.after>0?null:before.down;
       if(outcome.recovered)patch.trauma=outcome.trauma;
       plan={...plan,...outcome};
     }
   }else if(type==='SetHealthCurrent'){
     if(command.value!=null&&command.value!==''&&!finite(command.value))return {ok:false,error:'INVALID_HEALTH_VALUE',message:'Enter a finite Health value, or clear it for full Health.'};
     patch.fields={...record(state.fields),hpCur:command.value==null||command.value===''?'':String(numeric(command.value))};
     Object.assign(patch,healthTrackingPatch({...state,...patch}));
   }else if(type==='SetHealthMaximum'){
     const over={...record(state.over)};
     if(command.value==null||command.value==='')delete over.hpMax;
     else if(!finite(command.value))return {ok:false,error:'INVALID_HEALTH_MAXIMUM',message:'Enter a finite maximum, or clear it for the automatic value.'};
     else over.hpMax=String(numeric(command.value));
     patch.over=over;Object.assign(patch,healthTrackingPatch({...state,...patch}));
   }else if(type==='SetHealthStability'){
     if(typeof command.stable!=='boolean')return {ok:false,error:'INVALID_STABILITY',message:'Choose whether this character is stabilized.'};
     if(before.down)patch.down={...before.down,stable:command.stable};
   }else if(type==='SetHealthTrauma'){
     const value=amount(command.value);
     if(value===null||!Number.isSafeInteger(value))return {ok:false,error:'INVALID_TRAUMA',message:'Enter a whole, nonnegative Trauma value.'};
     patch.trauma=value;Object.assign(patch,healthTrackingPatch({...state,...patch}));
   }else if(type==='TreatHealth'){
     if(before.current==null||before.current>0||before.dead)return {ok:false,error:'TREATMENT_UNAVAILABLE',message:'Treatment is for a living character at 0 Health or below.'};
     patch.fields={...record(state.fields),hpCur:'1'};patch.trauma=before.trauma+1;patch.down=null;plan.recovered=true;
   }
   if((type==='HealHealth'&&plan.amount>0)||type==='TreatHealth'){const statuses=(state.statuses||[]).filter(s=>String(s.preset||s.name).toLowerCase()!=='bleeding');if(statuses.length!==(state.statuses||[]).length)patch.statuses=statuses;}
   if(patch.fields&&health({...state,...patch}).current!=null&&health({...state,...patch}).current<=0){patch.fields.concOn='0';if(plan.concentration)plan.concentration=false;}
   const next={...state,...patch},after=health(next);
   plan={...plan,before:before.current,after:after.current,trauma:after.trauma,threshold:after.threshold};
   const correction=type.startsWith('Set')&&command.source!=='indomitable';
   const events=[];
   if(JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(record(state.fields).hpCur)!==JSON.stringify(record(next.fields).hpCur))
     events.push({type:'health.changed',previous:before,current:after,source:correction?'correction':'command',command:type});
   if(type==='DamageHealth'||type==='HealHealth'||type==='TreatHealth')events.push({type:type==='DamageHealth'?'health.damaged':type==='HealHealth'?'health.healed':'health.treated',
     previous:before.current,current:after.current,amount:plan.amount,
     applied:type==='DamageHealth'?before.current-after.current:after.current-before.current,
     source:command.source==='bleeding'?'bleeding':'command',command:type});
   return {ok:true,state:next,patch,events,healthPlan:plan,log:events.map(event=>type+': '+event.type),message:'Health updated.'};
 }
 function derive(state){
   const resources=Object.create(null);
   for(const r of (Array.isArray(state.resources)?state.resources:[])){
     if(!r||typeof r.id!=='string')continue;
     resources[r.id]=Object.freeze({
       current:number(r.current),
       baseMax:Math.max(1,number(r.max,1)),
       effectiveMax:maximum(state,r)
     });
   }
   const fields=record(state.fields),over=record(state.over),combat=window.WBCombat;
   const max=combat.apMaximum(state);
   const own=combat.trackerAvailable(state.apAvail==null?null:
     finite(state.apAvail)?numeric(state.apAvail):0,max);
   const rawGiven=record(state.apGiven).n;
   const given=finite(rawGiven)?Math.max(0,Math.min(40,numeric(rawGiven))):0;
   const ap=Object.freeze({max,own,given,total:own+given});
   const automaticMax=combat.characterMaxMana(state);
   const manaMax=finite(over.mpMax)?numeric(over.mpMax):automaticMax;
   const blank=fields.mpCur==null||String(fields.mpCur).trim()==='';
   const current=blank?(manaMax==null?null:Math.max(0,manaMax)):
     Math.max(0,finite(fields.mpCur)?numeric(fields.mpCur):0);
   const visible=window.WBAbilities.formManaAvailable(state);
   const configured=manaMax!=null&&Number.isFinite(manaMax)&&manaMax>0;
   const mana=Object.freeze({kind:fields.manaKind==='holy'?'holy':'mana',
     automaticMax,max:manaMax,current,visible,configured,available:visible&&configured});
   const reactionMax=combat.reactionMaximum(state,window.WBAbilities.effectBonus(state,'stat','AGL'),window.WBAbilities.formStatBonus(state,'AGL'));
   const reactions=Object.freeze({max:reactionMax,current:combat.trackerAvailable(state.reactAvail==null?null:
     finite(state.reactAvail)?numeric(state.reactAvail):0,reactionMax)});
   return {resources,ap,mana,reactions,health:health(state)};
 }
 const poolTypes=new Set(['SpendAP','RefundAP','SetAPCurrent','SetAPMaximum',
   'SpendMana','SetManaCurrent','SetManaMaximum','SpendPools']);
 function applyPools(state,command){
   const before=derive(state),patch={},type=command.type;
   const combat=window.WBCombat;
   const normalized={...state,apGiven:state.apGiven?
     {...state.apGiven,n:before.ap.given}:null};
   if(['SpendAP','SpendMana','SpendPools'].includes(type)){
     const ap=type==='SpendAP'?amount(command.amount):type==='SpendPools'?
       amount(command.ap===undefined?0:command.ap):0;
     const mana=type==='SpendMana'?amount(command.amount):type==='SpendPools'?
       amount(command.mana===undefined?0:command.mana):0;
     if(ap===null||mana===null)return {ok:false,error:'INVALID_AMOUNT'};
     // Validate both pools before making any patch; failed payments are inert.
     if(ap>before.ap.total)return {ok:false,error:'INSUFFICIENT_AP'};
     if(mana>0){
       if(!before.mana.configured)return {ok:false,error:'MANA_NOT_CONFIGURED'};
       if(!before.mana.visible&&command.allowHiddenMana!==true)
         return {ok:false,error:'MANA_UNAVAILABLE'};
       if(mana>before.mana.current)return {ok:false,error:'INSUFFICIENT_MANA'};
     }
     if(ap>0)Object.assign(patch,combat.spendAp(normalized,before.ap.own,ap));
     if(mana>0)patch.fields={...record(state.fields),mpCur:String(before.mana.current-mana)};
   }else if(type==='RefundAP'){
     const n=amount(command.amount);
     if(n===null)return {ok:false,error:'INVALID_AMOUNT'};
     if(n>0)Object.assign(patch,combat.refundAp(normalized,before.ap.own,before.ap.max,n));
   }else if(type==='SetAPCurrent'){
     if(command.value==null||command.value==='')patch.apAvail=null;
     else if(!finite(command.value))return {ok:false,error:'INVALID_VALUE'};
     else patch.apAvail=Math.max(0,Math.min(before.ap.max,numeric(command.value)));
   }else{
     // Corrections retain blank/full sentinels and manually entered balances,
     // including above-max/negative Mana. Derived spendable Mana is never negative.
     const value=command.value;
     if(value!==''&&value!=null&&!finite(value))return {ok:false,error:'INVALID_VALUE'};
     const text=value==null?'':String(value);
     if(type==='SetManaMaximum'){
       patch.over={...record(state.over)};
       if(text.trim()==='')delete patch.over.mpMax;else patch.over.mpMax=text;
     }else{
       const key=type==='SetAPMaximum'?'apMax':'mpCur';
       patch.fields={...record(state.fields),[key]:text};
     }
   }
   const next={...state,...patch},after=derive(next),events=[];
   const correction=type.startsWith('Set');
   for(const pool of ['ap','mana']){
     const a=after[pool],b=before[pool];
     if(JSON.stringify(a)===JSON.stringify(b))continue;
     events.push({type:pool+'.changed',previous:b,current:a,
       source:correction?'correction':'command',command:type});
   }
   return {ok:true,state:next,patch,events,log:events.map(e=>type+': '+e.type+' '+
     (e.type==='ap.changed'?e.previous.total:e.previous.current)+' -> '+
     (e.type==='ap.changed'?e.current.total:e.current.current))};
 }
 const transactionTypes=new Set(['ActivateAbility','EnterForm','SelectPortrait']);
 // A rest receipt is memory-only and deliberately excludes portraits, notes,
 // inventory, consumables, history, manual statuses and DM/game data.
 const restKeys=['abilities','milestoneUses','resources','wonderAvail','apAvail','reactAvail','apGiven','move',
   'parryUsed','parryOutsideSpent','spent','equipmentOutsideSpent','trauma','down'];
 const transitionKeys=[...restKeys,'fields','statuses'];
 const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 function restReceipt(state){
   const snapshot=(object,keys)=>Object.fromEntries(keys.map(key=>[key,
     {present:Object.prototype.hasOwnProperty.call(object,key),value:copy(object[key])}]));
   return {version:1,values:snapshot(state,restKeys),fields:snapshot(record(state.fields),['hpCur','mpCur','concOn'])};
 }
 function undoLongRest(state,command){
   const receipt=record(command.receipt),values=record(receipt.values),fields=record(receipt.fields);
   if(receipt.version!==1||!restKeys.every(key=>typeof record(values[key]).present==='boolean')||
     !['hpCur','mpCur','concOn'].every(key=>typeof record(fields[key]).present==='boolean'))
     return {ok:false,error:'INVALID_REST_RECEIPT',message:'There is no valid long rest to undo.'};
   const patch={fields:{...record(state.fields)}},removedKeys=[];
   for(const key of restKeys){
     if(values[key].present)patch[key]=copy(values[key].value);
     else {patch[key]=undefined;removedKeys.push(key);}
   }
   for(const key of ['hpCur','mpCur','concOn']){
     if(fields[key].present)patch.fields[key]=copy(fields[key].value);
     else delete patch.fields[key];
   }
   const next={...state,...patch};for(const key of removedKeys)delete next[key];
   return {ok:true,state:next,patch,removedKeys,restoreRecords:true,events:[],log:[],message:'Long rest undone.'};
 }
 function applyTurnRest(state,command){
   const type=command.type,rest=type==='LongRest',next={...state},events=[];
   // Helpers see only private owned records. A failed late stage cannot leak
   // earlier regeneration, timer ticks, tracker resets or settlement.
   for(const key of transitionKeys)if(state[key]!==undefined)next[key]=copy(state[key]);
   next.fields={...record(next.fields)};
   let bleeding=null;
   const run=(nested,stage)=>{
     const result=apply(next,nested);
     if(!result.ok)throw Error(result.error);
     if(result.patch)Object.assign(next,result.patch);
     else next.resources=result.state.resources;
     events.push(...result.events.map(event=>({...event,command:type,stage})));
     return result;
   };
   try{
     const before=derive(state);
     next.apAvail=null;next.reactAvail=null;next.parryUsed=false;next.move=null;
     next.apGiven=!rest&&state.apGiven&&state.apGiven.fresh&&state.apGiven.n>0?
       {n:state.apGiven.n,fresh:false}:null;
     if(rest){
       run({type:'ResourceLongRest'},'resources');
       run({type:'RestAbilities'},'abilities');
       const pools=derive(next);
       if(pools.health.max!=null)next.fields.hpCur=String(pools.health.max);
       if(pools.mana.max!=null)next.fields.mpCur=String(pools.mana.max);
       next.wonderAvail=null;next.parryOutsideSpent=0;next.trauma=0;next.down=null;
     }else{
       const previousMaxima=Object.fromEntries(Object.entries(before.resources).map(([id,r])=>[id,r.effectiveMax]));
       run({type:'ResourceTurnStart'},'regeneration');
       run({type:'AdvanceAbilityTurn'},'abilities');
       run({type:'ReconcileResourceMaximums',previousMaxima},'maximums');
       window.WBStatus.advanceTurn(next);
       if(JSON.stringify(state.statuses||[])!==JSON.stringify(next.statuses||[]))
         events.push({type:'statuses.changed',previous:copy(state.statuses||[]),current:copy(next.statuses||[]),command:type,stage:'statuses'});
       const h=health(next);
       if(h.current!=null&&h.current<=0&&!(h.down||{}).stable&&!h.dead)
         bleeding=run({type:'DamageHealth',amount:4,source:'bleeding'},'bleeding').healthPlan;
     }
     Object.assign(next,healthTrackingPatch(next));
     const after=derive(next),patch={};
     for(const key of transitionKeys)if(JSON.stringify(state[key])!==JSON.stringify(next[key]))patch[key]=next[key];
     for(const [id,current] of Object.entries(after.resources)){
       const previous=before.resources[id];
       if(previous&&previous.effectiveMax!==current.effectiveMax)
         events.push({type:'resource.maximum.changed',resourceId:id,previous:previous.effectiveMax,
           current:current.effectiveMax,command:type,stage:'complete'});
     }
     for(const pool of ['ap','mana','reactions'])if(JSON.stringify(before[pool])!==JSON.stringify(after[pool]))
       events.push({type:pool+'.changed',previous:before[pool],current:after[pool],command:type,stage:'complete'});
     if(rest&&JSON.stringify(before.health)!==JSON.stringify(after.health))
       events.push({type:'health.changed',previous:before.health,current:after.health,source:'rest',command:type,stage:'complete'});
     events.push({type:rest?'rest.completed':'turn.started',previous:before,current:after,command:type});
     return {ok:true,state:next,patch,events,log:events.map(e=>type+': '+e.type),
       transitionPlan:{bleeding},...(rest?{restReceipt:restReceipt(state)}:{}),message:rest?'Long rest completed.':'Turn started.'};
   }catch(error){return {ok:false,error:'TRANSACTION_FAILED',message:'The '+(rest?'long rest':'turn')+' could not be completed. Nothing changed.'};}
 }
 const lifecycleTypes=new Set(['StartCombat','EndCombat','AdvanceAbilityTurn','RestAbilities']);
 function applyAbilityLifecycle(state,command){
   const type=command.type,abilities=window.WBAbilities;
   if(type==='StartCombat'&&state.inCombat===true||type==='EndCombat'&&state.inCombat!==true)
     return {ok:true,state,patch:{},events:[],log:[],message:type==='StartCombat'?'Already in combat.':'Already outside combat.'};
   const patch={},next={...state,abilities:(state.abilities||[]).map(a=>({...a}))};
   if(type==='StartCombat'){
     patch.inCombat=true;next.inCombat=true;patch.parryUsed=false;
     for(const a of next.abilities)if(['combat','round'].includes(a.usesPer))a.usesLeft=a.uses===''?null:a.uses;
   }else if(type==='EndCombat'){patch.inCombat=false;next.inCombat=false;}
   else if(type==='AdvanceAbilityTurn')abilities.advanceTurn(next);
   else abilities.resetForRest(next);
   const events=[];
   if(type==='StartCombat'||type==='EndCombat')events.push({type:type==='StartCombat'?'combat.started':'combat.ended',command:type});
   const snapshot=a=>({usesLeft:a.usesLeft,outsideUsesSpent:a.outsideUsesSpent||0,
     cooldownLeft:a.cooldownLeft,durationLeft:a.durationLeft});
   for(let i=0;i<next.abilities.length;i++){
     const previous=snapshot(state.abilities[i]),current=snapshot(next.abilities[i]);
     if(JSON.stringify(previous)!==JSON.stringify(current))events.push({type:'ability.changed',abilityId:next.abilities[i].id,previous,current,command:type});
   }
   if(JSON.stringify(next.abilities)!==JSON.stringify(state.abilities||[]))patch.abilities=next.abilities;
   const milestoneUses=abilities.milestoneLifecycle(next,type);
   if(JSON.stringify(milestoneUses)!==JSON.stringify(state.milestoneUses||{})){
     patch.milestoneUses=milestoneUses;
     for(const [id,current] of Object.entries(milestoneUses)){
       const previous=record(state.milestoneUses)[id];
       if(JSON.stringify(previous)!==JSON.stringify(current))events.push({type:'milestone.changed',milestoneId:id,previous,current,command:type});
     }
   }
   const equipment=abilities.equipmentLifecycle(next,type);
   for(const key of ['spent','equipmentOutsideSpent'])if(JSON.stringify(equipment[key])!==JSON.stringify(state[key]||{})){
     patch[key]=equipment[key];events.push({type:'equipment.uses.changed',pool:key,previous:state[key]||{},current:equipment[key],command:type});
   }
   return {ok:true,state:{...state,...patch},patch,events,log:events.map(e=>type+': '+e.type),
     message:type==='StartCombat'?'Combat started. Combat and round uses restored.':type==='EndCombat'?'Combat ended. Outside uses retained.':'Ability trackers updated.'};
 }
 function applyTransaction(state,command){
   const type=command.type,abilities=window.WBAbilities;
   const reject=(error,message)=>({ok:false,error,message});
   if(type==='ActivateAbility'&&typeof command.abilityId!=='string'||
      type==='EnterForm'&&typeof command.formId!=='string'||
      type==='SelectPortrait'&&typeof command.portraitId!=='string')
     return reject('INVALID_COMMAND','Choose an existing ability, form or portrait.');
   // Copy only paths owned by these operations. Portrait image strings, history
   // and unknown data stay shared/read-only; no normalization or new ids here.
   const next={...state};
   for(const key of ['fields','apGiven','equip'])
     if(state[key]&&typeof state[key]==='object')next[key]={...state[key]};
   for(const key of ['abilities','resources'])
     if(Array.isArray(state[key]))next[key]=state[key].map(item=>item?{...item}:item);
   if(state.equipmentProfiles)next.equipmentProfiles=Object.fromEntries(
     Object.entries(state.equipmentProfiles).map(([id,profile])=>[id,{...record(profile)}]));
   // Existing WBAbilities/WBEquipment rules operate only on the private copy.
   // Every payment uses B1's primitives; no external callbacks or DOM values.
   const commit=result=>{
     if(!result.ok)throw new Error(result.error);
     Object.assign(next,result.patch);
     return result;
   };
   const controls={
     getAp:()=>derive(next).ap.total,
     getMana:()=>{const mana=derive(next).mana;return mana.configured?mana.current:null;},
     spendAp:n=>commit(applyPools(next,{type:'SpendAP',amount:n})),
     spendMana:n=>commit(applyPools(next,{type:'SpendMana',amount:n})),
     planPools:costs=>applyPools(next,{type:'SpendPools',...costs}),
     commitPools:commit
   };
   let result;
   try{
     if(type==='ActivateAbility'){
       result=abilities.activate(next,command.abilityId,controls);
       if(!result.ok)return reject('ABILITY_REJECTED',result.message);
     }else{
       const formId=type==='EnterForm'?command.formId:abilities.portraitForm(next,command.portraitId);
       if(formId===null)return reject('PORTRAIT_NOT_FOUND','That portrait no longer exists.');
       const payment=abilities.entryCost(next,formId,controls);
       if(!payment.ok)return reject('FORM_REJECTED',payment.message);
       const switched=type==='EnterForm'?abilities.selectLoadout(next,formId,controls):
         abilities.selectPortrait(next,command.portraitId,controls);
       if(!switched)return reject('FORM_REJECTED','Could not switch forms. No costs were spent.');
       const form=(next.abilityLoadouts||[]).find(f=>f.id===next.activeAbilityLoadoutId);
       result={message:form?'Active form: '+form.name:'Base form: shared abilities only.'};
     }
   }catch(error){return reject('TRANSACTION_FAILED','The character change could not be completed. No costs were spent.');}
   if(type==='ActivateAbility'){
     const ability=next.abilities.find(a=>a.id===command.abilityId);
     for(const key of ['usesLeft','outsideUsesSpent','capacityCurrent','cooldownLeft','durationLeft'])
       if(ability[key]!=null&&(!finite(ability[key])||numeric(ability[key])<0))
         return reject('INVALID_CHARACTER_STATE','This ability has unreadable tracker values. No costs were spent.');
   }
   for(const resource of (next.resources||[])){
     const previous=(state.resources||[]).find(r=>r.id===resource.id);
     if(previous&&previous.current!==resource.current&&
       (!finite(resource.current)||numeric(resource.current)<0))
       return reject('INVALID_CHARACTER_STATE','The resource balance could not be read. No costs were spent.');
   }
   const patch={};
   for(const key of ['fields','apAvail','apGiven','abilities','resources','equip',
     'equipmentProfiles','activeAbilityLoadoutId','formId'])
     if(JSON.stringify(state[key])!==JSON.stringify(next[key]))patch[key]=next[key];
   const before=derive(state),after=derive(next),events=[];
   const emit=(event)=>events.push({...event,source:'command',command:type});
   for(const pool of ['ap','mana'])
     if(JSON.stringify(before[pool])!==JSON.stringify(after[pool]))
       emit({type:pool+'.changed',previous:before[pool],current:after[pool]});
   for(const [id,current] of Object.entries(after.resources)){
     const previous=before.resources[id];
     if(previous&&JSON.stringify(previous)!==JSON.stringify(current))
       emit({type:'resource.changed',resourceId:id,previous:previous.current,current:current.current,
         previousMaximum:previous.effectiveMax,currentMaximum:current.effectiveMax});
   }
   if(type==='ActivateAbility'){
     const snapshot=s=>{
       const a=s.abilities.find(a=>a.id===command.abilityId);
       return {usesLeft:a.usesLeft,outsideUsesSpent:a.outsideUsesSpent||0,cooldownLeft:a.cooldownLeft,
         durationLeft:a.durationLeft,capacityCurrent:a.capacityCurrent};
     };
     emit({type:'ability.used',abilityId:command.abilityId,previous:snapshot(state),current:snapshot(next)});
   }else{
     if(state.activeAbilityLoadoutId!==next.activeAbilityLoadoutId){
       if(state.activeAbilityLoadoutId)emit({type:'form.left',formId:state.activeAbilityLoadoutId});
       if(next.activeAbilityLoadoutId)emit({type:'form.entered',formId:next.activeAbilityLoadoutId});
     }
     if(state.formId!==next.formId)emit({type:'portrait.changed',previous:state.formId??null,current:next.formId??null});
     if(JSON.stringify(record(state.equip))!==JSON.stringify(record(next.equip)))
       emit({type:'equipment.changed',previous:{...record(state.equip)},current:{...record(next.equip)}});
   }
   return {ok:true,state:{...state,...patch},patch,events,message:result.message,
     ...(result.rollPlan?{rollPlan:result.rollPlan}:{}),
     log:[result.message,...events.map(e=>type+': '+e.type)]};
 }
 function applyMilestone(state,command){
   const id=command.milestoneId,abilities=window.WBAbilities;
   const milestone=typeof id==='string'?abilities.milestoneAction(state,id):null;
   if(!milestone)return {ok:false,error:'MILESTONE_NOT_FOUND',message:'Choose an existing milestone action.'};
   const previous={...record(record(state.milestoneUses)[id])};
   if(command.type==='SetMilestoneUses'){
     const value=amount(command.value);
     if(value===null)return {ok:false,error:'INVALID_VALUE',message:'Enter a nonnegative number of uses.'};
     const remaining=Math.min(milestone.usage.maximum,Math.round(value));
     const current={...previous,usesLeft:milestone.ability.usesLeft,outsideUsesSpent:milestone.ability.outsideUsesSpent};
     if(milestone.usage.outside)current.outsideUsesSpent=milestone.usage.maximum-remaining;
     else current.usesLeft=remaining;
     const patch={milestoneUses:{...record(state.milestoneUses),[id]:current}};
     const events=[{type:'milestone.changed',milestoneId:id,previous,current,source:'correction',command:command.type}];
     return {ok:true,state:{...state,...patch},patch,events,log:[],message:'Adjusted '+milestone.name+' uses.'};
   }
   if(!milestone.unlocked)return {ok:false,error:'MILESTONE_LOCKED',message:milestone.name+' unlocks at '+milestone.stat+' '+milestone.at+'.'};
   // Adapt built-in actions to the same atomic activation path, without adding
   // generated entries to the player's editable Ability Library.
   const working={...state,abilities:[milestone.ability,...(state.abilities||[])]};
   const result=applyTransaction(working,{type:'ActivateAbility',abilityId:milestone.ability.id});
   if(!result.ok)return result;
   const used=result.state.abilities[0];
   const current={...previous,usesLeft:used.usesLeft,outsideUsesSpent:used.outsideUsesSpent};
   const patch={...result.patch,milestoneUses:{...record(state.milestoneUses),[id]:current}};
   delete patch.abilities;
   const events=result.events.map(event=>event.type==='ability.used'?
     {type:'milestone.used',milestoneId:id,previous:{usesLeft:milestone.ability.usesLeft,outsideUsesSpent:milestone.ability.outsideUsesSpent},
       current:{usesLeft:used.usesLeft,outsideUsesSpent:used.outsideUsesSpent},command:'UseMilestone'}:
     {...event,command:'UseMilestone'});
   return {ok:true,state:{...state,...patch},patch,events,message:result.message,milestonePlan:milestone.plan,
     log:events.map(e=>'UseMilestone: '+e.type)};
 }
 function beginWeaponAttack(state,command){
   const plan=window.WBAbilities.weaponAttackPlan(state,command.slot);
   if(!plan.ok)return {ok:false,error:'INVALID_WEAPON',message:plan.message};
   const shots={...record(state.weaponShots)};
   for(const source of [plan.main,plan.off].filter(Boolean))if(source.loading){
     const remaining=shots[source.weaponId]==null?source.loading:Number(shots[source.weaponId]);
     if(!Number.isFinite(remaining)||remaining<1)return {ok:false,error:'RELOAD_REQUIRED',message:source.name+' needs reloading (5 AP).'};
     shots[source.weaponId]=remaining-1;
   }
   const payment=command.payment===undefined?'ap':command.payment;
   if(!['ap','reaction'].includes(payment))return {ok:false,error:'INVALID_PAYMENT',message:'Choose AP or a reaction for this weapon attack.'};
   const before=derive(state);
   let patch={weaponShots:shots},events=[];
   if(payment==='ap'){
     const paid=applyPools(state,{type:'SpendAP',amount:plan.apCost});
     if(!paid.ok)return {ok:false,error:paid.error,message:'Not enough AP for this weapon attack.'};
     patch={...patch,...paid.patch};events=paid.events.map(e=>({...e,command:'BeginWeaponAttack'}));
   }else{
     if(before.reactions.current<1)return {ok:false,error:'INSUFFICIENT_REACTIONS',message:'No reactions left. They come back at the start of your turn.'};
     patch.reactAvail=before.reactions.current-1;
     events.push({type:'reactions.changed',previous:before.reactions.current,current:patch.reactAvail,command:'BeginWeaponAttack'});
   }
   const singularityHand=command.singularityHand||'';
   if(singularityHand){
     if(!['main','off','strapped'].includes(singularityHand)||!plan.dual&&singularityHand!==command.slot)
       return {ok:false,error:'INVALID_SINGULARITY_HAND',message:'Choose one hand making this weapon attack.'};
     const used=applyMilestone({...state,...patch},{type:'UseMilestone',milestoneId:'singularity'});
     if(!used.ok)return used;
     patch={...patch,...used.patch};events.push(...used.events.map(e=>({...e,command:'BeginWeaponAttack'})));
   }
   const weaponAttack={...plan,payment,apSpent:payment==='ap'?plan.apCost:0,singularityHand};
   events.push({type:'weapon.attack.prepared',slot:plan.slot,payment,command:'BeginWeaponAttack'});
   return {ok:true,state:{...state,...patch},patch,events,weaponAttack,message:'Weapon attack prepared.',log:events.map(e=>'BeginWeaponAttack: '+e.type)};
 }
 function applyEquipmentAbility(state,command){
   const itemId=command.itemId,index=command.abilityIndex,abilities=window.WBAbilities;
   const data=abilities.equipmentAbility(state,itemId,index);
   if(!data)return {ok:false,error:'EQUIPMENT_ABILITY_NOT_FOUND',message:'Choose an existing equipment ability.'};
   if(!data.usage.limited)return {ok:false,error:'UNLIMITED_EQUIPMENT_ABILITY',message:'This equipment ability has no use limit to track.'};
   const key=data.usage.outside?'equipmentOutsideSpent':'spent';
   const previous=data.usage.outside?data.ability.outsideUsesSpent:data.spent;
   let current;
   if(command.type==='SetEquipmentAbilityUses'){
     const value=amount(command.value);
     if(value===null)return {ok:false,error:'INVALID_VALUE',message:'Enter a nonnegative number of uses.'};
     current=data.usage.maximum-Math.min(data.usage.maximum,Math.round(value));
   }else{
     if(data.usage.remaining<=0)return {ok:false,error:'NO_EQUIPMENT_USES',message:data.ability.name+' has no uses left until the next '+data.usage.period+'.'};
     const working={...state,abilities:[data.ability,...(state.abilities||[])]};
     const used=applyTransaction(working,{type:'ActivateAbility',abilityId:data.ability.id});
     if(!used.ok)return used;
     const ability=used.state.abilities[0];
     current=data.usage.outside?ability.outsideUsesSpent:data.ability.uses-ability.usesLeft;
   }
   const patch={[key]:{...record(state[key]),[itemId]:{...record(record(state[key])[itemId]),[index]:current}}};
   const correction=command.type==='SetEquipmentAbilityUses';
   const events=[{type:correction?'equipment.ability.corrected':'equipment.ability.used',itemId,abilityIndex:index,previous,current,
     period:data.usage.period,source:correction?'correction':'command',command:command.type}];
   return {ok:true,state:{...state,...patch},patch,events,log:events.map(e=>command.type+': '+e.type),
     message:(correction?'Adjusted ':'Used ')+data.ability.name+'.',equipmentAbilityPlan:{name:data.ability.name,effect:String(data.definition.effect||'')}};
 }
 const consumables=state=>state.consumables==null?[]:Array.isArray(state.consumables)?state.consumables:null;
 const consumableQuantity=value=>finite(value)&&Number.isSafeInteger(numeric(value))&&numeric(value)>=0?numeric(value):null;
 function consumableHealing(value){
   if(value==null||typeof value==='string'&&value.trim()==='')return {ok:true,healing:null};
   const healing=typeof value==='string'?window.WBCombat.parseDamageDice(value):null;
   if(!healing||!Number.isSafeInteger(healing.maximum+healing.flat))
     return {ok:false,error:'INVALID_HEALING_DICE',message:'Enter complete healing dice such as 2d6+2, or leave healing blank.'};
   return {ok:true,healing};
 }
 const consumableTypes=new Set(['AddConsumable','EditConsumable','SetConsumableQuantity','UseConsumable','RemoveConsumable']);
 function applyConsumable(state,command){
   const list=consumables(state),type=command.type;
   if(!list)return {ok:false,error:'UNSUPPORTED_CONSUMABLES',message:'The consumables in this save could not be read. Their saved data has been kept.'};
   const data=record(command.consumable),id=type==='AddConsumable'?data.id:command.consumableId;
   if(typeof id!=='string'||!id.trim())return {ok:false,error:'INVALID_CONSUMABLE_ID',message:'Choose an existing consumable.'};
   const matches=list.map((item,index)=>item&&item.id===id?index:-1).filter(index=>index>=0);
   if(type==='AddConsumable'&&matches.length)return {ok:false,error:'DUPLICATE_CONSUMABLE',message:'That consumable already exists.'};
   if(type!=='AddConsumable'&&matches.length!==1)return {ok:false,error:'CONSUMABLE_NOT_FOUND',message:'Choose one existing consumable with a unique saved identifier.'};
   const index=matches[0],previous=index===undefined?null:list[index];
   let current,plan;
   if(type==='AddConsumable'||type==='EditConsumable'){
     if(typeof data.name!=='string'||!data.name.trim())return {ok:false,error:'INVALID_CONSUMABLE_NAME',message:'Give this consumable a name.'};
     const roll=consumableHealing(data.healingDice);if(!roll.ok)return roll;
     const quantity=type==='AddConsumable'?consumableQuantity(data.quantity):previous.quantity;
     if(type==='AddConsumable'&&quantity===null)return {ok:false,error:'INVALID_QUANTITY',message:'Enter a whole quantity of zero or more.'};
     current={...(previous||data),id,name:data.name.trim(),description:typeof data.description==='string'?data.description:'',
       healingDice:typeof data.healingDice==='string'?data.healingDice.trim():'',quantity};
   }else if(type==='SetConsumableQuantity'){
     const quantity=consumableQuantity(command.value);
     if(quantity===null)return {ok:false,error:'INVALID_QUANTITY',message:'Enter a whole quantity of zero or more.'};
     current={...previous,quantity};
   }else if(type==='UseConsumable'){
     const quantity=consumableQuantity(previous.quantity);
     if(quantity===null)return {ok:false,error:'INVALID_QUANTITY',message:'Set a whole quantity before using this consumable.'};
     if(quantity===0)return {ok:false,error:'NO_CONSUMABLES_LEFT',message:'None of this consumable remain. Correct the quantity when you restock.'};
     const roll=consumableHealing(previous.healingDice);if(!roll.ok)return roll;
     current={...previous,quantity:quantity-1};
     plan={id,name:String(previous.name||'Consumable'),description:typeof previous.description==='string'?previous.description:'',healing:roll.healing};
   }
   const next=list.slice();
   if(type==='AddConsumable')next.push(current);
   else if(type==='RemoveConsumable')next.splice(index,1);
   else next[index]=current;
   const patch={consumables:next};
   const event={type:type==='UseConsumable'?'consumable.used':type==='SetConsumableQuantity'?'consumable.quantity.corrected':
     type==='AddConsumable'?'consumable.added':type==='RemoveConsumable'?'consumable.removed':'consumable.edited',
     consumableId:id,previous:previous||null,current:current||null,source:type==='UseConsumable'?'command':type==='SetConsumableQuantity'?'correction':'configuration',command:type};
   return {ok:true,state:{...state,...patch},patch,events:[event],log:[type+': '+id],
     ...(plan?{consumablePlan:plan}:{}),message:type==='UseConsumable'?'Used one '+plan.name+'.':'Consumables updated.'};
 }
 function applyTracker(state,command){
   const type=command.type;
   if(['SetReactionCurrent','SpendReaction','SetWonderCurrent','SpendWonder'].includes(type)){
     const wonder=type.includes('Wonder'),key=wonder?'wonderAvail':'reactAvail';
     const max=wonder?window.WBCombat.trackerMax(record(state.over).wonderMax,Math.max(0,window.WBCombat.currentModifier(state,'FTH'))):derive(state).reactions.max;
     const before=state[key]==null?max:number(state[key]),spend=type.startsWith('Spend');
     if(spend&&before<1)return {ok:false,error:'TRACKER_EMPTY',message:'No '+(wonder?'Wonder uses':'reactions')+' left.'};
     if(!spend&&command.value!=null&&command.value!==''&&!finite(command.value))return {ok:false,error:'INVALID_VALUE'};
     const value=spend?before-1:command.value==null||command.value===''?null:Math.max(0,Math.min(max,numeric(command.value)));
     const patch={[key]:value};return {ok:true,state:{...state,...patch},patch,events:[{type:(wonder?'wonder':'reactions')+'.changed',previous:before,current:value??max,source:spend?'command':'correction'}],log:[]};
   }
   const abilities=(state.abilities||[]).map(a=>({...a})),ability=abilities.find(a=>a.id===command.abilityId);
   if(!ability)return {ok:false,error:'ABILITY_NOT_FOUND',message:'Choose an existing ability.'};
   const usage=window.WBAbilities.usageState(state,ability);
   if(type==='EndAbilityEffect')ability.durationLeft=0;
   else if(type==='ReleaseAbilityCapacity')ability.capacityCurrent=Math.max(0,number(ability.capacityCurrent)-1);
   else if(type==='ResetAbilityTracker'){
     ability.cooldownLeft=0;ability.durationLeft=0;
     if(usage.outside)ability.outsideUsesSpent=0;else ability.usesLeft=ability.uses===''?null:ability.uses;
   }else{
     if(!['usesLeft','cooldownLeft','durationLeft','capacityCurrent'].includes(command.field)||amount(command.value)===null)return {ok:false,error:'INVALID_TRACKER',message:'Enter a nonnegative tracker value.'};
     const value=number(command.value);
     if(command.field==='usesLeft'&&usage.limited){const remaining=Math.min(usage.maximum,value);if(usage.outside)ability.outsideUsesSpent=usage.maximum-remaining;else ability.usesLeft=remaining;}
     else ability[command.field]=command.field==='capacityCurrent'&&ability.capacityMax!==''?Math.min(Number(ability.capacityMax)||0,value):value;
   }
   const patch={abilities};return {ok:true,state:{...state,...patch},patch,events:[{type:'ability.changed',abilityId:ability.id,source:'correction',command:type}],log:[],message:'Updated '+ability.name+'.'};
 }
 function applyRaw(state,command){
   if(!state||typeof state!=='object'||Array.isArray(state)||!command||typeof command!=='object'||Array.isArray(command))
     return {ok:false,error:'INVALID_COMMAND'};
   if(['SetReactionCurrent','SpendReaction','SetWonderCurrent','SpendWonder','SetAbilityTracker','ResetAbilityTracker','ReleaseAbilityCapacity','EndAbilityEffect'].includes(command.type))return applyTracker(state,command);
   if(command.type==='EndManualStatus'){
     const patch={statuses:(state.statuses||[]).filter(status=>status.id!==command.statusId)};
     return {ok:true,state:{...state,...patch},patch,events:[],log:[],message:'Condition ended.'};
   }
   if(command.type==='StandUp'){
     const result=applyPools(state,{type:'SpendAP',amount:5});if(!result.ok)return {...result,message:'Standing up costs 5 AP.'};
     const patch={...result.patch,statuses:(state.statuses||[]).filter(s=>s.id!==command.statusId)};
     return {...result,state:{...state,...patch},patch,message:'Stood up for 5 AP.'};
   }
   if(command.type==='BeginShakeItOff'){
     const status=(state.statuses||[]).find(status=>status.id===command.statusId);
     if(!status||!['bleeding','burning','poisoned'].includes(String(status.preset||status.name).toLowerCase()))return {ok:false,error:'INELIGIBLE_STATUS',message:'Choose Bleeding, Burning or Poisoned.'};
     const dc=amount(command.dc??status.dc);if(dc===null)return {ok:false,error:'MISSING_DC',message:'Enter the effect DC before rolling Shake It Off.'};
     const modifier=window.WBCombat.currentModifier(state,'VIT'),cost=window.WBCombat.abilityApCost(5,modifier);
     const result=applyPools(state,{type:'SpendAP',amount:cost});
     return result.ok?{...result,shakePlan:{statusId:status.id,characterId:state.id,modifier,dc,cost},message:'Shake It Off: '+cost+' AP.'}:{...result,message:'Not enough AP for Shake It Off.'};
   }
   if(poolTypes.has(command.type))return applyPools(state,command);
   if(healthTypes.has(command.type))return applyHealth(state,command);
   if(transactionTypes.has(command.type))return applyTransaction(state,command);
   if(command.type==='StartTurn'||command.type==='LongRest')return applyTurnRest(state,command);
   if(command.type==='UndoLongRest')return undoLongRest(state,command);
   if(lifecycleTypes.has(command.type))return applyAbilityLifecycle(state,command);
   if(command.type==='UseMilestone'||command.type==='SetMilestoneUses')return applyMilestone(state,command);
   if(command.type==='DrinkConsumable'){
     const used=applyConsumable(state,{...command,type:'UseConsumable'});if(!used.ok)return used;
     const cost=window.WBCombat.abilityApCost(5,window.WBCombat.currentModifier(state,'DEX'));
     const paid=applyPools(state,{type:'SpendAP',amount:cost});if(!paid.ok)return {...paid,message:'Drinking costs '+cost+' AP.'};
     const patch={...used.patch,...paid.patch};return {...used,state:{...state,...patch},patch,events:[...paid.events,...used.events],message:'Drank one item for '+cost+' AP.'};
   }
   if(command.type==='DrawWeapon'){
     const item=(state.items||[]).find(it=>it.id===command.weaponId);
     if(!item||!['onehand','twohand'].includes(item.type))return {ok:false,error:'WEAPON_NOT_FOUND',message:'Choose a weapon.'};
     const rules=window.WBCombat.weaponRules(state,item),cost=(Array.isArray(item.signatures)?item.signatures:[]).includes('Quickdraw')?0:window.WBCombat.abilityApCost(2,window.WBCombat.currentModifier(state,'DEX'));
     const paid=applyPools(state,{type:'SpendAP',amount:cost});if(!paid.ok)return {...paid,message:'Drawing/swapping costs '+cost+' AP.'};
     const slot=rules.props.includes('Strapped')?'strapped':rules.twoHanded?'main':command.slot==='off'?'off':'main';
     const equip={...record(state.equip)};for(const key of Object.keys(equip))if(equip[key]===item.id)delete equip[key];
     equip[slot]=item.id;if(rules.twoHanded)delete equip.off;
     if(slot==='off'){const main=(state.items||[]).find(it=>it.id===equip.main);if(main&&window.WBCombat.weaponRules(state,main).twoHanded)delete equip.main;}
     const patch={...paid.patch,equip,equipmentProfiles:copy(state.equipmentProfiles||{})},next={...state,...patch};
     window.WBEquipment.capture(next);patch.equipmentProfiles=next.equipmentProfiles;
     return {...paid,state:next,patch,message:'Drew/swapped '+item.name+' for '+cost+' AP.'};
   }
   if(command.type==='ReloadWeapon'){
     const item=(state.items||[]).find(it=>it.id===command.weaponId),capacity=item&&window.WBCombat.weaponRules(state,item).loading;
     if(!capacity)return {ok:false,error:'NOT_LOADING',message:'Choose a Loading weapon.'};
     const cost=window.WBCombat.abilityApCost(5,window.WBCombat.currentModifier(state,'DEX'));
     const paid=applyPools(state,{type:'SpendAP',amount:cost});if(!paid.ok)return {...paid,message:'Reload costs '+cost+' AP.'};
     const patch={...paid.patch,weaponShots:{...record(state.weaponShots),[item.id]:capacity}};
     return {...paid,state:{...state,...patch},patch,message:'Reloaded '+item.name+' for '+cost+' AP.'};
   }
   if(command.type==='BeginWeaponAttack')return beginWeaponAttack(state,command);
   if(command.type==='UseEquipmentAbility'||command.type==='SetEquipmentAbilityUses')return applyEquipmentAbility(state,command);
   if(consumableTypes.has(command.type))return applyConsumable(state,command);
   if(['RecordRoll','ReviseRoll','ClearRollHistory'].includes(command.type))return window.WBRolls.apply(state,command);
   const resources=(Array.isArray(state.resources)?state.resources:[]).map(r=>({...r}));
   const next={...state,resources};
   const before=derive(state).resources;
   const type=command.type;
   const r=resources.find(x=>x&&x.id===command.resourceId);
   if(['SpendResource','GainResource','FillResource','SetResourceCurrent','SetResourceMaximum'].includes(type)&&!r)
     return {ok:false,error:'RESOURCE_NOT_FOUND'};
   if(['SpendResource','GainResource'].includes(type)&&
     (command.amount==null||command.amount===''||!Number.isFinite(Number(command.amount))||
      Number(command.amount)<0))return {ok:false,error:'INVALID_AMOUNT'};
   if(['SetResourceCurrent','SetResourceMaximum'].includes(type)&&
     (command.value==null||command.value===''||!Number.isFinite(Number(command.value))||
      Number(command.value)<0))return {ok:false,error:'INVALID_VALUE'};
   if(type==='SpendResource')r.current=Math.max(0,number(r.current)-number(command.amount));
   else if(type==='GainResource')
     r.current=Math.max(number(r.current),Math.min(before[r.id].effectiveMax,number(r.current)+number(command.amount)));
   else if(type==='FillResource')
     r.current=Math.max(number(r.current),before[r.id].effectiveMax);
   else if(type==='SetResourceCurrent')
     r.current=Math.min(before[r.id].effectiveMax,number(command.value));
   else if(type==='SetResourceMaximum'){
     r.max=Math.max(1,number(command.value,1));
     const cap=maximum(next,r);
     if(cap<before[r.id].effectiveMax)r.current=Math.min(number(r.current),cap);
   } else if(type==='ResourceTurnStart'){
     for(const pool of resources){
       if(!pool||!pool.regen)continue;
       const ids=Array.isArray(pool.loadoutIds)?pool.loadoutIds:[];
       if((state.abilityLoadouts||[]).length&&ids.length&&!ids.includes(state.activeAbilityLoadoutId))
         continue;
       const cap=maximum(next,pool);
       if(number(pool.current)<cap)
         pool.current=Math.min(cap,number(pool.current)+number(pool.regen));
     }
   } else if(type==='ResourceLongRest'){
     for(const pool of resources)if(pool&&pool.refillOnRest!==false)
       pool.current=Math.max(1,number(pool.max,1));
   } else if(type==='ReconcileResourceMaximums'){
     // Only an actual state transition can lower excess, never loading/drawing.
     const old=command.previousMaxima||{};
     for(const pool of resources){
       if(!pool||!Object.prototype.hasOwnProperty.call(old,pool.id))continue;
       const prior=Number(old[pool.id]),cap=maximum(next,pool);
       if(Number.isFinite(prior)&&cap<prior)
         pool.current=Math.min(number(pool.current),cap);
     }
   } else return {ok:false,error:'UNKNOWN_COMMAND'};
   const after=derive(next).resources,events=[];
   for(const pool of resources){
     if(!pool||!before[pool.id])continue;
     const a=after[pool.id],b=before[pool.id];
     if(b.current!==a.current||b.baseMax!==a.baseMax)
       events.push({type:'resource.changed',resourceId:pool.id,
         previous:b.current,current:a.current,
         source:type==='SetResourceCurrent'?'correction':'command'});
   }
   return {ok:true,state:next,events,log:events.map(e=>
     type+': '+e.resourceId+' '+e.previous+' -> '+e.current)};
 }
 function vitalMaximums(state){return {health:health(state).max,mana:derive(state).mana.max};}
 function reconcileVitals(state,previous,correction=false){
   const current=vitalMaximums(state),patch={},fields={...record(state.fields)},events=[];
   for(const [pool,key] of [['health','hpCur'],['mana','mpCur']]){
     const old=previous&&previous[pool],max=current[pool];
     if(!Number.isFinite(old)||!Number.isFinite(max)||old===max)continue;
     const before=finite(fields[key])?numeric(fields[key]):null;
     if(before!=null){fields[key]=String(before+max-old);patch.fields=fields;}
     if(pool==='health'){
       const h=health({...state,...patch});
       if(h.current!=null&&h.current<=0){
         if(before!=null&&before>0||!h.down)patch.down={mercy:false,stable:false};
         else patch.down=h.down;
         fields.concOn='0';patch.fields=fields;
       }else{patch.down=null;if(before!=null&&before<=0&&h.current>0&&!correction)patch.trauma=health(state).trauma+1;}
       if(max>old&&!correction){const statuses=(state.statuses||[]).filter(s=>String(s.preset||s.name).toLowerCase()!=='bleeding');if(statuses.length!==(state.statuses||[]).length)patch.statuses=statuses;}
     }
     events.push({type:pool+'.maximum.changed',previous:old,current:max,delta:max-old,source:correction?'correction':'maximum'});
   }
   return {ok:true,state:{...state,...patch},patch,events,log:[],message:'Pool maxima updated.'};
 }
 function apply(state,command){
   if(command&&command.type==='ReconcileVitalMaximums')return reconcileVitals(state,command.previous);
   const result=applyRaw(state,command);
   if(!result.ok)return result;
   if(['ActivateAbility','EnterForm','SelectPortrait','AdvanceAbilityTurn','RestAbilities','SetHealthMaximum','SetManaMaximum',
      'SetAbilityTracker','ResetAbilityTracker','EndAbilityEffect','DrawWeapon'].includes(command.type)){
     const adjusted=reconcileVitals(result.state,vitalMaximums(state),command.type.startsWith('Set'));
     return {...result,state:adjusted.state,patch:{...result.patch,...adjusted.patch},...(result.healthPlan?{healthPlan:{...result.healthPlan,after:health(adjusted.state).current,threshold:health(adjusted.state).threshold}}:{}),events:[...result.events.map(event=>event.type==='mana.changed'?{...event,current:derive(adjusted.state).mana}:event),...adjusted.events]};
   }
   return result;
 }
 window.WBCharacter={derive,apply,health,healthTrackingPatch,consumables,consumableQuantity,vitalMaximums};
})();
